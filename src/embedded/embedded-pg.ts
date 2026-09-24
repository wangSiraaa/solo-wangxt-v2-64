/**
 * 用户态嵌入式 PostgreSQL 生命周期管理。
 * 仅当未配置外部 DB_HOST 时启用（演示环境无 root / 无系统 PG 也可运行）。
 */
import EmbeddedPostgres from 'embedded-postgres';
import * as fs from 'fs';
import * as path from 'path';

let server: EmbeddedPostgres | null = null;

export async function startEmbeddedPostgres(): Promise<void> {
  if (process.env.DB_HOST) return; // 使用外部 PostgreSQL

  const port = Number(process.env.EMBEDDED_PG_PORT ?? 55432);
  const databaseDir = path.resolve(
    process.env.EMBEDDED_PG_DATA_DIR ?? '.pg-data',
  );
  const alreadyInitialized = fs.existsSync(path.join(databaseDir, 'PG_VERSION'));

  server = new EmbeddedPostgres({
    databaseDir,
    user: process.env.DB_USERNAME ?? 'postgres',
    password: process.env.DB_PASSWORD ?? 'postgres',
    port,
    persistent: true,
  });

  if (!alreadyInitialized) {
    await server.initialise();
  }
  await server.start();

  const dbName = process.env.DB_DATABASE ?? 'eldercare';
  try {
    await server.createDatabase(dbName);
  } catch (e: any) {
    // 数据库已存在属正常（重复启动）
    if (!String(e?.message ?? e).includes('already exists')) throw e;
  }

  // TypeORM / pg 驱动连接参数
  process.env.DB_HOST = '127.0.0.1';
  process.env.DB_PORT = String(port);

  const stop = async () => {
    if (server) {
      try {
        await server.stop();
      } catch {
        /* 退出时忽略 */
      }
    }
    process.exit(0);
  };
  process.once('SIGINT', stop);
  process.once('SIGTERM', stop);
}

export async function stopEmbeddedPostgres(): Promise<void> {
  if (server) await server.stop();
  server = null;
}
