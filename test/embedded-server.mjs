/**
 * 独立 ESM 进程入口（Jest 的脚本运行器无法 require 纯 ESM 包）。
 * 用法：node embedded-server.mjs <dataDir> <port>
 * 启动成功后向 stdout 打印 READY，收到 SIGTERM/SIGINT 时优雅停止。
 */
import EmbeddedPostgres from 'embedded-postgres';

const [, , databaseDir, portStr] = process.argv;
const port = Number(portStr);

const server = new EmbeddedPostgres({
  databaseDir,
  user: 'postgres',
  password: 'postgres',
  port,
  persistent: true,
});

async function main() {
  const fs = await import('fs');
  if (!fs.existsSync(`${databaseDir}/PG_VERSION`)) {
    await server.initialise();
  }
  await server.start();
  try {
    await server.createDatabase('eldercare_test');
  } catch {
    /* 已存在忽略 */
  }
  process.stdout.write('READY\n');
}

async function shutdown() {
  try {
    await server.stop();
  } finally {
    process.exit(0);
  }
}
process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
