import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { ScaleVersion } from '../domain/scale-version.entity';
import { Assessment } from '../domain/assessment.entity';
import { Resident } from '../domain/resident.entity';
import { AssessmentStatus } from '../domain/enums';
import { scoreAssessor } from '../scoring/scoring.engine';
import { CreateAssessmentDto } from '../api/dto';

@Injectable()
export class AssessmentService {
  constructor(
    @InjectRepository(Assessment)
    private readonly assessments: Repository<Assessment>,
    @InjectRepository(ScaleVersion)
    private readonly scales: Repository<ScaleVersion>,
    @InjectRepository(Resident)
    private readonly residents: Repository<Resident>,
    private readonly dataSource: DataSource,
  ) {}

  async create(dto: CreateAssessmentDto): Promise<Assessment> {
    const resident = await this.residents.findOne({ where: { id: dto.residentId } });
    if (!resident) throw new NotFoundException('老人不存在');

    const names = dto.assessors.map((a) => a.assessorName.trim());
    if (new Set(names).size !== 2) {
      throw new BadRequestException('必须由两位不同的评估员分别作答');
    }

    const scaleCode = dto.scaleCode ?? 'FCRS-1.0';
    const scale = await this.scales.findOne({ where: { code: scaleCode } });
    if (!scale) throw new BadRequestException(`量表版本 ${scaleCode} 不存在`);

    const itemCodes = new Set(scale.items.map((i) => i.code));

    return this.dataSource.transaction(async (manager) => {
      // 服务端依据原始选项逐人重算（客户端不能自报分数/等级）
      const missing = [];
      const scoreResults = dto.assessors.map((raw) => {
        // 过滤量表中不存在的 itemCode，未知 key 的作答无效（在评分引擎中按缺失处理）
        const cleaned: Record<string, string> = {};
        for (const [k, v] of Object.entries(raw.answers ?? {})) {
          if (itemCodes.has(k)) cleaned[k] = v;
        }
        const result = scoreAssessor(scale.items, scale.bands, {
          assessorName: raw.assessorName,
          answers: cleaned,
        });
        missing.push(...result.missing);
        return result.score;
      });

      const anyIncomplete = scoreResults.some((s) => s.reason);
      const levels = scoreResults.map((s) => s.level).filter(Boolean);
      const conflict =
        !anyIncomplete && new Set(levels).size > 1;

      const entity = manager.create(Assessment, {
        residentId: resident.id,
        scaleCode,
        responses: dto.assessors.map((a) => ({ assessorName: a.assessorName, answers: a.answers })),
        scoreResults,
        missingFields: missing.length ? missing : null,
        familyContact: {
          name: dto.familyContact.name,
          channel: dto.familyContact.channel,
          address: dto.familyContact.address,
        },
      });

      if (anyIncomplete) {
        // 必填项缺失：不得自动定级，等待补录
        entity.status = AssessmentStatus.INCOMPLETE;
        entity.holdReason =
          '必填项缺失，按量表规则不得自动定级：' +
          missing.map((m) => `${m.assessorName}/${m.itemCode}`).join('，');
      } else if (conflict) {
        // 冲突：进入复核，绝不简单取较高等级
        entity.status = AssessmentStatus.PENDING_REVIEW;
        entity.proposedLevel = null;
        entity.holdReason = `两位评估员等级不一致（${levels.join(' vs ')}），需管理复核`;
      } else {
        entity.status = AssessmentStatus.PENDING_CONFIRMATION;
        entity.proposedLevel = levels[0];
        entity.holdReason = null;
      }

      return manager.save(entity);
    });
  }

  async get(id: string): Promise<Assessment> {
    const a = await this.assessments.findOne({
      where: { id },
      relations: ['review'],
    });
    if (!a) throw new NotFoundException('评估单不存在');
    return a;
  }

  async list(residentId?: string): Promise<Assessment[]> {
    return this.assessments.find({
      where: residentId ? { residentId } : {},
      order: { createdAt: 'DESC' },
      relations: ['review'],
      take: 100,
    });
  }

  async getScale(code = 'FCRS-1.0'): Promise<ScaleVersion> {
    const scale = await this.scales.findOne({ where: { code } });
    if (!scale) throw new NotFoundException(`量表 ${code} 不存在`);
    return scale;
  }
}
