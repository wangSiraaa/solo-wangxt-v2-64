/**
 * 端到端冒烟验证（无前端，直接打 API）：
 *  A 必填缺失 -> INCOMPLETE，不自动定级，且禁止确认
 *  B 两位评估员冲突 -> PENDING_REVIEW；复核员试取高等级被驳回；按量表重算裁定通过
 *  C 一致结果 -> PENDING_CONFIRMATION，接口能解释评分来源
 *  D 月中升级（2024 闰年 2 月）：L1 截断至 02-14，L2 自 02-15 生效
 *  E 闰月按天分段：14×200 + 15×280 = 7000.00
 *  F 重复确认请求：同键重放首次结果，不产生新区间/新告知；新键再确认已确认单 -> 409
 *  G 同一天重叠生效等级：应用层 + 数据库 gist EXCLUDE 双重拒绝
 *  H 送达失败 / 尚未送达分别记录；失败可换地址重试；送达后才能签收
 *  I NA 条目按量表定义剔除分母（MED=NA：1/11 而非 1/13）
 */
const BASE = process.env.BASE || 'http://127.0.0.1:3000';

let failures = 0;
const ok = (cond, name, extra) => {
  console.log(`${cond ? '✅' : '❌'} ${name}`);
  if (!cond) {
    failures++;
    if (extra !== undefined) console.log('   ', typeof extra === 'string' ? extra : JSON.stringify(extra));
  }
};
const req = async (method, url, body, headers = {}) => {
  const res = await fetch(BASE + url, {
    method,
    headers: body ? { 'content-type': 'application/json', ...headers } : headers,
    body: body ? JSON.stringify(body) : undefined,
  });
  const json = await res.json().catch(() => ({}));
  return { status: res.status, json };
};

const L1_A = { MOBIL: 'CANE', TRANSFER: 'MIN', EAT: 'SETUP', TOILET: 'MIN', BATHE: 'INDEP', MED: 'REMIND' };
const L1_B = { MOBIL: 'CANE', TRANSFER: 'MIN', EAT: 'SETUP', TOILET: 'MIN', BATHE: 'ASSIST', MED: 'REMIND' };
// 复核员裁定答卷（重算 = 8/13 = 61.54% -> L2）
const REVIEW_L2 = { MOBIL: 'ASSIST', TRANSFER: 'MIN', EAT: 'FEED', TOILET: 'MIN', BATHE: 'ASSIST', MED: 'REMIND' };
// 两位一致 L2（9/13 = 69.23%）
const L2 = { MOBIL: 'ASSIST', TRANSFER: 'FULL', EAT: 'FEED', TOILET: 'MIN', BATHE: 'ASSIST', MED: 'REMIND' };
const L3 = { MOBIL: 'BED', TRANSFER: 'FULL', EAT: 'FEED', TOILET: 'FULL', BATHE: 'FULL', MED: 'ADMIN' };

const run = async () => {
  const { json: residents } = await req('GET', '/residents');
  const r1 = residents.find((r) => r.name === '张桂英');
  const r2 = residents.find((r) => r.name === '李建国');
  const r3 = residents.find((r) => r.name === '王秀兰');

  // ---------- A 必填缺失 ----------
  let { json: aMiss } = await req('POST', '/assessments', {
    residentId: r3.id,
    familyContact: { name: '王芳', channel: 'SMS', address: '13800000000' },
    assessors: [
      { assessorName: '评估员甲', answers: { MOBIL: 'CANE', TRANSFER: 'MIN' } }, // 缺 EAT/TOILET/BATHE
      { assessorName: '评估员乙', answers: { MOBIL: 'INDEP', TRANSFER: 'INDEP', EAT: 'INDEP', TOILET: 'INDEP', BATHE: 'INDEP' } },
    ],
  });
  ok(aMiss.status === 'INCOMPLETE', 'A1 必填项缺失 -> INCOMPLETE，不自动定级', aMiss);
  ok(aMiss.confirmedLevel === null && aMiss.proposedLevel === null, 'A2 缺失时无任何等级', aMiss);
  ok(
    aMiss.missingFields.map((m) => m.itemCode).sort().join() === 'BATHE,EAT,TOILET',
    'A3 缺失字段被逐项记录（评估员/条目）',
    aMiss.missingFields,
  );
  const { status: confirmBlocked } = await req('POST', `/assessments/${aMiss.id}/confirm`, { effectiveDate: '2024-03-01' });
  ok(confirmBlocked === 400, 'A4 INCOMPLETE 状态禁止确认', { status: confirmBlocked });

  // ---------- B 冲突 -> 复核 ----------
  const { json: conflict } = await req('POST', '/assessments', {
    residentId: r2.id,
    familyContact: { name: '李大伟', channel: 'SMS', address: '13900000000' },
    assessors: [
      { assessorName: '评估员甲', answers: L1_A },
      { assessorName: '评估员乙', answers: L3 }, // 13/13 = 100% L3
    ],
  });
  ok(conflict.status === 'PENDING_REVIEW', 'B1 两位评估员等级冲突 -> PENDING_REVIEW', conflict);
  const levels = conflict.scoreResults.map((s) => `${s.level}(${s.percentage}%)`);
  ok(levels.join() === 'L1(38.46%),L3(100%)', 'B2 两份原始评分分别保留（不取较高等级）', levels);

  // 复核员试图直接裁 L3，但答卷重算只有 L2 -> 驳回
  const { status: rejectHigh, json: rejectBody } = await req('POST', `/assessments/${conflict.id}/review`, {
    reviewerName: '护理部主任',
    decidedLevel: 'L3',
    basisAnswers: REVIEW_L2,
    rationale: '情况严重，倾向按较高等级处理以保险起见（不应被接受）',
  });
  ok(rejectHigh === 400, 'B3 复核裁定与量表重算不一致 -> 驳回（不能简单取较高等级）', rejectBody.message);

  const { json: reviewed } = await req('POST', `/assessments/${conflict.id}/review`, {
    reviewerName: '护理部主任',
    decidedLevel: 'L2',
    basisAnswers: REVIEW_L2,
    rationale: '结合两次入户走访：移动需一人扶助、进食需喂食与第二次观察一致，其余取两位评估员交集。',
  });
  ok(
    reviewed.status === 'PENDING_CONFIRMATION' && reviewed.proposedLevel === 'L2',
    'B4 复核按重算等级 L2（61.54%）进入待确认',
    reviewed,
  );

  // ---------- C 一致结果 + 评分来源 ----------
  const { json: agreed } = await req('POST', '/assessments', {
    residentId: r2.id,
    familyContact: { name: '李大伟', channel: 'SMS', address: '13900000000' },
    assessors: [
      { assessorName: '评估员甲', answers: L1_A },
      { assessorName: '评估员乙', answers: L1_B },
    ],
  });
  ok(agreed.status === 'PENDING_CONFIRMATION' && agreed.proposedLevel === 'L1', 'C1 一致评分 -> PENDING_CONFIRMATION / L1', agreed);
  const src = agreed.scoreResults[0];
  ok(
    src.rawScore === 5 && src.denominator === 13 && src.percentage === 38.46 && src.level === 'L1',
    `C2 接口可解释评分来源（${src.rawScore}/${src.denominator}=${src.percentage}%，逐项明细见 scoreResults.details）`,
    src,
  );

  // 幂等键语义：同键第二次确认重放
  const cConfirm1 = await req('POST', `/assessments/${agreed.id}/confirm`, { effectiveDate: '2024-02-01' }, { 'x-idempotency-key': 'idem-c-001' });
  ok(cConfirm1.status === 201 && cConfirm1.json.confirmedLevel === 'L1', 'C3 首次确认成功（r2 首个生效区间，HTTP 201）', cConfirm1.json);
  const cConfirm2 = await req('POST', `/assessments/${agreed.id}/confirm`, { effectiveDate: '2024-02-01' }, { 'x-idempotency-key': 'idem-c-001' });
  ok(cConfirm2.json.replayed === true, 'C4 同一幂等键重复确认 -> replayed=true', cConfirm2.json);

  // ---------- D/E 月中升级 + 闰月分段 ----------
  const { json: upgraded } = await req('POST', '/assessments', {
    residentId: r1.id,
    familyContact: { name: '张小英', channel: 'SMS', address: '13700000000' },
    assessors: [
      { assessorName: '评估员甲', answers: L2 },
      { assessorName: '评估员乙', answers: L2 },
    ],
  });
  ok(upgraded.status === 'PENDING_CONFIRMATION' && upgraded.proposedLevel === 'L2', 'D1 月中升级评估 L2 待确认', upgraded);

  const { json: confirmed } = await req('POST', `/assessments/${upgraded.id}/confirm`, { effectiveDate: '2024-02-15' });
  ok(confirmed.confirmedLevel === 'L2' && confirmed.fee.outcome === 'ACTIVATED', 'D2 确认后 L2 生效', confirmed);
  ok(
    confirmed.fee.truncatedPeriod?.careLevel === 'L1' && confirmed.fee.truncatedPeriod.validTo === '2024-02-14',
    'D3 旧 L1 开放区间截断至 2024-02-14（无空档、无重叠）',
    confirmed.fee,
  );
  ok(
    confirmed.fee.period.validFrom === '2024-02-15' && confirmed.fee.period.validTo === null,
    'D4 新 L2 区间自 2024-02-15 开放',
    confirmed.fee,
  );

  const { json: quote } = await req('GET', `/residents/${r1.id}/fee-quote?month=2024-02`);
  ok(quote.monthStart === '2024-02-01' && quote.monthEnd === '2024-02-29', 'E1 闰月 2024-02 共 29 天', quote);
  const segSummary = quote.segments.map((s) => `${s.careLevel}:${s.validFrom}~${s.validTo}=${s.days}天×${s.dailyRate}=${s.amount}`);
  ok(
    quote.segments.length === 2 &&
      quote.segments[0].days === 14 && quote.segments[0].amount === '2800.00' &&
      quote.segments[1].days === 15 && quote.segments[1].amount === '4200.00' &&
      quote.totalAmount === '7000.00',
    `E2 按天分段 14×200+15×280=7000.00 [${segSummary.join(' | ')}]`,
    quote,
  );
  ok(
    quote.segments[0].sourceAssessmentId === null && quote.segments[1].sourceAssessmentId === upgraded.id,
    'E3 每段标注来源评估单（种子区间为 null，升级段指向本次评估单）',
    quote.segments.map((s) => s.sourceAssessmentId),
  );

  // ---------- F 重复确认请求 ----------
  const { json: replay1 } = await req('POST', `/assessments/${upgraded.id}/confirm`, { effectiveDate: '2024-02-15' });
  ok(
    replay1.replayed === true && replay1.confirmedLevel === 'L2' && replay1.fee.period.validFrom === '2024-02-15',
    'F1 重复确认重放首次结果（replayed=true，返回首次区间）',
    replay1,
  );
  const replayNewKey = await req('POST', `/assessments/${upgraded.id}/confirm`, { effectiveDate: '2024-02-15' }, { 'x-idempotency-key': 'brand-new-key' });
  ok(replayNewKey.status === 409, 'F2 已确认评估单换新幂等键再次确认 -> 409（不重复生效）', replayNewKey.json.message);
  const { json: periodsAfterReplay } = await req('GET', `/residents/${r1.id}/fee-periods`);
  ok(periodsAfterReplay.length === 2, 'F3 重放/拒绝都不产生新费用区间', periodsAfterReplay);
  const { json: notesAfterReplay } = await req('GET', `/assessments/${upgraded.id}/notifications`);
  ok(notesAfterReplay.length === 1, 'F4 重放不重复生成告知记录', notesAfterReplay);

  // ---------- G 同一天重叠生效等级 ----------
  const { json: ovA } = await req('POST', '/assessments', {
    residentId: r1.id,
    familyContact: { name: '张小英', channel: 'SMS', address: '13700000000' },
    assessors: [
      { assessorName: '评估员甲', answers: L1_A },
      { assessorName: '评估员乙', answers: L1_B },
    ],
  });
  const closedHit = await req('POST', `/assessments/${ovA.id}/confirm`, { effectiveDate: '2024-02-10' });
  ok(
    (closedHit.status === 400 || closedHit.status === 409) && /同等级|重叠/.test(closedHit.json.message || ''),
    'G1 生效日落入已截止区间（同等级也重叠）-> 拒绝',
    closedHit.json.message,
  );

  const { json: ovB } = await req('POST', '/assessments', {
    residentId: r1.id,
    familyContact: { name: '张小英', channel: 'SMS', address: '13700000000' },
    assessors: [
      { assessorName: '评估员甲', answers: L2 },
      { assessorName: '评估员乙', answers: L2 },
    ],
  });
  const sameDay = await req('POST', `/assessments/${ovB.id}/confirm`, { effectiveDate: '2024-02-15' });
  ok(
    (sameDay.status === 400 || sameDay.status === 409) && /当天已有|重叠/.test(sameDay.json.message || ''),
    'G2 同日插入第二个生效等级 -> 应用层拒绝',
    sameDay.json.message,
  );

  const { json: periodsAfterG } = await req('GET', `/residents/${r1.id}/fee-periods`);
  ok(
    periodsAfterG.length === 2 && periodsAfterG[0].validTo === '2024-02-14' && periodsAfterG[1].validFrom === '2024-02-15',
    'G3 被拒绝后区间保持 L1[..,02-14] + L2[02-15,..]',
    periodsAfterG,
  );
  const { json: quoteAfter } = await req('GET', `/residents/${r1.id}/fee-quote?month=2024-02`);
  ok(quoteAfter.totalAmount === '7000.00', 'G4 拒绝后费用分段保持 7000.00 不变', quoteAfter);

  // ---------- H 送达失败 / 尚未送达 / 重试 / 签收 ----------
  const { json: failAssess } = await req('POST', '/assessments', {
    residentId: r3.id,
    familyContact: { name: '王芳', channel: 'EMAIL', address: 'fail@example.com' },
    assessors: [
      { assessorName: '评估员甲', answers: L1_A },
      { assessorName: '评估员乙', answers: L1_B },
    ],
  });
  const { json: failConfirm } = await req('POST', `/assessments/${failAssess.id}/confirm`, { effectiveDate: '2024-03-01' });
  ok(
    failConfirm.notification.status === 'DELIVERY_FAILED' &&
      !!failConfirm.notification.lastError &&
      failConfirm.fee.outcome === 'ACTIVATED',
    'H1 送达失败独立记录（含失败原因），费用生效不受送达结果影响',
    failConfirm,
  );
  const { json: failedNotes } = await req('GET', `/assessments/${failAssess.id}/notifications`);
  const noteId = failedNotes[0].id;
  const { status: ackBlocked } = await req('POST', `/notifications/${noteId}/acknowledge`, {});
  ok(ackBlocked === 400, 'H2 送达失败时不能签收（送达与签收分别记录）', { status: ackBlocked });
  const { json: retried } = await req('POST', `/notifications/${noteId}/retry`, { newAddress: 'wangfang@example.com' });
  ok(retried.status === 'DELIVERED' && retried.attemptCount === 2, 'H3 更换地址后重试送达成功', retried);
  const { json: acked } = await req('POST', `/notifications/${noteId}/acknowledge`, {});
  ok(acked.status === 'ACKNOWLEDGED' && !!acked.acknowledgedAt, 'H4 家属签收独立记录时间', acked);

  // 尚未送达（PENDING）：用一张新的 L2 评估做月中升级，告知模拟“已发送未送达”
  const { json: laterAssess } = await req('POST', '/assessments', {
    residentId: r3.id,
    familyContact: { name: '王芳', channel: 'SMS', address: 'later-pending' },
    assessors: [
      { assessorName: '评估员甲', answers: L2 },
      { assessorName: '评估员乙', answers: L2 },
    ],
  });
  const { json: laterConfirm } = await req('POST', `/assessments/${laterAssess.id}/confirm`, { effectiveDate: '2024-03-05' });
  ok(
    laterConfirm.notification.status === 'PENDING' && laterConfirm.notification.attemptCount === 1,
    'H5 已生成但尚未送达 -> PENDING 与失败/送达分开记录',
    laterConfirm,
  );
  const { json: noNotes } = await req('GET', `/assessments/${aMiss.id}/notifications`);
  ok(Array.isArray(noNotes) && noNotes.length === 0, 'H6 尚未确认等级的评估单 -> 无告知记录', noNotes);

  // ---------- I NA 剔除分母 ----------
  const { json: naAssess } = await req('POST', '/assessments', {
    residentId: r3.id,
    familyContact: { name: '王芳', channel: 'SMS', address: '13800000001' },
    assessors: [
      { assessorName: '评估员甲', answers: { MOBIL: 'INDEP', TRANSFER: 'INDEP', EAT: 'SETUP', TOILET: 'INDEP', BATHE: 'INDEP', MED: 'NA' } },
      { assessorName: '评估员乙', answers: { MOBIL: 'INDEP', TRANSFER: 'INDEP', EAT: 'SETUP', TOILET: 'INDEP', BATHE: 'INDEP', MED: 'NA' } },
    ],
  });
  const na = naAssess.scoreResults[0];
  ok(
    na.naItems.join() === 'MED' && na.denominator === 11 && na.countedItems === 5 &&
      na.rawScore === 1 && na.percentage === 9.09 && na.level === 'L0',
    'I1 MED=NA 按量表定义剔除分母（1/11=9.09% L0，而非 1/13=7.69%）',
    { naItems: na.naItems, denominator: na.denominator, rawScore: na.rawScore, percentage: na.percentage, level: na.level },
  );

  // ---------- G5 数据库 EXCLUDE 兜底（绕过应用层直接 SQL） ----------
  const { Client } = await import('pg');
  const client = new Client({ host: '/tmp', port: 55432, user: 'app', database: 'eldercare' });
  await client.connect();
  let dbCode = null;
  try {
    await client.query(
      `INSERT INTO fee_periods(resident_id, valid_from, valid_to, care_level)
       VALUES ($1,'2024-02-10','2024-02-12','L0')`,
      [r1.id],
    );
  } catch (e) {
    dbCode = e.code;
  } finally {
    await client.end();
  }
  ok(dbCode === '23P01', `G5 直接 SQL 插入重叠区间被 gist EXCLUDE 拒绝（SQLSTATE 23P01，实际 ${dbCode}）`);

  console.log(failures === 0 ? '\n全部场景通过 🎉' : `\n${failures} 个断言失败`);
  process.exit(failures === 0 ? 0 : 1);
};

run().catch((e) => {
  console.error('冒烟脚本异常:', e);
  process.exit(1);
});
