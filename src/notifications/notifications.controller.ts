import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
} from '@nestjs/common';
import { NotificationsService } from './notifications.service';
import { NotifyAttemptDto } from './dto/notify-attempt.dto';

@Controller('assessments/:caseId/notification')
export class NotificationsController {
  constructor(private readonly service: NotificationsService) {}

  /** 发起一次家属告知尝试；送达失败 / 尚未确认分别记录 */
  @Post('attempt')
  attempt(
    @Param('caseId', new ParseUUIDPipe()) caseId: string,
    @Body() dto: NotifyAttemptDto,
  ) {
    return this.service.attempt(caseId, dto);
  }

  /** 查看该案件全部告知记录（可含多条尚未确认尝试 + 最终送达） */
  @Get()
  list(@Param('caseId', new ParseUUIDPipe()) caseId: string) {
    return this.service.listForCase(caseId);
  }
}
