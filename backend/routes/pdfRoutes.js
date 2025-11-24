const express = require('express');
const router = express.Router();
const pdfService = require('../services/pdfService');
const { pool } = require('../db');

// Middleware to check authentication
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  
  if (!token) {
    return res.status(401).json({ message: 'Authentication required' });
  }
  
  // For now, we'll use a simple token check. In production, use proper JWT verification
  if (token !== 'session') {
    return res.status(403).json({ message: 'Invalid token' });
  }
  
  next();
};

// Admin-only middleware
const requireAdmin = (req, res, next) => {
  const userRole = req.headers['x-user-role'];
  if (userRole !== 'Admin') {
    return res.status(403).json({ message: 'Admin access required' });
  }
  next();
};

// Generate attendance PDF report
router.post('/attendance', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { dateFrom, dateTo, userId } = req.body;
    
    let query = `
      SELECT 
        ae.*,
        u.name as user_name,
        u.email as user_email
      FROM attendance_entries ae
      JOIN users u ON ae.user_id = u.id
      WHERE 1=1
    `;
    const params = [];
    let paramIndex = 1;
    
    if (dateFrom) {
      query += ` AND ae.attendance_date >= $${paramIndex++}`;
      params.push(dateFrom);
    }
    
    if (dateTo) {
      query += ` AND ae.attendance_date <= $${paramIndex++}`;
      params.push(dateTo);
    }
    
    if (userId) {
      query += ` AND ae.user_id = $${paramIndex++}`;
      params.push(userId);
    }
    
    query += ` ORDER BY ae.attendance_date DESC, u.name`;
    
    const result = await pool.query(query, params);
    
    const pdfData = {
      dateFrom,
      dateTo,
      records: result.rows
    };
    
    const pdfBuffer = await pdfService.generatePDFReport(pdfData, 'attendance');
    
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="attendance-report-${new Date().toISOString().split('T')[0]}.pdf"`);
    res.send(pdfBuffer);
    
  } catch (error) {
    console.error('Error generating attendance PDF:', error);
    res.status(500).json({ message: 'Error generating PDF report' });
  }
});

// Generate candidates PDF report
router.post('/candidates', authenticateToken, async (req, res) => {
  try {
    const { stage, recruiterId, dateFrom, dateTo } = req.body;
    const userId = req.headers['x-user-id'];
    const userRole = req.headers['x-user-role'];
    
    let query = `
      SELECT 
        c.*,
        u.name as recruiter_name
      FROM candidates c
      LEFT JOIN users u ON c.assigned_recruiter_id = u.id
      WHERE 1=1
    `;
    const params = [];
    let paramIndex = 1;
    
    // Non-admin users can only see their assigned candidates
    if (userRole !== 'Admin' && userId) {
      query += ` AND c.assigned_recruiter_id = $${paramIndex++}`;
      params.push(userId);
    }
    
    if (stage) {
      query += ` AND c.current_stage = $${paramIndex++}`;
      params.push(stage);
    }
    
    if (recruiterId && userRole === 'Admin') {
      query += ` AND c.assigned_recruiter_id = $${paramIndex++}`;
      params.push(recruiterId);
    }
    
    if (dateFrom) {
      query += ` AND c.created_at >= $${paramIndex++}`;
      params.push(dateFrom);
    }
    
    if (dateTo) {
      query += ` AND c.created_at <= $${paramIndex++}`;
      params.push(dateTo);
    }
    
    query += ` ORDER BY c.created_at DESC`;
    
    const result = await pool.query(query, params);
    
    const pdfData = {
      candidates: result.rows,
      filters: { stage, recruiterId, dateFrom, dateTo }
    };
    
    const pdfBuffer = await pdfService.generatePDFReport(pdfData, 'candidates');
    
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="candidates-report-${new Date().toISOString().split('T')[0]}.pdf"`);
    res.send(pdfBuffer);
    
  } catch (error) {
    console.error('Error generating candidates PDF:', error);
    res.status(500).json({ message: 'Error generating PDF report' });
  }
});

// Generate performance PDF report
router.post('/performance', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { period = 'monthly', dateFrom, dateTo } = req.body;
    
    let dateFilter = '';
    if (period === 'monthly') {
      dateFilter = `AND da.activity_date >= NOW() - INTERVAL '1 month'`;
    } else if (period === 'weekly') {
      dateFilter = `AND da.activity_date >= NOW() - INTERVAL '1 week'`;
    } else if (dateFrom && dateTo) {
      dateFilter = `AND da.activity_date BETWEEN '${dateFrom}' AND '${dateTo}'`;
    }
    
    const query = `
      SELECT 
        u.id,
        u.name,
        u.email,
        COALESCE(SUM(CASE WHEN da.applications_submitted > 0 THEN da.applications_submitted ELSE 0 END), 0) as applications,
        COALESCE(SUM(CASE WHEN da.interviews_scheduled > 0 THEN da.interviews_scheduled ELSE 0 END), 0) as interviews,
        COALESCE(SUM(CASE WHEN da.candidates_placed > 0 THEN da.candidates_placed ELSE 0 END), 0) as placements
      FROM users u
      LEFT JOIN daily_activity da ON u.id = da.user_id ${dateFilter}
      WHERE u.role = 'Recruiter'
      GROUP BY u.id, u.name, u.email
      ORDER BY placements DESC, applications DESC
    `;
    
    const result = await pool.query(query);
    
    const pdfData = {
      recruiters: result.rows,
      period: period.charAt(0).toUpperCase() + period.slice(1)
    };
    
    const pdfBuffer = await pdfService.generatePDFReport(pdfData, 'performance');
    
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="performance-report-${period}-${new Date().toISOString().split('T')[0]}.pdf"`);
    res.send(pdfBuffer);
    
  } catch (error) {
    console.error('Error generating performance PDF:', error);
    res.status(500).json({ message: 'Error generating PDF report' });
  }
});

// Generate applications PDF report
router.post('/applications', authenticateToken, async (req, res) => {
  try {
    const { status, recruiterId, dateFrom, dateTo } = req.body;
    const userId = req.headers['x-user-id'];
    const userRole = req.headers['x-user-role'];
    
    let query = `
      SELECT 
        a.*,
        c.name as candidate_name,
        u.name as recruiter_name
      FROM applications a
      JOIN candidates c ON a.candidate_id = c.id
      LEFT JOIN users u ON a.recruiter_id = u.id
      WHERE 1=1
    `;
    const params = [];
    let paramIndex = 1;
    
    // Non-admin users can only see their applications
    if (userRole !== 'Admin' && userId) {
      query += ` AND a.recruiter_id = $${paramIndex++}`;
      params.push(userId);
    }
    
    if (status) {
      query += ` AND a.status = $${paramIndex++}`;
      params.push(status);
    }
    
    if (recruiterId && userRole === 'Admin') {
      query += ` AND a.recruiter_id = $${paramIndex++}`;
      params.push(recruiterId);
    }
    
    if (dateFrom) {
      query += ` AND a.application_date >= $${paramIndex++}`;
      params.push(dateFrom);
    }
    
    if (dateTo) {
      query += ` AND a.application_date <= $${paramIndex++}`;
      params.push(dateTo);
    }
    
    query += ` ORDER BY a.application_date DESC`;
    
    const result = await pool.query(query, params);
    
    const pdfData = {
      applications: result.rows,
      period: dateFrom && dateTo ? `${dateFrom} to ${dateTo}` : 'All Time'
    };
    
    const pdfBuffer = await pdfService.generatePDFReport(pdfData, 'applications');
    
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="applications-report-${new Date().toISOString().split('T')[0]}.pdf"`);
    res.send(pdfBuffer);
    
  } catch (error) {
    console.error('Error generating applications PDF:', error);
    res.status(500).json({ message: 'Error generating PDF report' });
  }
});

// Generate interviews PDF report
router.post('/interviews', authenticateToken, async (req, res) => {
  try {
    const { status, type, dateFrom, dateTo } = req.body;
    const userId = req.headers['x-user-id'];
    const userRole = req.headers['x-user-role'];
    
    let query = `
      SELECT 
        i.*,
        c.name as candidate_name,
        u.name as recruiter_name
      FROM interviews i
      JOIN candidates c ON i.candidate_id = c.id
      LEFT JOIN users u ON i.recruiter_id = u.id
      WHERE 1=1
    `;
    const params = [];
    let paramIndex = 1;
    
    // Non-admin users can only see their interviews
    if (userRole !== 'Admin' && userId) {
      query += ` AND i.recruiter_id = $${paramIndex++}`;
      params.push(userId);
    }
    
    if (status) {
      query += ` AND i.status = $${paramIndex++}`;
      params.push(status);
    }
    
    if (type) {
      query += ` AND i.interview_type = $${paramIndex++}`;
      params.push(type);
    }
    
    if (dateFrom) {
      query += ` AND i.scheduled_date >= $${paramIndex++}`;
      params.push(dateFrom);
    }
    
    if (dateTo) {
      query += ` AND i.scheduled_date <= $${paramIndex++}`;
      params.push(dateTo);
    }
    
    query += ` ORDER BY i.scheduled_date DESC`;
    
    const result = await pool.query(query, params);
    
    const pdfData = {
      interviews: result.rows,
      period: dateFrom && dateTo ? `${dateFrom} to ${dateTo}` : 'All Time'
    };
    
    const pdfBuffer = await pdfService.generatePDFReport(pdfData, 'interviews');
    
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="interviews-report-${new Date().toISOString().split('T')[0]}.pdf"`);
    res.send(pdfBuffer);
    
  } catch (error) {
    console.error('Error generating interviews PDF:', error);
    res.status(500).json({ message: 'Error generating PDF report' });
  }
});

// Generate custom report
router.post('/custom', authenticateToken, async (req, res) => {
  try {
    const { reportType, data, options } = req.body;
    
    if (!reportType || !data) {
      return res.status(400).json({ message: 'Report type and data are required' });
    }
    
    const pdfBuffer = await pdfService.generatePDFReport(data, reportType, options);
    
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="custom-report-${new Date().toISOString().split('T')[0]}.pdf"`);
    res.send(pdfBuffer);
    
  } catch (error) {
    console.error('Error generating custom PDF:', error);
    res.status(500).json({ message: 'Error generating PDF report' });
  }
});

module.exports = router;

