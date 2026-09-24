import { Body, Controller, Get, Headers, Param, Post, Query } from '@nestjs/common';
import { AssessmentService } from '../assessment/assessment.service';
import { ReviewService } from '../review/review.service';
import { ConfirmationService } from '../confirmation/confirmation.service';
import { NotificationService } from '../notification/notification.service';
import { FeeService } from '../fees/fee.service';
import {
  ConfirmAssessmentDto,
  CreateAssessmentDto,
  RetryNotificationDto,
  SubmitReviewDto,
} from './dto';

@Controller()
export class ApiController {
  constructor(
    private readonly assessments: AssessmentService,
    private readonly reviews: ReviewService,
    private readonly confirmations: ConfirmationService,
    private readonly notifications: NotificationService,
    private readonly fees: FeeService,
  ) {}

  /** 量表定义（解释“分数从哪来”：原始选项、必填项、NA 分母策略、等级区间） */
  @Get('scales/:code')
  scale(@Param('code') code: string) {
    return this.assessments.getScale(code);
  }

  /** 两位评估员提交作答；必填缺失->INCOMPLETE，冲突->PENDING_REVIEW，一致->PENDING_CONFIRMATION */
  @Post('assessments')
  create(@Body() dto: CreateAssessmentDto) {
    return this.assessments.create(dto);
  }

  @Get('assessments')
  list(@Query('residentId') residentId?: string) {
    return this.assessments.list(residentId);
  }

  @Get('assessments/:id')
  get(@Param('id') id: string) {
    return this.assessments.get(id);
  }

  /** 管理复核：必须提交裁定答卷，服务端按量表重算校验，不允许直接取高等级 */
  @Post('assessments/:id/review')
  review(@Param('id') id: string, @Body() dto: SubmitReviewDto) {
    return this.reviews.submit(id, dto);
  }

  /** 等级确认：生效费用区间 + 生成家属告知记录；重复请求（幂等键或同评估单）重放首次结果 */
  @Post('assessments/:id/confirm')
  confirm(
    @Param('id') id: string,
    @Body() dto: ConfirmAssessmentDto,
    @Headers('x-idempotency-key') idemKey?: string,
  ) {
    return this.confirmations.confirm(id, dto.effectiveDate, idemKey);
  }

  @Get('assessments/:id/notifications')
  listNotifications(@Param('id') id: string) {
    return this.notifications.listByAssessment(id);
  }

  /** 送达失败重试（送达与签收分别记录） */
  @Post('notifications/:id/retry')
  retry(@Param('id') id: string, @Body() dto: RetryNotificationDto) {
    return this.notifications.retry(id, dto?.newAddress);
  }

  /** 家属签收 */
  @Post('notifications/:id/acknowledge')
  acknowledge(@Param('id') id: string) {
    return this.notifications.acknowledge(id);
  }

  /** 费用分段：按天分段 + decimal.js 金额，解释每段天数、单价、来源评估单 */
  @Get('residents/:id/fee-quote')
  quote(@Param('id') id: string, @Query('month') month: string) {
    return this.fees.quoteMonth(id, month);
  }

  @Get('residents/:id/fee-periods')
  periods(@Param('id') id: string) {
    return this.fees.listPeriods(id);
  }

  @Get('residents')
  residents() {
    return this.fees.listResidents();
  }
}
