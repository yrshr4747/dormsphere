const { Client } = require('pg');
require('dotenv').config({ path: '../.env' });

const client = new Client({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

async function check() {
  await client.connect();
  const { rows } = await client.query("SELECT email, password_hash, roll_number FROM students LIMIT 5");
  console.log(rows);
  await client.end();
}

check().catch(console.error);
