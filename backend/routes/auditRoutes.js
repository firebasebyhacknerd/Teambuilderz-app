const express = require('express');
const router = express.Router();
const { pool } = require('../db');

// Middleware to check authentication
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ message: 'Access token required' });
  }

  // Verify token (simplified - use your actual JWT verification)
  try {
    // Token verification logic here
    next();
  } catch (error) {
    return res.status(403).json({ message: 'Invalid token' });
  }
};

// Middleware to check admin role
const requireAdmin = (req, res, next) => {
  const userRole = req.headers['x-user-role'];
  if (userRole !== 'Admin') {
    return res.status(403).json({ message: 'Admin access required' });
  }
  next();
};

/**
 * Log an action to audit trail
 * POST /api/v1/audit/log
 */
router.post('/log', authenticateToken, async (req, res) => {
  try {
    const { action, tableName, recordId, oldValues, newValues } = req.body;
    const userId = req.headers['x-user-id'];
    const ipAddress = req.ip;
    const userAgent = req.headers['user-agent'];

    const query = `
      INSERT INTO audit_logs (
        user_id, action, table_name, record_id, 
        old_values, new_values, ip_address, user_agent, created_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW())
      RETURNING *;
    `;

    const result = await pool.query(query, [
      userId,
      action,
      tableName,
      recordId,
      JSON.stringify(oldValues || null),
      JSON.stringify(newValues || null),
      ipAddress,
      userAgent,
    ]);

    res.status(201).json({
      message: 'Audit log created',
      log: result.rows[0],
    });
  } catch (error) {
    console.error('Error logging audit:', error);
    res.status(500).json({ message: 'Failed to log audit' });
  }
});

/**
 * Get audit logs with filtering
 * GET /api/v1/audit/logs
 */
router.get('/logs', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const {
      userId,
      action,
      resourceType,
      startDate,
      endDate,
      limit = 50,
      offset = 0,
    } = req.query;

    let query = 'SELECT * FROM audit_logs WHERE 1=1';
    const params = [];
    let paramCount = 1;

    if (userId) {
      query += ` AND user_id = $${paramCount}`;
      params.push(userId);
      paramCount++;
    }

    if (action) {
      query += ` AND action = $${paramCount}`;
      params.push(action);
      paramCount++;
    }

    if (resourceType) {
      query += ` AND table_name = $${paramCount}`;
      params.push(resourceType);
      paramCount++;
    }

    if (startDate) {
      query += ` AND created_at >= $${paramCount}`;
      params.push(startDate);
      paramCount++;
    }

    if (endDate) {
      query += ` AND created_at <= $${paramCount}`;
      params.push(endDate);
      paramCount++;
    }

    query += ` ORDER BY created_at DESC LIMIT $${paramCount} OFFSET $${paramCount + 1}`;
    params.push(limit, offset);

    const result = await pool.query(query, params);

    // Get total count
    let countQuery = 'SELECT COUNT(*) FROM audit_logs WHERE 1=1';
    const countParams = [];
    let countParamCount = 1;

    if (userId) {
      countQuery += ` AND user_id = $${countParamCount}`;
      countParams.push(userId);
      countParamCount++;
    }

    if (action) {
      countQuery += ` AND action = $${countParamCount}`;
      countParams.push(action);
      countParamCount++;
    }

    if (resourceType) {
      countQuery += ` AND table_name = $${countParamCount}`;
      countParams.push(resourceType);
      countParamCount++;
    }

    if (startDate) {
      countQuery += ` AND created_at >= $${countParamCount}`;
      countParams.push(startDate);
      countParamCount++;
    }

    if (endDate) {
      countQuery += ` AND created_at <= $${countParamCount}`;
      countParams.push(endDate);
      countParamCount++;
    }

    const countResult = await pool.query(countQuery, countParams);
    const total = parseInt(countResult.rows[0].count);

    res.json({
      logs: result.rows,
      pagination: {
        total,
        limit: parseInt(limit),
        offset: parseInt(offset),
        pages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error('Error fetching audit logs:', error);
    res.status(500).json({ message: 'Failed to fetch audit logs' });
  }
});

/**
 * Get user activity timeline
 * GET /api/v1/audit/user/:userId/activity
 */
router.get('/user/:userId/activity', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { userId } = req.params;
    const { limit = 100 } = req.query;

    const query = `
      SELECT 
        id, action, table_name, record_id, 
        old_values, new_values, created_at, ip_address
      FROM audit_logs
      WHERE user_id = $1
      ORDER BY created_at DESC
      LIMIT $2;
    `;

    const result = await pool.query(query, [userId, limit]);

    res.json({
      userId,
      activities: result.rows,
      count: result.rows.length,
    });
  } catch (error) {
    console.error('Error fetching user activity:', error);
    res.status(500).json({ message: 'Failed to fetch user activity' });
  }
});

/**
 * Get audit statistics
 * GET /api/v1/audit/stats
 */
router.get('/stats', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { startDate, endDate } = req.query;

    let dateFilter = '';
    const params = [];

    if (startDate && endDate) {
      dateFilter = 'WHERE created_at BETWEEN $1 AND $2';
      params.push(startDate, endDate);
    }

    // Get action counts
    const actionsQuery = `
      SELECT action, COUNT(*) as count
      FROM audit_logs
      ${dateFilter}
      GROUP BY action
      ORDER BY count DESC;
    `;

    const actionsResult = await pool.query(actionsQuery, params);

    // Get table name counts
    const resourcesQuery = `
      SELECT table_name, COUNT(*) as count
      FROM audit_logs
      ${dateFilter}
      GROUP BY table_name
      ORDER BY count DESC;
    `;

    const resourcesResult = await pool.query(resourcesQuery, params);

    // Get top users
    const usersQuery = `
      SELECT user_id, COUNT(*) as count
      FROM audit_logs
      ${dateFilter}
      GROUP BY user_id
      ORDER BY count DESC
      LIMIT 10;
    `;

    const usersResult = await pool.query(usersQuery, params);

    res.json({
      actions: actionsResult.rows,
      resourceTypes: resourcesResult.rows,
      topUsers: usersResult.rows,
    });
  } catch (error) {
    console.error('Error fetching audit stats:', error);
    res.status(500).json({ message: 'Failed to fetch audit statistics' });
  }
});

/**
 * Export audit logs
 * GET /api/v1/audit/export
 */
router.get('/export', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { startDate, endDate, format = 'csv' } = req.query;

    let query = 'SELECT * FROM audit_logs WHERE 1=1';
    const params = [];
    let paramCount = 1;

    if (startDate) {
      query += ` AND created_at >= $${paramCount}`;
      params.push(startDate);
      paramCount++;
    }

    if (endDate) {
      query += ` AND created_at <= $${paramCount}`;
      params.push(endDate);
      paramCount++;
    }

    query += ' ORDER BY created_at DESC';

    const result = await pool.query(query, params);

    if (format === 'csv') {
      // Convert to CSV
      const headers = [
        'ID',
        'User ID',
        'Action',
        'Resource Type',
        'Resource ID',
        'Changes',
        'IP Address',
        'Created At',
      ];

      const rows = result.rows.map((log) => [
        log.id,
        log.user_id,
        log.action,
        log.resource_type,
        log.resource_id,
        JSON.stringify(log.changes),
        log.ip_address,
        log.created_at,
      ]);

      const csv = [headers, ...rows].map((row) => row.map((cell) => `"${cell}"`).join(',')).join('\n');

      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', 'attachment; filename=audit-logs.csv');
      res.send(csv);
    } else if (format === 'json') {
      res.setHeader('Content-Type', 'application/json');
      res.setHeader('Content-Disposition', 'attachment; filename=audit-logs.json');
      res.json(result.rows);
    }
  } catch (error) {
    console.error('Error exporting audit logs:', error);
    res.status(500).json({ message: 'Failed to export audit logs' });
  }
});

/**
 * Delete old audit logs (retention policy)
 * DELETE /api/v1/audit/cleanup
 */
router.delete('/cleanup', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { daysToKeep = 90 } = req.body;

    const query = `
      DELETE FROM audit_logs
      WHERE created_at < NOW() - INTERVAL '${daysToKeep} days'
      RETURNING id;
    `;

    const result = await pool.query(query);

    res.json({
      message: `Deleted ${result.rows.length} old audit logs`,
      deletedCount: result.rows.length,
    });
  } catch (error) {
    console.error('Error cleaning up audit logs:', error);
    res.status(500).json({ message: 'Failed to cleanup audit logs' });
  }
});

module.exports = router;
