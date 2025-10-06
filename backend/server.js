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
          title VARCHAR(200) NOT NULL,
          description TEXT,
          due_date TIMESTAMP WITH TIME ZONE NOT NULL,
          status reminder_status DEFAULT 'pending',
          priority INTEGER DEFAULT 1,
          created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP
        );
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
      console.log('Database tables already exist. Skipping initialization.');
    }
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
    next();
  } catch (error) {
    return res.status(401).json({ message: 'Invalid token' });
  }
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

    res.json({ token, role: user.role, name: user.name });

  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ message: 'Internal server error during login.' });
  }
});

// Candidates API endpoints
app.get('/api/v1/candidates', verifyToken, async (req, res) => {
  try {
    const { stage, recruiter_id, search } = req.query;
    let query = `
      SELECT c.*, u.name as recruiter_name,
             COUNT(DISTINCT a.id) as total_applications,
             COUNT(DISTINCT CASE WHEN a.application_date = CURRENT_DATE THEN a.id END) as daily_applications
      FROM candidates c
      LEFT JOIN users u ON c.assigned_recruiter_id = u.id
      LEFT JOIN applications a ON c.id = a.candidate_id
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

    query += ` GROUP BY c.id, u.name ORDER BY c.created_at DESC`;

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
    const { name, email, phone, visa_status, skills, experience_years, assigned_recruiter_id } = req.body;
    
    const result = await pool.query(`
      INSERT INTO candidates (name, email, phone, visa_status, skills, experience_years, assigned_recruiter_id)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING *
    `, [name, email, phone, visa_status, skills, experience_years, assigned_recruiter_id]);

    // Log audit
    await pool.query(`
      INSERT INTO audit_logs (user_id, action, table_name, record_id, new_values)
      VALUES ($1, 'CREATE', 'candidates', $2, $3)
    `, [req.user.userId, result.rows[0].id, JSON.stringify(result.rows[0])]);

    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('Error creating candidate:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// Update candidate
app.put('/api/v1/candidates/:id', verifyToken, async (req, res) => {
  try {
    const { id } = req.params;
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
    const oldResult = await pool.query('SELECT * FROM candidates WHERE id = $1', [id]);
    if (oldResult.rows.length === 0) {
      return res.status(404).json({ message: 'Candidate not found' });
    }

    const oldCandidate = oldResult.rows[0];
    const updatedCandidate = {
      name: name ?? oldCandidate.name,
      email: email ?? oldCandidate.email,
      phone: phone ?? oldCandidate.phone,
      visa_status: visa_status ?? oldCandidate.visa_status,
      skills: skills ?? oldCandidate.skills,
      experience_years: experience_years ?? oldCandidate.experience_years,
      current_stage: current_stage ?? oldCandidate.current_stage,
      marketing_start_date: marketing_start_date ?? oldCandidate.marketing_start_date,
      assigned_recruiter_id: assigned_recruiter_id ?? oldCandidate.assigned_recruiter_id
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
      id
    ]);

    // Log audit
    await pool.query(`
      INSERT INTO audit_logs (user_id, action, table_name, record_id, old_values, new_values)
      VALUES ($1, 'UPDATE', 'candidates', $2, $3, $4)
    `, [req.user.userId, id, JSON.stringify(oldCandidate), JSON.stringify(result.rows[0])]);

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
    const { candidate_id, company_name, job_title, job_description, channel } = req.body;
    
    const result = await pool.query(`
      INSERT INTO applications (candidate_id, recruiter_id, company_name, job_title, job_description, channel)
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING *
    `, [candidate_id, req.user.userId, company_name, job_title, job_description, channel]);

    // Update daily activity
    await pool.query(`
      INSERT INTO daily_activity (user_id, applications_count)
      VALUES ($1, 1)
      ON CONFLICT (user_id, activity_date)
      DO UPDATE SET applications_count = daily_activity.applications_count + 1
    `, [req.user.userId]);

    // Log audit
    await pool.query(`
      INSERT INTO audit_logs (user_id, action, table_name, record_id, new_values)
      VALUES ($1, 'CREATE', 'applications', $2, $3)
    `, [req.user.userId, result.rows[0].id, JSON.stringify(result.rows[0])]);

    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('Error creating application:', error);
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

// Performance reports API endpoint
app.get('/api/v1/reports/performance', verifyToken, async (req, res) => {
  try {
    const { date_from, date_to } = req.query;
    const startDate = date_from || new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    const endDate = date_to || new Date().toISOString().split('T')[0];

    const result = await pool.query(`
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
      GROUP BY u.id, u.name, u.daily_quota
      ORDER BY apps_total_period DESC
    `, [startDate, endDate]);

    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching performance data:', error);
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
app.get('/api/v1/users', verifyToken, async (req, res) => {
  try {
    if (req.user.role !== 'Admin') {
      return res.status(403).json({ message: 'Access denied' });
    }

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

app.post('/api/v1/users', verifyToken, async (req, res) => {
  try {
    if (req.user.role !== 'Admin') {
      return res.status(403).json({ message: 'Access denied' });
    }

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
    console.log('  Alerts:');
    console.log('    GET  /api/v1/alerts - Get alerts (requires auth)');
    console.log('  Users (Admin only):');
    console.log('    GET  /api/v1/users - Get users (requires admin)');
    console.log('    POST /api/v1/users - Create user (requires admin)');
  });
}

startServer();

