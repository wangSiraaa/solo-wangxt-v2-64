import { Body, Controller, Get, Param, ParseUUIDPipe, Post } from '@nestjs/common';
import { AssessmentsService } from './assessments.service';
import { SubmitAssessmentDto } from './dto/submit-assessment.dto';

@Controller('assessments')
export class AssessmentsController {
  constructor(private readonly service: AssessmentsService) {}

  /** 提交两位评估员的作答；返回案件状态、逐项评分来源、冲突/确认结果 */
  @Post()
  submit(@Body() dto: SubmitAssessmentDto) {
    return this.service.submit(dto);
  }

  @Get(':id')
  findOne(@Param('id', new ParseUUIDPipe()) id: string) {
    return this.service.findOne(id);
  }
}
