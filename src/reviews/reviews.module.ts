import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AssessmentCase } from '../entities/assessment-case.entity';
import { ReviewDecision } from '../entities/review-decision.entity';
import { NotificationRecord } from '../entities/notification.entity';
import { ReviewsController } from './reviews.controller';
import { ReviewsService } from './reviews.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      AssessmentCase,
      ReviewDecision,
      NotificationRecord,
    ]),
  ],
  controllers: [ReviewsController],
  providers: [ReviewsService],
})
export class ReviewsModule {}
