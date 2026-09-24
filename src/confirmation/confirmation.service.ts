import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { Assessment } from '../domain/assessment.entity';
import { ReviewDecision } from '../domain/review-decision.entity';
import { FamilyNotification } from '../domain/family-notification.entity';
import { IdempotencyRecord } from '../domain/idempotency-record.entity';
import {
  AssessmentStatus,
  CareLevel,
  ConfirmationKind,
  NotificationStatus,
} from '../domain/enums';
import { FeeService } from '../fees/fee.service';
import { NotificationService } from '../notification/notification.service';

export interface ConfirmationResponse {
  replayed: boolean;
  assessmentId: string;
  status: AssessmentStatus;
  confirmationKind: ConfirmationKind;
  confirmedLevel: CareLevel;
  levelSource: string;
  effectiveDate: string;
  fee: {
    outcome: string;
    message: string;
    period: { id: string; validFrom: string; validTo: string | null; careLevel: CareLevel } | null;
    truncatedPeriod: object | null;
  };
  notification: {
    id: string;
    status: NotificationStatus;
    attemptCount: number;
    lastError: string | null;
  };
  note: string;
}

@Injectable()
export class ConfirmationService {
  constructor(
    @InjectRepository(Assessment)
    private readonly assessments: Repository<Assessment>,
    @InjectRepository(ReviewDecision)
    private readonly reviews: Repository<ReviewDecision>,
    @InjectRepository(IdempotencyRecord)
    private readonly idempotency: Repository<IdempotencyRecord>,
    private readonly feeService: FeeService,
    private readonly notificationService: NotificationService,
    private readonly dataSource: DataSource,
  ) {}

  async confirm(
    assessmentId: string,
    effectiveDate: string,
    idempotencyKey?: string,
  ): Promise<ConfirmationResponse> {
    const key = (idempotencyKey || `confirm:${assessmentId}`).slice(0, 128);

    // 1) 幂等：重复确认请求重放首次结果
    const existing = await this.idempotency.findOne({ where: { key } });
    if (existing) {
      return { ...(existing.response as ConfirmationResponse), replayed: true };
    }

    return this.dataSource.transaction(
      async (manager): Promise<ConfirmationResponse> => {
        // 2) 行级锁，防止并发双重确认
        const locked = await manager
          .getRepository(Assessment)
          .createQueryBuilder('a')
          .setLock('pessimistic_write')
          .where('a.id = :id', { id: assessmentId })
          .getOne();

        if (!locked) throw new NotFoundException('评估单不存在');

        if (locked.status === AssessmentStatus.CONFIRMED) {
          // 已确认过的并发兜底：直接重放已有结果
          const dup = await this.idempotency.findOne({ where: { key } });
          if (dup) return { ...(dup.response as ConfirmationResponse), replayed: true };
          throw new ConflictException('评估单已确认，不能重复确认');
        }

        if (
          locked.status !== AssessmentStatus.PENDING_CONFIRMATION ||
          !locked.proposedLevel
        ) {
          throw new BadRequestException(
            `评估单当前为 ${locked.status}，尚不能确认：必填缺失需补录，等级冲突需先完成复核`,
          );
        }

        if (!/^\d{4}-\d{2}-\d{2}$/.test(effectiveDate)) {
          throw new BadRequestException('生效日期格式应为 YYYY-MM-DD');
        }

        const review = await manager.findOne(ReviewDecision, {
          where: { assessmentId: locked.id },
        });
        const kind: ConfirmationKind = review
          ? ConfirmationKind.REVIEWED
          : ConfirmationKind.AGREED;

        // 3) 费用生效：按机构示例规则独立判断（与告知能否送达无关）
        const feeResult = await this.feeService.activateLevel({
          residentId: locked.residentId,
          level: locked.proposedLevel,
          effectiveDate,
          sourceAssessmentId: locked.id,
          manager,
        });

        if (feeResult.outcome === 'REJECTED_OVERLAP') {
          throw new ConflictException(feeResult.message);
        }

        // 4) 落确认等级
        locked.status = AssessmentStatus.CONFIRMED;
        locked.confirmedLevel = locked.proposedLevel;
        locked.confirmationKind = kind;
        locked.effectiveDate = effectiveDate;
        locked.confirmedAt = new Date();
        const saved = await manager.save(locked);

        // 5) 确认后才生成告知记录；送达失败/尚未送达分别记录
        const notification = await this.notificationService.createForConfirmation({
          assessment: saved,
          level: locked.confirmedLevel,
          manager,
        });

        const levelSource =
          kind === ConfirmationKind.AGREED
            ? `两位评估员按量表 ${locked.scaleCode} 评分一致：${locked.scoreResults
                .map((s) => `${s.rawScore}/${s.denominator}=${s.percentage}%`)
                .join('，')}`
            : `经复核员 ${review.reviewerName} 按量表 ${locked.scaleCode} 重算裁定：${review.decidedLevel}（${review.reconciledScore.rawScore}/${review.reconciledScore.denominator}=${review.reconciledScore.percentage}%）`;

        const response: ConfirmationResponse = {
          replayed: false,
          assessmentId: locked.id,
          status: AssessmentStatus.CONFIRMED,
          confirmationKind: kind,
          confirmedLevel: locked.confirmedLevel,
          levelSource,
          effectiveDate,
          fee: {
            outcome: feeResult.outcome,
            message: feeResult.message,
            period: feeResult.period
              ? {
                  id: feeResult.period.id,
                  validFrom: feeResult.period.validFrom,
                  validTo: feeResult.period.validTo,
                  careLevel: feeResult.period.careLevel,
                }
              : null,
            truncatedPeriod: feeResult.truncatedPeriod,
          },
          notification: {
            id: notification.id,
            status: notification.status,
            attemptCount: notification.attemptCount,
            lastError: notification.lastError,
          },
          note: '虚构量表行政流程演示，不构成医疗诊断或真实护理建议',
        };

        // 6) 幂等记录与业务数据同一事务落库
        await manager.save(
          manager.create(IdempotencyRecord, {
            key,
            residentId: locked.residentId,
            action: 'CONFIRM_ASSESSMENT',
            status: 200,
            response,
          }),
        );

        return response;
      },
    ).catch((err) => {
      // 并发下唯一键冲突：重放首次结果而非报错
      if (err && (err.code === '23505' || String(err.message).includes('duplicate key'))) {
        return this.idempotency.findOne({ where: { key } }).then((rec) => {
          if (rec) return { ...(rec.response as ConfirmationResponse), replayed: true };
          throw err;
        });
      }
      throw err;
    });
  }
}
