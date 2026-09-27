import mysql from 'mysql2/promise';
import dotenv from 'dotenv';
dotenv.config();

async function run() {
  const rawUrl = process.env.DATABASE_URL;
  console.log('Connecting to DB with URL:', rawUrl ? 'URL present' : 'No URL');
  
  const pool = mysql.createPool({
    uri: rawUrl,
    waitForConnections: true,
    connectionLimit: 5,
    ssl: { rejectUnauthorized: false }
  });

  const [res] = await pool.query('SELECT 1 as ok, DATABASE() as db');
  console.log('Connected to:', res);

  console.log('Modifying columns bus_route_id, bus_route_name, stopping_name to allow NULL...');
  await pool.query('ALTER TABLE students MODIFY COLUMN bus_route_id INT(11) NULL DEFAULT NULL');
  await pool.query('ALTER TABLE students MODIFY COLUMN bus_route_name VARCHAR(200) NULL DEFAULT NULL');
  await pool.query('ALTER TABLE students MODIFY COLUMN stopping_name VARCHAR(150) NULL DEFAULT NULL');
  console.log('✅ Modified route & stopping columns to allow NULL.');

  const [cols] = await pool.query('DESCRIBE students');
  const hasHostel = cols.some(c => c.Field === 'is_hostel');
  if (!hasHostel) {
    await pool.query("ALTER TABLE students ADD COLUMN is_hostel TINYINT(1) NOT NULL DEFAULT 0 COMMENT '1 if hostel student, 0 if day scholar' AFTER year_or_section");
    console.log('✅ Added `is_hostel` column to students table.');
  } else {
    console.log('ℹ️ `is_hostel` column already exists.');
  }

  const [finalCols] = await pool.query('DESCRIBE students');
  console.log('Current schema columns:');
  finalCols.forEach(c => {
    console.log(` - ${c.Field}: ${c.Type} | Null: ${c.Null} | Default: ${c.Default}`);
  });

  await pool.end();
  console.log('🎉 Migration finished successfully.');
}

run().catch(err => {
  console.error('Migration error:', err);
  process.exit(1);
});
