import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { EntityManager, Repository } from 'typeorm';
import { FamilyNotification } from '../domain/family-notification.entity';
import { Assessment } from '../domain/assessment.entity';
import { CareLevel, NotificationStatus } from '../domain/enums';

export interface DeliveryResult {
  status: NotificationStatus;
  error: string | null;
  deliveredAt: Date | null;
}

@Injectable()
export class NotificationService {
  constructor(
    @InjectRepository(FamilyNotification)
    private readonly notifications: Repository<FamilyNotification>,
  ) {}

  /**
   * 等级确认后生成告知记录，并立即尝试首次送达。
   * 注意：告知记录的生成与送达结果分开落库——
   *  - 尚未确认等级的评估单不会产生告知记录；
   *  - 送达失败保留 DELIVERY_FAILED 及原因，不影响费用生效；
   *  - 送达成功只是 DELIVERED，家属签收是后续独立动作。
   *
   * 演示用送达模拟（地址前缀）：
   *  fail:  -> 送达失败
   *  later: -> 已发送暂未送达（PENDING，等待重试/回执）
   *  其他   -> 送达成功
   */
  async createForConfirmation(params: {
    assessment: Assessment;
    level: CareLevel;
    manager: EntityManager;
  }): Promise<FamilyNotification> {
    const { assessment, level, manager } = params;
    const contact = assessment.familyContact;
    if (!contact) throw new BadRequestException('缺少家属联系方式，无法生成告知记录');

    const content =
      `【行政流程演示通知】评估单 ${assessment.id}：依据虚构量表 ${assessment.scaleCode}，` +
      `经流程确认的护理等级为 ${level}，拟于 ${assessment.effectiveDate} 起生效并据此计费。` +
      `本通知仅为行政流程演示，不构成医疗诊断或护理建议。`;

    const record = manager.create(FamilyNotification, {
      residentId: assessment.residentId,
      assessmentId: assessment.id,
      contactName: contact.name,
      channel: contact.channel,
      channelAddress: contact.address,
      careLevel: level,
      effectiveDate: assessment.effectiveDate,
      content,
      status: NotificationStatus.PENDING,
      attemptCount: 0,
    });
    await manager.save(record);

    const result = this.deliver(contact.channel, contact.address);
    record.attemptCount = 1;
    record.status = result.status;
    record.lastError = result.error;
    record.deliveredAt = result.deliveredAt;
    return manager.save(record);
  }

  deliver(channel: string, address: string): DeliveryResult {
    const lower = address.toLowerCase();
    if (lower.startsWith('fail')) {
      return {
        status: NotificationStatus.DELIVERY_FAILED,
        error: `模拟送达失败：${channel} 网关拒绝投递至 ${address}`,
        deliveredAt: null,
      };
    }
    if (lower.startsWith('later')) {
      return {
        status: NotificationStatus.PENDING,
        error: null,
        deliveredAt: null,
      };
    }
    return { status: NotificationStatus.DELIVERED, error: null, deliveredAt: new Date() };
  }

  async retry(id: string, newAddress?: string): Promise<FamilyNotification> {
    const record = await this.notifications.findOne({ where: { id } });
    if (!record) throw new NotFoundException('告知记录不存在');
    if (record.status === NotificationStatus.ACKNOWLEDGED) {
      throw new BadRequestException('家属已签收，无需重试送达');
    }
    if (record.status === NotificationStatus.DELIVERED) {
      throw new BadRequestException('已送达，等待家属签收，不能重试');
    }

    if (newAddress) record.channelAddress = newAddress;
    const result = this.deliver(record.channel, record.channelAddress);
    record.attemptCount += 1;
    record.status = result.status;
    record.lastError = result.error;
    record.deliveredAt = result.deliveredAt;
    return this.notifications.save(record);
  }

  async acknowledge(id: string): Promise<FamilyNotification> {
    const record = await this.notifications.findOne({ where: { id } });
    if (!record) throw new NotFoundException('告知记录不存在');
    if (record.status === NotificationStatus.DELIVERY_FAILED) {
      throw new BadRequestException('送达失败，尚未送达，不能签收');
    }
    if (record.status === NotificationStatus.PENDING) {
      throw new BadRequestException('尚未送达，不能签收（送达与签收分别记录）');
    }
    if (record.status === NotificationStatus.ACKNOWLEDGED) return record;
    record.status = NotificationStatus.ACKNOWLEDGED;
    record.acknowledgedAt = new Date();
    return this.notifications.save(record);
  }

  async listByAssessment(assessmentId: string): Promise<FamilyNotification[]> {
    return this.notifications.find({
      where: { assessmentId },
      order: { createdAt: 'DESC' },
    });
  }
}
