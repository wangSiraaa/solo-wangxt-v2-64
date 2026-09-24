import { Body, Controller, Get, Post, Query } from '@nestjs/common';
import { FeesService } from './fees.service';
import { ActivateGradeDto, FeeSegmentsQueryDto } from './dto/fee.dto';

@Controller('fees')
export class FeesController {
  constructor(private readonly service: FeesService) {}

  /** 等级生效（必须已确认；同日不允许重叠等级） */
  @Post('activate')
  activate(@Body() dto: ActivateGradeDto) {
    return this.service.activateGrade(
      dto.caseId,
      dto.effectiveDate,
      dto.idempotencyKey,
    );
  }

  /** 按天分段费用：解释每段等级、日费版本、天数与金额，给出 decimal 合计 */
  @Get('segments')
  segments(@Query() q: FeeSegmentsQueryDto) {
    return this.service.feeSegments(q.elderId, q.from, q.to);
  }
}
