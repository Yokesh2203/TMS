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
const rawDatabaseUrl = 
  process.env.DATABASE_URL || 
  process.env.MYSQL_URL || 
  process.env.MYSQL_PRIVATE_URL || 
  process.env.MYSQL_PUBLIC_URL;

const defaultDbName = (process.env.MYSQLHOST || process.env.MYSQL_URL) ? 'railway' : 'nadar_tms';

const dbConfig = {
  host: process.env.DB_HOST || process.env.MYSQLHOST || 'localhost',
  port: Number(process.env.DB_PORT || process.env.MYSQLPORT) || 3306,
  user: process.env.DB_USER || process.env.MYSQLUSER || 'root',
  password: process.env.DB_PASSWORD || process.env.MYSQLPASSWORD || '',
  database: process.env.DB_NAME || process.env.MYSQLDATABASE || defaultDbName,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
};

let pool = null;

function getPool() {
  if (!pool) {
    if (rawDatabaseUrl) {
      console.log('📡 Connecting to MySQL database via connection URL...');
      pool = mysql.createPool({
        uri: rawDatabaseUrl,
        waitForConnections: true,
        connectionLimit: 10,
        queueLimit: 0,
        ssl: process.env.DB_SSL === 'false' ? undefined : { rejectUnauthorized: false },
      });
    } else {
      const isCloudHost = dbConfig.host && dbConfig.host !== 'localhost' && dbConfig.host !== '127.0.0.1';
      console.log(`📡 Connecting to MySQL host: ${dbConfig.host}:${dbConfig.port}, database: ${dbConfig.database}`);
      pool = mysql.createPool({
        ...dbConfig,
        ssl: (process.env.DB_SSL === 'true' || isCloudHost) ? { rejectUnauthorized: false } : undefined,
      });
    }
  }
  return pool;
}

// Auto-create students table if not exists
async function initializeDatabase() {
  try {
    // Attempt local DB creation if running on localhost
    if (!rawDatabaseUrl && (dbConfig.host === 'localhost' || dbConfig.host === '127.0.0.1')) {
      try {
        const initConn = await mysql.createConnection({
          host: dbConfig.host,
          port: dbConfig.port,
          user: dbConfig.user,
          password: dbConfig.password,
        });
        await initConn.query(`CREATE DATABASE IF NOT EXISTS \`${dbConfig.database}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`);
        await initConn.end();
      } catch (e) {
        // Ignored for environments where DB is pre-created
      }
    }

    const db = getPool();
    const [verResult] = await db.query('SELECT 1 as connected, DATABASE() as db');
    console.log(`✅ Connected to MySQL database "${verResult[0]?.db || 'default'}" successfully.`);

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
      if (!alterErr.message?.includes('Duplicate column')) {
        console.warn('ALTER TABLE note:', alterErr.message);
      }
    }

    // Back-fill bus_route_name for existing rows that have empty name
    try {
      await db.query(`
        UPDATE students s
        LEFT JOIN routes r ON s.bus_route_id = r.id
        SET s.bus_route_name = COALESCE(CONCAT(r.route_code, ' - ', r.route_name), CONCAT('Route #', s.bus_route_id))
        WHERE s.bus_route_name = '' OR s.bus_route_name IS NULL
      `);
    } catch (bfErr) {
      // Ignore if table routes is empty or not yet populated
    }

    // Create admins table if not exists to store admin credentials securely in database
    await db.query(`
      CREATE TABLE IF NOT EXISTS \`admins\` (
        \`id\` INT(11) NOT NULL AUTO_INCREMENT,
        \`username\` VARCHAR(100) NOT NULL UNIQUE,
        \`password\` VARCHAR(255) NOT NULL,
        \`name\` VARCHAR(150) NOT NULL DEFAULT 'Administrator',
        \`role\` VARCHAR(50) NOT NULL DEFAULT 'admin',
        \`created_at\` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        \`updated_at\` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        PRIMARY KEY (\`id\`)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

    // Seed default admin in database if not already present
    const seedUser = process.env.ADMIN_USERNAME || 'admin';
    const seedPass = process.env.ADMIN_PASSWORD || 'admin123';
    await db.query(`
      INSERT INTO \`admins\` (\`username\`, \`password\`, \`name\`, \`role\`)
      VALUES (?, ?, 'System Administrator', 'admin')
      ON DUPLICATE KEY UPDATE \`username\` = \`username\`;
    `, [seedUser, seedPass]);
    console.log('✅ MySQL Database connected, `students` and `admins` tables verified.');
  } catch (error) {
    console.error('⚠️ MySQL connection note:', error.message || error.code || error);
    if (!rawDatabaseUrl && dbConfig.host === 'localhost') {
      console.warn('💡 Tip: No cloud database URL detected. In Railway, add DATABASE_URL in your service Variables tab.');
    }
  }
}

// 1. Health check endpoint
app.get('/api/health', async (req, res) => {
  try {
    const db = getPool();
    const [rows] = await db.query('SELECT DATABASE() as db, VERSION() as ver');
    res.json({
      status: 'connected',
      database: rows[0]?.db || dbConfig.database,
      host: rawDatabaseUrl ? 'railway-cluster' : dbConfig.host,
      version: rows[0]?.ver,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    res.status(503).json({
      status: 'disconnected',
      error: error.message,
      hint: 'Ensure database URL or MySQL credentials are provided in Railway Variables.',
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

// 4. Admin Authentication Endpoints (Backed by MySQL Database)
// Admin Login
app.post('/api/admin/login', async (req, res) => {
  try {
    const { username, password } = req.body || {};
    if (!username || !password) {
      return res.status(400).json({
        success: false,
        error: 'Username and password are required.',
      });
    }

    const cleanUser = username.trim();
    const cleanPass = password;

    const db = getPool();
    // Query admin record directly from MySQL table `admins`
    const [rows] = await db.query(
      'SELECT id, username, password, name, role FROM admins WHERE username = ? LIMIT 1',
      [cleanUser]
    );

    let isAuthenticated = false;
    let matchedUser = null;

    if (rows && rows.length > 0) {
      const adminRecord = rows[0];
      if (adminRecord.password === cleanPass) {
        isAuthenticated = true;
        matchedUser = {
          id: adminRecord.id,
          username: adminRecord.username,
          name: adminRecord.name || 'Administrator',
          role: adminRecord.role || 'admin',
        };
      }
    } else {
      // Fallback check against environment variables in case table was just created
      const fallbackUser = process.env.ADMIN_USERNAME || 'admin';
      const fallbackPass = process.env.ADMIN_PASSWORD || 'admin123';
      if (cleanUser === fallbackUser && cleanPass === fallbackPass) {
        isAuthenticated = true;
        matchedUser = {
          id: 1,
          username: fallbackUser,
          name: 'Administrator',
          role: 'admin',
        };
      }
    }

    if (isAuthenticated && matchedUser) {
      const sessionPayload = {
        username: matchedUser.username,
        role: matchedUser.role,
        loggedInAt: new Date().toISOString(),
      };
      const token = Buffer.from(JSON.stringify(sessionPayload)).toString('base64');

      console.log(`🔐 Admin "${matchedUser.username}" verified from database & logged in.`);
      return res.json({
        success: true,
        token,
        user: matchedUser,
      });
    }

    return res.status(401).json({
      success: false,
      error: 'Invalid administrator username or password.',
    });
  } catch (error) {
    console.error('Admin login error:', error);
    res.status(500).json({ success: false, error: 'Database error during authentication.' });
  }
});

// Verify Admin Token
app.get('/api/admin/verify', async (req, res) => {
  try {
    const authHeader = req.headers.authorization || req.headers['x-admin-token'];
    if (!authHeader) {
      return res.status(401).json({ success: false, error: 'No authorization token provided.' });
    }

    const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : authHeader;
    const decoded = JSON.parse(Buffer.from(token, 'base64').toString('utf-8'));

    if (decoded && decoded.role === 'admin' && decoded.username) {
      try {
        const db = getPool();
        const [rows] = await db.query(
          'SELECT id, username, name, role FROM admins WHERE username = ? LIMIT 1',
          [decoded.username]
        );

        const userRecord = rows && rows.length > 0 ? rows[0] : {
          username: decoded.username,
          name: 'Administrator',
          role: 'admin',
        };

        return res.json({
          success: true,
          user: {
            username: userRecord.username,
            name: userRecord.name || 'Administrator',
            role: userRecord.role || 'admin',
            loggedInAt: decoded.loggedInAt,
          },
        });
      } catch {
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
    }

    return res.status(401).json({ success: false, error: 'Invalid admin session token.' });
  } catch {
    return res.status(401).json({ success: false, error: 'Malformed or expired admin session token.' });
  }
});

// Change Admin Password in Database
app.post('/api/admin/change-password', async (req, res) => {
  try {
    const { username, currentPassword, newPassword } = req.body || {};
    if (!username || !currentPassword || !newPassword) {
      return res.status(400).json({ success: false, error: 'Missing required credentials.' });
    }

    const db = getPool();
    const [rows] = await db.query(
      'SELECT id, password FROM admins WHERE username = ? LIMIT 1',
      [username.trim()]
    );

    if (!rows || rows.length === 0 || rows[0].password !== currentPassword) {
      return res.status(401).json({ success: false, error: 'Current password is incorrect.' });
    }

    await db.query('UPDATE admins SET password = ? WHERE id = ?', [newPassword, rows[0].id]);
    console.log(`🔑 Password updated in database for admin "${username}".`);
    res.json({ success: true, message: 'Password updated successfully in database.' });
  } catch (error) {
    console.error('Error changing admin password:', error);
    res.status(500).json({ success: false, error: error.message });
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

// 6. Clear all student records and reset AUTO_INCREMENT to 1
app.post('/api/admin/clear-students', async (req, res) => {
  try {
    const db = getPool();
    await db.query('TRUNCATE TABLE students');
    console.log('🧹 Truncated students table. S.No / id reset to 1.');
    res.json({ success: true, message: 'All student records cleared and S.No reset to 1.' });
  } catch (error) {
    console.error('Error clearing students table:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Start Express server
app.listen(PORT, async () => {
  console.log(`🚀 TMS Backend Server running on http://localhost:${PORT}`);
  await initializeDatabase();
});
