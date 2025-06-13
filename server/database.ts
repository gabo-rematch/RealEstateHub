import { Pool } from 'pg';

const DATABASE_URL = process.env.DATABASE_URL;

console.log('DATABASE_URL configured:', DATABASE_URL ? 'Yes' : 'No');
console.log('First 50 chars of DATABASE_URL:', DATABASE_URL?.substring(0, 50));

const pool = new Pool({
  connectionString: DATABASE_URL,
  ssl: {
    rejectUnauthorized: false
  }
});

export async function queryDatabase(query: string, params: any[] = []) {
  const client = await pool.connect();
  try {
    const result = await client.query(query, params);
    return result.rows;
  } catch (error) {
    console.error('Database query error:', error);
    throw error;
  } finally {
    client.release();
  }
}

export async function testConnection() {
  try {
    const result = await queryDatabase('SELECT NOW() as current_time');
    console.log('Database connection successful:', result[0]);
    return true;
  } catch (error) {
    console.error('Database connection failed:', error);
    return false;
  }
}