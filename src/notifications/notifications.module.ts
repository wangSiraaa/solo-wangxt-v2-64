import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AssessmentCase } from '../entities/assessment-case.entity';
import { NotificationRecord } from '../entities/notification.entity';
import { NotificationsController } from './notifications.controller';
import { NotificationsService } from './notifications.service';
import { NotifyChannelService } from './notify-channel.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([AssessmentCase, NotificationRecord]),
  ],
  controllers: [NotificationsController],
  providers: [NotificationsService, NotifyChannelService],
})
export class NotificationsModule {}
