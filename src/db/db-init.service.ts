import { Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import * as fs from 'fs';
import * as path from 'path';

/**
 * 虚构量表 FCRS-1.0 示例数据。
 * 6 个条目：前 5 条必填，MED（用药自我管理）为可选条目（可标 NA）。
 * NA 策略由量表定义为 EXCLUDE_FROM_DENOMINATOR：NA 条目剔除出分子与分母。
 */
@Injectable()
export class DbInitService implements OnApplicationBootstrap {
  private readonly logger = new Logger(DbInitService.name);

  constructor(@InjectDataSource() private readonly dataSource: DataSource) {}

  async onApplicationBootstrap(): Promise<void> {
    const sql = fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf8');
    await this.dataSource.query(sql);
    this.logger.log('数据库结构已就绪（含 gist EXCLUDE 重叠约束）');
    await this.seed();
  }

  private async seed(): Promise<void> {
    await this.dataSource.transaction(async (manager) => {
      const rows = await manager.query('SELECT 1 FROM residents LIMIT 1');
      if (rows.length > 0) {
        this.logger.log('种子数据已存在，跳过');
        return;
      }

      const scale = {
        code: 'FCRS-1.0',
        title: '虚构护理依赖评定表 FCRS（仅行政流程演示，非医疗用途）',
        naPolicy: 'EXCLUDE_FROM_DENOMINATOR',
        items: [
          {
            code: 'MOBIL',
            label: '床椅以外的移动能力（虚构条目）',
            required: true,
            options: [
              { key: 'INDEP', label: '可独立行走', score: 0 },
              { key: 'CANE', label: '需助行器具', score: 1 },
              { key: 'ASSIST', label: '需一人扶助', score: 2 },
              { key: 'BED', label: '基本卧床', score: 3 },
            ],
          },
          {
            code: 'TRANSFER',
            label: '床椅转移（虚构条目）',
            required: true,
            options: [
              { key: 'INDEP', label: '独立完成', score: 0 },
              { key: 'MIN', label: '少量扶助', score: 1 },
              { key: 'FULL', label: '全程扶助', score: 2 },
            ],
          },
          {
            code: 'EAT',
            label: '进食协助（虚构条目）',
            required: true,
            options: [
              { key: 'INDEP', label: '独立进食', score: 0 },
              { key: 'SETUP', label: '需备餐/提醒', score: 1 },
              { key: 'FEED', label: '需喂食', score: 2 },
            ],
          },
          {
            code: 'TOILET',
            label: '如厕协助（虚构条目）',
            required: true,
            options: [
              { key: 'INDEP', label: '独立如厕', score: 0 },
              { key: 'MIN', label: '需提醒/部分协助', score: 1 },
              { key: 'FULL', label: '全程协助', score: 2 },
            ],
          },
          {
            code: 'BATHE',
            label: '洗浴协助（虚构条目）',
            required: true,
            options: [
              { key: 'INDEP', label: '独立洗浴', score: 0 },
              { key: 'ASSIST', label: '需协助', score: 1 },
              { key: 'FULL', label: '全程协助', score: 2 },
            ],
          },
          {
            code: 'MED',
            label: '用药自我管理（虚构条目，可选，可判不适用）',
            required: false,
            options: [
              { key: 'INDEP', label: '可自行管药', score: 0 },
              { key: 'REMIND', label: '需提醒', score: 1 },
              { key: 'ADMIN', label: '需代为给药', score: 2 },
              { key: 'NA', label: '不适用（按量表定义剔除出分母）', score: 0 },
            ],
          },
        ],
        bands: [
          { minInclusive: 0, maxExclusive: 34, level: 'L0', label: '一级自理（虚构）' },
          { minInclusive: 34, maxExclusive: 58, level: 'L1', label: '二级协助（虚构）' },
          { minInclusive: 58, maxExclusive: 82, level: 'L2', label: '三级照护（虚构）' },
          { minInclusive: 82, maxExclusive: 100.001, level: 'L3', label: '四级专护（虚构）' },
        ],
      };

      await manager.query(
        `INSERT INTO scale_versions(code, title, items, bands, na_policy)
         VALUES ($1,$2,$3,$4,$5)`,
        [scale.code, scale.title, JSON.stringify(scale.items), JSON.stringify(scale.bands), scale.naPolicy],
      );

      const residents = await manager.query(
        `INSERT INTO residents(name, room_no, admission_date) VALUES
          ('张桂英','A101','2024-01-01'),
          ('李建国','B202','2024-01-15'),
          ('王秀兰','A103','2024-02-01')
         RETURNING id, name`,
      );

      // 费率卡（示例：元/天）
      await manager.query(
        `INSERT INTO fee_rate_cards(care_level, valid_from, daily_rate) VALUES
          ('L0','2024-01-01',120.00),
          ('L1','2024-01-01',200.00),
          ('L2','2024-01-01',280.00),
          ('L3','2024-01-01',360.00)`,
      );

      // r1 的初始 L1 生效区间（月中升级时会被截断到 2024-02-14）
      await manager.query(
        `INSERT INTO fee_periods(resident_id, valid_from, valid_to, care_level)
         VALUES ($1,'2024-01-01',NULL,'L1')`,
        [residents[0].id],
      );

      this.logger.log(
        `种子数据已写入：量表 ${scale.code}，3 位老人（${residents
          .map((r) => `${r.name}=${r.id}`)
          .join(', ')}），4 档费率卡，r1 初始 L1 区间`,
      );
    });
  }
}
