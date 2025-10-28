require('dotenv').config();
const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const { Pool } = require('pg');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');

const app = express();
const port = process.env.BACKEND_PORT || 3001;
const SECRET_KEY = process.env.JWT_SECRET;
if (!SECRET_KEY) {
  console.error('JWT_SECRET environment variable is required');
  process.exit(1);
}

// Database Connection Setup
const pool = new Pool({
  user: process.env.DB_USER,
  host: process.env.DB_HOST || 'localhost',
  database: process.env.DB_NAME,
  password: process.env.DB_PASSWORD,
  port: process.env.DB_PORT || 5432,
});

// Middleware
app.use(cors());
app.use(bodyParser.json());

// Routes
app.get('/', (req, res) => {
  res.send('TeamBuilderz Backend API is running!');
});

// Database Schema Setup
async function setupDatabase() {
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

      // Create ENUMs first
      await pool.query(`
        CREATE TYPE user_role AS ENUM ('Admin', 'Recruiter', 'Viewer');
        CREATE TYPE candidate_stage AS ENUM ('onboarding', 'marketing', 'interviewing', 'offered', 'placed', 'inactive');
        CREATE TYPE application_status AS ENUM ('sent', 'viewed', 'shortlisted', 'interviewing', 'offered', 'hired', 'rejected');
        CREATE TYPE interview_status AS ENUM ('scheduled', 'completed', 'feedback_pending', 'rejected', 'advanced');
        CREATE TYPE assessment_status AS ENUM ('assigned', 'submitted', 'passed', 'failed', 'waived');
        CREATE TYPE reminder_status AS ENUM ('pending', 'sent', 'snoozed', 'dismissed');
        CREATE TYPE alert_status AS ENUM ('open', 'acknowledged', 'resolved');
        CREATE TYPE interview_type AS ENUM ('phone', 'video', 'in_person', 'technical', 'hr', 'final');
      `);

      // Users table with enhanced fields
      await pool.query(`
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
      `);

      // Candidates table
      await pool.query(`
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
      `);

      // Documents table for resumes and other files
      await pool.query(`
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
      `);

      // Applications table
      await pool.query(`
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
      `);

      // Interviews table
      await pool.query(`
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
      `);

      // Assessments table
      await pool.query(`
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
      `);

      // Notes table
      await pool.query(`
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
      `);

      // Reminders table
      await pool.query(`
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
      `);

      await pool.query(`
        ALTER TABLE reminders
        ADD COLUMN IF NOT EXISTS note_id INTEGER REFERENCES notes(id) ON DELETE SET NULL
      `);

      // Alerts table
      await pool.query(`
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
      `);

      // Daily activity tracking
      await pool.query(`
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
      `);

      // Audit logs
      await pool.query(`
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
      `);

      // Export logs
      await pool.query(`
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
      `);

      // Create indexes for performance
      await pool.query(`
        CREATE INDEX idx_candidates_recruiter ON candidates(assigned_recruiter_id);
        CREATE INDEX idx_candidates_stage ON candidates(current_stage);
        CREATE INDEX idx_applications_candidate ON applications(candidate_id);
        CREATE INDEX idx_applications_recruiter ON applications(recruiter_id);
        CREATE INDEX idx_applications_status ON applications(status);
        CREATE INDEX idx_interviews_candidate ON interviews(candidate_id);
        CREATE INDEX idx_interviews_date ON interviews(scheduled_date);
        CREATE INDEX idx_assessments_due ON assessments(due_date);
        CREATE INDEX idx_reminders_due ON reminders(due_date);
        CREATE INDEX idx_alerts_user ON alerts(user_id);
        CREATE INDEX idx_audit_logs_user ON audit_logs(user_id);
        CREATE INDEX idx_audit_logs_table ON audit_logs(table_name);
      `);

      // Candidate assignment history
      await pool.query(`
        CREATE TABLE IF NOT EXISTS candidate_assignments (
          id SERIAL PRIMARY KEY,
          candidate_id INTEGER REFERENCES candidates(id) ON DELETE CASCADE,
          recruiter_id INTEGER REFERENCES users(id),
          assigned_by INTEGER REFERENCES users(id),
          assigned_at TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP,
          unassigned_at TIMESTAMP WITHOUT TIME ZONE,
          note TEXT
        );
      `);

      await pool.query(`
        CREATE INDEX IF NOT EXISTS idx_candidate_assignments_candidate ON candidate_assignments(candidate_id);
      `);

      // Insert default users
      const adminPassword = process.env.ADMIN_PASSWORD || 'admin123';
      const recruiterPassword = process.env.RECRUITER_PASSWORD || 'recruit123';
      const hashedAdminPassword = await bcrypt.hash(adminPassword, 10);
      const hashedRecruiterPassword = await bcrypt.hash(recruiterPassword, 10);

      await pool.query(`
        INSERT INTO users (name, email, password_hash, role, daily_quota)
        VALUES ('Kunal Gupta', 'admin@tbz.us', $1, 'Admin', 0),
               ('Sarthi Patel', 'sarthi@tbz.us', $2, 'Recruiter', 60);
      `, [hashedAdminPassword, hashedRecruiterPassword]);

      console.log('Comprehensive database schema created successfully!');
      console.log('Default Admin and Recruiter users created.');
    } else {
      console.log('Database tables detected. Ensuring schema completeness...');
    }

    // Ensure new columns exist for evolved schema
    await pool.query(`
      ALTER TABLE applications
      ADD COLUMN IF NOT EXISTS applications_count INTEGER DEFAULT 1,
      ADD COLUMN IF NOT EXISTS is_approved BOOLEAN DEFAULT false,
      ADD COLUMN IF NOT EXISTS approved_by INTEGER REFERENCES users(id),
      ADD COLUMN IF NOT EXISTS approved_at TIMESTAMP WITHOUT TIME ZONE
    `);

    await pool.query(`
      UPDATE applications
      SET applications_count = COALESCE(applications_count, 1),
          is_approved = COALESCE(is_approved, false)
    `);

    await pool.query(`
      ALTER TABLE interviews
      ADD COLUMN IF NOT EXISTS is_approved BOOLEAN DEFAULT false,
      ADD COLUMN IF NOT EXISTS approved_by INTEGER REFERENCES users(id),
      ADD COLUMN IF NOT EXISTS approved_at TIMESTAMP WITHOUT TIME ZONE
    `);

    await pool.query(`
      UPDATE interviews
      SET is_approved = COALESCE(is_approved, false)
    `);

    await pool.query(`
      ALTER TABLE assessments
      ADD COLUMN IF NOT EXISTS is_approved BOOLEAN DEFAULT false,
      ADD COLUMN IF NOT EXISTS approved_by INTEGER REFERENCES users(id),
      ADD COLUMN IF NOT EXISTS approved_at TIMESTAMP WITHOUT TIME ZONE
    `);

    await pool.query(`
      UPDATE assessments
      SET is_approved = COALESCE(is_approved, false)
    `);

    await pool.query(`
      ALTER TABLE reminders
      ADD COLUMN IF NOT EXISTS note_id INTEGER REFERENCES notes(id) ON DELETE SET NULL
    `);

    await pool.query(`
      ALTER TABLE users
      ADD COLUMN IF NOT EXISTS last_login_at TIMESTAMP WITHOUT TIME ZONE
    `);

    await pool.query(`
      ALTER TABLE users
      ADD COLUMN IF NOT EXISTS last_active_at TIMESTAMP WITHOUT TIME ZONE
    `);

    await pool.query(`
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

    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_candidate_assignments_candidate ON candidate_assignments(candidate_id)
    `);
  } catch (error) {
    console.error('Database setup error:', error.message);
  }
}

// Middleware to verify JWT token
const verifyToken = (req, res, next) => {
  const token = req.headers.authorization?.split(' ')[1];

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

// Authentication Route
app.post('/api/v1/auth/login', async (req, res) => {
  const { email, password } = req.body;

  try {
    const result = await pool.query('SELECT * FROM users WHERE email = $1', [email]);

    if (result.rows.length === 0) {
      return res.status(401).json({ message: 'Invalid email or password.' });
    }

    const user = result.rows[0];
    const passwordMatch = await bcrypt.compare(password, user.password_hash);

    if (!passwordMatch) {
      return res.status(401).json({ message: 'Invalid email or password.' });
    }

    const token = jwt.sign({ userId: user.id, role: user.role }, SECRET_KEY, { expiresIn: '1d' });

    await pool.query(
      `
        UPDATE users
        SET last_login_at = CURRENT_TIMESTAMP,
            last_active_at = CURRENT_TIMESTAMP
        WHERE id = $1
      `,
      [user.id]
    );

    res.json({ token, role: user.role, name: user.name, id: user.id });

  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ message: 'Internal server error during login.' });
  }
});

app.get('/api/v1/profile', verifyToken, async (req, res) => {
  try {
    const result = await pool.query(
      `
      SELECT id, name, email, role, daily_quota, created_at, updated_at
      FROM users
      WHERE id = $1
    `,
      [req.user.userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'User not found' });
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error fetching profile:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

app.put('/api/v1/profile', verifyToken, async (req, res) => {
  try {
    const { name, email, password, daily_quota } = req.body;

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
app.post('/api/v1/candidates', verifyToken, async (req, res) => {
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
app.put('/api/v1/candidates/:id', verifyToken, async (req, res) => {
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

app.post('/api/v1/candidates/:id/notes', verifyToken, async (req, res) => {
  try {
    const candidateId = parseInt(req.params.id, 10);
    if (Number.isNaN(candidateId)) {
      return res.status(400).json({ message: 'Invalid candidate id' });
    }

    const candidate = await fetchCandidateWithAccess(candidateId, req.user);

    const { content, isPrivate = false, followUp } = req.body;
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
      [candidateId, req.user.userId, trimmedContent, Boolean(isPrivate)]
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

app.put('/api/v1/candidates/:candidateId/notes/:noteId', verifyToken, async (req, res) => {
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

    const { content, isPrivate = existingNote.is_private, followUp } = req.body;
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
      [trimmedContent, Boolean(isPrivate), noteId]
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

app.post('/api/v1/applications', verifyToken, async (req, res) => {
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

app.put('/api/v1/applications/:id', verifyToken, async (req, res) => {
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

app.post('/api/v1/applications/:id/approval', verifyToken, requireRole('Admin'), async (req, res) => {
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
          approved_by = CASE WHEN $1 THEN $2 ELSE NULL END,
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

app.post('/api/v1/interviews', verifyToken, async (req, res) => {
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

app.put('/api/v1/interviews/:id', verifyToken, async (req, res) => {
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

    if (status !== undefined) {
      const allowedStatuses = ['scheduled', 'completed', 'feedback_pending', 'rejected', 'advanced'];
      if (!allowedStatuses.includes(status)) {
        return res.status(400).json({ message: 'Invalid interview status.' });
      }
      updates.push(`status = $${updates.length + 1}`);
      params.push(status);
    }

    if (scheduled_date !== undefined) {
      updates.push(`scheduled_date = $${updates.length + 1}`);
      params.push(scheduled_date ? new Date(scheduled_date) : null);
    }

    if (round_number !== undefined) {
      const roundNumber = Number(round_number);
      if (!Number.isFinite(roundNumber) || roundNumber < 1) {
        return res.status(400).json({ message: 'Round number must be a positive integer.' });
      }
      updates.push(`round_number = $${updates.length + 1}`);
      params.push(roundNumber);
    }

    if (timezone !== undefined) {
      updates.push(`timezone = $${updates.length + 1}`);
      params.push(timezone || null);
    }

    if (notes !== undefined) {
      updates.push(`notes = $${updates.length + 1}`);
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
        WHERE id = $${params.length}
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

app.post('/api/v1/interviews/:id/approval', verifyToken, requireRole('Admin'), async (req, res) => {
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
            approved_by = CASE WHEN $1 THEN $2 ELSE NULL END,
            approved_at = CASE WHEN $1 THEN CURRENT_TIMESTAMP ELSE NULL END,
            updated_at = CURRENT_TIMESTAMP
        WHERE id = $3
        RETURNING *
      `,
      [shouldApprove, req.user.userId, interviewId],
    );

    const interview = updated.rows[0];

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

app.post('/api/v1/assessments', verifyToken, async (req, res) => {
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

app.put('/api/v1/assessments/:id', verifyToken, async (req, res) => {
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
      const numericScore = score === null || score === '' ? null : Number(score);
      if (numericScore !== null && !Number.isFinite(numericScore)) {
        return res.status(400).json({ message: 'Score must be a number.' });
      }
      updates.push(`score = $${updates.length + 1}`);
      params.push(numericScore);
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

app.post('/api/v1/assessments/:id/approval', verifyToken, requireRole('Admin'), async (req, res) => {
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
            approved_by = CASE WHEN $1 THEN $2 ELSE NULL END,
            approved_at = CASE WHEN $1 THEN CURRENT_TIMESTAMP ELSE NULL END,
            updated_at = CURRENT_TIMESTAMP
        WHERE id = $3
        RETURNING *
      `,
      [shouldApprove, req.user.userId, assessmentId],
    );

    const assessment = updated.rows[0];

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
    const [{ rows: candidateSummaryRows }, { rows: stageRows }, { rows: marketingRows }, { rows: productivityRows }] =
      await Promise.all([
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
            COALESCE(today.applications_count, 0) AS applications_today,
            COALESCE(today.interviews_count, 0) AS interviews_today,
            COALESCE(today.assessments_count, 0) AS assessments_today,
            COALESCE(last7.avg_apps, 0)::numeric(10,2) AS avg_apps_last_7,
            COALESCE(last30.avg_apps, 0)::numeric(10,2) AS avg_apps_last_30
          FROM users u
          LEFT JOIN (
            SELECT user_id, applications_count, interviews_count, assessments_count
            FROM daily_activity
            WHERE activity_date = CURRENT_DATE
          ) today ON today.user_id = u.id
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
        `),
      ]);

    const candidateSummary = candidateSummaryRows[0] || {
      total_candidates: 0,
      active_candidates: 0,
      marketing_candidates: 0,
      avg_tenure_days: 0,
    };

    const totalApplicationsToday = productivityRows.reduce(
      (sum, row) => sum + Number(row.applications_today || 0),
      0,
    );
    const totalInterviewsToday = productivityRows.reduce(
      (sum, row) => sum + Number(row.interviews_today || 0),
      0,
    );
    const totalAssessmentsToday = productivityRows.reduce(
      (sum, row) => sum + Number(row.assessments_today || 0),
      0,
    );

    res.json({
      summary: {
        totalCandidates: Number(candidateSummary.total_candidates) || 0,
        activeCandidates: Number(candidateSummary.active_candidates) || 0,
        marketingCandidates: Number(candidateSummary.marketing_candidates) || 0,
        avgCandidateTenureDays: Number(candidateSummary.avg_tenure_days) || 0,
        totalRecruiters: productivityRows.length,
        totalApplicationsToday,
        totalInterviewsToday,
        totalAssessmentsToday,
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
        applicationsToday: Number(row.applications_today) || 0,
        interviewsToday: Number(row.interviews_today) || 0,
        assessmentsToday: Number(row.assessments_today) || 0,
        avgApplicationsLast7Days: Number(row.avg_apps_last_7) || 0,
        avgApplicationsLast30Days: Number(row.avg_apps_last_30) || 0,
        quotaProgress:
          row.daily_quota && Number(row.daily_quota) > 0
            ? Number(row.applications_today || 0) / Number(row.daily_quota)
            : 0,
      })),
    });
  } catch (error) {
    console.error('Error building overview report:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

app.get('/api/v1/reports/activity', verifyToken, requireRole('Admin'), async (req, res) => {
  try {
    const [
      notesResult,
      remindersResult,
      recruiterNotesResult,
      notesByRecruiterResult,
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
          ORDER BY n.created_at DESC
          LIMIT 15
        `
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
          ORDER BY r.due_date ASC
          LIMIT 15
        `
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
          ORDER BY n.created_at DESC
          LIMIT 100
        `
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

    res.json({ recentNotes, upcomingReminders, recruiterNotes, notesByRecruiter });
  } catch (error) {
    console.error('Error fetching activity feed:', error);
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
      interviewMetricsResult,
      assessmentMetricsResult,
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
    ]);

    const applicationMetrics = applicationMetricsResult.rows[0] || {};
    const interviewMetrics = interviewMetricsResult.rows[0] || {};
    const assessmentMetrics = assessmentMetricsResult.rows[0] || {};

    res.json({
      user: userResult.rows[0],
      metrics: {
        applications: {
          total: Number(applicationMetrics.total || 0),
          approved: Number(applicationMetrics.approved || 0),
          pending: Number(applicationMetrics.pending || 0),
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
    });
  } catch (error) {
    console.error('Error fetching user profile:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

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

app.post('/api/v1/users', verifyToken, requireRole('Admin'), async (req, res) => {
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

app.put('/api/v1/users/:id', verifyToken, requireRole('Admin'), async (req, res) => {
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

// Schedule automation tasks
function scheduleAutomationTasks() {
  // Check daily quotas every hour
  setInterval(checkDailyQuotas, 60 * 60 * 1000);
  
  // Check assessment deadlines every 6 hours
  setInterval(checkAssessmentDeadlines, 6 * 60 * 60 * 1000);
  
  // Check interview reminders every 2 hours
  setInterval(checkInterviewReminders, 2 * 60 * 60 * 1000);
  
  console.log('Automation tasks scheduled');
}

// Start server and initialize database
async function startServer() {
  try {
    const client = await pool.connect();
    client.release();
    console.log('Connected to PostgreSQL!');
    await setupDatabase();
    
    // Start automation tasks
    scheduleAutomationTasks();
    
    // Run initial checks
    await checkDailyQuotas();
    await checkAssessmentDeadlines();
    await checkInterviewReminders();
    
  } catch (err) {
    console.error('Database connection failed:', err.message);
    console.log('Starting server without database connection for testing...');
  }

  app.listen(port, () => {
    console.log(`Server running on http://localhost:${port}`);
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
  });
}

startServer();
