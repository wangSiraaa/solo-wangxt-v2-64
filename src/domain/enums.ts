/**
 * 行政流程演示用枚举。
 * 注意：本系统使用虚构量表 FCRS，仅用于演示评估/复核/告知/费用的服务端流程，
 * 不构成医疗诊断或真实护理建议。
 */

/** 评估单整体状态机：
 * INCOMPLETE           必填项缺失，未自动定级，等待补录
 * PENDING_REVIEW       两位评估员等级冲突，等待管理复核
 * IN_REVIEW            复核员已领取/处理中
 * PENDING_CONFIRMATION 等级待机构最终确认（评分一致或复核完成后）
 * CONFIRMED            已确认：已生成告知记录，并按费用规则处理生效区间
 */
export enum AssessmentStatus {
  INCOMPLETE = 'INCOMPLETE',
  PENDING_REVIEW = 'PENDING_REVIEW',
  IN_REVIEW = 'IN_REVIEW',
  CONFIRMED = 'CONFIRMED',
  PENDING_CONFIRMATION = 'PENDING_CONFIRMATION',
}

/** 虚构量表等级：数字越大护理依赖程度越高（仅演示） */
export enum CareLevel {
  L0 = 'L0',
  L1 = 'L1',
  L2 = 'L2',
  L3 = 'L3',
}

export enum NotificationStatus {
  /** 已生成，尚未尝试送达 */
  PENDING = 'PENDING',
  /** 送达失败（已记录，可重试） */
  DELIVERY_FAILED = 'DELIVERY_FAILED',
  /** 已送达，家属尚未签收确认 */
  DELIVERED = 'DELIVERED',
  /** 家属已签收确认 */
  ACKNOWLEDGED = 'ACKNOWLEDGED',
}

/** 评估单的确认方式 */
export enum ConfirmationKind {
  /** 两位评估员结果一致，无需复核，直接进入确认 */
  AGREED = 'AGREED',
  /** 冲突经管理复核后确认 */
  REVIEWED = 'REVIEWED',
}
