import { Pool } from 'pg';
import { config } from './env';

const poolConfig: any = {
  host: config.database.host,
  port: config.database.port,
  database: config.database.name,
  user: config.database.user,
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
};

// Only add password if it's a non-empty string
const dbPassword = config.database.password;
if (dbPassword && typeof dbPassword === 'string' && dbPassword.trim().length > 0) {
  poolConfig.password = dbPassword;
}

export const pool = new Pool(poolConfig);

pool.on('error', (err) => {
  console.error('Unexpected error on idle client', err);
  process.exit(-1);
});

export const query = async (text: string, params?: any[]) => {
  const start = Date.now();
  try {
    const res = await pool.query(text, params);
    const duration = Date.now() - start;
    console.log('Executed query', { text, duration, rows: res.rowCount });
    return res;
  } catch (error) {
    console.error('Database query error:', error);
    throw error;
  }
};