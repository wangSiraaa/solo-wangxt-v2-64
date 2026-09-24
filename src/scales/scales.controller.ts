import { Controller, Get, NotFoundException, Param } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ScaleVersion } from '../entities/scale-version.entity';
import { ScaleItem } from '../entities/scale-item.entity';
import { ScaleOption } from '../entities/scale-option.entity';

@Controller('scales')
export class ScalesController {
  constructor(
    @InjectRepository(ScaleVersion)
    private readonly scaleRepo: Repository<ScaleVersion>,
    @InjectRepository(ScaleItem)
    private readonly itemRepo: Repository<ScaleItem>,
    @InjectRepository(ScaleOption)
    private readonly optionRepo: Repository<ScaleOption>,
  ) {}

  /** 查看量表版本：原始条目、原始选项、NA 分母策略、定级阈值 */
  @Get(':id')
  async detail(@Param('id') id: string) {
    const scale = await this.scaleRepo.findOne({ where: { id } });
    if (!scale) throw new NotFoundException('量表版本不存在');
    const [items, options] = await Promise.all([
      this.itemRepo.find({
        where: { scaleVersion: { id } },
        order: { orderIndex: 'ASC' },
      }),
      this.optionRepo.find({
        where: { scaleVersion: { id } },
        order: { orderIndex: 'ASC' },
      }),
    ]);
    return { scale, items, options };
  }
}
