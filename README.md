# 养老机构 评估→复核→告知→费用生效 服务端流程（NestJS + PostgreSQL）

> **免责声明**：本工程使用**虚构量表 FCRS（Fictional Care Rating Scale）**与虚构费率，
> 仅用于演示行政服务端流程（量表评估、管理复核、家属告知、费用生效），
> **不构成医疗诊断、护理分级结论或真实护理建议**，不得用于真实机构定价或照护决策。

无前端，仅提供 HTTP API。

## 流程与规则落点

| 要求 | 实现位置 |
| --- | --- |
| 必填项缺失不得自动定级 | `src/scoring/scoring.engine.ts`：必填条目缺失/NA 即收集 `missingFields`，状态置 `INCOMPLETE`，不产生等级；确认接口拒绝该状态 |
| 不适用项如何影响分母由量表定义 | 量表 `na_policy = EXCLUDE_FROM_DENOMINATOR`：NA/可选未答条目同时剔除分子与分母；条目满分取该条目原始选项最高分值 |
| 两位评估员冲突进入复核，不取较高等级 | 等级集合 >1 → `PENDING_REVIEW`；复核必须提交**裁定答卷**，服务端按同一量表重算，裁定等级 ≠ 重算等级（如想直接取 L3）一律驳回；必须写书面理由 |
| 等级确认后生成告知记录 | `ConfirmationService` 在同一事务内：费用生效 → 落确认等级 → 才生成家属告知 |
| 送达失败与尚未确认分别记录 | 告知状态机 `PENDING / DELIVERY_FAILED / DELIVERED / ACKNOWLEDGED`：未确认的评估单没有告知记录；失败保留原因与次数，可换地址重试；送达与签收是两个独立动作；送达结果不影响费用生效 |
| 费用生效按机构示例规则独立判断 | `src/fees/fee.service.ts`：不早于入住日、落点须在连续区间内；月中升级时把旧开放区间截断到生效日前一天；落已截止区间/同日重叠 → 拒绝 |
| 同一天不能出现重叠生效等级 | 双保险：应用层逐日判断 + PostgreSQL `EXCLUDE USING gist (resident_id WITH =, daterange(...) WITH &&)`（SQLSTATE 23P01） |
| decimal.js 按天分段费用 | `src/fees/fee.calculator.ts`：闭区间自然日数（UTC 日期差，闰月自动 29 天）× 当日有效费率卡，`HALF_UP` 到分；账单月有任意无等级空档日则拒绝计费 |
| 重复确认请求 | `IdempotencyRecord` + `x-idempotency-key`（缺省按评估单）：同键重放首次结果（`replayed:true`），不产生新区间/新告知；已确认单换新键再确认 → 409；事务内行锁 + 唯一键兜底并发 |
| 接口能解释评分来源与费用分段 | 评估返回保留两份原始选项作答与逐项 `details`（选项 key、分值、条目满分、是否计入分母、NA 清单、原始分/分母/百分比/等级）；费用报价返回每段起止日、天数、日单价、小计、来源评估单、合计 |

### 状态机

```
两位评估员提交
  ├─ 任一必填缺失/无法定级 ──> INCOMPLETE（不自动定级，可补录重提）
  ├─ 两人等级冲突          ──> PENDING_REVIEW
  │                            └─ 复核员提交裁定答卷(重算校验+书面理由)
  │                                 ├─ 裁定≠重算：驳回，仍在 PENDING_REVIEW
  │                                 └─ 一致：PENDING_CONFIRMATION
  └─ 两人等级一致          ──> PENDING_CONFIRMATION
                                   └─ POST /confirm（机构示例规则判费用生效）
                                        └─> CONFIRMED + 家属告知记录（尝试首次送达）
```

## 运行

环境无系统 PostgreSQL 时，可用随仓库脚本运行一个仅监听 Unix socket 的本地实例
（PostgreSQL 15 二进制由 Debian .deb 解压到 `.pgsql/`，不含在 git 中）：

```bash
npm install
npm run pg:start        # 首次需先初始化（见 scripts/pg-ctl.sh 同级的 .pgsql）
npm run build
npm start               # http://127.0.0.1:3000，启动时自动建表+种子
npm run smoke           # 端到端冒烟：全部规则场景
```

连接参数（默认）：`PGHOST=/tmp PGPORT=55432 PGUSER=app PGDATABASE=eldercare`，可用环境变量覆盖。
首次初始化命令（仅一次）：

```bash
mkdir -p .pgsql/debs && cd .pgsql/debs
apt-get download postgresql-15 postgresql-client-15 libpq5 postgresql-common
cd .. && for d in debs/*.deb; do dpkg-deb -x "$d" pg; done
export LD_LIBRARY_PATH=$PWD/pg/usr/lib/aarch64-linux-gnu:$PWD/pg/usr/lib/postgresql/15/lib
pg/usr/lib/postgresql/15/bin/initdb -D data -U app --auth=trust --encoding=UTF8 --locale=C
printf "listen_addresses = ''\nunix_socket_directories = '/tmp'\nport = 55432\n" >> data/postgresql.conf
```

## 种子数据

- 量表 `FCRS-1.0`：6 个虚构条目（5 必填 + 1 可选 `MED` 可 NA），等级带 L0–L3（34/58/82%）。
- 老人：张桂英（A101，2024-01-01 入住，预置 L1 开放区间）、李建国、王秀兰。
- 费率卡（元/天，示例）：L0=120, L1=200, L2=280, L3=360。

## API

| 方法 路径 | 说明 |
| --- | --- |
| `GET  /scales/:code` | 量表版本、原始选项、必填项、NA 分母策略、等级带 |
| `POST /assessments` | 两位评估员提交原始选项作答（body 见下） |
| `GET  /assessments/:id` | 评估单：两份原始作答 + 逐项评分明细 + 状态/滞留原因 |
| `POST /assessments/:id/review` | 管理复核：`reviewerName/decidedLevel/basisAnswers/rationale` |
| `POST /assessments/:id/confirm` | 确认等级 + 费用生效 + 生成告知；头 `x-idempotency-key` 可显式幂等 |
| `GET  /assessments/:id/notifications` | 告知记录（未确认单为空数组） |
| `POST /notifications/:id/retry` | 送达失败重试（可 `newAddress`） |
| `POST /notifications/:id/acknowledge` | 家属签收（未送达/失败时 400） |
| `GET  /residents/:id/fee-quote?month=2024-02` | 按天分段报价（decimal.js） |
| `GET  /residents/:id/fee-periods` | 生效区间（应逐日衔接、无重叠） |

送达模拟（告知地址前缀）：`fail`→送达失败；`later`→已发送未送达(PENDING)；其他→送达成功。

`POST /assessments` body 示例：

```json
{
  "residentId": "…uuid…",
  "familyContact": { "name": "张小英", "channel": "SMS", "address": "13700000000" },
  "assessors": [
    { "assessorName": "评估员甲", "answers": { "MOBIL": "CANE", "TRANSFER": "MIN", "EAT": "SETUP", "TOILET": "MIN", "BATHE": "INDEP", "MED": "REMIND" } },
    { "assessorName": "评估员乙", "answers": { "MOBIL": "CANE", "TRANSFER": "MIN", "EAT": "SETUP", "TOILET": "MIN", "BATHE": "ASSIST", "MED": "REMIND" } }
  ]
}
```

## 冒烟覆盖（`npm run smoke`）

A 必填缺失不自动定级且禁止确认 · B 冲突进复核/取高等级被驳回/重算裁定通过 ·
C 一致评分与评分来源解释 · D 月中升级（2024-02-15）旧区间截断 ·
E 闰月 29 天分段 14×200+15×280=7000.00 · F 重复确认重放/换新键 409/不产生重复数据 ·
G 同日重叠应用层拒绝 + 直接 SQL 被 gist EXCLUDE（23P01）拒绝 ·
H 送达失败/尚未送达/重试/签收分别记录，未确认无告知 · I NA 剔除分母（1/11=9.09% L0）。
