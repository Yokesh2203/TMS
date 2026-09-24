import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import mysql from 'mysql2/promise';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());

// MySQL connection pool configuration
const dbConfig = {
  host: process.env.DB_HOST || 'localhost',
  port: Number(process.env.DB_PORT) || 3306,
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'nadar_tms',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
};

let pool = null;

function getPool() {
  if (!pool) {
    pool = mysql.createPool(dbConfig);
  }
  return pool;
}

// Auto-create students table if not exists
async function initializeDatabase() {
  try {
    // First, create the database if it doesn't exist
    const initConn = await mysql.createConnection({
      host: dbConfig.host,
      port: dbConfig.port,
      user: dbConfig.user,
      password: dbConfig.password,
    });
    await initConn.query(`CREATE DATABASE IF NOT EXISTS \`${dbConfig.database}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`);
    await initConn.end();
    console.log(`✅ Database \`${dbConfig.database}\` is ready.`);

    const db = getPool();

    // Create students table if it doesn't exist
    await db.query(`
      CREATE TABLE IF NOT EXISTS \`students\` (
        \`id\` INT(11) NOT NULL AUTO_INCREMENT,
        \`student_name\` VARCHAR(150) NOT NULL,
        \`identifier\` VARCHAR(50) NOT NULL COMMENT 'Register No or Admission No',
        \`institution_id\` INT(11) NOT NULL,
        \`department_or_class\` VARCHAR(100) NOT NULL,
        \`year_or_section\` VARCHAR(50) NOT NULL,
        \`bus_route_id\` INT(11) NOT NULL,
        \`bus_route_name\` VARCHAR(200) NOT NULL DEFAULT '' COMMENT 'Route code and name e.g. R-19 - Bodi',
        \`stopping_name\` VARCHAR(150) NOT NULL,
        \`created_at\` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        \`updated_at\` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        PRIMARY KEY (\`id\`),
        KEY \`institution_id\` (\`institution_id\`),
        KEY \`bus_route_id\` (\`bus_route_id\`)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

    // Migrate: add bus_route_name column to existing tables that don't have it yet
    try {
      await db.query(`ALTER TABLE \`students\` ADD COLUMN \`bus_route_name\` VARCHAR(200) NOT NULL DEFAULT '' COMMENT 'Route code and name' AFTER \`bus_route_id\``);
      console.log('✅ Added bus_route_name column to students table.');
    } catch (alterErr) {
      // Column likely already exists — ignore duplicate column error
      if (!alterErr.message.includes('Duplicate column')) {
        console.warn('ALTER TABLE note:', alterErr.message);
      }
    }

    // Back-fill bus_route_name for existing rows that have empty name
    await db.query(`
      UPDATE students s
      LEFT JOIN routes r ON s.bus_route_id = r.id
      SET s.bus_route_name = COALESCE(CONCAT(r.route_code, ' - ', r.route_name), CONCAT('Route #', s.bus_route_id))
      WHERE s.bus_route_name = '' OR s.bus_route_name IS NULL
    `);

    console.log('✅ MySQL Database connected & `students` table verified.');
  } catch (error) {
    console.warn('⚠️ MySQL connection note:', error.message);
  }
}

// 1. Health check endpoint
app.get('/api/health', async (req, res) => {
  try {
    const db = getPool();
    await db.query('SELECT 1');
    res.json({
      status: 'connected',
      database: dbConfig.database,
      host: dbConfig.host,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    res.status(503).json({
      status: 'disconnected',
      error: error.message,
      hint: 'Ensure XAMPP MySQL is started and nadar_tms database is imported in phpMyAdmin.',
    });
  }
});

// 2. Fetch all student records
app.get('/api/students', async (req, res) => {
  try {
    const db = getPool();
    const [rows] = await db.query(`
      SELECT 
        s.id,
        s.student_name AS studentName,
        s.identifier,
        s.institution_id AS institutionId,
        COALESCE(i.name, CONCAT('Institution #', s.institution_id)) AS institutionName,
        COALESCE(i.type, 'college') AS institutionType,
        s.department_or_class AS departmentOrClass,
        s.year_or_section AS yearOrSection,
        s.bus_route_id AS busRouteId,
        CASE
          WHEN s.bus_route_name IS NOT NULL AND s.bus_route_name != ''
            THEN s.bus_route_name
          ELSE COALESCE(CONCAT(r.route_code, ' - ', r.route_name), CONCAT('Route #', s.bus_route_id))
        END AS busRouteName,
        s.stopping_name AS stoppingName,
        s.created_at AS createdAt,
        s.updated_at AS updatedAt
      FROM students s
      LEFT JOIN institutions i ON s.institution_id = i.id
      LEFT JOIN routes r ON s.bus_route_id = r.id
      ORDER BY s.id DESC
    `);
    res.json({ success: true, count: rows.length, data: rows });
  } catch (error) {
    console.error('Error fetching students:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// 3. Insert a student record directly into MySQL
app.post('/api/students', async (req, res) => {
  try {
    const {
      studentName,
      identifier,
      institutionId,
      departmentOrClass,
      yearOrSection,
      busRouteId,
      busRouteName,
      stoppingName,
    } = req.body;

    if (!studentName || !identifier || !institutionId || !busRouteId || !stoppingName) {
      return res.status(400).json({
        success: false,
        error: 'Missing required student enrollment fields.',
      });
    }

    const db = getPool();

    // If busRouteName not sent from frontend, look it up from routes table
    let routeName = busRouteName ? busRouteName.trim() : '';
    if (!routeName) {
      try {
        const [routeRows] = await db.query(
          `SELECT CONCAT(route_code, ' - ', route_name) AS name FROM routes WHERE id = ? LIMIT 1`,
          [parseInt(busRouteId, 10)]
        );
        routeName = routeRows[0]?.name || `Route #${busRouteId}`;
      } catch {
        routeName = `Route #${busRouteId}`;
      }
    }

    const [result] = await db.query(
      `INSERT INTO students 
        (student_name, identifier, institution_id, department_or_class, year_or_section, bus_route_id, bus_route_name, stopping_name)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        studentName.trim(),
        identifier.trim(),
        parseInt(institutionId, 10),
        departmentOrClass ? departmentOrClass.trim() : '',
        yearOrSection ? yearOrSection.trim() : '',
        parseInt(busRouteId, 10),
        routeName,
        stoppingName.trim(),
      ]
    );

    const insertedId = result.insertId;

    // Fetch the newly inserted record
    const [rows] = await db.query(`
      SELECT 
        s.id,
        s.student_name AS studentName,
        s.identifier,
        s.institution_id AS institutionId,
        COALESCE(i.name, CONCAT('Institution #', s.institution_id)) AS institutionName,
        COALESCE(i.type, 'college') AS institutionType,
        s.department_or_class AS departmentOrClass,
        s.year_or_section AS yearOrSection,
        s.bus_route_id AS busRouteId,
        s.bus_route_name AS busRouteName,
        s.stopping_name AS stoppingName,
        s.created_at AS createdAt
      FROM students s
      LEFT JOIN institutions i ON s.institution_id = i.id
      WHERE s.id = ?
    `, [insertedId]);

    const newStudent = rows[0] || {
      id: insertedId,
      studentName,
      identifier,
      institutionId,
      departmentOrClass,
      yearOrSection,
      busRouteId,
      busRouteName: routeName,
      stoppingName,
      createdAt: new Date().toISOString(),
    };

    console.log(`📥 Saved student "${studentName}" (${identifier}) → Route: ${routeName} | Stop: ${stoppingName}`);
    res.status(201).json({ success: true, data: newStudent });
  } catch (error) {
    console.error('Error inserting student:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// 4. Admin Authentication Endpoints
const ADMIN_CONFIG = {
  username: process.env.ADMIN_USERNAME || 'admin',
  password: process.env.ADMIN_PASSWORD || 'admin123',
};

// Admin Login
app.post('/api/admin/login', (req, res) => {
  try {
    const { username, password } = req.body || {};
    if (!username || !password) {
      return res.status(400).json({
        success: false,
        error: 'Username and password are required.',
      });
    }

    if (
      username.trim() === ADMIN_CONFIG.username &&
      password === ADMIN_CONFIG.password
    ) {
      // Create session token
      const sessionPayload = {
        username: ADMIN_CONFIG.username,
        role: 'admin',
        loggedInAt: new Date().toISOString(),
      };
      const token = Buffer.from(JSON.stringify(sessionPayload)).toString('base64');

      console.log(`🔐 Admin "${ADMIN_CONFIG.username}" successfully logged in.`);
      return res.json({
        success: true,
        token,
        user: {
          username: ADMIN_CONFIG.username,
          name: 'Administrator',
          role: 'admin',
        },
      });
    }

    return res.status(401).json({
      success: false,
      error: 'Invalid administrator username or password.',
    });
  } catch (error) {
    console.error('Admin login error:', error);
    res.status(500).json({ success: false, error: 'Internal server error during login.' });
  }
});

// Verify Admin Token
app.get('/api/admin/verify', (req, res) => {
  try {
    const authHeader = req.headers.authorization || req.headers['x-admin-token'];
    if (!authHeader) {
      return res.status(401).json({ success: false, error: 'No authorization token provided.' });
    }

    const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : authHeader;
    const decoded = JSON.parse(Buffer.from(token, 'base64').toString('utf-8'));

    if (decoded && decoded.role === 'admin' && decoded.username === ADMIN_CONFIG.username) {
      return res.json({
        success: true,
        user: {
          username: decoded.username,
          name: 'Administrator',
          role: 'admin',
          loggedInAt: decoded.loggedInAt,
        },
      });
    }

    return res.status(401).json({ success: false, error: 'Invalid admin session token.' });
  } catch {
    return res.status(401).json({ success: false, error: 'Malformed or expired admin session token.' });
  }
});

// 5. Delete a student record
app.delete('/api/students/:id', async (req, res) => {
  try {
    const studentId = parseInt(req.params.id, 10);
    const db = getPool();
    await db.query('DELETE FROM students WHERE id = ?', [studentId]);
    res.json({ success: true, message: 'Student removed from database' });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Start Express server
app.listen(PORT, async () => {
  console.log(`🚀 TMS Backend Server running on http://localhost:${PORT}`);
  await initializeDatabase();
});
