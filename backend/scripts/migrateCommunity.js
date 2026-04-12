const { Client } = require('pg');
require('dotenv').config({ path: '../.env' });

const client = new Client({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

async function migrate() {
  await client.connect();
  console.log('Connected to DB. Creating community tables...');

  await client.query(`
    -- Lost and Found Table
    CREATE TABLE IF NOT EXISTS lost_and_found (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        item_type VARCHAR(10) CHECK (item_type IN ('lost', 'found')),
        title VARCHAR(100) NOT NULL,
        description TEXT NOT NULL,
        location VARCHAR(100),
        image_url TEXT,
        reported_by UUID NOT NULL REFERENCES students(id),
        status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'claimed', 'resolved')),
        created_at TIMESTAMP DEFAULT NOW()
    );

    -- Public Grievances Table
    CREATE TABLE IF NOT EXISTS public_grievances (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        student_id UUID NOT NULL REFERENCES students(id),
        title VARCHAR(150) NOT NULL,
        description TEXT NOT NULL,
        category VARCHAR(50),
        is_anonymous BOOLEAN DEFAULT false,
        status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'resolved')),
        created_at TIMESTAMP DEFAULT NOW(),
        resolved_at TIMESTAMP,
        resolved_by UUID REFERENCES students(id)
    );

    -- Grievance Upvotes tracking
    CREATE TABLE IF NOT EXISTS grievance_upvotes (
        grievance_id UUID NOT NULL REFERENCES public_grievances(id) ON DELETE CASCADE,
        student_id UUID NOT NULL REFERENCES students(id),
        PRIMARY KEY (grievance_id, student_id)
    );
  `);

  console.log('✅ Community Tables injected successfully.');
  await client.end();
}

migrate().catch(console.error);
