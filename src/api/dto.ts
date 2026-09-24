import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsISO8601,
  IsObject,
  IsOptional,
  IsString,
  Length,
  Matches,
  ValidateNested,
} from 'class-validator';

export class AssessorAnswersDto {
  @IsString()
  @Length(1, 64)
  assessorName: string;

  /** itemCode -> 原始选项 key（只接受量表中定义的原始选项，或可选条目的 'NA'） */
  @IsObject()
  answers: Record<string, string>;
}

export class FamilyContactDto {
  @IsString()
  @Length(1, 64)
  name: string;

  /** 演示渠道：SMS / EMAIL / CALL；地址以 fail 开头时模拟送达失败 */
  @Matches(/^(SMS|EMAIL|CALL)$/)
  channel: string;

  @IsString()
  @Length(1, 128)
  address: string;
}

export class CreateAssessmentDto {
  @IsString()
  residentId: string;

  @IsOptional()
  @IsString()
  scaleCode?: string;

  @ValidateNested()
  @Type(() => FamilyContactDto)
  familyContact: FamilyContactDto;

  @IsArray()
  @ArrayMinSize(2)
  @ArrayMaxSize(2)
  @ValidateNested({ each: true })
  @Type(() => AssessorAnswersDto)
  assessors: AssessorAnswersDto[];
}

export class SubmitReviewDto {
  @IsString()
  @Length(1, 64)
  reviewerName: string;

  /** 复核员主张的等级；必须与按量表重算的裁定答卷一致，否则驳回 */
  @Matches(/^L[0-3]$/)
  decidedLevel: string;

  /** 复核员核对后形成的裁定答卷（完整 itemCode -> 选项 key），服务端重算 */
  @IsObject()
  basisAnswers: Record<string, string>;

  @IsString()
  @Length(10, 1000)
  rationale: string;
}

export class ConfirmAssessmentDto {
  /** 申请的费用生效日（机构示例规则会独立判断是否采纳） */
  @IsISO8601({ strict: true })
  effectiveDate: string;
}

export class RetryNotificationDto {
  @IsOptional()
  @IsString()
  @Length(1, 128)
  newAddress?: string;
}
