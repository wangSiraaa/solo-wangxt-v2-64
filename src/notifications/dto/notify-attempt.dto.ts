import { IsBoolean, IsOptional } from 'class-validator';

export class NotifyAttemptDto {
  /** 演示用：强制本次送达失败（模拟通道异常），记录失败原因 */
  @IsOptional()
  @IsBoolean()
  simulateFail?: boolean;
}
