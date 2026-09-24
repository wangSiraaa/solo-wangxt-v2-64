import { Injectable } from '@nestjs/common';
import Decimal from 'decimal.js';
import { GradeCode, NaPolicy } from '../common/enums';
import { ScaleVersion } from '../entities/scale-version.entity';
import { ScaleItem } from '../entities/scale-item.entity';
import { ScaleOption } from '../entities/scale-option.entity';

export interface AnswerInput {
  itemCode: string;
  optionCode: string;
}

export interface AnswerLineExplain {
  itemCode: string;
  label: string;
  required: boolean;
  allowsNa: boolean;
  optionCode: string | null; // 缺失项为 null
  optionLabel: string | null;
  score: number | null;
  na: boolean;
  includedInDenominator: boolean;
  note: string;
}

export interface MissingItem {
  itemCode: string;
  label: string;
  required: boolean;
}

export interface ScoreResult {
  gradeable: boolean;
  reason?: string;
  rawScore: number | null;
  maxScore: number | null;
  denominator: number | null; // 有效分母（参与计分的条目数）
  naCount: number;
  missingRequired: MissingItem[];
  scorePct: string | null; // decimal 百分比（0~100）
  grade: GradeCode | null;
  lines: AnswerLineExplain[];
}

@Injectable()
export class ScoringService {
  /**
   * 计算单个评估员的得分与等级，并给出逐项可解释明细。
   *
   * 规则（由量表版本定义）：
   *  - 必填项缺失：不得自动定级（gradeable=false）
   *  - 非必填项缺失：不阻塞定级
   *  - NA 如何影响分母：读取量表 naPolicy；本演示为“从分母剔除”
   *  - 百分比 = 实得分 / (有效条目数 × 单项满分3) × 100，decimal 计算
   */
  score(
    scale: ScaleVersion,
    items: ScaleItem[],
    options: ScaleOption[],
    answers: AnswerInput[],
  ): ScoreResult {
    const answerMap = new Map(answers.map((a) => [a.itemCode, a.optionCode]));
    const itemsSorted = [...items].sort((a, b) => a.orderIndex - b.orderIndex);

    const lines: AnswerLineExplain[] = [];
    const missingRequired: MissingItem[] = [];
    let rawScore = 0;
    let denominatorItems = 0;
    let naCount = 0;

    for (const item of itemsSorted) {
      const optCode = answerMap.get(item.code) ?? null;

      if (optCode === null) {
        lines.push({
          itemCode: item.code,
          label: item.label,
          required: item.required,
          allowsNa: item.allowsNa,
          optionCode: null,
          optionLabel: null,
          score: null,
          na: false,
          includedInDenominator: false,
          note: item.required ? '必填项缺失：不得自动定级' : '非必填项缺失：不参与计分',
        });
        if (item.required) {
          missingRequired.push({
            itemCode: item.code,
            label: item.label,
            required: true,
          });
        }
        continue;
      }

      const option = options.find(
        (o) => o.item.id === item.id && o.code === optCode,
      );
      if (!option) {
        // 选项不在该量表原始选项中：按无效作答处理，必填项视为缺失
        const isNaAttempt = optCode === 'NA' && !item.allowsNa;
        lines.push({
          itemCode: item.code,
          label: item.label,
          required: item.required,
          allowsNa: item.allowsNa,
          optionCode: optCode,
          optionLabel: null,
          score: null,
          na: isNaAttempt,
          includedInDenominator: false,
          note: isNaAttempt
            ? '量表未定义该项可为“不适用”：作答无效，必填项不得自动定级'
            : `选项 ${optCode} 不在量表原始选项中：作答无效`,
        });
        if (item.required) {
          missingRequired.push({
            itemCode: item.code,
            label: item.label,
            required: true,
          });
        }
        continue;
      }

      const isNa = option.score === null;
      if (isNa && !item.allowsNa) {
        // 量表未定义该项可 NA：无效作答
        lines.push({
          itemCode: item.code,
          label: item.label,
          required: item.required,
          allowsNa: false,
          optionCode: optCode,
          optionLabel: option.label,
          score: null,
          na: true,
          includedInDenominator: false,
          note: '量表未定义该项可为“不适用”：作答无效，必填项不得自动定级',
        });
        if (item.required) {
          missingRequired.push({
            itemCode: item.code,
            label: item.label,
            required: true,
          });
        }
        continue;
      }

      if (isNa) {
        naCount++;
        const included =
          scale.naPolicy === NaPolicy.COUNT_AS_ZERO; // 本演示量表为 EXCLUDE
        lines.push({
          itemCode: item.code,
          label: item.label,
          required: item.required,
          allowsNa: item.allowsNa,
          optionCode: option.code,
          optionLabel: option.label,
          score: null,
          na: true,
          includedInDenominator: included,
          note:
            scale.naPolicy === NaPolicy.EXCLUDE_FROM_DENOMINATOR
              ? 'NA：按量表定义从分母剔除（不计分、不计入分母）'
              : 'NA：按量表定义以 0 分计入分母',
        });
        if (included) {
          denominatorItems++;
        }
        continue;
      }

      rawScore += option.score!;
      denominatorItems++;
      lines.push({
        itemCode: item.code,
        label: item.label,
        required: item.required,
        allowsNa: item.allowsNa,
        optionCode: option.code,
        optionLabel: option.label,
        score: option.score,
        na: false,
        includedInDenominator: true,
        note: `计分 +${option.score}`,
      });
    }

    if (missingRequired.length > 0) {
      return {
        gradeable: false,
        reason: '必填项缺失或无效，不得自动定级，请补充评估',
        rawScore: null,
        maxScore: null,
        denominator: null,
        naCount,
        missingRequired,
        scorePct: null,
        grade: null,
        lines,
      };
    }

    const maxPerItem = 3;
    const maxScore = denominatorItems * maxPerItem;
    const scorePct =
      maxScore === 0
        ? new Decimal(0)
        : new Decimal(rawScore).mul(100).div(maxScore);

    return {
      gradeable: true,
      rawScore,
      maxScore,
      denominator: denominatorItems,
      naCount,
      missingRequired: [],
      scorePct: scorePct.toFixed(4),
      grade: this.resolveGrade(scale, scorePct),
      lines,
    };
  }

  /** 按量表阈值定级（阈值为量表定义，非硬编码） */
  private resolveGrade(scale: ScaleVersion, pct: Decimal): GradeCode {
    const thresholds = [...scale.gradeThresholds].sort(
      (a, b) => b.minScorePct - a.minScorePct,
    );
    for (const t of thresholds) {
      if (pct.gte(t.minScorePct)) return t.grade as GradeCode;
    }
    // 兜底：最低档
    return thresholds[thresholds.length - 1].grade as GradeCode;
  }
}
