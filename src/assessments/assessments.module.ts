import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AssessmentCase } from '../entities/assessment-case.entity';
import { AssessorAnswer } from '../entities/assessor-answer.entity';
import { ScaleVersion } from '../entities/scale-version.entity';
import { ScoringService } from '../scoring/scoring.service';
import { AssessmentsController } from './assessments.controller';
import { AssessmentsService } from './assessments.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([AssessmentCase, AssessorAnswer, ScaleVersion]),
  ],
  controllers: [AssessmentsController],
  providers: [AssessmentsService, ScoringService],
  exports: [AssessmentsService],
})
export class AssessmentsModule {}
