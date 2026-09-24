import { Column, CreateDateColumn, Entity, PrimaryColumn } from 'typeorm';

/**
 * 幂等记录：相同 resident + action + key 的重复请求重放首次结果，
 * 不重复生成确认/告知/费用区间。
 */
@Entity('idempotency_records')
export class IdempotencyRecord {
  @PrimaryColumn({ type: 'varchar', length: 128 })
  key: string;

  @Column({ type: 'uuid', name: 'resident_id', nullable: true })
  residentId: string | null;

  @Column({ type: 'varchar', length: 32 })
  action: string;

  @Column({ type: 'int' })
  status: number;

  @Column({ type: 'jsonb' })
  response: unknown;

  @CreateDateColumn({ type: 'timestamptz', name: 'created_at' })
  createdAt: Date;
}
