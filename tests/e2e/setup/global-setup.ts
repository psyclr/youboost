import { Client } from 'pg';
import { execSync } from 'node:child_process';
import path from 'node:path';

const DEV_DB_URL = 'postgresql://youboost:youboost_dev_password@localhost:5432/youboost_dev';
const TEST_DB_URL = 'postgresql://youboost:youboost_dev_password@localhost:5432/youboost_test';

export default async function globalSetup(): Promise<void> {
  const client = new Client({ connectionString: DEV_DB_URL });
  await client.connect();

  const result = await client.query("SELECT 1 FROM pg_database WHERE datname = 'youboost_test'");

  if (result.rows.length === 0) {
    await client.query('CREATE DATABASE youboost_test');
  }

  await client.end();

  const projectRoot = path.resolve(__dirname, '../../..');
  execSync('npx prisma migrate deploy', {
    cwd: projectRoot,
    env: { ...process.env, DATABASE_URL: TEST_DB_URL },
    stdio: 'pipe',
  });
}
