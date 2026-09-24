import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { EntityManager, Repository } from 'typeorm';
import { FeePeriod } from '../domain/fee-period.entity';
import { FeeRateCard } from '../domain/fee-rate-card.entity';
import { Resident } from '../domain/resident.entity';
import { quoteMonthlyFees, FeeQuote, monthRange } from './fee.calculator';
import { CareLevel } from '../domain/enums';
import { addDays, toISODate } from './date.util';

export interface FeeActivationResult {
  activated: boolean;
  /** NOOP_DUPLICATE | ACTIVATED | REJECTED_OVERLAP */
  outcome: 'ACTIVATED' | 'NOOP_DUPLICATE' | 'REJECTED_OVERLAP';
  period: FeePeriod | null;
  /** 被截断的旧开放区间 */
  truncatedPeriod: { id: string; validFrom: string; validTo: string; careLevel: CareLevel } | null;
  message: string;
}

@Injectable()
export class FeeService {
  constructor(
    @InjectRepository(FeePeriod)
    private readonly periods: Repository<FeePeriod>,
    @InjectRepository(FeeRateCard)
    private readonly rates: Repository<FeeRateCard>,
    @InjectRepository(Resident)
    private readonly residents: Repository<Resident>,
  ) {}

  /**
   * 机构示例费用生效规则（独立于告知送达结果判断）：
   *  1. 生效日不得早于入住日；
   *  2. 生效日落点必须在当前开放区间内（支持月中升级：旧开放区间在生效日前一天截断）；
   *  3. 生效日若落在已截止区间或与现有区间同日重叠 → 拒绝，同一天绝不允许两个生效等级；
   *  4. 同评估单的重复生效请求直接返回 NOOP_DUPLICATE（幂等）；
   *  5. 数据库 gist EXCLUDE 约束做最终兜底。
   */
  async activateLevel(params: {
    residentId: string;
    level: CareLevel;
    effectiveDate: string;
    sourceAssessmentId: string;
    manager: EntityManager;
  }): Promise<FeeActivationResult> {
    const { residentId, level, effectiveDate, sourceAssessmentId, manager } = params;

    const resident = await manager.findOne(Resident, { where: { id: residentId } });
    if (!resident) throw new NotFoundException('老人不存在');

    if (effectiveDate < toISODate(new Date(resident.admissionDate))) {
      throw new BadRequestException(
        `费用生效日 ${effectiveDate} 早于入住日 ${resident.admissionDate}，机构示例规则不允许`,
      );
    }

    const repo = manager.getRepository(FeePeriod);
    const all = await repo.find({
      where: { residentId },
      order: { validFrom: 'ASC' },
    });

    // 重复确认：同一评估单已经产生过以该日为起点的区间
    const duplicate = all.find(
      (p) => p.sourceAssessmentId === sourceAssessmentId && p.validFrom === effectiveDate,
    );
    if (duplicate) {
      return {
        activated: false,
        outcome: 'NOOP_DUPLICATE',
        period: duplicate,
        truncatedPeriod: null,
        message: '同一评估单的费用生效请求已处理过，重复请求不产生新区间',
      };
    }

    const hit = all.find(
      (p) => p.validFrom <= effectiveDate && (p.validTo === null || p.validTo >= effectiveDate),
    );

    if (hit) {
      if (hit.careLevel === level) {
        throw new BadRequestException(
          `生效日 ${effectiveDate} 已处于同等级 ${level} 的生效区间 [${hit.validFrom}, ${
            hit.validTo ?? '至今'
          }]，不能再插入同日重叠的生效等级`,
        );
      }

      if (hit.validTo !== null) {
        // 落在已截止区间：同日重叠，拒绝改写历史
        throw new BadRequestException(
          `生效日 ${effectiveDate} 落在已截止的 ${hit.careLevel} 区间 [${hit.validFrom}, ${hit.validTo}]，同一天不能重叠生效等级`,
        );
      }

      if (hit.validFrom === effectiveDate) {
        throw new BadRequestException(
          `生效日 ${effectiveDate} 当天已有生效等级 ${hit.careLevel}，同一天不能出现重叠生效等级`,
        );
      }

      // 月中升级：开放区间在生效日前一天截断
      const newValidTo = addDays(effectiveDate, -1);
      hit.validTo = newValidTo;
      await repo.save(hit);
    } else {
      // 没有任何区间覆盖该日（入住首日首次定级除外：无区间时允许建立第一个区间）
      const hasAny = all.length > 0;
      if (hasAny) {
        throw new BadRequestException(
          `生效日 ${effectiveDate} 不处于任何连续生效区间内（存在无等级空档日），按示例规则不能生效`,
        );
      }
    }

    const period = repo.create({
      residentId,
      validFrom: effectiveDate,
      validTo: null,
      careLevel: level,
      sourceAssessmentId,
    });

    try {
      const saved = await repo.save(period);
      return {
        activated: true,
        outcome: 'ACTIVATED',
        period: saved,
        truncatedPeriod: hit
          ? { id: hit.id, validFrom: hit.validFrom, validTo: hit.validTo, careLevel: hit.careLevel }
          : null,
        message: hit
          ? `等级 ${level} 自 ${effectiveDate} 起生效；原 ${hit.careLevel} 区间截断至 ${hit.validTo}`
          : `等级 ${level} 自 ${effectiveDate} 起建立首个生效区间`,
      };
    } catch (e) {
      // gist EXCLUDE 约束兜底
      throw new BadRequestException(
        `费用生效被数据库拒绝：同一天存在重叠生效等级（${(e as Error).message}）`,
      );
    }
  }

  async quoteMonth(residentId: string, yearMonth: string): Promise<FeeQuote> {
    const resident = await this.residents.findOne({ where: { id: residentId } });
    if (!resident) throw new NotFoundException('老人不存在');
    if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(yearMonth)) {
      throw new BadRequestException('月份格式应为 YYYY-MM');
    }
    const { start, end } = monthRange(yearMonth);
    const [periods, cards] = await Promise.all([
      this.periods.find({ where: { residentId }, order: { validFrom: 'ASC' } }),
      this.rates.find(),
    ]);
    return quoteMonthlyFees(residentId, start, end, periods, cards);
  }

  async listResidents() {
    const residents = await this.residents.find({ order: { name: 'ASC' } });
    return Promise.all(
      residents.map(async (r) => ({
        ...r,
        feePeriods: await this.periods.find({
          where: { residentId: r.id },
          order: { validFrom: 'ASC' },
        }),
      })),
    );
  }

  async listPeriods(residentId: string): Promise<FeePeriod[]> {
    return this.periods.find({ where: { residentId }, order: { validFrom: 'ASC' } });
  }
}
