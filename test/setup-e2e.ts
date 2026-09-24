/**
 * e2e 测试环境：以独立 ESM 子进程启动用户态嵌入式 PostgreSQL。
 */
import { spawn, ChildProcess } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';

const DATA_DIR = path.resolve(process.cwd(), '.pg-test-data');
const PORT = 55433;

let child: ChildProcess | null = null;

function waitForReady(proc: ChildProcess): Promise<void> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(
      () => reject(new Error('嵌入式 PostgreSQL 启动超时')),
      90_000,
    );
    proc.stdout!.on('data', (chunk) => {
      if (chunk.toString().includes('READY')) {
        clearTimeout(timer);
        resolve();
      }
    });
    proc.stderr!.on('data', () => {
      /* postgres 日志忽略 */
    });
    proc.on('exit', (code) => {
      clearTimeout(timer);
      reject(new Error(`嵌入式 PostgreSQL 提前退出 code=${code}`));
    });
  });
}

beforeAll(async () => {
  fs.rmSync(DATA_DIR, { recursive: true, force: true });
  child = spawn(
    'node',
    [path.resolve(__dirname, 'embedded-server.mjs'), DATA_DIR, String(PORT)],
    { stdio: ['ignore', 'pipe', 'pipe'] },
  );
  await waitForReady(child);

  process.env.DB_HOST = '127.0.0.1';
  process.env.DB_PORT = String(PORT);
  process.env.DB_USERNAME = 'postgres';
  process.env.DB_PASSWORD = 'postgres';
  process.env.DB_DATABASE = 'eldercare_test';
}, 120_000);

afterAll(async () => {
  if (child) {
    child.kill('SIGTERM');
    await new Promise((r) => child!.on('exit', r));
    child = null;
  }
}, 30_000);
