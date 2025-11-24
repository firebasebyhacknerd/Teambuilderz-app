require('dotenv').config();
const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const { Pool } = require('pg');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const config = require('./lib/config');
const { validateBody, schemas } = require('./lib/validation');
const { startAuditStream } = require('./lib/auditStream');
const { fetchUserProfile } = require('./services/profileService');

const NODE_ENV = (process.env.NODE_ENV || '').toLowerCase();
const isTestEnv = NODE_ENV === 'test';
const app = express();
const port = config.getInt('BACKEND_PORT', 3001);
const SECRET_KEY = config.get('JWT_SECRET', isTestEnv ? 'test-secret' : undefined);
if (!SECRET_KEY) {
  console.error('JWT_SECRET environment variable is required');
  process.exit(1);
}
const isProduction = NODE_ENV === 'production';
const useSecureCookies = config.getBool('COOKIE_SECURE', isProduction);
const sameSitePolicy = config.get('COOKIE_SAMESITE', 'strict');
const defaultSkipDbSetup = config.getBool('SKIP_DB_SETUP', isTestEnv);

function createLimiter({ windowMs, max, message, name }) {
  const limiterName = name || 'rate-limit';
  const responseMessage = message || { message: 'Too many requests. Please try again later.' };

  return rateLimit({
    windowMs,
    max,
    standardHeaders: true,
    legacyHeaders: false,
    skipSuccessfulRequests: true,
    statusCode: 429,
    message: responseMessage,
    handler: (req, res, next, options) => {
      console.warn(
        `[RateLimit] ${limiterName} threshold hit`,
        JSON.stringify({
          ip: req.ip,
          path: req.originalUrl,
          max,
          windowMs,
        }),
      );
      res.status(options.statusCode).json(responseMessage);
    },
  });
}

function composeMiddleware(middlewares) {
  return (req, res, next) => {
    let idx = 0;
    const run = (err) => {
      if (err) return next(err);
      const middleware = middlewares[idx++];
      if (!middleware) return next();
      try {
        middleware(req, res, run);
      } catch (error) {
        next(error);
      }
    };
    run();
  };
}

function createLoginHandler({ db, jwtLib, bcryptLib, secret }) {
  return async (req, res) => {
    const { email, password } = req.body;
    const requestIp = req.ip;

    try {
      console.info(
        '[Auth] Login attempt received',
        JSON.stringify({
          email,
          ip: requestIp,
          userAgent: req.headers['user-agent'],
        }),
      );

      const result = await db.query('SELECT * FROM users WHERE email = $1', [email]);

      if (result.rows.length === 0) {
        console.warn(
          '[Auth] Login failed - unknown email',
          JSON.stringify({
            email,
            ip: requestIp,
          }),
        );
        return res.status(401).json({ message: 'Invalid email or password.' });
      }

      const user = result.rows[0];
      const passwordMatch = await bcryptLib.compare(password, user.password_hash);

      if (!passwordMatch) {
        console.warn(
          '[Auth] Login failed - invalid credentials',
          JSON.stringify({
            email,
            ip: requestIp,
            userId: user.id,
          }),
        );
        return res.status(401).json({ message: 'Invalid email or password.' });
      }

      const token = jwtLib.sign({ userId: user.id, role: user.role }, secret, { expiresIn: '1d' });
      res.cookie(AUTH_COOKIE_NAME, token, COOKIE_OPTIONS);

      await db.query(
        `
        UPDATE users
        SET last_login_at = CURRENT_TIMESTAMP,
            last_active_at = CURRENT_TIMESTAMP
        WHERE id = $1
      `,
        [user.id],
      );

      console.info(
        '[Auth] Login success',
        JSON.stringify({
          email,
          ip: requestIp,
          userId: user.id,
          role: user.role,
        }),
      );

      res.json({ role: user.role, name: user.name, id: user.id });
    } catch (error) {
      console.error('Login error:', error);
      res.status(500).json({ message: 'Internal server error during login.' });
    }
  };
}

const AUTH_COOKIE_NAME = 'tbz_auth';
const COOKIE_OPTIONS = {
  httpOnly: true,
  sameSite: sameSitePolicy,
  secure: useSecureCookies,
  maxAge: 24 * 60 * 60 * 1000,
};
const CLEAR_COOKIE_OPTIONS = {
  httpOnly: true,
  sameSite: sameSitePolicy,
  secure: useSecureCookies,
};
const ALLOWED_ORIGINS = (config.get('CORS_ORIGIN', 'http://localhost:3000,http://localhost:3001'))
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean);
const enforceTls = config.getBool('ENFORCE_TLS', false);
const auditLogPath = config.get('AUDIT_LOG_PATH');
const auditWebhookUrl = config.get('AUDIT_WEBHOOK_URL');
const auditCloudWatchConfig = {
  logGroupName: config.get('AUDIT_CW_LOG_GROUP'),
  logStreamName: config.get('AUDIT_CW_LOG_STREAM'),
  region: config.get('AUDIT_CW_REGION'),
  accessKeyId: config.get('AUDIT_CW_ACCESS_KEY'),
  secretAccessKey: config.get('AUDIT_CW_SECRET_KEY'),
  sessionToken: config.get('AUDIT_CW_SESSION_TOKEN'),
};
const hasAuditCloudWatch =
  auditCloudWatchConfig.logGroupName && auditCloudWatchConfig.logStreamName && auditCloudWatchConfig.region;
let auditStreamClient = null;
let automationIntervals = [];
let serverInstance = null;
const automationSchedule = {
  quotaMinutes: config.getInt('AUTOMATION_QUOTA_INTERVAL_MINUTES', 60) || 60,
  assessmentMinutes: config.getInt('AUTOMATION_ASSESSMENT_INTERVAL_MINUTES', 360) || 360,
  interviewMinutes: config.getInt('AUTOMATION_INTERVIEW_INTERVAL_MINUTES', 120) || 120,
};

const LOCAL_IP_REGEXES = [
  /^127\.(\d{1,3}\.){2}\d{1,3}$/u,
  /^10\.(\d{1,3}\.){2}\d{1,3}$/u,
  /^192\.168\.(\d{1,3})\.(\d{1,3})$/u,
  /^172\.(1[6-9]|2\d|3[0-1])\.(\d{1,3})\.(\d{1,3})$/u,
];

function isLocalNetworkOrigin(origin) {
  try {
    const url = new URL(origin);
    if (!['http:', 'https:'].includes(url.protocol)) {
      return false;
    }
    if (url.hostname === 'localhost') {
      return true;
    }
    return LOCAL_IP_REGEXES.some((regex) => regex.test(url.hostname));
  } catch (error) {
    return false;
  }
}

const authLimiter = createLimiter({
  windowMs: 5 * 60 * 1000,
  max: 10,
  name: 'auth-login',
  message: { message: 'Too many login attempts. Please try again after 5 minutes.' },
});
const analyticsLimiter = createLimiter({
  windowMs: 60 * 1000,
  max: 60,
  name: 'analytics-intake',
  message: { message: 'Too many analytics events. Please slow down.' },
});
const profileLimiter = createLimiter({
  windowMs: 60 * 1000,
  max: 10,
  name: 'profile-update',
  message: { message: 'Too many profile updates. Please try again shortly.' },
});

// Database Connection Setup
const dbConfig = {
  user: config.get('DB_USER'),
  host: config.get('DB_HOST', 'localhost'),
  database: config.get('DB_NAME'),
  password: config.get('DB_PASSWORD'),
  port: config.getInt('DB_PORT', 5432),
};

const pool = new Pool(dbConfig);

app.set('trust proxy', 1);
app.use(
  helmet({
    contentSecurityPolicy: false,
    referrerPolicy: { policy: 'no-referrer' },
    crossOriginResourcePolicy: { policy: 'same-site' },
  }),
);

// Middleware
app.use(
  composeMiddleware([
    cors({
      origin: (origin, callback) => {
        if (!origin || ALLOWED_ORIGINS.includes(origin) || isLocalNetworkOrigin(origin)) {
          callback(null, true);
        } else {
          callback(new Error('Not allowed by CORS'));
        }
      },
      credentials: true,
    }),
    bodyParser.json(),
  ]),
);

if (enforceTls) {
  app.use((req, res, next) => {
    const forwardedProto = req.headers['x-forwarded-proto'];
    const isSecure = req.secure || forwardedProto === 'https';
    if (isSecure) {
      return next();
    }
    if (req.method === 'GET' || req.method === 'HEAD') {
      return res.redirect(301, `https://${req.headers.host}${req.originalUrl}`);
    }
    return res.status(400).json({ message: 'HTTPS required.' });
  });
}

// Routes
app.get('/', (req, res) => {
  res.json({ message: 'Backend is running' });
});

// Database Schema Setup
async function ensureEnums(db) {
  await db.query(`
    CREATE TYPE user_role AS ENUM ('Admin', 'Recruiter', 'Viewer');
    CREATE TYPE candidate_stage AS ENUM ('onboarding', 'marketing', 'interviewing', 'offered', 'placed', 'inactive');
    CREATE TYPE application_status AS ENUM ('sent', 'viewed', 'shortlisted', 'interviewing', 'offered', 'hired', 'rejected');
    CREATE TYPE interview_status AS ENUM ('scheduled', 'completed', 'feedback_pending', 'rejected', 'advanced');
    CREATE TYPE assessment_status AS ENUM ('assigned', 'submitted', 'passed', 'failed', 'waived');
    CREATE TYPE reminder_status AS ENUM ('pending', 'sent', 'snoozed', 'dismissed');
    CREATE TYPE alert_status AS ENUM ('open', 'acknowledged', 'resolved');
    CREATE TYPE interview_type AS ENUM ('phone', 'video', 'in_person', 'technical', 'hr', 'final');
    CREATE TYPE attendance_status AS ENUM ('present', 'absent', 'leave', 'half-day');
    CREATE TYPE attendance_approval_status AS ENUM ('pending', 'approved', 'rejected');
  `);
}

async function ensureTables(db) {
  const statements = [
    `
      CREATE TABLE users (
        id SERIAL PRIMARY KEY,
        name VARCHAR(100) NOT NULL,
        email VARCHAR(100) UNIQUE NOT NULL,
        password_hash VARCHAR(100) NOT NULL,
        role user_role NOT NULL,
        daily_quota INTEGER DEFAULT 60,
        is_active BOOLEAN DEFAULT true,
        created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
    `,
    `
      CREATE TABLE candidates (
        id SERIAL PRIMARY KEY,
        name VARCHAR(100) NOT NULL,
        email VARCHAR(100) UNIQUE NOT NULL,
        phone VARCHAR(20),
        visa_status VARCHAR(50),
        skills TEXT[],
        experience_years INTEGER,
        current_stage candidate_stage DEFAULT 'onboarding',
        marketing_start_date DATE,
        assigned_recruiter_id INTEGER REFERENCES users(id),
        created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
    `,
    `
      CREATE TABLE documents (
        id SERIAL PRIMARY KEY,
        candidate_id INTEGER REFERENCES candidates(id) ON DELETE CASCADE,
        filename VARCHAR(255) NOT NULL,
        file_path VARCHAR(500) NOT NULL,
        file_type VARCHAR(50),
        file_size INTEGER,
        uploaded_by INTEGER REFERENCES users(id),
        created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
    `,
    `
      CREATE TABLE applications (
        id SERIAL PRIMARY KEY,
        candidate_id INTEGER REFERENCES candidates(id) ON DELETE CASCADE,
        recruiter_id INTEGER REFERENCES users(id),
        company_name VARCHAR(100) NOT NULL,
        job_title VARCHAR(100) NOT NULL,
        job_description TEXT,
        channel VARCHAR(50),
        status application_status DEFAULT 'sent',
        application_date DATE DEFAULT CURRENT_DATE,
        applications_count INTEGER DEFAULT 1,
        is_approved BOOLEAN DEFAULT false,
        approved_by INTEGER REFERENCES users(id),
        approved_at TIMESTAMP WITHOUT TIME ZONE,
        created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
    `,
    `
      CREATE TABLE interviews (
        id SERIAL PRIMARY KEY,
        candidate_id INTEGER REFERENCES candidates(id) ON DELETE CASCADE,
        application_id INTEGER REFERENCES applications(id),
        recruiter_id INTEGER REFERENCES users(id),
        company_name VARCHAR(100) NOT NULL,
        interview_type interview_type NOT NULL,
        round_number INTEGER DEFAULT 1,
        scheduled_date TIMESTAMP WITH TIME ZONE NOT NULL,
        timezone VARCHAR(50) DEFAULT 'UTC',
        status interview_status DEFAULT 'scheduled',
        feedback TEXT,
        feedback_files TEXT[],
        is_approved BOOLEAN DEFAULT false,
        approved_by INTEGER REFERENCES users(id),
        approved_at TIMESTAMP WITHOUT TIME ZONE,
        created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
    `,
    `
      CREATE TABLE assessments (
        id SERIAL PRIMARY KEY,
        candidate_id INTEGER REFERENCES candidates(id) ON DELETE CASCADE,
        application_id INTEGER REFERENCES applications(id),
        recruiter_id INTEGER REFERENCES users(id),
        assessment_platform VARCHAR(50) NOT NULL,
        assessment_type VARCHAR(50),
        assigned_date DATE DEFAULT CURRENT_DATE,
        due_date DATE NOT NULL,
        status assessment_status DEFAULT 'assigned',
        score DECIMAL(5,2),
        notes TEXT,
        is_approved BOOLEAN DEFAULT false,
        approved_by INTEGER REFERENCES users(id),
        approved_at TIMESTAMP WITHOUT TIME ZONE,
        created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
    `,
    `
      CREATE TABLE notes (
        id SERIAL PRIMARY KEY,
        candidate_id INTEGER REFERENCES candidates(id) ON DELETE CASCADE,
        application_id INTEGER REFERENCES applications(id),
        interview_id INTEGER REFERENCES interviews(id),
        assessment_id INTEGER REFERENCES assessments(id),
        author_id INTEGER REFERENCES users(id),
        content TEXT NOT NULL,
        is_private BOOLEAN DEFAULT false,
        created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
    `,
    `
      CREATE TABLE reminders (
        id SERIAL PRIMARY KEY,
        user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
        note_id INTEGER REFERENCES notes(id) ON DELETE SET NULL,
        title VARCHAR(200) NOT NULL,
        description TEXT,
        due_date TIMESTAMP WITH TIME ZONE NOT NULL,
        status reminder_status DEFAULT 'pending',
        priority INTEGER DEFAULT 1,
        created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
    `,
    `
      CREATE TABLE alerts (
        id SERIAL PRIMARY KEY,
        user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
        alert_type VARCHAR(50) NOT NULL,
        title VARCHAR(200) NOT NULL,
        message TEXT NOT NULL,
        status alert_status DEFAULT 'open',
        priority INTEGER DEFAULT 1,
        created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        acknowledged_at TIMESTAMP WITH TIME ZONE,
        resolved_at TIMESTAMP WITH TIME ZONE
      );
    `,
    `
      CREATE TABLE daily_activity (
        id SERIAL PRIMARY KEY,
        user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
        activity_date DATE DEFAULT CURRENT_DATE,
        applications_count INTEGER DEFAULT 0,
        interviews_count INTEGER DEFAULT 0,
        assessments_count INTEGER DEFAULT 0,
        created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(user_id, activity_date)
      );
    `,
    `
      CREATE TABLE attendance_entries (
        id SERIAL PRIMARY KEY,
        user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
        attendance_date DATE NOT NULL,
        reported_status attendance_status NOT NULL DEFAULT 'present',
        approval_status attendance_approval_status NOT NULL DEFAULT 'pending',
        approved_by INTEGER REFERENCES users(id),
        approved_at TIMESTAMP WITHOUT TIME ZONE,
        reviewer_note TEXT,
        created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(user_id, attendance_date)
      );
    `,
    `
      CREATE TABLE recruiter_candidate_activity (
        id SERIAL PRIMARY KEY,
        recruiter_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
        candidate_id INTEGER REFERENCES candidates(id) ON DELETE CASCADE,
        activity_date DATE NOT NULL,
        applications_count INTEGER NOT NULL,
        created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(recruiter_id, candidate_id, activity_date)
      );
    `,
    `
      CREATE TABLE audit_logs (
        id SERIAL PRIMARY KEY,
        user_id INTEGER REFERENCES users(id),
        action VARCHAR(50) NOT NULL,
        table_name VARCHAR(50) NOT NULL,
        record_id INTEGER,
        old_values JSONB,
        new_values JSONB,
        ip_address INET,
        user_agent TEXT,
        created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
    `,
    `
      CREATE TABLE export_logs (
        id SERIAL PRIMARY KEY,
        user_id INTEGER REFERENCES users(id),
        export_type VARCHAR(50) NOT NULL,
        filters JSONB,
        row_count INTEGER,
        file_path VARCHAR(500),
        status VARCHAR(20) DEFAULT 'pending',
        admin_approval_required BOOLEAN DEFAULT false,
        approved_by INTEGER REFERENCES users(id),
        created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
    `,
    `
      CREATE TABLE IF NOT EXISTS candidate_assignments (
        id SERIAL PRIMARY KEY,
        candidate_id INTEGER REFERENCES candidates(id) ON DELETE CASCADE,
        recruiter_id INTEGER REFERENCES users(id),
        assigned_by INTEGER REFERENCES users(id),
        assigned_at TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        unassigned_at TIMESTAMP WITHOUT TIME ZONE,
        note TEXT
      );
    `,
  ];

  for (const statement of statements) {
    await db.query(statement);
  }
}

async function ensureIndexes(db) {
  const statements = [
    `CREATE INDEX IF NOT EXISTS idx_candidates_recruiter ON candidates(assigned_recruiter_id);`,
    `CREATE INDEX IF NOT EXISTS idx_candidates_stage ON candidates(current_stage);`,
    `CREATE INDEX IF NOT EXISTS idx_applications_candidate ON applications(candidate_id);`,
    `CREATE INDEX IF NOT EXISTS idx_applications_recruiter ON applications(recruiter_id);`,
    `CREATE INDEX IF NOT EXISTS idx_applications_status ON applications(status);`,
    `CREATE INDEX IF NOT EXISTS idx_interviews_candidate ON interviews(candidate_id);`,
    `CREATE INDEX IF NOT EXISTS idx_interviews_date ON interviews(scheduled_date);`,
    `CREATE INDEX IF NOT EXISTS idx_assessments_due ON assessments(due_date);`,
    `CREATE INDEX IF NOT EXISTS idx_reminders_due ON reminders(due_date);`,
    `CREATE INDEX IF NOT EXISTS idx_alerts_user ON alerts(user_id);`,
    `CREATE INDEX IF NOT EXISTS idx_audit_logs_user ON audit_logs(user_id);`,
    `CREATE INDEX IF NOT EXISTS idx_audit_logs_table ON audit_logs(table_name);`,
    `CREATE INDEX IF NOT EXISTS idx_attendance_entries_date ON attendance_entries(attendance_date);`,
    `CREATE INDEX IF NOT EXISTS idx_attendance_entries_status ON attendance_entries(approval_status);`,
  ];

  for (const statement of statements) {
    await db.query(statement);
  }
}

async function seedDefaultUsers(db, bcryptLib) {
  const seeds = [];

  const adminEmail = process.env.ADMIN_EMAIL;
  const adminPassword = process.env.ADMIN_PASSWORD;
  if (adminEmail && adminPassword) {
    seeds.push({
      name: process.env.ADMIN_NAME || 'System Administrator',
      email: adminEmail,
      password: adminPassword,
      role: 'Admin',
      dailyQuota: Number(process.env.ADMIN_DAILY_QUOTA ?? 0) || 0,
    });
  } else {
    console.warn(
      '[Seed] Skipping default admin creation. Provide ADMIN_EMAIL and ADMIN_PASSWORD environment variables to seed an initial admin account.',
    );
  }

  const recruiterEmail = process.env.RECRUITER_EMAIL;
  const recruiterPassword = process.env.RECRUITER_PASSWORD;
  if (recruiterEmail && recruiterPassword) {
    seeds.push({
      name: process.env.RECRUITER_NAME || 'Default Recruiter',
      email: recruiterEmail,
      password: recruiterPassword,
      role: 'Recruiter',
      dailyQuota: Number(process.env.RECRUITER_DAILY_QUOTA ?? 60) || 60,
    });
  }

  if (seeds.length === 0) {
    return;
  }

  const hashedPasswords = await Promise.all(
    seeds.map((seed) => bcryptLib.hash(seed.password, 10)),
  );

  await Promise.all(
    seeds.map((seed, index) =>
      db.query(
        `
          INSERT INTO users (name, email, password_hash, role, daily_quota)
          VALUES ($1, $2, $3, $4, $5)
          ON CONFLICT (email) DO NOTHING;
        `,
        [seed.name, seed.email, hashedPasswords[index], seed.role, seed.dailyQuota],
      ),
    ),
  );
}

async function ensureApplicationColumns(db) {
  await db.query(`
    ALTER TABLE applications
    ADD COLUMN IF NOT EXISTS applications_count INTEGER DEFAULT 1,
    ADD COLUMN IF NOT EXISTS is_approved BOOLEAN DEFAULT false,
    ADD COLUMN IF NOT EXISTS approved_by INTEGER REFERENCES users(id),
    ADD COLUMN IF NOT EXISTS approved_at TIMESTAMP WITHOUT TIME ZONE
  `);

  await db.query(`
    UPDATE applications
    SET applications_count = COALESCE(applications_count, 1),
        is_approved = COALESCE(is_approved, false)
  `);
}

async function ensureInterviewColumns(db) {
  await db.query(`
    ALTER TABLE interviews
    ADD COLUMN IF NOT EXISTS is_approved BOOLEAN DEFAULT false,
    ADD COLUMN IF NOT EXISTS approved_by INTEGER REFERENCES users(id),
    ADD COLUMN IF NOT EXISTS approved_at TIMESTAMP WITHOUT TIME ZONE
  `);

  await db.query(`
    UPDATE interviews
    SET is_approved = COALESCE(is_approved, false)
  `);
}

async function ensureAssessmentColumns(db) {
  await db.query(`
    ALTER TABLE assessments
    ADD COLUMN IF NOT EXISTS is_approved BOOLEAN DEFAULT false,
    ADD COLUMN IF NOT EXISTS approved_by INTEGER REFERENCES users(id),
    ADD COLUMN IF NOT EXISTS approved_at TIMESTAMP WITHOUT TIME ZONE
  `);

  await db.query(`
    UPDATE assessments
    SET is_approved = COALESCE(is_approved, false)
  `);
}

async function ensureReminderNoteLink(db) {
  await db.query(`
    ALTER TABLE reminders
    ADD COLUMN IF NOT EXISTS note_id INTEGER REFERENCES notes(id) ON DELETE SET NULL
  `);
}

async function ensureUserActivityColumns(db) {
  await db.query(`
    ALTER TABLE users
    ADD COLUMN IF NOT EXISTS last_login_at TIMESTAMP WITHOUT TIME ZONE
  `);

  await db.query(`
    ALTER TABLE users
    ADD COLUMN IF NOT EXISTS last_active_at TIMESTAMP WITHOUT TIME ZONE
  `);
}

async function ensureCandidateAssignments(db) {
  await db.query(`
    CREATE TABLE IF NOT EXISTS candidate_assignments (
      id SERIAL PRIMARY KEY,
      candidate_id INTEGER REFERENCES candidates(id) ON DELETE CASCADE,
      recruiter_id INTEGER REFERENCES users(id),
      assigned_by INTEGER REFERENCES users(id),
      assigned_at TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP,
      unassigned_at TIMESTAMP WITHOUT TIME ZONE,
      note TEXT
    )
  `);

  await db.query(`
    CREATE INDEX IF NOT EXISTS idx_candidate_assignments_candidate ON candidate_assignments(candidate_id)
  `);
}

async function ensureSchemaEvolution(db) {
  console.log('--- DEBUG: Executing ensureSchemaEvolution ---');
  await Promise.all([
    ensureApplicationColumns(db),
    ensureInterviewColumns(db),
    ensureAssessmentColumns(db),
    ensureReminderNoteLink(db),
    ensureUserActivityColumns(db),
    ensureRecruiterCandidateActivityTable(db),
    ensureAttendanceSchema(db),
  ]);

  await ensureCandidateAssignments(db);
}

async function ensureAuditNotifications(db) {
  await db.query(`
    CREATE OR REPLACE FUNCTION notify_audit_event() RETURNS trigger AS $$
    BEGIN
      PERFORM pg_notify('audit_event', row_to_json(NEW)::text);
      RETURN NEW;
    END;
    $$ LANGUAGE plpgsql;
  `);

  await db.query(`
    DO $$
    BEGIN
      IF NOT EXISTS (
        SELECT 1 FROM pg_trigger
        WHERE tgname = 'audit_event_trigger'
      ) THEN
        CREATE TRIGGER audit_event_trigger
        AFTER INSERT ON audit_logs
        FOR EACH ROW
        EXECUTE FUNCTION notify_audit_event();
      END IF;
    END;
    $$;
  `);
}

async function ensureRecruiterCandidateActivityTable(db) {
  await db.query(`
    CREATE TABLE IF NOT EXISTS recruiter_candidate_activity (
      id SERIAL PRIMARY KEY,
      recruiter_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
      candidate_id INTEGER REFERENCES candidates(id) ON DELETE CASCADE,
      activity_date DATE NOT NULL,
      applications_count INTEGER NOT NULL,
      created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(recruiter_id, candidate_id, activity_date)
    );
  `);
}

async function ensureAttendanceSchema(db) {
  await db.query(`
    DO $$
    BEGIN
      IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'attendance_status') THEN
        CREATE TYPE attendance_status AS ENUM ('present', 'absent', 'leave', 'half-day');
      END IF;
      IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'attendance_approval_status') THEN
        CREATE TYPE attendance_approval_status AS ENUM ('pending', 'approved', 'rejected');
      END IF;
    END;
    $$;
  `);

  await db.query(`ALTER TYPE attendance_status ADD VALUE IF NOT EXISTS 'half-day';`);

  await db.query(`
    CREATE TABLE IF NOT EXISTS attendance_entries (
      id SERIAL PRIMARY KEY,
      user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
      attendance_date DATE NOT NULL,
      reported_status attendance_status NOT NULL DEFAULT 'present',
      approval_status attendance_approval_status NOT NULL DEFAULT 'pending',
      approved_by INTEGER REFERENCES users(id),
      approved_at TIMESTAMP WITHOUT TIME ZONE,
      reviewer_note TEXT,
      created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(user_id, attendance_date)
    );
  `);

  await db.query(`
    DO $$
    BEGIN
      IF NOT EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_name = 'attendance_entries'
          AND column_name = 'reviewer_note'
      ) THEN
        ALTER TABLE attendance_entries
        ADD COLUMN reviewer_note TEXT;
      END IF;
    END;
    $$;
  `);

  await db.query(`
    CREATE INDEX IF NOT EXISTS idx_attendance_entries_date ON attendance_entries(attendance_date);
  `);
  await db.query(`
    CREATE INDEX IF NOT EXISTS idx_attendance_entries_status ON attendance_entries(approval_status);
  `);
}

async function setupDatabase() {
  console.log('--- DEBUG: Executing setupDatabase ---');
  try {
    const res = await pool.query(`
      SELECT EXISTS (
        SELECT 1 FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'users'
      );
    `);

    if (!res.rows[0].exists) {
      console.log('Database tables not found. Initializing comprehensive schema...');
      await ensureEnums(pool);
      await ensureTables(pool);
      await ensureIndexes(pool);
      await seedDefaultUsers(pool, bcrypt);
      console.log('Comprehensive database schema created successfully!');
      console.log('Default Admin and Recruiter users created.');
    } else {
      console.log('Database tables detected. Ensuring schema completeness...');
    }

    await ensureSchemaEvolution(pool);
    await ensureAuditNotifications(pool);
  } catch (error) {
    console.error('Database setup error:', error.message);
  }
}

function parseCookies(cookieHeader) {
  if (!cookieHeader) {
    return {};
  }
  return cookieHeader.split(';').reduce((acc, part) => {
    const [rawKey, ...rawVal] = part.split('=');
    if (!rawKey || rawVal.length === 0) {
      return acc;
    }
    const key = rawKey.trim();
    const value = rawVal.join('=').trim();
    acc[key] = decodeURIComponent(value);
    return acc;
  }, {});
}

function getTokenFromRequest(req) {
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const rawToken = authHeader.slice(7).trim();
    if (rawToken && rawToken !== 'session') {
      return rawToken;
    }
  }

  const cookies = parseCookies(req.headers?.cookie);
  if (cookies[AUTH_COOKIE_NAME]) {
    return cookies[AUTH_COOKIE_NAME];
  }
  return null;
}

const ONE_DAY_MS = 24 * 60 * 60 * 1000;
const WEEKDAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

const parseDateOnly = (value) => {
  if (!value) {
    return null;
  }
  const normalized = typeof value === 'string' && !value.includes('T') ? `${value}T00:00:00Z` : value;
  const parsed = new Date(normalized);
  if (Number.isNaN(parsed.getTime())) {
    return null;
  }
  return new Date(Date.UTC(parsed.getUTCFullYear(), parsed.getUTCMonth(), parsed.getUTCDate()));
};

const toDateIso = (date) => {
  if (!(date instanceof Date) || Number.isNaN(date.getTime())) {
    return null;
  }
  return date.toISOString().split('T')[0];
};

const addDays = (date, days) => {
  const reference = date instanceof Date ? date : parseDateOnly(date);
  if (!reference) {
    return null;
  }
  return new Date(reference.getTime() + days * ONE_DAY_MS);
};

// Middleware to verify JWT token
const verifyToken = (req, res, next) => {
  const token = getTokenFromRequest(req);

  if (!token) {
    return res.status(401).json({ message: 'No token provided' });
  }

  try {
    const decoded = jwt.verify(token, SECRET_KEY);
    req.user = decoded;
    pool
      .query(
        `
          UPDATE users
          SET last_active_at = CURRENT_TIMESTAMP
          WHERE id = $1
        `,
        [decoded.userId]
      )
      .catch((activityError) => {
        console.error('Failed to update last_active_at:', activityError.message);
      });
    next();
  } catch (error) {
    return res.status(401).json({ message: 'Invalid token' });
  }
  };

const requireRole =
  (...allowedRoles) =>
  (req, res, next) => {
    if (!req.user || !allowedRoles.includes(req.user.role)) {
      return res.status(403).json({ message: 'Access denied' });
    }
    return next();
  };

const fetchCandidateWithAccess = async (candidateId, user) => {
  const candidateResult = await pool.query(
    `
      SELECT id, assigned_recruiter_id, name
      FROM candidates
      WHERE id = $1
    `,
    [candidateId]
  );

  if (candidateResult.rows.length === 0) {
    const error = new Error('Candidate not found');
    error.statusCode = 404;
    throw error;
  }

  const candidate = candidateResult.rows[0];

  if (user.role === 'Recruiter' && candidate.assigned_recruiter_id !== user.userId) {
    const error = new Error('Access denied');
    error.statusCode = 403;
    throw error;
  }

  return candidate;
};

const loginHandler = createLoginHandler({
  db: pool,
  jwtLib: jwt,
  bcryptLib: bcrypt,
  secret: SECRET_KEY,
});

// Authentication Route
app.post('/api/v1/auth/login', authLimiter, validateBody(schemas.login), loginHandler);

app.post('/api/v1/auth/logout', (req, res) => {
  res.clearCookie(AUTH_COOKIE_NAME, CLEAR_COOKIE_OPTIONS);
  res.status(204).end();
});

app.post('/api/v1/analytics', analyticsLimiter, verifyToken, (req, res) => {
  const events = Array.isArray(req.body?.events) ? req.body.events : [];
  const meta = {
    count: events.length,
    sample: events.slice(0, 3).map((event) => event.event),
  };

  console.info('[Analytics] Batch received', JSON.stringify(meta));
  res.status(204).end();
});

app.get('/api/v1/profile', verifyToken, async (req, res) => {
  try {
    const profile = await fetchUserProfile(pool, req.user.userId);
    if (!profile) {
      return res.status(404).json({ message: 'User not found' });
    }
    res.json(profile);
  } catch (error) {
    console.error('Error fetching profile:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

app.put('/api/v1/profile', profileLimiter, verifyToken, async (req, res) => {
  try {
    const { name, email, password, daily_quota } = req.body;

    if (password) {
      const passwordPolicy = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[\W_]).{8,}$/;
      if (!passwordPolicy.test(password)) {
        return res.status(400).json({
          message: 'Password must be at least 8 characters and include uppercase, lowercase, number, and symbol.',
        });
      }
    }
    const userResult = await pool.query('SELECT * FROM users WHERE id = $1', [req.user.userId]);
    if (userResult.rows.length === 0) {
      return res.status(404).json({ message: 'User not found' });
    }

    const updates = [];
    const params = [];
    let idx = 1;

    if (name !== undefined) {
      updates.push(`name = $${idx++}`);
      params.push(name);
    }

    if (email !== undefined) {
      updates.push(`email = $${idx++}`);
      params.push(email);
    }

    if (password) {
      const hashed = await bcrypt.hash(password, 10);
      updates.push(`password_hash = $${idx++}`);
      params.push(hashed);
    }

    if (daily_quota !== undefined && req.user.role === 'Admin') {
      updates.push(`daily_quota = $${idx++}`);
      params.push(daily_quota);
    }

    if (updates.length === 0) {
      return res.status(400).json({ message: 'No profile fields provided to update.' });
    }

    updates.push(`updated_at = CURRENT_TIMESTAMP`);
    params.push(req.user.userId);

    const result = await pool.query(
      `
      UPDATE users
      SET ${updates.join(', ')}
      WHERE id = $${idx}
      RETURNING id, name, email, role, daily_quota, created_at, updated_at
    `,
      params
    );

    res.json(result.rows[0]);
  } catch (error) {
    if (error.code === '23505') {
      return res.status(400).json({ message: 'Email already in use.' });
    }
    console.error('Error updating profile:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// Candidates API endpoints
app.get('/api/v1/candidates', verifyToken, async (req, res) => {
  try {
    const { stage, recruiter_id, search } = req.query;
    let query = `
      SELECT
        c.*,
        u.name AS recruiter_name,
        COALESCE(app_metrics.applications_total, 0) AS total_applications,
        COALESCE(app_metrics.applications_daily, 0) AS daily_applications,
        COALESCE(app_metrics.applications_approved, 0) AS approved_applications,
        COALESCE(app_metrics.applications_pending, 0) AS pending_applications,
        COALESCE(interview_metrics.total_interviews, 0) AS interviews_total,
        COALESCE(interview_metrics.approved_interviews, 0) AS interviews_approved,
        COALESCE(interview_metrics.pending_interviews, 0) AS interviews_pending,
        COALESCE(assessment_metrics.total_assessments, 0) AS assessments_total,
        COALESCE(assessment_metrics.approved_assessments, 0) AS assessments_approved,
        COALESCE(assessment_metrics.pending_assessments, 0) AS assessments_pending
      FROM candidates c
      LEFT JOIN users u ON c.assigned_recruiter_id = u.id
      LEFT JOIN LATERAL (
        SELECT
          COALESCE(SUM(a.applications_count), 0) AS applications_total,
          COALESCE(SUM(CASE WHEN a.application_date = CURRENT_DATE THEN a.applications_count ELSE 0 END), 0) AS applications_daily,
          COALESCE(SUM(CASE WHEN COALESCE(a.is_approved, false) THEN a.applications_count ELSE 0 END), 0) AS applications_approved,
          COALESCE(SUM(CASE WHEN COALESCE(a.is_approved, false) THEN 0 ELSE a.applications_count END), 0) AS applications_pending
        FROM applications a
        WHERE a.candidate_id = c.id
      ) AS app_metrics ON true
      LEFT JOIN LATERAL (
        SELECT
          COUNT(*) AS total_interviews,
          COUNT(*) FILTER (WHERE COALESCE(i.is_approved, false)) AS approved_interviews,
          COUNT(*) FILTER (WHERE NOT COALESCE(i.is_approved, false)) AS pending_interviews
        FROM interviews i
        WHERE i.candidate_id = c.id
      ) AS interview_metrics ON true
      LEFT JOIN LATERAL (
        SELECT
          COUNT(*) AS total_assessments,
          COUNT(*) FILTER (WHERE COALESCE(s.is_approved, false)) AS approved_assessments,
          COUNT(*) FILTER (WHERE NOT COALESCE(s.is_approved, false)) AS pending_assessments
        FROM assessments s
        WHERE s.candidate_id = c.id
      ) AS assessment_metrics ON true
      WHERE 1=1
    `;
    const params = [];
    let paramCount = 0;

    // Role-based filtering
    if (req.user.role === 'Recruiter') {
      query += ` AND c.assigned_recruiter_id = $${++paramCount}`;
      params.push(req.user.userId);
    }

    if (stage) {
      query += ` AND c.current_stage = $${++paramCount}`;
      params.push(stage);
    }

    if (recruiter_id) {
      query += ` AND c.assigned_recruiter_id = $${++paramCount}`;
      params.push(recruiter_id);
    }

    if (search) {
      query += ` AND (c.name ILIKE $${++paramCount} OR c.email ILIKE $${++paramCount})`;
      params.push(`%${search}%`, `%${search}%`);
    }

    query += ` ORDER BY c.created_at DESC`;

    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching candidates:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// Create candidate
app.post('/api/v1/candidates', verifyToken, validateBody(schemas.candidateUpsert), async (req, res) => {
  try {
    const {
      name,
      email,
      phone,
      visa_status,
      skills,
      experience_years,
      current_stage = 'onboarding',
      marketing_start_date = null,
      assigned_recruiter_id,
    } = req.body;

    if (!name || !email) {
      return res.status(400).json({ message: 'Name and email are required.' });
    }

    let recruiterId = null;
    if (assigned_recruiter_id !== undefined && assigned_recruiter_id !== null && assigned_recruiter_id !== '') {
      const parsed = parseInt(assigned_recruiter_id, 10);
      if (Number.isNaN(parsed)) {
        return res.status(400).json({ message: 'Invalid recruiter id.' });
      }
      recruiterId = parsed;
    }

    if (req.user.role === 'Recruiter') {
      recruiterId = req.user.userId;
    }

    if (recruiterId && req.user.role !== 'Admin' && recruiterId !== req.user.userId) {
      return res.status(403).json({ message: 'You are not allowed to assign this candidate to another recruiter.' });
    }

    const insertResult = await pool.query(
      `
        INSERT INTO candidates (
          name,
          email,
          phone,
          visa_status,
          skills,
          experience_years,
          current_stage,
          marketing_start_date,
          assigned_recruiter_id
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
        RETURNING *
      `,
      [name, email, phone, visa_status, skills, experience_years, current_stage, marketing_start_date, recruiterId],
    );

    const candidate = insertResult.rows[0];

    if (recruiterId) {
      await pool.query(
        `
          INSERT INTO candidate_assignments (candidate_id, recruiter_id, assigned_by)
          VALUES ($1, $2, $3)
        `,
        [candidate.id, recruiterId, req.user.userId],
      );
    }

    await pool.query(
      `
        INSERT INTO audit_logs (user_id, action, table_name, record_id, new_values)
        VALUES ($1, 'CREATE', 'candidates', $2, $3)
      `,
      [req.user.userId, candidate.id, JSON.stringify(candidate)],
    );

    res.status(201).json(candidate);
  } catch (error) {
    console.error('Error creating candidate:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// Update candidate
app.put('/api/v1/candidates/:id', verifyToken, validateBody(schemas.candidateUpsert), async (req, res) => {
  try {
    const candidateId = parseInt(req.params.id, 10);
    if (Number.isNaN(candidateId)) {
      return res.status(400).json({ message: 'Invalid candidate id' });
    }

    await fetchCandidateWithAccess(candidateId, req.user);

    const {
      name,
      email,
      phone,
      visa_status,
      skills,
      experience_years,
      current_stage,
      marketing_start_date,
      assigned_recruiter_id
    } = req.body;

    // Get old values for audit
    const oldResult = await pool.query('SELECT * FROM candidates WHERE id = $1', [candidateId]);
    if (oldResult.rows.length === 0) {
      return res.status(404).json({ message: 'Candidate not found' });
    }

    const oldCandidate = oldResult.rows[0];

    let newAssignedRecruiterId = oldCandidate.assigned_recruiter_id;
    if (assigned_recruiter_id !== undefined) {
      if (assigned_recruiter_id === null || assigned_recruiter_id === '') {
        newAssignedRecruiterId = null;
      } else {
        const parsed = parseInt(assigned_recruiter_id, 10);
        if (Number.isNaN(parsed)) {
          return res.status(400).json({ message: 'Invalid recruiter id.' });
        }
        newAssignedRecruiterId = parsed;
      }

      if (req.user.role !== 'Admin' && newAssignedRecruiterId !== oldCandidate.assigned_recruiter_id) {
        return res.status(403).json({ message: 'Only admins can reassign candidates.' });
      }
    }

    const updatedCandidate = {
      name: name ?? oldCandidate.name,
      email: email ?? oldCandidate.email,
      phone: phone ?? oldCandidate.phone,
      visa_status: visa_status ?? oldCandidate.visa_status,
      skills: skills ?? oldCandidate.skills,
      experience_years: experience_years ?? oldCandidate.experience_years,
      current_stage: current_stage ?? oldCandidate.current_stage,
      marketing_start_date: marketing_start_date ?? oldCandidate.marketing_start_date,
      assigned_recruiter_id: newAssignedRecruiterId
    };

    const result = await pool.query(`
      UPDATE candidates 
      SET name = $1, email = $2, phone = $3, visa_status = $4, skills = $5, 
          experience_years = $6, current_stage = $7, marketing_start_date = $8, 
          assigned_recruiter_id = $9, updated_at = CURRENT_TIMESTAMP
      WHERE id = $10
      RETURNING *
    `, [
      updatedCandidate.name,
      updatedCandidate.email,
      updatedCandidate.phone,
      updatedCandidate.visa_status,
      updatedCandidate.skills,
      updatedCandidate.experience_years,
      updatedCandidate.current_stage,
      updatedCandidate.marketing_start_date,
      updatedCandidate.assigned_recruiter_id,
      candidateId
    ]);

    if (oldCandidate.assigned_recruiter_id !== updatedCandidate.assigned_recruiter_id) {
      await pool.query(
        `
          UPDATE candidate_assignments
          SET unassigned_at = CURRENT_TIMESTAMP
          WHERE candidate_id = $1 AND unassigned_at IS NULL
        `,
        [candidateId],
      );

      if (updatedCandidate.assigned_recruiter_id) {
        await pool.query(
          `
            INSERT INTO candidate_assignments (candidate_id, recruiter_id, assigned_by)
            VALUES ($1, $2, $3)
          `,
          [candidateId, updatedCandidate.assigned_recruiter_id, req.user.userId],
        );
      }
    }

    // Log audit
    await pool.query(`
      INSERT INTO audit_logs (user_id, action, table_name, record_id, old_values, new_values)
      VALUES ($1, 'UPDATE', 'candidates', $2, $3, $4)
    `, [req.user.userId, candidateId, JSON.stringify(oldCandidate), JSON.stringify(result.rows[0])]);

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error updating candidate:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// Delete candidate (Admin only)
app.delete('/api/v1/candidates/:id', verifyToken, async (req, res) => {
  try {
    if (req.user.role !== 'Admin') {
      return res.status(403).json({ message: 'Access denied' });
    }

    const { id } = req.params;
    const candidateResult = await pool.query('SELECT * FROM candidates WHERE id = $1', [id]);

    if (candidateResult.rows.length === 0) {
      return res.status(404).json({ message: 'Candidate not found' });
    }

    await pool.query(
      `
        UPDATE candidate_assignments
        SET unassigned_at = CURRENT_TIMESTAMP
        WHERE candidate_id = $1 AND unassigned_at IS NULL
      `,
      [id],
    );

    await pool.query('DELETE FROM candidates WHERE id = $1', [id]);

    await pool.query(`
      INSERT INTO audit_logs (user_id, action, table_name, record_id, old_values, new_values)
      VALUES ($1, 'DELETE', 'candidates', $2, $3, $4)
    `, [req.user.userId, id, JSON.stringify(candidateResult.rows[0]), null]);

    res.json({ message: 'Candidate deleted successfully' });
  } catch (error) {
    console.error('Error deleting candidate:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

app.get('/api/v1/candidates/:id/notes', verifyToken, async (req, res) => {
  try {
    const candidateId = parseInt(req.params.id, 10);
    if (Number.isNaN(candidateId)) {
      return res.status(400).json({ message: 'Invalid candidate id' });
    }

    await fetchCandidateWithAccess(candidateId, req.user);

    const params = [candidateId];
    let visibilityClause = '';

    if (req.user.role === 'Recruiter') {
      params.push(req.user.userId);
      visibilityClause = ' AND (n.is_private = false OR n.author_id = $2)';
    }

    const notesResult = await pool.query(
      `
        SELECT
          n.id,
          n.candidate_id,
          n.author_id,
          u.name AS author_name,
          u.role AS author_role,
          n.content,
          n.is_private,
          n.created_at,
          r.id AS reminder_id,
          r.title AS reminder_title,
          r.description AS reminder_description,
          r.due_date AS reminder_due_date,
          r.status AS reminder_status,
          r.priority AS reminder_priority
        FROM notes n
        JOIN users u ON n.author_id = u.id
        LEFT JOIN reminders r ON r.note_id = n.id
        WHERE n.candidate_id = $1
        ${visibilityClause}
        ORDER BY n.created_at DESC
      `,
      params
    );

    const notes = notesResult.rows.map((row) => ({
      id: row.id,
      candidateId: row.candidate_id,
      content: row.content,
      isPrivate: row.is_private,
      createdAt: row.created_at,
      author: {
        id: row.author_id,
        name: row.author_name,
        role: row.author_role,
      },
      reminder: row.reminder_id
        ? {
            id: row.reminder_id,
            title: row.reminder_title,
            description: row.reminder_description,
            dueDate: row.reminder_due_date,
            status: row.reminder_status,
            priority: row.reminder_priority,
          }
        : null,
    }));

    res.json(notes);
  } catch (error) {
    if (error.statusCode) {
      return res.status(error.statusCode).json({ message: error.message });
    }
    console.error('Error fetching notes:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

app.get('/api/v1/candidates/:id/assignments', verifyToken, async (req, res) => {
  try {
    const candidateId = parseInt(req.params.id, 10);
    if (Number.isNaN(candidateId)) {
      return res.status(400).json({ message: 'Invalid candidate id' });
    }

    await fetchCandidateWithAccess(candidateId, req.user);

    const result = await pool.query(
      `
        SELECT
          ca.id,
          ca.candidate_id,
          ca.recruiter_id,
          ca.assigned_by,
          ca.assigned_at,
          ca.unassigned_at,
          rec.name AS recruiter_name,
          admin.name AS assigned_by_name
        FROM candidate_assignments ca
        LEFT JOIN users rec ON ca.recruiter_id = rec.id
        LEFT JOIN users admin ON ca.assigned_by = admin.id
        WHERE ca.candidate_id = $1
        ORDER BY ca.assigned_at DESC
      `,
      [candidateId],
    );

    const history = result.rows.map((row) => ({
      id: row.id,
      candidateId: row.candidate_id,
      recruiter: row.recruiter_id
        ? { id: row.recruiter_id, name: row.recruiter_name }
        : null,
      assignedBy: row.assigned_by
        ? { id: row.assigned_by, name: row.assigned_by_name }
        : null,
      assignedAt: row.assigned_at,
      unassignedAt: row.unassigned_at,
    }));

    res.json(history);
  } catch (error) {
    if (error.statusCode) {
      return res.status(error.statusCode).json({ message: error.message });
    }
    console.error('Error fetching candidate assignments:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

app.post('/api/v1/candidates/:id/notes', verifyToken, validateBody(schemas.noteCreate), async (req, res) => {
  try {
    const candidateId = parseInt(req.params.id, 10);
    if (Number.isNaN(candidateId)) {
      return res.status(400).json({ message: 'Invalid candidate id' });
    }

    const candidate = await fetchCandidateWithAccess(candidateId, req.user);

    const { content, is_private = false, followUp } = req.body;
    const trimmedContent = (content || '').trim();
    if (!trimmedContent) {
      return res.status(400).json({ message: 'Note content is required.' });
    }

    const authorResult = await pool.query(
      `
        SELECT name, role
        FROM users
        WHERE id = $1
      `,
      [req.user.userId]
    );
    const authorDetails = authorResult.rows[0] || { name: 'Unknown', role: req.user.role };

    const noteResult = await pool.query(
      `
        INSERT INTO notes (candidate_id, author_id, content, is_private)
        VALUES ($1, $2, $3, $4)
        RETURNING id, candidate_id, author_id, content, is_private, created_at
      `,
      [candidateId, req.user.userId, trimmedContent, Boolean(is_private)]
    );

    const note = noteResult.rows[0];

    let reminder = null;
    if (followUp?.dueDate) {
      const dueDate = new Date(followUp.dueDate);
      if (Number.isNaN(dueDate.getTime())) {
        return res.status(400).json({ message: 'Invalid follow-up due date.' });
      }

      const reminderUserId =
        followUp.assigneeId || candidate.assigned_recruiter_id || req.user.userId;
      const reminderTitle =
        (followUp.title || `Follow up with ${candidate.name}`).trim() || `Follow up with ${candidate.name}`;
      const reminderDescription = (followUp.description || trimmedContent).trim();
      const reminderPriority = Number.isFinite(followUp.priority)
        ? Math.max(1, Math.min(5, Math.floor(followUp.priority)))
        : 1;

      const reminderResult = await pool.query(
        `
          INSERT INTO reminders (user_id, note_id, title, description, due_date, priority)
          VALUES ($1, $2, $3, $4, $5, $6)
          RETURNING id, title, description, due_date, status, priority
        `,
        [reminderUserId, note.id, reminderTitle, reminderDescription, dueDate.toISOString(), reminderPriority]
      );

      const reminderRow = reminderResult.rows[0];
      reminder = {
        id: reminderRow.id,
        title: reminderRow.title,
        description: reminderRow.description,
        dueDate: reminderRow.due_date,
        status: reminderRow.status,
        priority: reminderRow.priority,
      };
    }

    res.status(201).json({
      id: note.id,
      candidateId: note.candidate_id,
      content: note.content,
      isPrivate: note.is_private,
      createdAt: note.created_at,
      author: {
        id: req.user.userId,
        name: authorDetails.name,
        role: authorDetails.role || req.user.role,
      },
      reminder,
    });
  } catch (error) {
    if (error.statusCode) {
      return res.status(error.statusCode).json({ message: error.message });
    }
    console.error('Error creating note:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

app.put(
  '/api/v1/candidates/:candidateId/notes/:noteId',
  verifyToken,
  validateBody(schemas.noteUpdate),
  async (req, res) => {
  try {
    const candidateId = parseInt(req.params.candidateId, 10);
    const noteId = parseInt(req.params.noteId, 10);

    if (Number.isNaN(candidateId) || Number.isNaN(noteId)) {
      return res.status(400).json({ message: 'Invalid candidate or note id' });
    }

    const candidate = await fetchCandidateWithAccess(candidateId, req.user);

    const noteResult = await pool.query(
      `
        SELECT n.id, n.candidate_id, n.author_id, n.content, n.is_private, n.created_at,
               u.name AS author_name, u.role AS author_role
        FROM notes n
        JOIN users u ON n.author_id = u.id
        WHERE n.id = $1
      `,
      [noteId]
    );

    if (noteResult.rows.length === 0 || noteResult.rows[0].candidate_id !== candidateId) {
      return res.status(404).json({ message: 'Note not found for this candidate.' });
    }

    const existingNote = noteResult.rows[0];
    const isAdmin = req.user.role === 'Admin';
    if (!isAdmin && existingNote.author_id !== req.user.userId) {
      return res.status(403).json({ message: 'You do not have permission to edit this note.' });
    }

    const { content, is_private, followUp } = req.body;
    const nextPrivacy = typeof is_private === 'boolean' ? is_private : existingNote.is_private;
    const trimmedContent = (content || '').trim();
    if (!trimmedContent) {
      return res.status(400).json({ message: 'Note content is required.' });
    }

    const updatedNoteResult = await pool.query(
      `
        UPDATE notes
        SET content = $1, is_private = $2
        WHERE id = $3
        RETURNING id, candidate_id, author_id, content, is_private, created_at
      `,
      [trimmedContent, Boolean(nextPrivacy), noteId]
    );

    const updatedNote = updatedNoteResult.rows[0];

    const reminderResult = await pool.query(
      `
        SELECT id, user_id, title, description, due_date, status, priority
        FROM reminders
        WHERE note_id = $1
      `,
      [noteId]
    );

    let reminder = reminderResult.rows[0] || null;

    if (followUp?.dueDate) {
      const dueDate = new Date(followUp.dueDate);
      if (Number.isNaN(dueDate.getTime())) {
        return res.status(400).json({ message: 'Invalid follow-up due date.' });
      }

      const reminderUserId =
        followUp.assigneeId || candidate.assigned_recruiter_id || req.user.userId;
      const reminderTitle =
        (followUp.title || `Follow up with ${candidate.name}`).trim() || `Follow up with ${candidate.name}`;
      const reminderDescription = (followUp.description || trimmedContent).trim();
      const reminderPriority = Number.isFinite(followUp.priority)
        ? Math.max(1, Math.min(5, Math.floor(followUp.priority)))
        : (reminder?.priority || 1);

      if (reminder) {
        const updatedReminder = await pool.query(
          `
            UPDATE reminders
            SET user_id = $1, title = $2, description = $3, due_date = $4, priority = $5, updated_at = CURRENT_TIMESTAMP
            WHERE id = $6
            RETURNING id, title, description, due_date, status, priority
          `,
          [reminderUserId, reminderTitle, reminderDescription, dueDate.toISOString(), reminderPriority, reminder.id]
        );
        reminder = updatedReminder.rows[0];
      } else {
        const createdReminder = await pool.query(
          `
            INSERT INTO reminders (user_id, note_id, title, description, due_date, priority)
            VALUES ($1, $2, $3, $4, $5, $6)
            RETURNING id, title, description, due_date, status, priority
          `,
          [reminderUserId, noteId, reminderTitle, reminderDescription, dueDate.toISOString(), reminderPriority]
        );
        reminder = createdReminder.rows[0];
      }
    } else if (reminder) {
      await pool.query(`DELETE FROM reminders WHERE id = $1`, [reminder.id]);
      reminder = null;
    }

    res.json({
      id: updatedNote.id,
      candidateId: updatedNote.candidate_id,
      content: updatedNote.content,
      isPrivate: updatedNote.is_private,
      createdAt: updatedNote.created_at,
      author: {
        id: existingNote.author_id,
        name: existingNote.author_name,
        role: existingNote.author_role,
      },
      reminder: reminder
        ? {
            id: reminder.id,
            title: reminder.title,
            description: reminder.description,
            dueDate: reminder.due_date,
            status: reminder.status,
            priority: reminder.priority,
          }
        : null,
    });
  } catch (error) {
    if (error.statusCode) {
      return res.status(error.statusCode).json({ message: error.message });
    }
    console.error('Error updating note:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

app.delete('/api/v1/candidates/:candidateId/notes/:noteId', verifyToken, async (req, res) => {
  try {
    const candidateId = parseInt(req.params.candidateId, 10);
    const noteId = parseInt(req.params.noteId, 10);

    if (Number.isNaN(candidateId) || Number.isNaN(noteId)) {
      return res.status(400).json({ message: 'Invalid candidate or note id' });
    }

    await fetchCandidateWithAccess(candidateId, req.user);

    const noteResult = await pool.query(
      `
        SELECT id, candidate_id, author_id
        FROM notes
        WHERE id = $1
      `,
      [noteId]
    );

    if (noteResult.rows.length === 0 || noteResult.rows[0].candidate_id !== candidateId) {
      return res.status(404).json({ message: 'Note not found for this candidate.' });
    }

    const existingNote = noteResult.rows[0];
    const isAdmin = req.user.role === 'Admin';
    if (!isAdmin && existingNote.author_id !== req.user.userId) {
      return res.status(403).json({ message: 'You do not have permission to delete this note.' });
    }

    await pool.query(`DELETE FROM reminders WHERE note_id = $1`, [noteId]);
    await pool.query(`DELETE FROM notes WHERE id = $1`, [noteId]);

    res.status(204).send();
  } catch (error) {
    if (error.statusCode) {
      return res.status(error.statusCode).json({ message: error.message });
    }
    console.error('Error deleting note:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});


// Applications API endpoints
app.get('/api/v1/applications', verifyToken, async (req, res) => {
  try {
    const { candidate_id, recruiter_id, status, date_from, date_to } = req.query;
    let query = `
      SELECT a.*, c.name as candidate_name, u.name as recruiter_name
      FROM applications a
      LEFT JOIN candidates c ON a.candidate_id = c.id
      LEFT JOIN users u ON a.recruiter_id = u.id
      WHERE 1=1
    `;
    const params = [];
    let paramCount = 0;

    // Role-based filtering
    if (req.user.role === 'Recruiter') {
      query += ` AND a.recruiter_id = $${++paramCount}`;
      params.push(req.user.userId);
    }

    if (candidate_id) {
      query += ` AND a.candidate_id = $${++paramCount}`;
      params.push(candidate_id);
    }

    if (recruiter_id) {
      query += ` AND a.recruiter_id = $${++paramCount}`;
      params.push(recruiter_id);
    }

    if (status) {
      query += ` AND a.status = $${++paramCount}`;
      params.push(status);
    }

    if (date_from) {
      query += ` AND a.application_date >= $${++paramCount}`;
      params.push(date_from);
    }

    if (date_to) {
      query += ` AND a.application_date <= $${++paramCount}`;
      params.push(date_to);
    }

    query += ` ORDER BY a.created_at DESC`;

    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching applications:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

app.post('/api/v1/applications', verifyToken, validateBody(schemas.applicationCreate), async (req, res) => {
  try {
    const {
      candidate_id,
      company_name,
      job_title,
      job_description,
      channel,
      status,
      applications_count,
      application_date
    } = req.body;

    const allowedStatuses = ['sent', 'viewed', 'shortlisted', 'interviewing', 'offered', 'hired', 'rejected'];
    const applicationsCount = Math.max(Number(applications_count) || 1, 1);
    const applicationStatus = allowedStatuses.includes(status) ? status : 'sent';
    const applicationDateParam = application_date || new Date().toISOString().split('T')[0];

    const result = await pool.query(
      `
      INSERT INTO applications (
        candidate_id,
        recruiter_id,
        company_name,
        job_title,
        job_description,
        channel,
        status,
        applications_count,
        application_date
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      RETURNING *
    `,
      [
        candidate_id,
        req.user.userId,
        company_name,
        job_title,
        job_description,
        channel,
        applicationStatus,
        applicationsCount,
        applicationDateParam
      ]
    );

    await pool.query(
      `
      INSERT INTO daily_activity (user_id, applications_count)
      VALUES ($1, $2)
      ON CONFLICT (user_id, activity_date)
      DO UPDATE SET applications_count = daily_activity.applications_count + $2
    `,
      [req.user.userId, applicationsCount]
    );

    await pool.query(
      `
      INSERT INTO audit_logs (user_id, action, table_name, record_id, new_values)
      VALUES ($1, 'CREATE', 'applications', $2, $3)
    `,
      [req.user.userId, result.rows[0].id, JSON.stringify(result.rows[0])]
    );

    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('Error creating application:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

app.put('/api/v1/applications/:id', verifyToken, validateBody(schemas.applicationUpdate), async (req, res) => {
  try {
    const { id } = req.params;
    const { status, channel, application_date, applications_count } = req.body;
    const allowedStatuses = ['sent', 'viewed', 'shortlisted', 'interviewing', 'offered', 'hired', 'rejected'];

    const existing = await pool.query('SELECT * FROM applications WHERE id = $1', [id]);

    if (existing.rows.length === 0) {
      return res.status(404).json({ message: 'Application not found' });
    }

    const application = existing.rows[0];

    if (req.user.role !== 'Admin' && application.recruiter_id !== req.user.userId) {
      return res.status(403).json({ message: 'Access denied' });
    }

    const isAdmin = req.user.role === 'Admin';
    const isApproved = Boolean(application.is_approved);

    const recruiterId = application.recruiter_id;
    const normalizeDate = (value) => {
      if (!value) return null;
      const date = new Date(value);
      if (Number.isNaN(date.getTime())) {
        return null;
      }
      return date.toISOString().split('T')[0];
    };

    const today = new Date().toISOString().split('T')[0];
    const applicationDate = application.application_date ? normalizeDate(application.application_date) : today;

    if (!isAdmin && applicationDate !== today) {
      return res.status(400).json({ message: 'Applications can only be modified on the day they are logged.' });
    }

    const updates = [];
    const params = [];
    let idx = 1;

    if (status && allowedStatuses.includes(status)) {
      updates.push(`status = $${idx++}`);
      params.push(status);
    }

    if (channel !== undefined) {
      updates.push(`channel = $${idx++}`);
      params.push(channel);
    }

    if (application_date) {
      updates.push(`application_date = $${idx++}`);
      params.push(application_date);
    }

    if (applications_count !== undefined) {
      if (!isAdmin && isApproved) {
        return res.status(403).json({ message: 'Approved application totals are locked. Contact an admin for changes.' });
      }
      const parsedCount = Number(applications_count);
      if (!Number.isFinite(parsedCount) || parsedCount < 0 || !Number.isInteger(parsedCount)) {
        return res.status(400).json({ message: 'applications_count must be a non-negative integer.' });
      }
      updates.push(`applications_count = $${idx++}`);
      params.push(parsedCount);
    }

    if (updates.length === 0) {
      return res.status(400).json({ message: 'No valid fields provided to update.' });
    }

    updates.push(`updated_at = CURRENT_TIMESTAMP`);

    params.push(id);

    const updated = await pool.query(
      `
      UPDATE applications
      SET ${updates.join(', ')}
      WHERE id = $${idx}
      RETURNING *
    `,
      params
    );

    const updatedApplication = updated.rows[0];

    if (recruiterId) {
      const oldDate = normalizeDate(application.application_date) || today;
      const newDate = normalizeDate(updatedApplication.application_date) || today;
      const datesToRefresh = new Set([oldDate, newDate].filter(Boolean));

      for (const date of datesToRefresh) {
        const aggregate = await pool.query(
          `
          SELECT COALESCE(SUM(applications_count), 0) AS total
          FROM applications
          WHERE recruiter_id = $1 AND application_date = $2
        `,
          [recruiterId, date]
        );

        const totalForDay = Number(aggregate.rows[0]?.total || 0);

        if (totalForDay > 0) {
          await pool.query(
            `
            INSERT INTO daily_activity (user_id, activity_date, applications_count)
            VALUES ($1, $2, $3)
            ON CONFLICT (user_id, activity_date)
            DO UPDATE SET applications_count = EXCLUDED.applications_count
          `,
            [recruiterId, date, totalForDay]
          );
        } else {
          await pool.query(
            `
            DELETE FROM daily_activity
            WHERE user_id = $1 AND activity_date = $2
          `,
            [recruiterId, date]
          );
        }
      }
    }

    await pool.query(
      `
      INSERT INTO audit_logs (user_id, action, table_name, record_id, old_values, new_values)
      VALUES ($1, 'UPDATE', 'applications', $2, $3, $4)
    `,
      [req.user.userId, id, JSON.stringify(application), JSON.stringify(updatedApplication)]
    );

    res.json(updatedApplication);
  } catch (error) {
    console.error('Error updating application:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

app.post(
  '/api/v1/applications/:id/approval',
  verifyToken,
  requireRole('Admin'),
  validateBody(schemas.approvalToggle),
  async (req, res) => {
  try {
    const applicationId = parseInt(req.params.id, 10);
    if (Number.isNaN(applicationId)) {
      return res.status(400).json({ message: 'Invalid application id' });
    }

    const existing = await pool.query('SELECT * FROM applications WHERE id = $1', [applicationId]);
    if (existing.rows.length === 0) {
      return res.status(404).json({ message: 'Application not found' });
    }

    const shouldApprove = typeof req.body?.approved === 'boolean' ? req.body.approved : true;

    const updated = await pool.query(
      `
      UPDATE applications
      SET is_approved = $1,
          approved_by = CASE WHEN $1 THEN $2::int ELSE NULL END,
          approved_at = CASE WHEN $1 THEN CURRENT_TIMESTAMP ELSE NULL END,
          updated_at = CURRENT_TIMESTAMP
      WHERE id = $3
      RETURNING *
    `,
      [shouldApprove, req.user.userId, applicationId],
    );

    const updatedApplication = updated.rows[0];

    await pool.query(
      `
      INSERT INTO audit_logs (user_id, action, table_name, record_id, old_values, new_values)
      VALUES ($1, 'UPDATE', 'applications', $2, $3, $4)
    `,
      [req.user.userId, applicationId, JSON.stringify(existing.rows[0]), JSON.stringify(updatedApplication)],
    );

    res.json(updatedApplication);
  } catch (error) {
    console.error('Error updating application approval:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

app.delete('/api/v1/applications/:id', verifyToken, requireRole('Admin'), async (req, res) => {
  try {
    const applicationId = parseInt(req.params.id, 10);
    if (Number.isNaN(applicationId)) {
      return res.status(400).json({ message: 'Invalid application id' });
    }

    const existing = await pool.query('SELECT * FROM applications WHERE id = $1', [applicationId]);
    if (existing.rows.length === 0) {
      return res.status(404).json({ message: 'Application not found' });
    }

    const application = existing.rows[0];

    await pool.query('DELETE FROM applications WHERE id = $1', [applicationId]);

    if (application.recruiter_id) {
      const candidateResult = await pool.query('SELECT name FROM candidates WHERE id = $1', [application.candidate_id]);
      const candidateName = candidateResult.rows[0]?.name || 'their candidate';

      await pool.query(
        `
          INSERT INTO alerts (user_id, alert_type, title, message, priority)
          VALUES ($1, 'submission_rejected', $2, $3, 2)
        `,
        [
          application.recruiter_id,
          'Application Rejected',
          `An admin rejected the application for ${candidateName}. Please update and resubmit.`,
        ],
      );

      const date = application.application_date
        ? new Date(application.application_date).toISOString().split('T')[0]
        : new Date().toISOString().split('T')[0];

      const aggregate = await pool.query(
        `
          SELECT COALESCE(SUM(applications_count), 0) AS total
          FROM applications
          WHERE recruiter_id = $1 AND application_date = $2
        `,
        [application.recruiter_id, date],
      );

      const totalForDay = Number(aggregate.rows[0]?.total || 0);

      if (totalForDay > 0) {
        await pool.query(
          `
            INSERT INTO daily_activity (user_id, activity_date, applications_count)
            VALUES ($1, $2, $3)
            ON CONFLICT (user_id, activity_date)
            DO UPDATE SET applications_count = EXCLUDED.applications_count
          `,
          [application.recruiter_id, date, totalForDay],
        );
      } else {
        await pool.query(
          `
            DELETE FROM daily_activity
            WHERE user_id = $1 AND activity_date = $2
          `,
          [application.recruiter_id, date],
        );
      }
    }

    await pool.query(
      `
      INSERT INTO audit_logs (user_id, action, table_name, record_id, old_values)
      VALUES ($1, 'DELETE', 'applications', $2, $3)
    `,
      [req.user.userId, applicationId, JSON.stringify(application)],
    );

    res.json({ success: true });
  } catch (error) {
    console.error('Error deleting application:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// Interviews API endpoints
app.get('/api/v1/interviews', verifyToken, async (req, res) => {
  try {
    const { candidate_id, recruiter_id, status, date_from, date_to } = req.query;
    let query = `
      SELECT i.*, c.name as candidate_name, u.name as recruiter_name
      FROM interviews i
      LEFT JOIN candidates c ON i.candidate_id = c.id
      LEFT JOIN users u ON i.recruiter_id = u.id
      WHERE 1=1
    `;
    const params = [];
    let paramCount = 0;

    if (req.user.role === 'Recruiter') {
      query += ` AND i.recruiter_id = $${++paramCount}`;
      params.push(req.user.userId);
    }

    if (candidate_id) {
      query += ` AND i.candidate_id = $${++paramCount}`;
      params.push(candidate_id);
    }

    if (recruiter_id) {
      query += ` AND i.recruiter_id = $${++paramCount}`;
      params.push(recruiter_id);
    }

    if (status) {
      query += ` AND i.status = $${++paramCount}`;
      params.push(status);
    }

    if (date_from) {
      query += ` AND i.scheduled_date >= $${++paramCount}`;
      params.push(date_from);
    }

    if (date_to) {
      query += ` AND i.scheduled_date <= $${++paramCount}`;
      params.push(date_to);
    }

    query += ` ORDER BY i.scheduled_date ASC`;

    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching interviews:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

app.post('/api/v1/interviews', verifyToken, validateBody(schemas.interviewCreate), async (req, res) => {
  try {
    const { candidate_id, application_id, company_name, interview_type, round_number, scheduled_date, timezone } = req.body;
    
    const result = await pool.query(`
      INSERT INTO interviews (candidate_id, application_id, recruiter_id, company_name, interview_type, round_number, scheduled_date, timezone)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      RETURNING *
    `, [candidate_id, application_id, req.user.userId, company_name, interview_type, round_number, scheduled_date, timezone]);

    // Update daily activity
    await pool.query(`
      INSERT INTO daily_activity (user_id, interviews_count)
      VALUES ($1, 1)
      ON CONFLICT (user_id, activity_date)
      DO UPDATE SET interviews_count = daily_activity.interviews_count + 1
    `, [req.user.userId]);

    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('Error creating interview:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

app.put('/api/v1/interviews/:id', verifyToken, validateBody(schemas.interviewUpdate), async (req, res) => {
  try {
    const interviewId = parseInt(req.params.id, 10);
    if (Number.isNaN(interviewId)) {
      return res.status(400).json({ message: 'Invalid interview id.' });
    }
    const { status, scheduled_date, round_number, timezone, notes } = req.body;

    const existing = await pool.query('SELECT * FROM interviews WHERE id = $1', [interviewId]);
    if (existing.rows.length === 0) {
      return res.status(404).json({ message: 'Interview not found.' });
    }

    const interview = existing.rows[0];
    const isAdmin = req.user.role === 'Admin';
    if (!isAdmin && interview.recruiter_id !== req.user.userId) {
      return res.status(403).json({ message: 'Access denied.' });
    }

    if (!isAdmin && Boolean(interview.is_approved)) {
      return res.status(403).json({ message: 'Approved interviews are locked. Contact an admin for changes.' });
    }

    const updates = [];
    const params = [];
    let paramIndex = 1;

    if (status !== undefined) {
      const allowedStatuses = ['scheduled', 'completed', 'feedback_pending', 'rejected', 'advanced'];
      if (!allowedStatuses.includes(status)) {
        return res.status(400).json({ message: 'Invalid interview status.' });
      }
      updates.push(`status = $${paramIndex++}`);
      params.push(status);
    }

    if (scheduled_date !== undefined) {
      updates.push(`scheduled_date = $${paramIndex++}`);
      params.push(scheduled_date ? new Date(scheduled_date) : null);
    }

    if (round_number !== undefined) {
      const roundNumber = Number(round_number);
      if (!Number.isFinite(roundNumber) || roundNumber < 1) {
        return res.status(400).json({ message: 'Round number must be a positive integer.' });
      }
      updates.push(`round_number = $${paramIndex++}`);
      params.push(roundNumber);
    }

    if (timezone !== undefined) {
      updates.push(`timezone = $${paramIndex++}`);
      params.push(timezone || null);
    }

    if (notes !== undefined) {
      updates.push(`notes = $${paramIndex++}`);
      params.push(notes || null);
    }

    if (updates.length === 0) {
      return res.status(400).json({ message: 'No interview fields provided for update.' });
    }

    updates.push('updated_at = CURRENT_TIMESTAMP');
    params.push(interviewId);

    const result = await pool.query(
      `
        UPDATE interviews
        SET ${updates.join(', ')}
        WHERE id = $${paramIndex}
        RETURNING *
      `,
      params,
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'Interview not found.' });
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error updating interview:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

app.post(
  '/api/v1/interviews/:id/approval',
  verifyToken,
  requireRole('Admin'),
  validateBody(schemas.approvalToggle),
  async (req, res) => {
  try {
    const interviewId = parseInt(req.params.id, 10);
    if (Number.isNaN(interviewId)) {
      return res.status(400).json({ message: 'Invalid interview id.' });
    }

    const existing = await pool.query('SELECT * FROM interviews WHERE id = $1', [interviewId]);
    if (existing.rows.length === 0) {
      return res.status(404).json({ message: 'Interview not found.' });
    }

    const shouldApprove = typeof req.body?.approved === 'boolean' ? req.body.approved : true;

    const updated = await pool.query(
      `
        UPDATE interviews
        SET is_approved = $1,
            approved_by = CASE WHEN $1 THEN $2::int ELSE NULL END,
            approved_at = CASE WHEN $1 THEN CURRENT_TIMESTAMP ELSE NULL END,
            updated_at = CURRENT_TIMESTAMP
        WHERE id = $3
        RETURNING *
      `,
      [shouldApprove, req.user.userId, interviewId],
    );

    const interview = updated.rows[0];

    if (!shouldApprove && interview?.recruiter_id) {
      const candidateResult = await pool.query('SELECT name FROM candidates WHERE id = $1', [interview.candidate_id]);
      const candidateName = candidateResult.rows[0]?.name || 'their candidate';

      await pool.query(
        `
          INSERT INTO alerts (user_id, alert_type, title, message, priority)
          VALUES ($1, 'submission_rejected', $2, $3, 2)
        `,
        [
          interview.recruiter_id,
          'Interview Rejected',
          `An admin rejected the interview for ${candidateName}. Please review the details and resubmit.`,
        ],
      );
    }

    await pool.query(
      `
        INSERT INTO audit_logs (user_id, action, table_name, record_id, old_values, new_values)
        VALUES ($1, 'UPDATE', 'interviews', $2, $3, $4)
      `,
      [req.user.userId, interviewId, JSON.stringify(existing.rows[0]), JSON.stringify(interview)],
    );

    res.json(interview);
  } catch (error) {
    console.error('Error updating interview approval:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// Assessments API endpoints
app.get('/api/v1/assessments', verifyToken, async (req, res) => {
  try {
    const { candidate_id, recruiter_id, status, due_soon } = req.query;
    let query = `
      SELECT a.*, c.name as candidate_name, u.name as recruiter_name
      FROM assessments a
      LEFT JOIN candidates c ON a.candidate_id = c.id
      LEFT JOIN users u ON a.recruiter_id = u.id
      WHERE 1=1
    `;
    const params = [];
    let paramCount = 0;

    if (req.user.role === 'Recruiter') {
      query += ` AND a.recruiter_id = $${++paramCount}`;
      params.push(req.user.userId);
    }

    if (candidate_id) {
      query += ` AND a.candidate_id = $${++paramCount}`;
      params.push(candidate_id);
    }

    if (recruiter_id) {
      query += ` AND a.recruiter_id = $${++paramCount}`;
      params.push(recruiter_id);
    }

    if (status) {
      query += ` AND a.status = $${++paramCount}`;
      params.push(status);
    }

    if (due_soon === 'true') {
      query += ` AND a.due_date <= CURRENT_DATE + INTERVAL '1 day' AND a.status = 'assigned'`;
    }

    query += ` ORDER BY a.due_date ASC`;

    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching assessments:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

app.post('/api/v1/assessments', verifyToken, validateBody(schemas.assessmentCreate), async (req, res) => {
  try {
    const { candidate_id, application_id, assessment_platform, assessment_type, due_date, notes } = req.body;
    
    const result = await pool.query(`
      INSERT INTO assessments (candidate_id, application_id, recruiter_id, assessment_platform, assessment_type, due_date, notes)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING *
    `, [candidate_id, application_id, req.user.userId, assessment_platform, assessment_type, due_date, notes]);

    // Update daily activity
    await pool.query(`
      INSERT INTO daily_activity (user_id, assessments_count)
      VALUES ($1, 1)
      ON CONFLICT (user_id, activity_date)
      DO UPDATE SET assessments_count = daily_activity.assessments_count + 1
    `, [req.user.userId]);

    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('Error creating assessment:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

app.put('/api/v1/assessments/:id', verifyToken, validateBody(schemas.assessmentUpdate), async (req, res) => {
  try {
    const assessmentId = parseInt(req.params.id, 10);
    if (Number.isNaN(assessmentId)) {
      return res.status(400).json({ message: 'Invalid assessment id.' });
    }
    const { status, due_date, score, notes } = req.body;

    const existing = await pool.query('SELECT * FROM assessments WHERE id = $1', [assessmentId]);
    if (existing.rows.length === 0) {
      return res.status(404).json({ message: 'Assessment not found.' });
    }

    const assessment = existing.rows[0];
    const isAdmin = req.user.role === 'Admin';
    if (!isAdmin && assessment.recruiter_id !== req.user.userId) {
      return res.status(403).json({ message: 'Access denied.' });
    }

    if (!isAdmin && Boolean(assessment.is_approved)) {
      return res.status(403).json({ message: 'Approved assessments are locked. Contact an admin for changes.' });
    }

    const updates = [];
    const params = [];

    if (status !== undefined) {
      const allowedStatuses = ['assigned', 'submitted', 'passed', 'failed', 'waived'];
      if (!allowedStatuses.includes(status)) {
        return res.status(400).json({ message: 'Invalid assessment status.' });
      }
      updates.push(`status = $${updates.length + 1}`);
      params.push(status);
    }

    if (due_date !== undefined) {
      updates.push(`due_date = $${updates.length + 1}`);
      params.push(due_date ? new Date(due_date) : null);
    }

    if (score !== undefined) {
      updates.push(`score = $${updates.length + 1}`);
      params.push(score);
    }

    if (notes !== undefined) {
      updates.push(`notes = $${updates.length + 1}`);
      params.push(notes || null);
    }

    if (updates.length === 0) {
      return res.status(400).json({ message: 'No assessment fields provided for update.' });
    }

    updates.push('updated_at = CURRENT_TIMESTAMP');
    params.push(assessmentId);

    const result = await pool.query(
      `
        UPDATE assessments
        SET ${updates.join(', ')}
        WHERE id = $${params.length}
        RETURNING *
      `,
      params,
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'Assessment not found.' });
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error updating assessment:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

app.post(
  '/api/v1/assessments/:id/approval',
  verifyToken,
  requireRole('Admin'),
  validateBody(schemas.approvalToggle),
  async (req, res) => {
  try {
    const assessmentId = parseInt(req.params.id, 10);
    if (Number.isNaN(assessmentId)) {
      return res.status(400).json({ message: 'Invalid assessment id.' });
    }

    const existing = await pool.query('SELECT * FROM assessments WHERE id = $1', [assessmentId]);
    if (existing.rows.length === 0) {
      return res.status(404).json({ message: 'Assessment not found.' });
    }

    const shouldApprove = typeof req.body?.approved === 'boolean' ? req.body.approved : true;

    const updated = await pool.query(
      `
        UPDATE assessments
        SET is_approved = $1,
            approved_by = CASE WHEN $1 THEN $2::int ELSE NULL END,
            approved_at = CASE WHEN $1 THEN CURRENT_TIMESTAMP ELSE NULL END,
            updated_at = CURRENT_TIMESTAMP
        WHERE id = $3
        RETURNING *
      `,
      [shouldApprove, req.user.userId, assessmentId],
    );

    const assessment = updated.rows[0];

    if (!shouldApprove && assessment?.recruiter_id) {
      const candidateResult = await pool.query('SELECT name FROM candidates WHERE id = $1', [assessment.candidate_id]);
      const candidateName = candidateResult.rows[0]?.name || 'their candidate';

      await pool.query(
        `
          INSERT INTO alerts (user_id, alert_type, title, message, priority)
          VALUES ($1, 'submission_rejected', $2, $3, 2)
        `,
        [
          assessment.recruiter_id,
          'Assessment Rejected',
          `An admin rejected the assessment for ${candidateName}. Please review and resubmit.`,
        ],
      );
    }

    await pool.query(
      `
        INSERT INTO audit_logs (user_id, action, table_name, record_id, old_values, new_values)
        VALUES ($1, 'UPDATE', 'assessments', $2, $3, $4)
      `,
      [req.user.userId, assessmentId, JSON.stringify(existing.rows[0]), JSON.stringify(assessment)],
    );

    res.json(assessment);
  } catch (error) {
    console.error('Error updating assessment approval:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// Performance reports API endpoint
app.get('/api/v1/reports/performance', verifyToken, async (req, res) => {
  try {
    const { date_from, date_to } = req.query;
    const startDate = date_from || new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    const endDate = date_to || new Date().toISOString().split('T')[0];

    let query = `
      SELECT 
        u.id as recruiter_id,
        u.name as recruiter_name,
        u.daily_quota,
        COUNT(DISTINCT c.id) as total_candidates,
        COALESCE(SUM(da.applications_count), 0) as apps_total_period,
        COALESCE(AVG(da.applications_count), 0) as avg_apps_per_day,
        COALESCE(SUM(da.interviews_count), 0) as interviews_total_period,
        COALESCE(SUM(da.assessments_count), 0) as assessments_total_period
      FROM users u
      LEFT JOIN candidates c ON u.id = c.assigned_recruiter_id
      LEFT JOIN daily_activity da ON u.id = da.user_id 
        AND da.activity_date BETWEEN $1 AND $2
      WHERE u.role = 'Recruiter' AND u.is_active = true
    `;
    const params = [startDate, endDate];

    if (req.user.role !== 'Admin') {
      query += ' AND u.id = $3';
      params.push(req.user.userId);
    }

    query += ' GROUP BY u.id, u.name, u.daily_quota ORDER BY apps_total_period DESC';

    const result = await pool.query(query, params);

    res.json(
      req.user.role === 'Admin'
        ? result.rows
        : result.rows.map((row) => ({ ...row, scope: 'self' })),
    );
  } catch (error) {
    console.error('Error fetching performance data:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

app.get('/api/v1/reports/overview', verifyToken, requireRole('Admin'), async (req, res) => {
  try {
    const parseISODate = (value) => {
      if (!value) return null;
      const parsed = new Date(value);
      if (Number.isNaN(parsed.getTime())) {
        return null;
      }
      return parsed;
    };

    const today = new Date();
    let startDate = parseISODate(req.query?.date_from) ?? today;
    let endDate = parseISODate(req.query?.date_to) ?? today;
    if (startDate > endDate) {
      const tmp = startDate;
      startDate = endDate;
      endDate = tmp;
    }
    const startDateStr = startDate.toISOString().split('T')[0];
    const endDateStr = endDate.toISOString().split('T')[0];
    const startDateTime = `${startDateStr} 00:00:00`;
    const endDateTime = `${endDateStr} 23:59:59`;
    const MS_PER_DAY = 24 * 60 * 60 * 1000;
    const totalRangeDays = Math.max(1, Math.round((endDate - startDate) / MS_PER_DAY) + 1);
    const trendWindowDays = Math.min(14, totalRangeDays);
    const trendStartDate = new Date(endDate);
    trendStartDate.setDate(endDate.getDate() - (trendWindowDays - 1));
    const trendStartStr = trendStartDate.toISOString().split('T')[0];

    const [
      { rows: candidateSummaryRows },
      { rows: stageRows },
      { rows: marketingRows },
      { rows: productivityRows },
      { rows: rangeActivityRows },
      { rows: applicationsRangeRows },
      { rows: trendRows },
    ] = await Promise.all([
        pool.query(`
          SELECT
            COUNT(*)::int AS total_candidates,
            COUNT(*) FILTER (WHERE current_stage <> 'inactive')::int AS active_candidates,
            COUNT(*) FILTER (WHERE marketing_start_date IS NOT NULL)::int AS marketing_candidates,
            COALESCE(AVG((CURRENT_DATE - created_at::date)), 0)::numeric(10,2) AS avg_tenure_days
          FROM candidates
        `),
        pool.query(`
          SELECT current_stage, COUNT(*)::int AS count
          FROM candidates
          GROUP BY current_stage
        `),
        pool.query(`
          SELECT
            COALESCE(AVG(app_totals.total_apps), 0)::numeric(10,2) AS avg_apps_per_candidate,
            COALESCE(AVG(app_totals.days_since_last_app), 0)::numeric(10,2) AS avg_days_since_last_application
          FROM (
            SELECT
              c.id,
              COALESCE(SUM(a.applications_count), 0) AS total_apps,
              CASE
                WHEN MAX(a.application_date) IS NULL THEN NULL
                ELSE (CURRENT_DATE - MAX(a.application_date))
              END AS days_since_last_app
            FROM candidates c
            LEFT JOIN applications a ON a.candidate_id = c.id
            GROUP BY c.id
          ) app_totals
        `),
        pool.query(`
          SELECT
            u.id,
            u.name,
            u.daily_quota,
            COALESCE(range_counts.applications_total, 0) AS applications_in_range,
            COALESCE(range_counts.interviews_total, 0) AS interviews_in_range,
            COALESCE(range_counts.assessments_total, 0) AS assessments_in_range,
            COALESCE(last7.avg_apps, 0)::numeric(10,2) AS avg_apps_last_7,
            COALESCE(last30.avg_apps, 0)::numeric(10,2) AS avg_apps_last_30
          FROM users u
          LEFT JOIN (
            SELECT user_id,
                   SUM(applications_count) AS applications_total,
                   SUM(interviews_count) AS interviews_total,
                   SUM(assessments_count) AS assessments_total
            FROM daily_activity
            WHERE activity_date BETWEEN $1 AND $2
            GROUP BY user_id
          ) range_counts ON range_counts.user_id = u.id
          LEFT JOIN (
            SELECT user_id, AVG(applications_count) AS avg_apps
            FROM daily_activity
            WHERE activity_date >= CURRENT_DATE - INTERVAL '6 days'
            GROUP BY user_id
          ) last7 ON last7.user_id = u.id
          LEFT JOIN (
            SELECT user_id, AVG(applications_count) AS avg_apps
            FROM daily_activity
            WHERE activity_date >= CURRENT_DATE - INTERVAL '29 days'
            GROUP BY user_id
          ) last30 ON last30.user_id = u.id
          WHERE u.role = 'Recruiter' AND u.is_active = true
          ORDER BY u.name
        `, [startDateStr, endDateStr]),
        pool.query(
          `
            SELECT
              COALESCE(SUM(applications_count), 0) AS applications_total,
              COALESCE(SUM(interviews_count), 0) AS interviews_total,
              COALESCE(SUM(assessments_count), 0) AS assessments_total
            FROM daily_activity
            WHERE activity_date BETWEEN $1 AND $2
          `,
          [startDateStr, endDateStr],
        ),
        pool.query(`
          SELECT
            COALESCE(SUM(applications_count), 0)::int AS total,
            COALESCE(
              SUM(CASE WHEN COALESCE(is_approved, false) THEN applications_count ELSE 0 END),
              0
            )::int AS approved,
            COALESCE(
              SUM(CASE WHEN COALESCE(is_approved, false) THEN 0 ELSE applications_count END),
              0
            )::int AS pending
          FROM applications
          WHERE application_date BETWEEN $1 AND $2
        `, [startDateStr, endDateStr]),
        pool.query(
          `
            SELECT
              activity_date,
              SUM(applications_count)::int AS applications_total,
              SUM(interviews_count)::int AS interviews_total,
              SUM(assessments_count)::int AS assessments_total
            FROM daily_activity
            WHERE activity_date BETWEEN $1 AND $2
            GROUP BY activity_date
            ORDER BY activity_date ASC
          `,
          [trendStartStr, endDateStr],
        ),
      ]);

    const candidateSummary = candidateSummaryRows[0] || {
      total_candidates: 0,
      active_candidates: 0,
      marketing_candidates: 0,
      avg_tenure_days: 0,
    };

    const activityTotals = rangeActivityRows[0] || {
      applications_total: 0,
      interviews_total: 0,
      assessments_total: 0,
    };

    const totalApplicationsInRange = Number(activityTotals.applications_total) || 0;
    const totalInterviewsInRange = Number(activityTotals.interviews_total) || 0;
    const totalAssessmentsInRange = Number(activityTotals.assessments_total) || 0;
    const avgApplicationsPerDayRaw =
      totalRangeDays > 0 ? totalApplicationsInRange / totalRangeDays : 0;
    const recruiterCount = productivityRows.length || 0;
    const avgApplicationsPerRecruiterPerDayRaw =
      totalRangeDays > 0 && recruiterCount > 0
        ? totalApplicationsInRange / (recruiterCount * totalRangeDays)
        : 0;

    const applicationsTodayMetrics = applicationsRangeRows[0] || {
      total: 0,
      approved: 0,
      pending: 0,
    };

    const totalApplicationsToday = Number(applicationsTodayMetrics.total) || 0;
    const applicationsApprovedToday = Number(applicationsTodayMetrics.approved) || 0;
    const applicationsPendingToday = Number(applicationsTodayMetrics.pending) || 0;

    res.json({
      summary: {
        totalCandidates: Number(candidateSummary.total_candidates) || 0,
        activeCandidates: Number(candidateSummary.active_candidates) || 0,
        marketingCandidates: Number(candidateSummary.marketing_candidates) || 0,
        avgCandidateTenureDays: Number(candidateSummary.avg_tenure_days) || 0,
        totalRecruiters: productivityRows.length,
        totalApplicationsToday: totalApplicationsInRange,
        totalInterviewsToday: totalInterviewsInRange,
        totalAssessmentsToday: totalAssessmentsInRange,
        applicationsTodayBreakdown: {
          total: totalApplicationsToday,
          approved: applicationsApprovedToday,
          pending: applicationsPendingToday,
        },
        avgApplicationsPerDay: Number(avgApplicationsPerDayRaw.toFixed(2)),
        avgApplicationsPerRecruiterPerDay: Number(avgApplicationsPerRecruiterPerDayRaw.toFixed(2)),
      },
      candidateStages: stageRows.map((row) => ({
        stage: row.current_stage,
        count: Number(row.count) || 0,
      })),
      marketingVelocity: {
        avgApplicationsPerCandidate: Number(marketingRows[0]?.avg_apps_per_candidate || 0),
        avgDaysSinceLastApplication: Number(marketingRows[0]?.avg_days_since_last_application || 0),
      },
      recruiterProductivity: productivityRows.map((row) => ({
        id: row.id,
        name: row.name,
        dailyQuota: Number(row.daily_quota) || 0,
        applicationsRange: Number(row.applications_in_range) || 0,
        interviewsRange: Number(row.interviews_in_range) || 0,
        assessmentsRange: Number(row.assessments_in_range) || 0,
        avgApplicationsLast7Days: Number(row.avg_apps_last_7) || 0,
        avgApplicationsLast30Days: Number(row.avg_apps_last_30) || 0,
        quotaProgress:
          row.daily_quota && Number(row.daily_quota) > 0
            ? Number(row.applications_in_range || 0) / Number(row.daily_quota)
            : 0,
      })),
      activityTrend: trendRows.map((row) => ({
        date: row.activity_date,
        applications: Number(row.applications_total) || 0,
        interviews: Number(row.interviews_total) || 0,
        assessments: Number(row.assessments_total) || 0,
      })),
      range: {
        dateFrom: startDateStr,
        dateTo: endDateStr,
      },
    });
  } catch (error) {
    console.error('Error building overview report:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

app.get('/api/v1/reports/activity', verifyToken, requireRole('Admin'), async (req, res) => {
  try {
    const parseISODate = (value) => {
      if (!value) return null;
      const parsed = new Date(value);
      if (Number.isNaN(parsed.getTime())) return null;
      return parsed;
    };

    const today = new Date();
    let startDate = parseISODate(req.query?.date_from) ?? today;
    let endDate = parseISODate(req.query?.date_to) ?? today;
    if (startDate > endDate) {
      const tmp = startDate;
      startDate = endDate;
      endDate = tmp;
    }
    const startDateStr = startDate.toISOString().split('T')[0];
    const endDateStr = endDate.toISOString().split('T')[0];
    const startDateTime = `${startDateStr} 00:00:00`;
    const endDateTime = `${endDateStr} 23:59:59`;

    const [
      notesResult,
      remindersResult,
      recruiterNotesResult,
      notesByRecruiterResult,
      pendingApplicationsResult,
      pendingInterviewsResult,
      pendingAssessmentsResult,
      recentApprovalsResult,
    ] = await Promise.all([
      pool.query(
        `
          SELECT
            n.id,
            n.candidate_id,
            COALESCE(c.name, 'Unassigned') AS candidate_name,
            n.content,
            n.is_private,
            n.created_at,
            u.id AS author_id,
            u.name AS author_name,
            u.role AS author_role
          FROM notes n
          JOIN users u ON n.author_id = u.id
          LEFT JOIN candidates c ON n.candidate_id = c.id
          WHERE n.created_at BETWEEN $1 AND $2
          ORDER BY n.created_at DESC
          LIMIT 15
        `,
        [startDateTime, endDateTime],
      ),
      pool.query(
        `
          SELECT
            r.id,
            r.title,
            r.description,
            r.due_date,
            r.status,
            r.priority,
            r.user_id,
            u.name AS user_name,
            c.id AS candidate_id,
            c.name AS candidate_name
          FROM reminders r
          LEFT JOIN users u ON r.user_id = u.id
          LEFT JOIN notes n ON r.note_id = n.id
          LEFT JOIN candidates c ON n.candidate_id = c.id
          WHERE r.status IN ('pending', 'snoozed')
            AND r.due_date BETWEEN $1 AND $2
          ORDER BY r.due_date ASC
          LIMIT 15
        `,
        [startDateStr, endDateStr],
      ),
      pool.query(
        `
          SELECT
            n.id,
            n.candidate_id,
            COALESCE(c.name, 'Unassigned') AS candidate_name,
            n.content,
            n.is_private,
            n.created_at,
            u.id AS author_id,
            u.name AS author_name,
            u.role AS author_role
          FROM notes n
          JOIN users u ON n.author_id = u.id
          LEFT JOIN candidates c ON n.candidate_id = c.id
          WHERE u.role = 'Recruiter'
            AND n.created_at BETWEEN $1 AND $2
          ORDER BY n.created_at DESC
          LIMIT 100
        `,
        [startDateTime, endDateTime],
      ),
      pool.query(
        `
          SELECT
            u.id,
            u.name,
            u.daily_quota,
            COUNT(n.id)::int AS total_notes,
            COUNT(*) FILTER (WHERE n.created_at >= NOW() - INTERVAL '7 days')::int AS notes_last_7_days,
            MAX(n.created_at) AS last_note_at
          FROM users u
          LEFT JOIN notes n ON n.author_id = u.id
          WHERE u.role = 'Recruiter'
          GROUP BY u.id, u.name, u.daily_quota
          ORDER BY total_notes DESC, u.name ASC
        `
      ),
      pool.query(
        `
          SELECT
            a.id,
            a.company_name AS "companyName",
            a.job_title AS "jobTitle",
            a.applications_count AS "applicationsCount",
            a.application_date AS "applicationDate",
            a.created_at AS "createdAt",
            c.id AS "candidateId",
            c.name AS "candidateName",
            u.id AS "recruiterId",
            u.name AS "recruiterName"
          FROM applications a
          LEFT JOIN candidates c ON c.id = a.candidate_id
          LEFT JOIN users u ON u.id = a.recruiter_id
          WHERE COALESCE(a.is_approved, false) = false
            AND (
              a.application_date BETWEEN $1 AND $2
              OR a.created_at BETWEEN $3 AND $4
            )
          ORDER BY a.application_date DESC, a.created_at DESC
          LIMIT 15
        `,
        [startDateStr, endDateStr, startDateTime, endDateTime],
      ),
      pool.query(
        `
          SELECT
            i.id,
            i.company_name AS "companyName",
            i.interview_type AS "interviewType",
            i.scheduled_date AS "scheduledDate",
            i.status,
            i.created_at AS "createdAt",
            c.id AS "candidateId",
            c.name AS "candidateName",
            u.id AS "recruiterId",
            u.name AS "recruiterName"
          FROM interviews i
          LEFT JOIN candidates c ON c.id = i.candidate_id
          LEFT JOIN users u ON u.id = i.recruiter_id
          WHERE COALESCE(i.is_approved, false) = false
            AND (
              i.scheduled_date BETWEEN $1 AND $2
              OR i.created_at BETWEEN $3 AND $4
            )
          ORDER BY i.scheduled_date ASC NULLS LAST, i.created_at DESC
          LIMIT 15
        `,
        [startDateTime, endDateTime, startDateTime, endDateTime],
      ),
      pool.query(
        `
          SELECT
            s.id,
            s.assessment_platform AS "assessmentPlatform",
            s.assessment_type AS "assessmentType",
            s.due_date AS "dueDate",
            s.status,
            s.created_at AS "createdAt",
            c.id AS "candidateId",
            c.name AS "candidateName",
            u.id AS "recruiterId",
            u.name AS "recruiterName"
          FROM assessments s
          LEFT JOIN candidates c ON c.id = s.candidate_id
          LEFT JOIN users u ON u.id = s.recruiter_id
          WHERE COALESCE(s.is_approved, false) = false
            AND (
              s.due_date BETWEEN $1 AND $2
              OR s.created_at BETWEEN $3 AND $4
            )
          ORDER BY s.due_date ASC NULLS LAST, s.created_at DESC
          LIMIT 15
        `,
        [startDateStr, endDateStr, startDateTime, endDateTime],
      ),
      pool.query(
        `
          SELECT
            al.id,
            al.table_name,
            al.action,
            al.record_id,
            al.old_values,
            al.new_values,
            al.created_at,
            act.id AS actor_id,
            act.name AS actor_name,
            COALESCE((al.new_values->>'recruiter_id')::int, (al.old_values->>'recruiter_id')::int) AS recruiter_id,
            rec.name AS recruiter_name,
            COALESCE((al.new_values->>'candidate_id')::int, (al.old_values->>'candidate_id')::int) AS candidate_id,
            cand.name AS candidate_name
          FROM audit_logs al
          LEFT JOIN users act ON act.id = al.user_id
          LEFT JOIN users rec ON rec.id = COALESCE((al.new_values->>'recruiter_id')::int, (al.old_values->>'recruiter_id')::int)
          LEFT JOIN candidates cand ON cand.id = COALESCE((al.new_values->>'candidate_id')::int, (al.old_values->>'candidate_id')::int)
          WHERE al.table_name IN ('applications', 'interviews', 'assessments')
            AND al.created_at BETWEEN $1 AND $2
          ORDER BY al.created_at DESC
          LIMIT 20
        `,
        [startDateTime, endDateTime],
      ),
    ]);

    const recentNotes = notesResult.rows.map((row) => ({
      id: row.id,
      candidateId: row.candidate_id,
      candidateName: row.candidate_name,
      content: row.content,
      isPrivate: row.is_private,
      createdAt: row.created_at,
      author: {
        id: row.author_id,
        name: row.author_name,
        role: row.author_role,
      },
    }));

    const upcomingReminders = remindersResult.rows.map((row) => ({
      id: row.id,
      title: row.title,
      description: row.description,
      dueDate: row.due_date,
      status: row.status,
      priority: row.priority,
      owner: {
        id: row.user_id,
        name: row.user_name,
      },
      candidate: row.candidate_id
        ? {
            id: row.candidate_id,
            name: row.candidate_name,
          }
        : null,
    }));

    const recruiterNotes = recruiterNotesResult.rows.map((row) => ({
      id: row.id,
      candidateId: row.candidate_id,
      candidateName: row.candidate_name,
      content: row.content,
      isPrivate: row.is_private,
      createdAt: row.created_at,
      author: {
        id: row.author_id,
        name: row.author_name,
        role: row.author_role,
      },
    }));

    const notesByRecruiter = notesByRecruiterResult.rows.map((row) => ({
      id: row.id,
      name: row.name,
      dailyQuota: Number(row.daily_quota) || 0,
      totalNotes: Number(row.total_notes) || 0,
      notesLast7Days: Number(row.notes_last_7_days) || 0,
      lastNoteAt: row.last_note_at,
    }));

    const pendingApplications = pendingApplicationsResult.rows.map((row) => ({
      id: row.id,
      companyName: row.companyName,
      jobTitle: row.jobTitle,
      applicationsCount: Number(row.applicationsCount || 0),
      applicationDate: row.applicationDate,
      createdAt: row.createdAt,
      candidate: row.candidateId ? { id: row.candidateId, name: row.candidateName } : null,
      recruiter: row.recruiterId ? { id: row.recruiterId, name: row.recruiterName } : null,
    }));

    const pendingInterviews = pendingInterviewsResult.rows.map((row) => ({
      id: row.id,
      companyName: row.companyName,
      interviewType: row.interviewType,
      scheduledDate: row.scheduledDate,
      status: row.status,
      createdAt: row.createdAt,
      candidate: row.candidateId ? { id: row.candidateId, name: row.candidateName } : null,
      recruiter: row.recruiterId ? { id: row.recruiterId, name: row.recruiterName } : null,
    }));

    const pendingAssessments = pendingAssessmentsResult.rows.map((row) => ({
      id: row.id,
      assessmentPlatform: row.assessmentPlatform,
      assessmentType: row.assessmentType,
      dueDate: row.dueDate,
      status: row.status,
      createdAt: row.createdAt,
      candidate: row.candidateId ? { id: row.candidateId, name: row.candidateName } : null,
      recruiter: row.recruiterId ? { id: row.recruiterId, name: row.recruiterName } : null,
    }));

    const recentApprovals = recentApprovalsResult.rows.map((row) => {
      const entity =
        row.table_name === 'applications'
          ? 'Application'
          : row.table_name === 'interviews'
          ? 'Interview'
          : row.table_name === 'assessments'
          ? 'Assessment'
          : row.table_name;
      const newValues = row.new_values || {};
      const oldValues = row.old_values || {};
      let decision = 'updated';

      if (row.table_name === 'applications') {
        if (row.action === 'DELETE') {
          decision = 'rejected';
        } else if (row.action === 'UPDATE') {
          decision = newValues.is_approved === true ? 'approved' : 'rejected';
        }
      } else {
        if (row.action === 'UPDATE') {
          if (newValues.is_approved === true) {
            decision = 'approved';
          } else if (newValues.is_approved === false || newValues.status === 'rejected') {
            decision = 'rejected';
          }
        } else if (row.action === 'DELETE') {
          decision = 'deleted';
        }
      }

      return {
        id: row.id,
        entity,
        decision,
        actor: {
          id: row.actor_id,
          name: row.actor_name || 'System',
        },
        recruiter: row.recruiter_id ? { id: row.recruiter_id, name: row.recruiter_name } : null,
        candidate: row.candidate_id ? { id: row.candidate_id, name: row.candidate_name } : null,
        createdAt: row.created_at,
        recordId: row.record_id,
      };
    });

    res.json({
      recentNotes,
      upcomingReminders,
      recruiterNotes,
      notesByRecruiter,
      pendingApprovals: {
        applications: pendingApplications,
        interviews: pendingInterviews,
        assessments: pendingAssessments,
      },
      recentApprovals,
      range: {
        dateFrom: startDateStr,
        dateTo: endDateStr,
      },
    });
  } catch (error) {
    console.error('Error fetching activity feed:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

app.post(
  '/api/v1/pending-approvals/bulk',
  verifyToken,
  requireRole('Admin'),
  validateBody(schemas.bulkPendingApprovals),
  async (req, res) => {
  const recruiterIdRaw = parseInt(req.body?.recruiterId, 10);
  const action = typeof req.body?.action === 'string' ? req.body.action.toLowerCase() : '';
  const validActions = ['approve', 'reject'];
  const validTypes = new Set(['applications', 'interviews', 'assessments']);
  const requestedTypes = Array.isArray(req.body?.types)
    ? req.body.types.map((value) => String(value).toLowerCase())
    : ['applications', 'interviews', 'assessments'];

  const parseIdArray = (value) => {
    if (!Array.isArray(value)) return [];
    const ids = value
      .map((item) => parseInt(item, 10))
      .filter((id) => Number.isFinite(id) && id > 0);
    return Array.from(new Set(ids));
  };

  const applicationIds = parseIdArray(req.body?.applicationIds);
  const interviewIds = parseIdArray(req.body?.interviewIds);
  const assessmentIds = parseIdArray(req.body?.assessmentIds);
  const hasExplicitSelection = applicationIds.length > 0 || interviewIds.length > 0 || assessmentIds.length > 0;

  let typeSet = Array.from(new Set(requestedTypes.filter((value) => validTypes.has(value))));
  if (typeSet.length === 0) {
    typeSet = ['applications', 'interviews', 'assessments'];
  }
  if (hasExplicitSelection) {
    typeSet = [];
    if (applicationIds.length > 0) typeSet.push('applications');
    if (interviewIds.length > 0) typeSet.push('interviews');
    if (assessmentIds.length > 0) typeSet.push('assessments');
  }

  if (!validActions.includes(action)) {
    return res.status(400).json({ message: 'action must be "approve" or "reject".' });
  }
  if (typeSet.length === 0) {
    return res.status(400).json({ message: 'types must include at least one supported entry.' });
  }

  const recruiterId = Number.isFinite(recruiterIdRaw) && recruiterIdRaw > 0 ? recruiterIdRaw : null;
  if (!hasExplicitSelection && recruiterId === null) {
    return res.status(400).json({ message: 'recruiterId must be provided when no explicit selection is supplied.' });
  }

  const buildSelectionClause = (useIds, field = 'id') =>
    useIds
      ? { text: `id = ANY($1::int[]) AND COALESCE(is_approved, false) = false`, params: [] }
      : { text: `recruiter_id = $1 AND COALESCE(is_approved, false) = false`, params: [] };

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const summary = {
      applications: 0,
      interviews: 0,
      assessments: 0,
    };

    if (typeSet.includes('applications')) {
      const useExplicit = applicationIds.length > 0;
      if (useExplicit || recruiterId !== null) {
        const clause = buildSelectionClause(useExplicit);
        const params = useExplicit ? [applicationIds] : [recruiterId];
        const { rows: existingApplications } = await client.query(
          `
            SELECT
              *,
              (SELECT name FROM candidates WHERE id = applications.candidate_id) AS candidate_name
            FROM applications
            WHERE ${clause.text}
          `,
          params,
        );
        if (existingApplications.length > 0) {
          const targetApplicationIds = existingApplications.map((row) => row.id);
          if (action === 'approve') {
            const { rows: updatedApplications } = await client.query(
              `
                UPDATE applications
                SET is_approved = true,
                    approved_by = $1::int,
                    approved_at = CURRENT_TIMESTAMP,
                    updated_at = CURRENT_TIMESTAMP
                WHERE id = ANY($2::int[])
                RETURNING *
              `,
              [req.user.userId, targetApplicationIds],
            );
            summary.applications = updatedApplications.length;
            const updatedMap = new Map(updatedApplications.map((row) => [row.id, row]));
            for (const original of existingApplications) {
              const updated = updatedMap.get(original.id);
              if (!updated) continue;
              await client.query(
                `
                  INSERT INTO audit_logs (user_id, action, table_name, record_id, old_values, new_values)
                  VALUES ($1, 'UPDATE', 'applications', $2, $3, $4)
                `,
                [req.user.userId, original.id, JSON.stringify(original), JSON.stringify(updated)],
              );
            }
          } else {
            const { rows: deletedApplications } = await client.query(
              `
                DELETE FROM applications
                WHERE id = ANY($1::int[])
                RETURNING *,
                  (SELECT name FROM candidates WHERE id = applications.candidate_id) AS candidate_name
              `,
              [targetApplicationIds],
            );
            summary.applications = deletedApplications.length;
            const refreshTargets = new Map();
            for (const row of deletedApplications) {
              const recruiterKey = row.recruiter_id || recruiterId;
              if (!recruiterKey) continue;
              const dateKey = row.application_date
                ? new Date(row.application_date).toISOString().split('T')[0]
                : new Date().toISOString().split('T')[0];
              const existingSet = refreshTargets.get(recruiterKey) ?? new Set();
              existingSet.add(dateKey);
              refreshTargets.set(recruiterKey, existingSet);
              await client.query(
                `
                  INSERT INTO audit_logs (user_id, action, table_name, record_id, old_values)
                  VALUES ($1, 'DELETE', 'applications', $2, $3)
                `,
                [req.user.userId, row.id, JSON.stringify(row)],
              );
              if (recruiterKey) {
                await client.query(
                  `
                    INSERT INTO alerts (user_id, alert_type, title, message, priority)
                    VALUES ($1, 'submission_rejected', 'Application Rejected', $2, 2)
                  `,
                  [
                    recruiterKey,
                    `An admin rejected the application for ${row.candidate_name || 'their candidate'}. Please update and resubmit.`,
                  ],
                );
              }
            }
            for (const [recruiterKey, dateSet] of refreshTargets.entries()) {
              for (const dateKey of dateSet) {
                const aggregate = await client.query(
                  `
                    SELECT COALESCE(SUM(applications_count), 0) AS total
                    FROM applications
                    WHERE recruiter_id = $1 AND application_date = $2
                  `,
                  [recruiterKey, dateKey],
                );
                const totalForDay = Number(aggregate.rows[0]?.total || 0);
                if (totalForDay > 0) {
                  await client.query(
                    `
                      INSERT INTO daily_activity (user_id, activity_date, applications_count)
                      VALUES ($1, $2, $3)
                      ON CONFLICT (user_id, activity_date)
                      DO UPDATE SET applications_count = EXCLUDED.applications_count
                    `,
                    [recruiterKey, dateKey, totalForDay],
                  );
                } else {
                  await client.query(
                    `
                      DELETE FROM daily_activity
                      WHERE user_id = $1 AND activity_date = $2
                    `,
                    [recruiterKey, dateKey],
                  );
                }
              }
            }
          }
        }
      }
    }

    if (typeSet.includes('interviews')) {
      const useExplicit = interviewIds.length > 0;
      if (useExplicit || recruiterId !== null) {
        const clause = buildSelectionClause(useExplicit);
        const params = useExplicit ? [interviewIds] : [recruiterId];
        const { rows: existingInterviews } = await client.query(
          `
            SELECT
              *,
              (SELECT name FROM candidates WHERE id = interviews.candidate_id) AS candidate_name
            FROM interviews
            WHERE ${clause.text}
          `,
          params,
        );
        if (existingInterviews.length > 0) {
          const targetInterviewIds = existingInterviews.map((row) => row.id);
          if (action === 'approve') {
            const { rows: updatedInterviews } = await client.query(
              `
                UPDATE interviews
                SET is_approved = true,
                    approved_by = $1::int,
                    approved_at = CURRENT_TIMESTAMP,
                    updated_at = CURRENT_TIMESTAMP
                WHERE id = ANY($2::int[])
                RETURNING *
              `,
              [req.user.userId, targetInterviewIds],
            );
            summary.interviews = updatedInterviews.length;
            const updatedMap = new Map(updatedInterviews.map((row) => [row.id, row]));
            for (const original of existingInterviews) {
              const updated = updatedMap.get(original.id);
              if (!updated) continue;
              await client.query(
                `
                  INSERT INTO audit_logs (user_id, action, table_name, record_id, old_values, new_values)
                  VALUES ($1, 'UPDATE', 'interviews', $2, $3, $4)
                `,
                [req.user.userId, original.id, JSON.stringify(original), JSON.stringify(updated)],
              );
            }
          } else {
            const { rows: updatedInterviews } = await client.query(
              `
                UPDATE interviews
                SET is_approved = false,
                    status = CASE WHEN status = 'rejected' THEN status ELSE 'rejected' END,
                    approved_by = NULL,
                    approved_at = NULL,
                    updated_at = CURRENT_TIMESTAMP
                WHERE id = ANY($1::int[])
                RETURNING *,
                  (SELECT name FROM candidates WHERE id = interviews.candidate_id) AS candidate_name
              `,
              [targetInterviewIds],
            );
            summary.interviews = updatedInterviews.length;
            const updatedMap = new Map(updatedInterviews.map((row) => [row.id, row]));
            for (const original of existingInterviews) {
              const updated = updatedMap.get(original.id);
              if (!updated) continue;
              await client.query(
                `
                  INSERT INTO audit_logs (user_id, action, table_name, record_id, old_values, new_values)
                  VALUES ($1, 'UPDATE', 'interviews', $2, $3, $4)
                `,
                [req.user.userId, original.id, JSON.stringify(original), JSON.stringify(updated)],
              );
              const recruiterKey = original.recruiter_id || recruiterId;
              if (recruiterKey) {
                await client.query(
                  `
                    INSERT INTO alerts (user_id, alert_type, title, message, priority)
                    VALUES ($1, 'submission_rejected', 'Interview Rejected', $2, 2)
                  `,
                  [
                    recruiterKey,
                    `An admin rejected the interview for ${original.candidate_name || 'their candidate'}. Please review the details and resubmit.`,
                  ],
                );
              }
            }
          }
        }
      }
    }

    if (typeSet.includes('assessments')) {
      const useExplicit = assessmentIds.length > 0;
      if (useExplicit || recruiterId !== null) {
        const clause = buildSelectionClause(useExplicit);
        const params = useExplicit ? [assessmentIds] : [recruiterId];
        const { rows: existingAssessments } = await client.query(
          `
            SELECT
              *,
              (SELECT name FROM candidates WHERE id = assessments.candidate_id) AS candidate_name
            FROM assessments
            WHERE ${clause.text}
          `,
          params,
        );
        if (existingAssessments.length > 0) {
          const targetAssessmentIds = existingAssessments.map((row) => row.id);
          if (action === 'approve') {
            const { rows: updatedAssessments } = await client.query(
              `
                UPDATE assessments
                SET is_approved = true,
                    approved_by = $1::int,
                    approved_at = CURRENT_TIMESTAMP,
                    updated_at = CURRENT_TIMESTAMP
                WHERE id = ANY($2::int[])
                RETURNING *
              `,
              [req.user.userId, targetAssessmentIds],
            );
            summary.assessments = updatedAssessments.length;
            const updatedMap = new Map(updatedAssessments.map((row) => [row.id, row]));
            for (const original of existingAssessments) {
              const updated = updatedMap.get(original.id);
              if (!updated) continue;
              await client.query(
                `
                  INSERT INTO audit_logs (user_id, action, table_name, record_id, old_values, new_values)
                  VALUES ($1, 'UPDATE', 'assessments', $2, $3, $4)
                `,
                [req.user.userId, original.id, JSON.stringify(original), JSON.stringify(updated)],
              );
            }
          } else {
            const { rows: updatedAssessments } = await client.query(
              `
                UPDATE assessments
                SET is_approved = false,
                    approved_by = NULL,
                    approved_at = NULL,
                    updated_at = CURRENT_TIMESTAMP
                WHERE id = ANY($1::int[])
                RETURNING *,
                  (SELECT name FROM candidates WHERE id = assessments.candidate_id) AS candidate_name
              `,
              [targetAssessmentIds],
            );
            summary.assessments = updatedAssessments.length;
            const updatedMap = new Map(updatedAssessments.map((row) => [row.id, row]));
            for (const original of existingAssessments) {
              const updated = updatedMap.get(original.id);
              if (!updated) continue;
              await client.query(
                `
                  INSERT INTO audit_logs (user_id, action, table_name, record_id, old_values, new_values)
                  VALUES ($1, 'UPDATE', 'assessments', $2, $3, $4)
                `,
                [req.user.userId, original.id, JSON.stringify(original), JSON.stringify(updated)],
              );
              const recruiterKey = original.recruiter_id || recruiterId;
              if (recruiterKey) {
                await client.query(
                  `
                    INSERT INTO alerts (user_id, alert_type, title, message, priority)
                    VALUES ($1, 'submission_rejected', 'Assessment Rejected', $2, 2)
                  `,
                  [
                    recruiterKey,
                    `An admin rejected the assessment for ${original.candidate_name || 'their candidate'}. Please review and resubmit.`,
                  ],
                );
              }
            }
          }
        }
      }
    }

    await client.query('COMMIT');
    res.json({
      action,
      summary,
      types: typeSet,
      mode: hasExplicitSelection ? 'selection' : 'recruiter',
      recruiterId: recruiterId ?? null,
    });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error processing bulk pending approvals:', error);
    res.status(500).json({ message: 'Internal server error' });
  } finally {
    client.release();
  }
});

app.get('/api/v1/reports/application-activity', verifyToken, requireRole('Admin'), async (req, res) => {
  try {
    const parseISODate = (value) => {
      if (!value) return null;
      const parsed = new Date(value);
      if (Number.isNaN(parsed.getTime())) return null;
      return parsed;
    };

    const today = new Date();
    const defaultEnd = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    const defaultStart = new Date(defaultEnd);
    defaultStart.setDate(defaultEnd.getDate() - 29);

    let startDate = parseISODate(req.query?.date_from) ?? defaultStart;
    let endDate = parseISODate(req.query?.date_to) ?? defaultEnd;
    if (startDate > endDate) {
      const tmp = startDate;
      startDate = endDate;
      endDate = tmp;
    }

    const startDateStr = startDate.toISOString().split('T')[0];
    const endDateStr = endDate.toISOString().split('T')[0];

    const conditions = [];
    const params = [];
    let paramIndex = 1;

    conditions.push(`rca.activity_date BETWEEN $${paramIndex++} AND $${paramIndex++}`);
    params.push(startDateStr, endDateStr);

    let recruiterId = null;
    if (req.query?.recruiter_id) {
      recruiterId = parseInt(req.query.recruiter_id, 10);
      if (Number.isNaN(recruiterId)) {
        return res.status(400).json({ message: 'Invalid recruiter_id parameter' });
      }
      conditions.push(`rca.recruiter_id = $${paramIndex++}`);
      params.push(recruiterId);
    }

    let candidateId = null;
    if (req.query?.candidate_id) {
      candidateId = parseInt(req.query.candidate_id, 10);
      if (Number.isNaN(candidateId)) {
        return res.status(400).json({ message: 'Invalid candidate_id parameter' });
      }
      conditions.push(`rca.candidate_id = $${paramIndex++}`);
      params.push(candidateId);
    }

    const whereClause = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

    const { rows } = await pool.query(
      `
        SELECT
          rca.activity_date,
          rca.recruiter_id,
          u.name AS recruiter_name,
          rca.candidate_id,
          c.name AS candidate_name,
          rca.applications_count
        FROM recruiter_candidate_activity rca
        JOIN users u ON u.id = rca.recruiter_id
        JOIN candidates c ON c.id = rca.candidate_id
        ${whereClause}
        ORDER BY rca.activity_date DESC, recruiter_name, candidate_name
      `,
      params,
    );

    const recruiterTotals = new Map();
    const candidateTotals = new Map();
    const dateTotals = new Map();
    let overallTotal = 0;

    const records = rows.map((row) => {
      const count = Number(row.applications_count) || 0;
      const recruiterKey = Number(row.recruiter_id);
      const candidateKey = Number(row.candidate_id);
      const dateKey =
        row.activity_date instanceof Date
          ? row.activity_date.toISOString().split('T')[0]
          : row.activity_date;

      overallTotal += count;

      const recruiterEntry = recruiterTotals.get(recruiterKey) ?? {
        recruiterId: recruiterKey,
        recruiterName: row.recruiter_name,
        totalApplications: 0,
      };
      recruiterEntry.totalApplications += count;
      recruiterTotals.set(recruiterKey, recruiterEntry);

      const candidateEntry = candidateTotals.get(candidateKey) ?? {
        candidateId: candidateKey,
        candidateName: row.candidate_name,
        totalApplications: 0,
      };
      candidateEntry.totalApplications += count;
      candidateTotals.set(candidateKey, candidateEntry);

      const dateEntry = dateTotals.get(dateKey) ?? 0;
      dateTotals.set(dateKey, dateEntry + count);

      return {
        activityDate: dateKey,
        recruiter: {
          id: recruiterKey,
          name: row.recruiter_name,
        },
        candidate: {
          id: candidateKey,
          name: row.candidate_name,
        },
        applicationsCount: count,
      };
    });

    const sortByTotal = (a, b) => b.totalApplications - a.totalApplications;

    const totals = {
      overall: overallTotal,
      byRecruiter: Array.from(recruiterTotals.values()).sort(sortByTotal),
      byCandidate: Array.from(candidateTotals.values()).sort(sortByTotal),
      byDate: Array.from(dateTotals.entries())
        .map(([date, total]) => ({ date, totalApplications: total }))
        .sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0)),
    };

    res.json({
      range: {
        start: startDateStr,
        end: endDateStr,
      },
      filters: {
        recruiterId: recruiterId ?? null,
        candidateId: candidateId ?? null,
      },
      totals,
      records,
      generatedAt: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Error building application activity report:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

app.get('/api/v1/reports/leaderboard', verifyToken, async (req, res) => {
  try {
    const leaderboardResult = await pool.query(
      `
        WITH application_metrics AS (
          SELECT
            recruiter_id,
            SUM(applications_count) AS total_applications,
            SUM(CASE WHEN application_date = CURRENT_DATE THEN applications_count ELSE 0 END) AS today_applications,
            SUM(CASE WHEN application_date >= CURRENT_DATE - INTERVAL '6 days' THEN applications_count ELSE 0 END) AS week_applications,
            SUM(CASE WHEN application_date >= CURRENT_DATE - INTERVAL '29 days' THEN applications_count ELSE 0 END) AS month_applications
          FROM applications
          GROUP BY recruiter_id
        ),
        candidate_metrics AS (
          SELECT
            assigned_recruiter_id AS recruiter_id,
            COUNT(*) FILTER (WHERE current_stage <> 'inactive') AS active_candidates,
            COUNT(*) AS total_candidates
          FROM candidates
          GROUP BY assigned_recruiter_id
        ),
        note_metrics AS (
          SELECT
            author_id AS recruiter_id,
            COUNT(*) FILTER (WHERE created_at >= CURRENT_DATE - INTERVAL '6 days') AS notes_last_7_days
          FROM notes
          GROUP BY author_id
        )
        SELECT
          u.id,
          u.name,
          u.daily_quota,
          COALESCE(a.today_applications, 0) AS today_applications,
          COALESCE(a.week_applications, 0) AS week_applications,
          COALESCE(a.month_applications, 0) AS month_applications,
          COALESCE(a.total_applications, 0) AS total_applications,
          COALESCE(c.active_candidates, 0) AS active_candidates,
          COALESCE(c.total_candidates, 0) AS total_candidates,
          COALESCE(n.notes_last_7_days, 0) AS notes_last_7_days
        FROM users u
        LEFT JOIN application_metrics a ON a.recruiter_id = u.id
        LEFT JOIN candidate_metrics c ON c.recruiter_id = u.id
        LEFT JOIN note_metrics n ON n.recruiter_id = u.id
        WHERE u.role = 'Recruiter' AND u.is_active = true
        ORDER BY COALESCE(a.week_applications, 0) DESC, COALESCE(a.today_applications, 0) DESC, u.name ASC
      `,
    );

    const leaderboard = leaderboardResult.rows.map((row, index) => ({
      rank: index + 1,
      recruiterId: row.id,
      name: row.name,
      dailyQuota: Number(row.daily_quota) || 0,
      todayApplications: Number(row.today_applications) || 0,
      weekApplications: Number(row.week_applications) || 0,
      monthApplications: Number(row.month_applications) || 0,
      totalApplications: Number(row.total_applications) || 0,
      activeCandidates: Number(row.active_candidates) || 0,
      totalCandidates: Number(row.total_candidates) || 0,
      notesLast7Days: Number(row.notes_last_7_days) || 0,
    }));

    res.json({ leaderboard, generatedAt: new Date().toISOString() });
  } catch (error) {
    console.error('Error building leaderboard:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

app.get('/api/v1/notifications', verifyToken, async (req, res) => {
  try {
    const isAdmin = req.user.role === 'Admin';

    const remindersQuery = `
      SELECT
        r.id,
        r.title,
        r.description,
        r.due_date,
        r.status,
        r.priority,
        r.user_id,
        u.name AS user_name,
        c.id AS candidate_id,
        c.name AS candidate_name
      FROM reminders r
      LEFT JOIN users u ON r.user_id = u.id
      LEFT JOIN notes n ON r.note_id = n.id
      LEFT JOIN candidates c ON n.candidate_id = c.id
      WHERE r.status IN ('pending', 'snoozed')
      ${isAdmin ? '' : 'AND r.user_id = $1'}
      ORDER BY r.due_date ASC
      LIMIT 15
    `;

    const alertsQuery = `
      SELECT
        a.id,
        a.alert_type,
        a.title,
        a.message,
        a.status,
        a.priority,
        a.created_at,
        a.user_id,
        u.name AS user_name
      FROM alerts a
      LEFT JOIN users u ON a.user_id = u.id
      WHERE a.status <> 'resolved'
      ${isAdmin ? '' : 'AND a.user_id = $1'}
      ORDER BY a.priority DESC, a.created_at DESC
      LIMIT 20
    `;

    const params = isAdmin ? [] : [req.user.userId];

    const [remindersResult, alertsResult] = await Promise.all([
      pool.query(remindersQuery, params),
      pool.query(alertsQuery, params),
    ]);

    const reminders = remindersResult.rows.map((row) => ({
      id: row.id,
      title: row.title,
      description: row.description,
      dueDate: row.due_date,
      status: row.status,
      priority: row.priority,
      owner: {
        id: row.user_id,
        name: row.user_name,
      },
      candidate: row.candidate_id
        ? {
            id: row.candidate_id,
            name: row.candidate_name,
          }
        : null,
    }));

    const alerts = alertsResult.rows.map((row) => ({
      id: row.id,
      type: row.alert_type,
      title: row.title,
      message: row.message,
      status: row.status,
      priority: row.priority,
      createdAt: row.created_at,
      owner: {
        id: row.user_id,
        name: row.user_name,
      },
    }));

    res.json({ reminders, alerts });
  } catch (error) {
    console.error('Error fetching notifications:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// Alerts API endpoints
app.get('/api/v1/alerts', verifyToken, async (req, res) => {
  try {
    const { status } = req.query;
    let query = `
      SELECT * FROM alerts 
      WHERE user_id = $1
    `;
    const params = [req.user.userId];

    if (status) {
      query += ` AND status = $2`;
      params.push(status);
    }

    query += ` ORDER BY created_at DESC`;

    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching alerts:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

app.patch('/api/v1/alerts/:id/acknowledge', verifyToken, async (req, res) => {
  try {
    const { id } = req.params;
    const alertResult = await pool.query('SELECT * FROM alerts WHERE id = $1', [id]);

    if (alertResult.rows.length === 0) {
      return res.status(404).json({ message: 'Alert not found' });
    }

    const alert = alertResult.rows[0];
    if (alert.user_id !== req.user.userId && req.user.role !== 'Admin') {
      return res.status(403).json({ message: 'Access denied' });
    }

    if (alert.status === 'resolved') {
      return res.status(400).json({ message: 'Resolved alerts cannot be acknowledged' });
    }

    const updated = await pool.query(`
      UPDATE alerts
      SET status = 'acknowledged',
          acknowledged_at = COALESCE(acknowledged_at, CURRENT_TIMESTAMP)
      WHERE id = $1
      RETURNING *
    `, [id]);

    res.json(updated.rows[0]);
  } catch (error) {
    console.error('Error acknowledging alert:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

app.patch('/api/v1/alerts/:id/resolve', verifyToken, async (req, res) => {
  try {
    const { id } = req.params;
    const alertResult = await pool.query('SELECT * FROM alerts WHERE id = $1', [id]);

    if (alertResult.rows.length === 0) {
      return res.status(404).json({ message: 'Alert not found' });
    }

    const alert = alertResult.rows[0];
    if (alert.user_id !== req.user.userId && req.user.role !== 'Admin') {
      return res.status(403).json({ message: 'Access denied' });
    }

    const updated = await pool.query(`
      UPDATE alerts
      SET status = 'resolved',
          acknowledged_at = COALESCE(acknowledged_at, CURRENT_TIMESTAMP),
          resolved_at = CURRENT_TIMESTAMP
      WHERE id = $1
      RETURNING *
    `, [id]);

    res.json(updated.rows[0]);
  } catch (error) {
    console.error('Error resolving alert:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// User management endpoints
app.get('/api/v1/users/activity', verifyToken, requireRole('Admin'), async (req, res) => {
  try {
    const result = await pool.query(
      `
        SELECT
          u.id,
          u.name,
          u.email,
          u.role,
          u.daily_quota,
          u.last_login_at,
          u.last_active_at,
          COUNT(n.id)::int AS total_notes,
          COUNT(*) FILTER (WHERE n.created_at >= NOW() - INTERVAL '7 days')::int AS notes_last_7_days
        FROM users u
        LEFT JOIN notes n ON n.author_id = u.id
        GROUP BY u.id, u.name, u.email, u.role, u.daily_quota, u.last_login_at, u.last_active_at
        ORDER BY u.role, u.name
      `
    );

    const now = Date.now();

    const users = result.rows.map((row) => {
      const lastActiveAt = row.last_active_at ? new Date(row.last_active_at) : null;
      const isOnline = lastActiveAt ? now - lastActiveAt.getTime() <= 5 * 60 * 1000 : false;

      return {
        id: row.id,
        name: row.name,
        email: row.email,
        role: row.role,
        dailyQuota: Number(row.daily_quota) || 0,
        lastLoginAt: row.last_login_at,
        lastActiveAt: row.last_active_at,
        isOnline,
        totalNotes: Number(row.total_notes) || 0,
        notesLast7Days: Number(row.notes_last_7_days) || 0,
      };
    });

    res.json({ users, generatedAt: new Date().toISOString() });
  } catch (error) {
    console.error('Error fetching user activity:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

app.get('/api/v1/users/:id/profile', verifyToken, async (req, res) => {
  try {
    const userId = parseInt(req.params.id, 10);
    if (Number.isNaN(userId)) {
      return res.status(400).json({ message: 'Invalid user id' });
    }

    if (req.user.role !== 'Admin' && req.user.userId !== userId) {
      return res.status(403).json({ message: 'Access denied' });
    }

    const parseLimit = (value, fallback = 6) => {
      const parsed = parseInt(value, 10);
      if (Number.isFinite(parsed) && parsed > 0) {
        return Math.min(parsed, 50);
      }
      return fallback;
    };

    const parseOffset = (value) => {
      const parsed = parseInt(value, 10);
      if (Number.isFinite(parsed) && parsed >= 0) {
        return parsed;
      }
      return 0;
    };

    const assignedCandidatesLimit = parseLimit(req.query.assignedCandidatesLimit, 6);
    const assignedCandidatesOffset = parseOffset(req.query.assignedCandidatesOffset);

    const recentApplicationsLimit = parseLimit(req.query.recentApplicationsLimit, 6);
    const recentApplicationsOffset = parseOffset(req.query.recentApplicationsOffset);

    const upcomingInterviewsLimit = parseLimit(req.query.upcomingInterviewsLimit, 6);
    const upcomingInterviewsOffset = parseOffset(req.query.upcomingInterviewsOffset);

    const pendingAssessmentsLimit = parseLimit(req.query.pendingAssessmentsLimit, 6);
    const pendingAssessmentsOffset = parseOffset(req.query.pendingAssessmentsOffset);

    const recentNotesLimit = parseLimit(req.query.recentNotesLimit, 6);
    const recentNotesOffset = parseOffset(req.query.recentNotesOffset);

    const upcomingRemindersLimit = parseLimit(req.query.upcomingRemindersLimit, 6);
    const upcomingRemindersOffset = parseOffset(req.query.upcomingRemindersOffset);

    const openAlertsLimit = parseLimit(req.query.openAlertsLimit, 6);
    const openAlertsOffset = parseOffset(req.query.openAlertsOffset);

    const userResult = await pool.query(
      `
        SELECT id, name, email, role, daily_quota, is_active, created_at, updated_at
        FROM users
        WHERE id = $1
      `,
      [userId],
    );

    if (userResult.rows.length === 0) {
      return res.status(404).json({ message: 'User not found' });
    }

    const [
      applicationMetricsResult,
      applicationTodayMetricsResult,
      interviewMetricsResult,
      assessmentMetricsResult,
      assignedCandidatesResult,
      recentApplicationsResult,
      upcomingInterviewsResult,
      pendingAssessmentsResult,
      recentNotesResult,
      upcomingRemindersResult,
      openAlertsResult,
    ] = await Promise.all([
      pool.query(
        `
          SELECT
            COALESCE(SUM(applications_count), 0) AS total,
            COALESCE(SUM(CASE WHEN COALESCE(is_approved, false) THEN applications_count ELSE 0 END), 0) AS approved,
            COALESCE(SUM(CASE WHEN COALESCE(is_approved, false) THEN 0 ELSE applications_count END), 0) AS pending
          FROM applications
          WHERE recruiter_id = $1
        `,
        [userId],
      ),
      pool.query(
        `
          SELECT
            COALESCE(SUM(applications_count), 0) AS total,
            COALESCE(SUM(CASE WHEN COALESCE(is_approved, false) THEN applications_count ELSE 0 END), 0) AS approved,
            COALESCE(SUM(CASE WHEN COALESCE(is_approved, false) THEN 0 ELSE applications_count END), 0) AS pending
          FROM applications
          WHERE recruiter_id = $1
            AND application_date = CURRENT_DATE
        `,
        [userId],
      ),
      pool.query(
        `
          SELECT
            COUNT(*) AS total,
            COUNT(*) FILTER (WHERE COALESCE(is_approved, false)) AS approved,
            COUNT(*) FILTER (WHERE NOT COALESCE(is_approved, false)) AS pending
          FROM interviews
          WHERE recruiter_id = $1
        `,
        [userId],
      ),
      pool.query(
        `
          SELECT
            COUNT(*) AS total,
            COUNT(*) FILTER (WHERE COALESCE(is_approved, false)) AS approved,
            COUNT(*) FILTER (WHERE NOT COALESCE(is_approved, false)) AS pending
          FROM assessments
          WHERE recruiter_id = $1
        `,
        [userId],
      ),
      pool.query(
        `
          SELECT
            c.id,
            c.name,
            c.email,
            c.current_stage AS "currentStage",
            COALESCE(app_metrics.today_apps, 0) AS "todayApplications",
            COALESCE(app_metrics.total_apps, 0) AS "totalApplications",
            c.updated_at
          FROM candidates c
          LEFT JOIN (
            SELECT
              candidate_id,
              SUM(applications_count) AS total_apps,
              SUM(CASE WHEN application_date = CURRENT_DATE THEN applications_count ELSE 0 END) AS today_apps
            FROM applications
            GROUP BY candidate_id
          ) AS app_metrics ON app_metrics.candidate_id = c.id
          WHERE c.assigned_recruiter_id = $1
          ORDER BY c.updated_at DESC
          LIMIT $2 OFFSET $3
        `,
        [userId, assignedCandidatesLimit + 1, assignedCandidatesOffset],
      ),
      pool.query(
        `
          SELECT
            a.id,
            a.company_name AS "companyName",
            a.job_title AS "jobTitle",
            a.status,
            a.application_date AS "applicationDate",
            a.applications_count AS "applicationsCount",
            COALESCE(a.is_approved, false) AS "isApproved",
            c.id AS "candidateId",
            c.name AS "candidateName"
          FROM applications a
          JOIN candidates c ON c.id = a.candidate_id
          WHERE a.recruiter_id = $1
          ORDER BY a.application_date DESC, a.created_at DESC
          LIMIT $2 OFFSET $3
        `,
        [userId, recentApplicationsLimit + 1, recentApplicationsOffset],
      ),
      pool.query(
        `
          SELECT
            i.id,
            i.company_name AS "companyName",
            i.interview_type AS "interviewType",
            i.scheduled_date AS "scheduledDate",
            i.status,
            COALESCE(i.is_approved, false) AS "isApproved",
            c.id AS "candidateId",
            c.name AS "candidateName"
          FROM interviews i
          JOIN candidates c ON c.id = i.candidate_id
          WHERE i.recruiter_id = $1
          ORDER BY i.scheduled_date ASC
          LIMIT $2 OFFSET $3
        `,
        [userId, upcomingInterviewsLimit + 1, upcomingInterviewsOffset],
      ),
      pool.query(
        `
          SELECT
            s.id,
            s.assessment_platform AS "assessmentPlatform",
            s.assessment_type AS "assessmentType",
            s.due_date AS "dueDate",
            s.status,
            COALESCE(s.is_approved, false) AS "isApproved",
            c.id AS "candidateId",
            c.name AS "candidateName"
          FROM assessments s
          JOIN candidates c ON c.id = s.candidate_id
          WHERE s.recruiter_id = $1
          ORDER BY
            CASE WHEN s.status IN ('assigned', 'submitted') THEN 0 ELSE 1 END,
            s.due_date ASC
          LIMIT $2 OFFSET $3
        `,
        [userId, pendingAssessmentsLimit + 1, pendingAssessmentsOffset],
      ),
      pool.query(
        `
          SELECT
            n.id,
            n.content,
            n.created_at AS "createdAt",
            c.id AS "candidateId",
            c.name AS "candidateName"
          FROM notes n
          LEFT JOIN candidates c ON c.id = n.candidate_id
          WHERE n.author_id = $1
          ORDER BY n.created_at DESC
          LIMIT $2 OFFSET $3
        `,
        [userId, recentNotesLimit + 1, recentNotesOffset],
      ),
      pool.query(
        `
          SELECT
            r.id,
            r.title,
            r.due_date AS "dueDate",
            r.status,
            r.priority,
            c.id AS "candidateId",
            c.name AS "candidateName"
          FROM reminders r
          LEFT JOIN notes n ON n.id = r.note_id
          LEFT JOIN candidates c ON c.id = n.candidate_id
          WHERE r.user_id = $1
          AND r.due_date >= CURRENT_DATE
          ORDER BY r.due_date ASC
          LIMIT $2 OFFSET $3
        `,
        [userId, upcomingRemindersLimit + 1, upcomingRemindersOffset],
      ),
      pool.query(
        `
          SELECT
            id,
            title,
            message,
            priority,
            status,
            created_at AS "createdAt"
          FROM alerts
          WHERE user_id = $1
          ORDER BY created_at DESC
          LIMIT $2 OFFSET $3
        `,
        [userId, openAlertsLimit + 1, openAlertsOffset],
      ),
    ]);

    const applicationMetrics = applicationMetricsResult.rows[0] || {};
    const applicationTodayMetrics = applicationTodayMetricsResult.rows[0] || {};
    const interviewMetrics = interviewMetricsResult.rows[0] || {};
    const assessmentMetrics = assessmentMetricsResult.rows[0] || {};

    const makeWindow = (rows, limit) => {
      const hasMore = rows.length > limit;
      const items = hasMore ? rows.slice(0, limit) : rows;
      return { items, hasMore };
    };

    const assignedCandidatesWindow = makeWindow(assignedCandidatesResult.rows, assignedCandidatesLimit);
    const recentApplicationsWindow = makeWindow(recentApplicationsResult.rows, recentApplicationsLimit);
    const upcomingInterviewsWindow = makeWindow(upcomingInterviewsResult.rows, upcomingInterviewsLimit);
    const pendingAssessmentsWindow = makeWindow(pendingAssessmentsResult.rows, pendingAssessmentsLimit);
    const recentNotesWindow = makeWindow(recentNotesResult.rows, recentNotesLimit);
    const upcomingRemindersWindow = makeWindow(upcomingRemindersResult.rows, upcomingRemindersLimit);
    const openAlertsWindow = makeWindow(openAlertsResult.rows, openAlertsLimit);

    res.json({
      user: userResult.rows[0],
      metrics: {
        applications: {
          total: Number(applicationMetrics.total || 0),
          approved: Number(applicationMetrics.approved || 0),
          pending: Number(applicationMetrics.pending || 0),
        },
        applicationsToday: {
          total: Number(applicationTodayMetrics.total || 0),
          approved: Number(applicationTodayMetrics.approved || 0),
          pending: Number(applicationTodayMetrics.pending || 0),
        },
        interviews: {
          total: Number(interviewMetrics.total || 0),
          approved: Number(interviewMetrics.approved || 0),
          pending: Number(interviewMetrics.pending || 0),
        },
        assessments: {
          total: Number(assessmentMetrics.total || 0),
          approved: Number(assessmentMetrics.approved || 0),
          pending: Number(assessmentMetrics.pending || 0),
        },
      },
      assignedCandidates: {
        items: assignedCandidatesWindow.items.map((row) => ({
          id: row.id,
          name: row.name,
          email: row.email,
          currentStage: row.currentStage,
          todayApplications: Number(row.todayApplications || 0),
          totalApplications: Number(row.totalApplications || 0),
          updatedAt: row.updated_at,
        })),
        hasMore: assignedCandidatesWindow.hasMore,
        limit: assignedCandidatesLimit,
        offset: assignedCandidatesOffset,
        nextOffset: assignedCandidatesOffset + assignedCandidatesLimit,
      },
      recentApplications: {
        items: recentApplicationsWindow.items.map((row) => ({
          id: row.id,
          companyName: row.companyName,
          jobTitle: row.jobTitle,
          status: row.status,
          applicationDate: row.applicationDate,
          applicationsCount: Number(row.applicationsCount || 0),
          isApproved: row.isApproved,
          candidateId: row.candidateId,
          candidateName: row.candidateName,
        })),
        hasMore: recentApplicationsWindow.hasMore,
        limit: recentApplicationsLimit,
        offset: recentApplicationsOffset,
        nextOffset: recentApplicationsOffset + recentApplicationsLimit,
      },
      upcomingInterviews: {
        items: upcomingInterviewsWindow.items.map((row) => ({
          id: row.id,
          companyName: row.companyName,
          interviewType: row.interviewType,
          scheduledDate: row.scheduledDate,
          status: row.status,
          isApproved: row.isApproved,
          candidateId: row.candidateId,
          candidateName: row.candidateName,
        })),
        hasMore: upcomingInterviewsWindow.hasMore,
        limit: upcomingInterviewsLimit,
        offset: upcomingInterviewsOffset,
        nextOffset: upcomingInterviewsOffset + upcomingInterviewsLimit,
      },
      pendingAssessments: {
        items: pendingAssessmentsWindow.items.map((row) => ({
          id: row.id,
          assessmentPlatform: row.assessmentPlatform,
          assessmentType: row.assessmentType,
          dueDate: row.dueDate,
          status: row.status,
          isApproved: row.isApproved,
          candidateId: row.candidateId,
          candidateName: row.candidateName,
        })),
        hasMore: pendingAssessmentsWindow.hasMore,
        limit: pendingAssessmentsLimit,
        offset: pendingAssessmentsOffset,
        nextOffset: pendingAssessmentsOffset + pendingAssessmentsLimit,
      },
      recentNotes: {
        items: recentNotesWindow.items.map((row) => ({
          id: row.id,
          content: row.content,
          createdAt: row.createdAt,
          candidateId: row.candidateId,
          candidateName: row.candidateName,
        })),
        hasMore: recentNotesWindow.hasMore,
        limit: recentNotesLimit,
        offset: recentNotesOffset,
        nextOffset: recentNotesOffset + recentNotesLimit,
      },
      upcomingReminders: {
        items: upcomingRemindersWindow.items.map((row) => ({
          id: row.id,
          title: row.title,
          dueDate: row.dueDate,
          status: row.status,
          priority: row.priority,
          candidateId: row.candidateId,
          candidateName: row.candidateName,
        })),
        hasMore: upcomingRemindersWindow.hasMore,
        limit: upcomingRemindersLimit,
        offset: upcomingRemindersOffset,
        nextOffset: upcomingRemindersOffset + upcomingRemindersLimit,
      },
      openAlerts: {
        items: openAlertsWindow.items.map((row) => ({
          id: row.id,
          title: row.title,
          message: row.message,
          priority: row.priority,
          status: row.status,
          createdAt: row.createdAt,
        })),
        hasMore: openAlertsWindow.hasMore,
        limit: openAlertsLimit,
        offset: openAlertsOffset,
        nextOffset: openAlertsOffset + openAlertsLimit,
      },
    });
  } catch (error) {
    console.error('Error fetching user profile:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

const mapAttendanceRow = (row) => ({
  id: row.id,
  userId: row.user_id,
  userName: row.user_name,
  date: toDateIso(row.attendance_date),
  reportedStatus: row.reported_status,
  approvalStatus: row.approval_status,
  approvedBy: row.approved_by,
  approvedByName: row.approved_by_name || null,
  approvedAt: row.approved_at,
  reviewerNote: row.reviewer_note,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
});

const fetchAttendanceById = async (attendanceId) => {
  const { rows } = await pool.query(
    `
      SELECT
        ae.id,
        ae.user_id,
        ae.attendance_date,
        ae.reported_status,
        ae.approval_status,
        ae.approved_by,
        ae.approved_at,
        ae.reviewer_note,
        ae.created_at,
        ae.updated_at,
        u.name AS user_name,
        approver.name AS approved_by_name
      FROM attendance_entries ae
      JOIN users u ON u.id = ae.user_id
      LEFT JOIN users approver ON approver.id = ae.approved_by
      WHERE ae.id = $1
    `,
    [attendanceId],
  );
  return rows[0] ? mapAttendanceRow(rows[0]) : null;
};

const attendanceStatusFromRow = (row) => {
  if (!row) {
    return 'unmarked';
  }
  if (row.approval_status === 'approved') {
    if (row.reported_status === 'present') {
      return 'present';
    }
    if (row.reported_status === 'half-day') {
      return 'half-day';
    }
    return 'absent';
  }
  if (row.approval_status === 'pending') {
    return 'pending';
  }
  if (row.approval_status === 'rejected') {
    return 'rejected';
  }
  return 'unmarked';
};

app.get('/api/v1/attendance', verifyToken, async (req, res) => {
  try {
    const today = parseDateOnly(new Date());
    let dateFrom = parseDateOnly(req.query?.date_from) || new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), 1));
    let dateTo = parseDateOnly(req.query?.date_to) || today;
    if (!dateFrom || !dateTo) {
      return res.status(400).json({ message: 'Invalid date range provided.' });
    }
    if (dateFrom > dateTo) {
      const tmp = dateFrom;
      dateFrom = dateTo;
      dateTo = tmp;
    }
    const rangeDays = Math.round((dateTo - dateFrom) / ONE_DAY_MS) + 1;
    if (rangeDays > 120) {
      return res.status(400).json({ message: 'Limit attendance queries to 120 days or fewer.' });
    }

    const rawUserId = req.query?.user_id;
    const normalizedUserId = rawUserId === 'self' ? req.user.userId : rawUserId;
    const allowedStatuses = ['present', 'half-day', 'absent', 'leave'];

    let users = [];
    if (req.user.role === 'Admin') {
      if (normalizedUserId) {
        const parsedId = Number(normalizedUserId);
        if (!Number.isInteger(parsedId)) {
          return res.status(400).json({ message: 'Invalid user_id parameter.' });
        }
        const { rows } = await pool.query(
          `SELECT id, name, role FROM users WHERE id = $1`,
          [parsedId],
        );
        if (rows.length === 0) {
          return res.status(404).json({ message: 'User not found.' });
        }
        if (rows[0].role !== 'Recruiter') {
          return res.status(400).json({ message: 'Attendance tracking is enabled for recruiters only.' });
        }
        users = rows.map(({ id, name }) => ({ id, name }));
      } else {
        const { rows } = await pool.query(
          `SELECT id, name FROM users WHERE role = 'Recruiter' ORDER BY name ASC`,
        );
        users = rows;
      }
    } else {
      if (normalizedUserId && Number(normalizedUserId) !== req.user.userId) {
        return res.status(403).json({ message: 'You can only view your own attendance.' });
      }
      const { rows } = await pool.query(
        `SELECT id, name, role FROM users WHERE id = $1`,
        [req.user.userId],
      );
      if (rows.length === 0) {
        return res.status(404).json({ message: 'User not found.' });
      }
      if (rows[0].role !== 'Recruiter') {
        return res.status(403).json({ message: 'Attendance tracking is limited to recruiter accounts.' });
      }
      users = rows.map(({ id, name }) => ({ id, name }));
    }

    if (users.length === 0) {
      return res.json({
        range: {
          dateFrom: toDateIso(dateFrom),
          dateTo: toDateIso(dateTo),
          days: rangeDays,
        },
        users: [],
        days: [],
        records: [],
        summary: { present: 0, halfDay: 0, absent: 0, pending: 0, autoPresent: 0, sandwichAbsent: 0 },
      });
    }

    const userIds = users.map((user) => user.id);
    const { rows: attendanceRowsRaw } = await pool.query(
      `
        SELECT
          ae.id,
          ae.user_id,
          ae.attendance_date,
          ae.reported_status,
          ae.approval_status,
          ae.approved_by,
          ae.approved_at,
          ae.reviewer_note,
          ae.created_at,
          ae.updated_at,
          u.name AS user_name,
          approver.name AS approved_by_name
        FROM attendance_entries ae
        JOIN users u ON u.id = ae.user_id
        LEFT JOIN users approver ON approver.id = ae.approved_by
        WHERE ae.attendance_date BETWEEN $1 AND $2
          AND ae.user_id = ANY($3)
        ORDER BY ae.attendance_date ASC, u.name ASC
      `,
      [toDateIso(dateFrom), toDateIso(dateTo), userIds],
    );

    const attendanceRows = attendanceRowsRaw.map((row) => ({
      ...row,
      attendance_date: parseDateOnly(row.attendance_date),
      isoDate: toDateIso(row.attendance_date),
    }));

    const attendanceMap = new Map();
    attendanceRows.forEach((row) => {
      const key = `${row.user_id}-${row.isoDate}`;
      attendanceMap.set(key, row);
    });

    const days = [];
    const daysByUser = new Map();
    for (const user of users) {
      const userDays = [];
      for (
        let cursor = new Date(dateFrom);
        cursor <= dateTo;
        cursor = addDays(cursor, 1)
      ) {
        const iso = toDateIso(cursor);
        const key = `${user.id}-${iso}`;
        const row = attendanceMap.get(key);
        const dayOfWeek = cursor.getUTCDay();
        const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
        const source = row ? 'record' : isWeekend ? 'auto-weekend' : 'none';
        const initialStatus = attendanceStatusFromRow(row);
        const effectiveStatus = source === 'auto-weekend' ? 'present' : initialStatus;
        const approvalStatus =
          row?.approval_status ??
          (source === 'auto-weekend' ? 'auto' : null);

        const dayRecord = {
          userId: user.id,
          userName: user.name,
          date: iso,
          weekday: WEEKDAY_LABELS[dayOfWeek],
          isWeekend,
          recordId: row?.id ?? null,
          reportedStatus: row?.reported_status ?? (isWeekend ? 'present' : null),
          approvalStatus,
          approvedBy: row?.approved_by ?? null,
          approvedByName: row?.approved_by_name ?? null,
          approvedAt: row?.approved_at ?? null,
          reviewerNote: row?.reviewer_note ?? null,
          effectiveStatus,
          source,
          sandwichApplied: false,
        };

        days.push(dayRecord);
        userDays.push(dayRecord);
      }
      daysByUser.set(user.id, userDays);
    }

    for (const user of users) {
      const userDays = daysByUser.get(user.id) || [];
      const dayMap = new Map(userDays.map((entry) => [entry.date, entry]));
      for (
        let cursor = new Date(dateFrom);
        cursor <= dateTo;
        cursor = addDays(cursor, 1)
      ) {
        if (cursor.getUTCDay() !== 6) {
          continue;
        }
        const fri = toDateIso(addDays(cursor, -1));
        const sat = toDateIso(cursor);
        const sun = toDateIso(addDays(cursor, 1));
        const mon = toDateIso(addDays(cursor, 2));
        const fridayEntry = dayMap.get(fri);
        const mondayEntry = dayMap.get(mon);

        if (
          fridayEntry &&
          mondayEntry &&
          fridayEntry.effectiveStatus === 'absent' &&
          mondayEntry.effectiveStatus === 'absent'
        ) {
          const saturdayEntry = dayMap.get(sat);
          if (saturdayEntry && saturdayEntry.source === 'auto-weekend') {
            saturdayEntry.effectiveStatus = 'absent';
            saturdayEntry.approvalStatus = 'sandwich';
            saturdayEntry.sandwichApplied = true;
          }
          const sundayEntry = dayMap.get(sun);
          if (sundayEntry && sundayEntry.source === 'auto-weekend') {
            sundayEntry.effectiveStatus = 'absent';
            sundayEntry.approvalStatus = 'sandwich';
            sundayEntry.sandwichApplied = true;
          }
        }
      }
    }

    const summary = days.reduce(
      (acc, day) => {
        if (day.effectiveStatus === 'present' && (day.approvalStatus === 'approved' || day.approvalStatus === 'auto')) {
          acc.present += 1;
          if (day.source === 'auto-weekend') {
            acc.autoPresent += 1;
          }
          return acc;
        }

        if (day.effectiveStatus === 'half-day' && day.approvalStatus === 'approved') {
          acc.halfDay += 1;
          return acc;
        }

        if (day.effectiveStatus === 'absent') {
          acc.absent += 1;
          if (day.sandwichApplied) {
            acc.sandwichAbsent += 1;
          }
          return acc;
        }

        if (day.effectiveStatus === 'pending' || day.effectiveStatus === 'unmarked' || day.effectiveStatus === 'rejected') {
          acc.pending += 1;
        }
        return acc;
      },
      { present: 0, halfDay: 0, absent: 0, pending: 0, autoPresent: 0, sandwichAbsent: 0 },
    );

    const pendingOnly = String(req.query?.pending_only || '').toLowerCase() === 'true';
    const allRecords = attendanceRows.map(mapAttendanceRow);
    const records = pendingOnly
      ? allRecords.filter((record) => record.approvalStatus === 'pending')
      : allRecords;

    res.json({
      range: {
        dateFrom: toDateIso(dateFrom),
        dateTo: toDateIso(dateTo),
        days: rangeDays,
      },
      users,
      days,
      records,
      summary,
      metadata: {
        statuses: allowedStatuses,
      },
    });
  } catch (error) {
    console.error('Error fetching attendance:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

app.post(
  '/api/v1/attendance',
  verifyToken,
  validateBody(schemas.attendanceCreate),
  async (req, res) => {
    try {
      const isAdmin = req.user.role === 'Admin';
      const targetUserId = isAdmin && req.body.user_id ? Number(req.body.user_id) : req.user.userId;
      if (!Number.isInteger(targetUserId)) {
        return res.status(400).json({ message: 'Invalid user id for attendance submission.' });
      }
      if (!isAdmin && req.body.user_id && Number(req.body.user_id) !== req.user.userId) {
        return res.status(403).json({ message: 'You can only submit attendance for yourself.' });
      }

      const { rows: userRows } = await pool.query(
        `SELECT id, name, role FROM users WHERE id = $1`,
        [targetUserId],
      );
      if (userRows.length === 0) {
        return res.status(404).json({ message: 'User not found.' });
      }
      if (userRows[0].role !== 'Recruiter') {
        return res.status(400).json({ message: 'Attendance submission is only available for recruiters.' });
      }

      const attendanceDate = parseDateOnly(req.body.attendance_date) || parseDateOnly(new Date());
      if (!attendanceDate) {
        return res.status(400).json({ message: 'Invalid attendance_date. Use YYYY-MM-DD format.' });
      }
      const attendanceDateIso = toDateIso(attendanceDate);

      const reportedStatus = req.body.status || 'present';
      const validStatuses = ['present', 'half-day', 'absent', 'leave'];
      if (!validStatuses.includes(reportedStatus)) {
        return res.status(400).json({ message: 'Unsupported attendance status.' });
      }

      let approvalStatus = 'pending';
      let approvedBy = null;
      let approvedAt = null;
      let reviewerNote = null;

      if (isAdmin) {
        approvalStatus = req.body.approval_status || 'approved';
        reviewerNote = req.body.reviewer_note ?? null;
        if (approvalStatus === 'approved') {
          approvedBy = req.user.userId;
          approvedAt = new Date();
        }
      }

      const result = await pool.query(
        `
          INSERT INTO attendance_entries (
            user_id,
            attendance_date,
            reported_status,
            approval_status,
            approved_by,
            approved_at,
            reviewer_note
          )
          VALUES ($1, $2, $3::attendance_status, $4::attendance_approval_status, $5, $6, $7)
          ON CONFLICT (user_id, attendance_date)
          DO UPDATE SET
            reported_status = EXCLUDED.reported_status,
            approval_status = EXCLUDED.approval_status,
            approved_by = CASE WHEN EXCLUDED.approval_status = 'approved' THEN EXCLUDED.approved_by ELSE NULL END,
            approved_at = CASE WHEN EXCLUDED.approval_status = 'approved' THEN EXCLUDED.approved_at ELSE NULL END,
            reviewer_note = EXCLUDED.reviewer_note,
            updated_at = CURRENT_TIMESTAMP
          RETURNING id
        `,
        [
          targetUserId,
          attendanceDateIso,
          reportedStatus,
          approvalStatus,
          approvedBy,
          approvedAt,
          reviewerNote,
        ],
      );

      const attendanceId = result.rows[0]?.id;
      if (!attendanceId) {
        return res.status(500).json({ message: 'Failed to record attendance.' });
      }

      const record = await fetchAttendanceById(attendanceId);
      res.status(201).json(record);
    } catch (error) {
      console.error('Error submitting attendance:', error);
      res.status(500).json({ message: 'Internal server error' });
    }
  },
);

app.put(
  '/api/v1/attendance/:id',
  verifyToken,
  requireRole('Admin'),
  validateBody(schemas.attendanceUpdate),
  async (req, res) => {
    try {
      const attendanceId = Number(req.params.id);
      if (!Number.isInteger(attendanceId)) {
        return res.status(400).json({ message: 'Invalid attendance id.' });
      }

      const { status, approval_status, reviewer_note } = req.body;
      const updates = [];
      const params = [];
      let idx = 1;

      if (status !== undefined) {
        updates.push(`reported_status = $${idx}::attendance_status`);
        params.push(status);
        idx += 1;
      }
      if (approval_status !== undefined) {
        updates.push(`approval_status = $${idx}::attendance_approval_status`);
        params.push(approval_status);
        idx += 1;
      }
      if (reviewer_note !== undefined) {
        updates.push(`reviewer_note = $${idx}`);
        params.push(reviewer_note);
        idx += 1;
      }

      if (updates.length === 0) {
        return res.status(400).json({ message: 'No attendance fields provided for update.' });
      }

      if (approval_status !== undefined) {
        if (approval_status === 'approved') {
          updates.push(`approved_by = $${idx}`);
          params.push(req.user.userId);
          idx += 1;
          updates.push(`approved_at = CURRENT_TIMESTAMP`);
        } else {
          updates.push(`approved_by = NULL`);
          updates.push(`approved_at = NULL`);
        }
      }

      updates.push(`updated_at = CURRENT_TIMESTAMP`);

      params.push(attendanceId);
      const updateSql = `
        UPDATE attendance_entries
        SET ${updates.join(', ')}
        WHERE id = $${idx}
        RETURNING id
      `;

      const { rows } = await pool.query(updateSql, params);
      if (rows.length === 0) {
        return res.status(404).json({ message: 'Attendance record not found.' });
      }

      const record = await fetchAttendanceById(attendanceId);
      res.json(record);
    } catch (error) {
      console.error('Error updating attendance:', error);
      res.status(500).json({ message: 'Internal server error' });
    }
  },
);

app.get('/api/v1/users', verifyToken, requireRole('Admin'), async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT id, name, email, role, daily_quota, is_active, created_at
      FROM users
      ORDER BY created_at DESC
    `);

    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching users:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

app.post('/api/v1/users', verifyToken, requireRole('Admin'), validateBody(schemas.userCreate), async (req, res) => {
  try {
    const { name, email, password, role, daily_quota } = req.body;
    const hashedPassword = await bcrypt.hash(password, 10);

    const result = await pool.query(`
      INSERT INTO users (name, email, password_hash, role, daily_quota)
      VALUES ($1, $2, $3, $4, $5)
      RETURNING id, name, email, role, daily_quota, is_active, created_at
    `, [name, email, hashedPassword, role, daily_quota || 60]);

    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('Error creating user:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

app.put(
  '/api/v1/users/:id',
  verifyToken,
  requireRole('Admin'),
  validateBody(schemas.userUpdate),
  async (req, res) => {
  try {
    const userId = parseInt(req.params.id, 10);
    if (Number.isNaN(userId)) {
      return res.status(400).json({ message: 'Invalid user id' });
    }

    const { name, email, role, daily_quota, is_active, password } = req.body;
    const updates = [];
    const params = [];
    let idx = 1;

    if (name !== undefined) {
      updates.push(`name = $${idx++}`);
      params.push(name);
    }
    if (email !== undefined) {
      updates.push(`email = $${idx++}`);
      params.push(email);
    }
    if (role !== undefined) {
      updates.push(`role = $${idx++}`);
      params.push(role);
    }
    if (daily_quota !== undefined) {
      updates.push(`daily_quota = $${idx++}`);
      params.push(daily_quota);
    }
    if (is_active !== undefined) {
      updates.push(`is_active = $${idx++}`);
      params.push(is_active);
    }
    if (password) {
      const hashedPassword = await bcrypt.hash(password, 10);
      updates.push(`password_hash = $${idx++}`);
      params.push(hashedPassword);
    }

    if (updates.length === 0) {
      return res.status(400).json({ message: 'No changes submitted.' });
    }

    updates.push('updated_at = CURRENT_TIMESTAMP');
    params.push(userId);

    const result = await pool.query(
      `
        UPDATE users
        SET ${updates.join(', ')}
        WHERE id = $${idx}
        RETURNING id, name, email, role, daily_quota, is_active, last_login_at, last_active_at, created_at, updated_at
      `,
      params
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'User not found.' });
    }

    res.json(result.rows[0]);
  } catch (error) {
    if (error.code === '23505') {
      return res.status(400).json({ message: 'Email already in use.' });
    }
    console.error('Error updating user:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

app.delete('/api/v1/users/:id', verifyToken, requireRole('Admin'), async (req, res) => {
  try {
    const userId = parseInt(req.params.id, 10);
    if (Number.isNaN(userId)) {
      return res.status(400).json({ message: 'Invalid user id' });
    }

    if (userId === req.user.userId) {
      return res.status(400).json({ message: 'You cannot delete your own account.' });
    }

    await pool.query(`UPDATE candidates SET assigned_recruiter_id = NULL WHERE assigned_recruiter_id = $1`, [userId]);
    await pool.query(`UPDATE applications SET recruiter_id = NULL WHERE recruiter_id = $1`, [userId]);
    await pool.query(`UPDATE interviews SET recruiter_id = NULL WHERE recruiter_id = $1`, [userId]);
    await pool.query(`UPDATE assessments SET recruiter_id = NULL WHERE recruiter_id = $1`, [userId]);
    await pool.query(`UPDATE notes SET author_id = NULL WHERE author_id = $1`, [userId]);
    await pool.query(`UPDATE reminders SET user_id = NULL WHERE user_id = $1`, [userId]);
    await pool.query(`UPDATE alerts SET user_id = NULL WHERE user_id = $1`, [userId]);

    const result = await pool.query(`DELETE FROM users WHERE id = $1 RETURNING id`, [userId]);

    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'User not found.' });
    }

    res.status(204).send();
  } catch (error) {
    console.error('Error deleting user:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// Automation and Alert Functions
async function checkDailyQuotas() {
  try {
    const result = await pool.query(`
      SELECT u.id, u.name, u.daily_quota, COALESCE(da.applications_count, 0) as today_apps
      FROM users u
      LEFT JOIN daily_activity da ON u.id = da.user_id AND da.activity_date = CURRENT_DATE
      WHERE u.role = 'Recruiter' AND u.is_active = true
    `);

    for (const recruiter of result.rows) {
      if (recruiter.today_apps < recruiter.daily_quota) {
        // Check if alert already exists for today
        const existingAlert = await pool.query(`
          SELECT id FROM alerts 
          WHERE user_id = $1 AND alert_type = 'quota_breach' 
          AND DATE(created_at) = CURRENT_DATE
        `, [recruiter.id]);

        if (existingAlert.rows.length === 0) {
          await pool.query(`
            INSERT INTO alerts (user_id, alert_type, title, message, priority)
            VALUES ($1, 'quota_breach', 'Daily Quota Not Met', 
                   $2, 2)
          `, [recruiter.id, `You have only ${recruiter.today_apps} applications today. Target: ${recruiter.daily_quota}`]);
        }
      }
    }
  } catch (error) {
    console.error('Error checking daily quotas:', error);
  }
}

async function checkAssessmentDeadlines() {
  try {
    const result = await pool.query(`
      SELECT a.id, a.candidate_id, a.due_date, c.name as candidate_name, u.name as recruiter_name
      FROM assessments a
      JOIN candidates c ON a.candidate_id = c.id
      JOIN users u ON a.recruiter_id = u.id
      WHERE a.status = 'assigned' 
      AND a.due_date <= CURRENT_DATE + INTERVAL '1 day'
      AND a.due_date > CURRENT_DATE
    `);

    for (const assessment of result.rows) {
      // Check if alert already exists
      const existingAlert = await pool.query(`
        SELECT id FROM alerts 
        WHERE user_id = (SELECT recruiter_id FROM assessments WHERE id = $1) 
        AND alert_type = 'assessment_due' 
        AND message LIKE $2
      `, [assessment.id, `%${assessment.candidate_name}%`]);

      if (existingAlert.rows.length === 0) {
        await pool.query(`
          INSERT INTO alerts (user_id, alert_type, title, message, priority)
          VALUES ((SELECT recruiter_id FROM assessments WHERE id = $1), 'assessment_due', 
                 'Assessment Due Soon', 
                 $2, 1)
        `, [assessment.id, `Assessment for ${assessment.candidate_name} is due on ${assessment.due_date}`]);
      }
    }
  } catch (error) {
    console.error('Error checking assessment deadlines:', error);
  }
}

async function checkInterviewReminders() {
  try {
    const result = await pool.query(`
      SELECT i.id, i.candidate_id, i.scheduled_date, c.name as candidate_name, u.name as recruiter_name
      FROM interviews i
      JOIN candidates c ON i.candidate_id = c.id
      JOIN users u ON i.recruiter_id = u.id
      WHERE i.status = 'scheduled'
      AND DATE(i.scheduled_date) = CURRENT_DATE
    `);

    for (const interview of result.rows) {
      // Check if reminder already exists
      const existingReminder = await pool.query(`
        SELECT id FROM reminders 
        WHERE user_id = (SELECT recruiter_id FROM interviews WHERE id = $1) 
        AND title LIKE $2
        AND DATE(created_at) = CURRENT_DATE
      `, [interview.id, `%${interview.candidate_name}%`]);

      if (existingReminder.rows.length === 0) {
        await pool.query(`
          INSERT INTO reminders (user_id, title, description, due_date, priority)
          VALUES ((SELECT recruiter_id FROM interviews WHERE id = $1), 
                 'Interview Today', 
                 $2, 
                 $3, 1)
        `, [interview.id, `Interview with ${interview.candidate_name} is scheduled for today`, interview.scheduled_date]);
      }
    }
  } catch (error) {
    console.error('Error checking interview reminders:', error);
  }
}

function stopAutomationTasks() {
  automationIntervals.forEach((intervalId) => clearInterval(intervalId));
  automationIntervals = [];
}

const minutesToMs = (minutes) => Math.max(minutes, 0) * 60 * 1000;

// Schedule automation tasks
function scheduleAutomationTasks() {
  stopAutomationTasks();

  const entries = [
    { handler: checkDailyQuotas, minutes: automationSchedule.quotaMinutes },
    { handler: checkAssessmentDeadlines, minutes: automationSchedule.assessmentMinutes },
    { handler: checkInterviewReminders, minutes: automationSchedule.interviewMinutes },
  ];

  automationIntervals = entries
    .filter(({ minutes }) => minutes > 0)
    .map(({ handler, minutes }) => setInterval(handler, minutesToMs(minutes)));

  if (automationIntervals.length > 0) {
    console.log('Automation tasks scheduled');
  } else {
    console.log('Automation scheduling disabled via configuration.');
  }
}

async function initAuditStream() {
  if (auditStreamClient) {
    return;
  }
  try {
    auditStreamClient = await startAuditStream({
      connection: dbConfig,
      logPath: auditLogPath,
      webhookUrl: auditWebhookUrl,
      cloudWatch: hasAuditCloudWatch ? auditCloudWatchConfig : null,
    });
  } catch (error) {
    console.error('Failed to initialise audit stream:', error.message);
  }
}

async function initializeInfrastructure({ skipDb } = {}) {
  console.log('--- DEBUG: Executing initializeInfrastructure ---');
  if (skipDb) {
    console.log('Skipping database initialization as requested.');
    return;
  }
  try {
    const client = await pool.connect();
    client.release();
    console.log('Connected to PostgreSQL!');
    await setupDatabase();
    await initAuditStream();
    scheduleAutomationTasks();
    await checkDailyQuotas();
    await checkAssessmentDeadlines();
    await checkInterviewReminders();
  } catch (err) {
    console.error('Database connection failed:', err.message);
    console.log('Starting server without database connection for testing...');
  }
}

function logAvailableEndpoints(resolvedPort) {
  console.log(`Server running on http://localhost:${resolvedPort}`);
  console.log('API endpoints available:');
  console.log('  Authentication:');
  console.log('    POST /api/v1/auth/login - User login');
  console.log('  Candidates:');
  console.log('    GET  /api/v1/candidates - Get candidates (requires auth)');
  console.log('    POST /api/v1/candidates - Create candidate (requires auth)');
  console.log('    PUT  /api/v1/candidates/:id - Update candidate (requires auth)');
  console.log('    GET  /api/v1/candidates/:id/notes - Candidate notes (requires auth)');
  console.log('    POST /api/v1/candidates/:id/notes - Create note (requires auth)');
  console.log('    GET  /api/v1/candidates/:id/assignments - Assignment history (requires auth)');
  console.log('    PUT  /api/v1/candidates/:id/notes/:noteId - Update note (author or admin)');
  console.log('    DELETE /api/v1/candidates/:id/notes/:noteId - Delete note (author or admin)');
  console.log('  Applications:');
  console.log('    GET  /api/v1/applications - Get applications (requires auth)');
  console.log('    POST /api/v1/applications - Create application (requires auth)');
  console.log('  Interviews:');
  console.log('    GET  /api/v1/interviews - Get interviews (requires auth)');
  console.log('    POST /api/v1/interviews - Create interview (requires auth)');
  console.log('  Assessments:');
  console.log('    GET  /api/v1/assessments - Get assessments (requires auth)');
  console.log('    POST /api/v1/assessments - Create assessment (requires auth)');
  console.log('  Reports:');
  console.log('    GET  /api/v1/reports/performance - Get performance reports (requires auth)');
  console.log('    GET  /api/v1/reports/overview - Admin overview metrics (requires admin)');
  console.log('    GET  /api/v1/reports/activity - Recent notes & reminders (requires admin)');
  console.log('    GET  /api/v1/reports/application-activity - Recruiter & candidate application totals (requires admin)');
  console.log('    GET  /api/v1/reports/leaderboard - Recruiter leaderboard (requires auth)');
  console.log('  Notifications:');
  console.log('    GET  /api/v1/notifications - Combined reminders & alerts (requires auth)');
  console.log('  Alerts:');
  console.log('    GET  /api/v1/alerts - Get alerts (requires auth)');
  console.log('  Users (Admin only):');
  console.log('    GET  /api/v1/users/activity - User activity (requires admin)');
  console.log('    GET  /api/v1/users - Get users (requires admin)');
  console.log('    POST /api/v1/users - Create user (requires admin)');
  console.log('    PUT  /api/v1/users/:id - Update user (requires admin)');
  console.log('    DELETE /api/v1/users/:id - Delete user (requires admin)');
}

async function startServer(options = {}) {
  if (serverInstance) {
    return serverInstance;
  }

  const { skipDb = defaultSkipDbSetup, port: customPort } = options;
  const listenPort = customPort ?? port;
  await initializeInfrastructure({ skipDb });

  return new Promise((resolve, reject) => {
    serverInstance = app
      .listen(listenPort, () => {
        const address = serverInstance.address();
        const resolvedPort = typeof address === 'object' && address ? address.port : listenPort;
        logAvailableEndpoints(resolvedPort);
        resolve(serverInstance);
      })
      .on('error', (error) => {
        serverInstance = null;
        reject(error);
      });
  });
}

async function stopServer() {
  stopAutomationTasks();

  if (auditStreamClient) {
    try {
      await auditStreamClient.end();
    } catch (error) {
      console.error('Error closing audit stream:', error.message);
    } finally {
      auditStreamClient = null;
    }
  }

  if (!serverInstance) {
    return;
  }

  await new Promise((resolve, reject) => {
    serverInstance.close((err) => {
      if (err) {
        reject(err);
      } else {
        resolve();
      }
    });
  });
  serverInstance = null;
}

const shutdown = async () => {
  console.log('Shutting down TeamBuilderz backend...');
  try {
    await stopServer();
  } finally {
    process.exit(0);
  }
};

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

if (require.main === module) {
  startServer().catch((error) => {
    console.error('Failed to start server:', error);
    process.exit(1);
  });
}

module.exports = {
  app,
  startServer,
  stopServer,
};
