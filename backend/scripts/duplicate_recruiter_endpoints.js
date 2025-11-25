// Add this endpoint to server.js after the users endpoints

app.get('/api/v1/admin/duplicate-recruiters', verifyToken, requireRole('Admin'), async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT 
        name,
        COUNT(*) as duplicate_count,
        STRING_AGG(id::text, ', ') as recruiter_ids,
        STRING_AGG(email, ', ') as emails,
        STRING_AGG(CASE WHEN is_active THEN 'Active' ELSE 'Inactive' END, ', ') as statuses
      FROM users 
      WHERE role = 'Recruiter' 
      GROUP BY name 
      HAVING COUNT(*) > 1
      ORDER BY duplicate_count DESC, name
    `);

    const allRecruiters = await pool.query(`
      SELECT id, name, email, is_active, created_at
      FROM users 
      WHERE role = 'Recruiter' 
      ORDER BY name, created_at
    `);

    res.json({
      duplicates: result.rows,
      all_recruiters: allRecruiters.rows,
      summary: {
        total_recruiters: allRecruiters.rows.length,
        duplicate_groups: result.rows.length,
        affected_recruiters: result.rows.reduce((sum, row) => sum + row.duplicate_count, 0)
      }
    });
  } catch (error) {
    console.error('Error fetching duplicate recruiters:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

app.post('/api/v1/admin/merge-recruiters', verifyToken, requireRole('Admin'), async (req, res) => {
  try {
    const { primary_recruiter_id, duplicate_recruiter_ids } = req.body;
    
    if (!primary_recruiter_id || !Array.isArray(duplicate_recruiter_ids) || duplicate_recruiter_ids.length === 0) {
      return res.status(400).json({ 
        message: 'Primary recruiter ID and duplicate recruiter IDs array are required' 
      });
    }

    // Verify all recruiters exist and are Recruiter role
    const allIds = [primary_recruiter_id, ...duplicate_recruiter_ids];
    const recruiters = await pool.query(
      'SELECT id, name, email, role FROM users WHERE id = ANY($1)',
      [allIds]
    );

    if (recruiters.rows.length !== allIds.length) {
      return res.status(404).json({ message: 'One or more recruiters not found' });
    }

    const nonRecruiters = recruiters.rows.filter(r => r.role !== 'Recruiter');
    if (nonRecruiters.length > 0) {
      return res.status(400).json({ 
        message: 'All specified users must be recruiters',
        invalid_users: nonRecruiters
      });
    }

    await pool.query('BEGIN');

    try {
      // Update all references from duplicate recruiters to primary recruiter
      await pool.query(
        'UPDATE candidates SET assigned_recruiter_id = $1 WHERE assigned_recruiter_id = ANY($2)',
        [primary_recruiter_id, duplicate_recruiter_ids]
      );
      
      await pool.query(
        'UPDATE applications SET recruiter_id = $1 WHERE recruiter_id = ANY($2)',
        [primary_recruiter_id, duplicate_recruiter_ids]
      );
      
      await pool.query(
        'UPDATE interviews SET recruiter_id = $1 WHERE recruiter_id = ANY($2)',
        [primary_recruiter_id, duplicate_recruiter_ids]
      );
      
      await pool.query(
        'UPDATE assessments SET recruiter_id = $1 WHERE recruiter_id = ANY($2)',
        [primary_recruiter_id, duplicate_recruiter_ids]
      );
      
      await pool.query(
        'UPDATE notes SET author_id = $1 WHERE author_id = ANY($2)',
        [primary_recruiter_id, duplicate_recruiter_ids]
      );
      
      await pool.query(
        'UPDATE attendance_entries SET user_id = $1 WHERE user_id = ANY($2)',
        [primary_recruiter_id, duplicate_recruiter_ids]
      );
      
      await pool.query(
        'UPDATE daily_activity SET user_id = $1 WHERE user_id = ANY($2)',
        [primary_recruiter_id, duplicate_recruiter_ids]
      );

      // Delete duplicate recruiters
      await pool.query(
        'DELETE FROM users WHERE id = ANY($1)',
        [duplicate_recruiter_ids]
      );

      await pool.query('COMMIT');

      res.json({
        message: 'Successfully merged recruiters',
        primary_recruiter_id,
        merged_recruiter_ids: duplicate_recruiter_ids,
        records_updated: {
          candidates: await pool.query('SELECT COUNT(*) FROM candidates WHERE assigned_recruiter_id = $1', [primary_recruiter_id]).then(r => parseInt(r.rows[0].count)),
          applications: await pool.query('SELECT COUNT(*) FROM applications WHERE recruiter_id = $1', [primary_recruiter_id]).then(r => parseInt(r.rows[0].count)),
          interviews: await pool.query('SELECT COUNT(*) FROM interviews WHERE recruiter_id = $1', [primary_recruiter_id]).then(r => parseInt(r.rows[0].count)),
          assessments: await pool.query('SELECT COUNT(*) FROM assessments WHERE recruiter_id = $1', [primary_recruiter_id]).then(r => parseInt(r.rows[0].count))
        }
      });
    } catch (error) {
      await pool.query('ROLLBACK');
      throw error;
    }
  } catch (error) {
    console.error('Error merging recruiters:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});
