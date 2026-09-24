import { IsIn, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';
import { GradeCode } from '../../common/enums';

export class ConfirmReviewDto {
  /** 管理员显式选定的最终等级（候选仅限两位评估员给出的等级，禁止系统取高） */
  @IsIn([GradeCode.LIGHT, GradeCode.MODERATE, GradeCode.SEVERE])
  confirmedGrade: GradeCode;

  @IsString()
  @MinLength(2)
  @MaxLength(64)
  reviewerId: string;

  /** 复核意见（必须说明依据，留痕） */
  @IsString()
  @MinLength(5)
  @MaxLength(2000)
  comment: string;

  /** 幂等键：相同键重复提交返回首次结果，不产生第二次确认 */
  @IsOptional()
  @IsString()
  @MaxLength(128)
  idempotencyKey?: string;
}
