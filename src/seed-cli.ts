import 'reflect-metadata';
import { loadEnvFile } from './common/env';
import { startEmbeddedPostgres, stopEmbeddedPostgres } from './embedded/embedded-pg';
import { buildInitializedDataSource } from './database/data-source';

/** 独立初始化脚本：启动嵌入式 PG → 建表 → 写入演示量表/选项/日费规则 */
loadEnvFile();

(async () => {
  await startEmbeddedPostgres();
  const ds = await buildInitializedDataSource();
  // eslint-disable-next-line no-console
  console.log('Seed 完成：DEMO_ADL v1.0.0（10 条目/原始选项）与示例日费规则已就绪。');
  await ds.destroy();
  await stopEmbeddedPostgres();
})().catch((e) => {
  // eslint-disable-next-line no-console
  console.error(e);
  process.exit(1);
});
