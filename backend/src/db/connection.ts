import { Pool, PoolClient, QueryResult, QueryResultRow } from 'pg';
import dotenv from 'dotenv';

dotenv.config({ path: '../.env' });

const DATABASE_URL = process.env.DATABASE_URL || 'postgresql://yashraj:password@localhost:5432/dormsphere';
const USE_SSL = !/localhost|127\.0\.0\.1|@db:/.test(DATABASE_URL);

const pool = new Pool({
  connectionString: DATABASE_URL,
  ssl: USE_SSL ? { rejectUnauthorized: false } : undefined,
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000,
});

pool.on('error', (err) => {
  console.error('Unexpected PostgreSQL pool error:', err);
});

/** Run a parameterized query. All routes use this. */
export async function query<T extends QueryResultRow = any>(
  text: string,
  params?: any[],
): Promise<QueryResult<T>> {
  return pool.query<T>(text, params);
}

export async function withTransaction<T>(
  handler: (client: PoolClient) => Promise<T>,
): Promise<T> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await handler(client);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

/**
 * Connect with resilient retry logic.
 * In Docker, the backend container often starts before PostgreSQL is ready.
 * On ECONNREFUSED, we wait 2 seconds and try again.
 */
const MAX_RETRIES = 15;     // 15 × 2s = 30 seconds max wait
const RETRY_DELAY_MS = 2000;

export async function connectDB(): Promise<void> {
  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      const client = await pool.connect();
      const res = await client.query('SELECT NOW()');
      client.release();
      console.log(`🗄️  PostgreSQL connected successfully at ${res.rows[0].now} (attempt ${attempt})`);
      return; // ✅ Success — break out
    } catch (error: any) {
      const isRetryable =
        error.code === 'ECONNREFUSED' ||
        error.code === 'ENOTFOUND' ||
        error.code === 'EAI_AGAIN' ||
        error.code === '57P03' ||       // PG "cannot connect now" (starting up)
        error.message?.includes('Connection terminated unexpectedly');

      if (isRetryable && attempt < MAX_RETRIES) {
        console.warn(`⏳ PostgreSQL not ready (${error.code || error.message}). Retry ${attempt}/${MAX_RETRIES} in ${RETRY_DELAY_MS / 1000}s...`);
        await new Promise((resolve) => setTimeout(resolve, RETRY_DELAY_MS));
      } else {
        console.error(`❌ PostgreSQL connection failed after ${attempt} attempt(s):`, error.message || error);
        process.exit(1);
      }
    }
  }
}

export { pool };
export default pool;
