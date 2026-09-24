import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsIn,
  IsOptional,
  IsString,
  MaxLength,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

export class AssessorAnswersDto {
  /** 评估员序号：1 或 2 */
  @IsIn([1, 2])
  assessorId: number;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => AnswerDto)
  answers: AnswerDto[];
}

export class AnswerDto {
  @IsString()
  @MaxLength(64)
  itemCode: string;

  @IsString()
  @MaxLength(64)
  optionCode: string;
}

export class SubmitAssessmentDto {
  @IsString()
  @MaxLength(64)
  elderId: string;

  @IsString()
  @MaxLength(100)
  elderName: string;

  @IsString()
  @MaxLength(64)
  familyContact: string;

  /** 量表版本 ID；不传则使用最新 DEMO_ADL */
  @IsOptional()
  @IsString()
  scaleVersionId?: string;

  @IsArray()
  @ArrayMinSize(2)
  @ArrayMaxSize(2)
  @ValidateNested({ each: true })
  @Type(() => AssessorAnswersDto)
  assessors: AssessorAnswersDto[];
}
