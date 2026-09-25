import mysql from 'mysql2/promise';

const RAILWAY_URL = 'mysql://root:ShVKUYLNuWhvThDtPuQYaFAwGBGCDJQg@autorack.proxy.rlwy.net:11784/railway';

async function main() {
  const connection = await mysql.createConnection({
    uri: RAILWAY_URL,
    ssl: { rejectUnauthorized: false },
  });

  try {
    await connection.query("ALTER TABLE students ADD COLUMN bus_route_name VARCHAR(200) NOT NULL DEFAULT '' AFTER bus_route_id");
    console.log('✅ Added bus_route_name column to students table');
  } catch (err) {
    console.log('Column note:', err.message);
  }

  const [cols] = await connection.query('DESCRIBE students');
  console.log('✅ Students table columns:', cols.map(c => c.Field).join(', '));

  await connection.end();
}

main().catch(console.error);
