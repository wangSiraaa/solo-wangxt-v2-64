import {
  IsDateString,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
} from 'class-validator';

export class ActivateGradeDto {
  @IsUUID()
  caseId: string;

  /** 生效首日 YYYY-MM-DD */
  @IsDateString()
  effectiveDate: string;

  @IsOptional()
  @IsString()
  @MaxLength(128)
  idempotencyKey?: string;
}

export class FeeSegmentsQueryDto {
  @IsString()
  @MaxLength(64)
  elderId: string;

  @IsDateString()
  from: string;

  @IsDateString()
  to: string;
}
