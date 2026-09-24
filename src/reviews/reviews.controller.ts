import { Body, Controller, Param, ParseUUIDPipe, Post } from '@nestjs/common';
import { ReviewsService } from './reviews.service';
import { ConfirmReviewDto } from './dto/confirm-review.dto';

@Controller('assessments/:caseId/review')
export class ReviewsController {
  constructor(private readonly service: ReviewsService) {}

  /** 管理复核确认（仅冲突案件需要；重复确认请求幂等处理） */
  @Post('confirm')
  confirm(
    @Param('caseId', new ParseUUIDPipe()) caseId: string,
    @Body() dto: ConfirmReviewDto,
  ) {
    return this.service.confirm(caseId, dto);
  }
}
