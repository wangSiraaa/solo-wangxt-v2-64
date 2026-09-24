import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ScaleVersion } from '../entities/scale-version.entity';
import { ScaleItem } from '../entities/scale-item.entity';
import { ScaleOption } from '../entities/scale-option.entity';
import { ScalesController } from './scales.controller';

@Module({
  imports: [TypeOrmModule.forFeature([ScaleVersion, ScaleItem, ScaleOption])],
  controllers: [ScalesController],
})
export class ScalesModule {}
