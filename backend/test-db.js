const { Pool } = require('pg');

const DATABASE_URL = 'postgresql://yashraj:password@localhost:5432/dormsphere';

const pool = new Pool({
  connectionString: DATABASE_URL,
});

async function run() {
  try {
    const client = await pool.connect();
    console.log('Connected to DB');
    
    // Check if students exist
    const email = '123CS0076@iiitk.ac.in';
    const rollNumber = '123CS0076';
    
    const { rows: existing } = await client.query(
      'SELECT id FROM students WHERE email = $1 OR ($2::text IS NOT NULL AND roll_number = $2::text) LIMIT 1',
      [email, rollNumber || null]
    );
    console.log('Existing students:', existing);
    
    const otp = "123456";
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000);
    
    await client.query("DELETE FROM otps WHERE email = $1 AND purpose = 'registration'", [email]);
    console.log('Deleted old otps');
    
    await client.query(
      'INSERT INTO otps (email, otp, purpose, expires_at) VALUES ($1, $2, $3, $4)',
      [email, otp, 'registration', expiresAt]
    );
    console.log('Inserted new otp');
    
    client.release();
    process.exit(0);
  } catch (err) {
    console.error('Error:', err);
    process.exit(1);
  }
}

run();
