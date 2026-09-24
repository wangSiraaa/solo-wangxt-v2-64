import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Assessment } from './domain/assessment.entity';
import { ReviewDecision } from './domain/review-decision.entity';
import { FamilyNotification } from './domain/family-notification.entity';
import { FeePeriod } from './domain/fee-period.entity';
import { FeeRateCard } from './domain/fee-rate-card.entity';
import { Resident } from './domain/resident.entity';
import { ScaleVersion } from './domain/scale-version.entity';
import { IdempotencyRecord } from './domain/idempotency-record.entity';
import { AssessmentService } from './assessment/assessment.service';
import { ReviewService } from './review/review.service';
import { ConfirmationService } from './confirmation/confirmation.service';
import { NotificationService } from './notification/notification.service';
import { FeeService } from './fees/fee.service';
import { ApiController } from './api/api.controller';
import { DbInitService } from './db/db-init.service';

const entities = [
  Resident,
  ScaleVersion,
  Assessment,
  ReviewDecision,
  FamilyNotification,
  FeePeriod,
  FeeRateCard,
  IdempotencyRecord,
];

@Module({
  imports: [
    TypeOrmModule.forRoot({
      type: 'postgres',
      host: process.env.PGHOST || '/tmp',
      port: Number(process.env.PGPORT || 55432),
      username: process.env.PGUSER || 'app',
      password: process.env.PGPASSWORD || '',
      database: process.env.PGDATABASE || 'eldercare',
      entities,
      synchronize: false, // 结构以 schema.sql 为准（含 EXCLUDE 约束）
      logging: false,
    }),
    TypeOrmModule.forFeature(entities),
  ],
  controllers: [ApiController],
  providers: [
    AssessmentService,
    ReviewService,
    ConfirmationService,
    NotificationService,
    FeeService,
    DbInitService,
  ],
})
export class AppModule {}
