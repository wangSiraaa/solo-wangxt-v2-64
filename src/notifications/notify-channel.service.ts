import { Injectable } from '@nestjs/common';

export interface DeliveryResult {
  delivered: boolean;
  failureReason: string | null;
}

/**
 * 家属告知通道适配器（演示桩）。
 * 真实系统可替换为短信/微信/电话回传；此处按联系方式后缀或显式标记模拟失败。
 */
@Injectable()
export class NotifyChannelService {
  async send(
    familyContact: string,
    message: string,
    forceFail: boolean,
  ): Promise<DeliveryResult> {
    await new Promise((r) => setTimeout(r, 5));
    if (forceFail) {
      return { delivered: false, failureReason: '模拟通道异常：网关超时' };
    }
    if (familyContact.endsWith('-FAIL')) {
      return { delivered: false, failureReason: '通道返回：家属号码无效' };
    }
    return { delivered: true, failureReason: null };
  }
}
