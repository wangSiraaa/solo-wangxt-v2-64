import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { Assessment } from '../domain/assessment.entity';
import { ReviewDecision } from '../domain/review-decision.entity';
import { ScaleVersion } from '../domain/scale-version.entity';
import { AssessmentStatus } from '../domain/enums';
import { scoreAssessor } from '../scoring/scoring.engine';
import { SubmitReviewDto } from '../api/dto';

@Injectable()
export class ReviewService {
  constructor(
    @InjectRepository(Assessment)
    private readonly assessments: Repository<Assessment>,
    @InjectRepository(ReviewDecision)
    private readonly reviews: Repository<ReviewDecision>,
    @InjectRepository(ScaleVersion)
    private readonly scales: Repository<ScaleVersion>,
    private readonly dataSource: DataSource,
  ) {}

  async submit(assessmentId: string, dto: SubmitReviewDto): Promise<Assessment> {
    const assessment = await this.assessments.findOne({ where: { id: assessmentId } });
    if (!assessment) throw new NotFoundException('评估单不存在');

    if (assessment.status !== AssessmentStatus.PENDING_REVIEW) {
      throw new BadRequestException(
        `评估单当前状态 ${assessment.status} 不允许提交复核（仅 PENDING_REVIEW 可复核）`,
      );
    }

    const scale = await this.scales.findOne({ where: { code: assessment.scaleCode } });
    if (!scale) throw new NotFoundException('量表版本缺失');

    // 复核不是“选个等级”：复核员必须给出核对后的裁定答卷，服务端用同一量表重算
    const { score, missing } = scoreAssessor(scale.items, scale.bands, {
      assessorName: dto.reviewerName,
      answers: dto.basisAnswers,
    });

    if (score.reason) {
      throw new BadRequestException(
        `裁定答卷不完整，无法定级：${score.reason}；缺失：${missing
          .map((m) => m.itemCode)
          .join(',') || '无'}`,
      );
    }

    if (score.level !== dto.decidedLevel) {
      // 防止复核员绕过量表直接取较高等级
      throw new BadRequestException(
        `裁定等级 ${dto.decidedLevel} 与按量表重算结果 ${score.level}（${score.percentage}%）不一致，复核被驳回`,
      );
    }

    const originalAnswers = assessment.responses.map((r) => r.answers);
    const basisItems: Record<string, string> = {};
    for (const [itemCode, optionKey] of Object.entries(dto.basisAnswers)) {
      const disagreed = originalAnswers.some((a) => a[itemCode] && a[itemCode] !== optionKey);
      basisItems[itemCode] = disagreed
        ? `裁定选项 ${optionKey}（与至少一位评估员原始选项不同）`
        : `裁定选项 ${optionKey}（与两位评估员一致）`;
    }

    return this.dataSource.transaction(async (manager) => {
      const decision = manager.create(ReviewDecision, {
        assessmentId: assessment.id,
        reviewerName: dto.reviewerName,
        decidedLevel: score.level,
        basisItems,
        rationale: dto.rationale,
        reconciledScore: score,
      });
      await manager.save(decision);

      assessment.status = AssessmentStatus.PENDING_CONFIRMATION;
      assessment.proposedLevel = score.level;
      assessment.holdReason = '复核完成，待机构确认';
      const saved = await manager.save(assessment);
      saved.review = decision;
      return saved;
    });
  }
}
