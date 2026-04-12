import { Pool } from 'pg';
import dotenv from 'dotenv';
dotenv.config();

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function run() {
  const { rows } = await pool.query('SELECT role, email, roll_number, name FROM students LIMIT 5');
  console.log(rows);
  process.exit();
}
run();
