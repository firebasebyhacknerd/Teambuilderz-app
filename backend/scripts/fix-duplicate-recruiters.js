#!/usr/bin/env node

/**
 * Duplicate Recruiter Fix Script
 * Run this script to identify and fix duplicate recruiter names
 */

const { Pool } = require('pg');

// Database connection - adjust as needed
const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgresql://username:password@localhost:5432/teambuilderz'
});

async function findDuplicates() {
  console.log('🔍 Finding duplicate recruiters...\n');
  
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

    if (result.rows.length === 0) {
      console.log('✅ No duplicate recruiter names found!');
      return;
    }

    console.log(`❌ Found ${result.rows.length} groups of duplicate recruiters:\n`);
    
    result.rows.forEach((dup, index) => {
      console.log(`${index + 1}. "${dup.name}" - ${dup.duplicate_count} duplicates`);
      console.log(`   IDs: ${dup.recruiter_ids}`);
      console.log(`   Emails: ${dup.emails}`);
      console.log(`   Status: ${dup.statuses}`);
      console.log('');
    });

    // Get all recruiters for detailed view
    const allRecruiters = await pool.query(`
      SELECT id, name, email, is_active, created_at
      FROM users 
      WHERE role = 'Recruiter' 
      ORDER BY name, created_at
    `);

    console.log('\n📋 All Recruiters (for reference):');
    allRecruiters.rows.forEach(rec => {
      const status = rec.is_active ? '✅' : '❌';
      console.log(`${status} ID: ${rec.id} | Name: "${rec.name}" | Email: ${rec.email} | Created: ${rec.created_at}`);
    });

    return result.rows;
  } catch (error) {
    console.error('Error finding duplicates:', error);
    throw error;
  }
}

async function mergeRecruiters(primaryId, duplicateIds) {
  console.log(`🔄 Merging recruiters - Primary: ${primaryId}, Duplicates: [${duplicateIds.join(', ')}]`);
  
  try {
    await pool.query('BEGIN');

    // Update all references
    await pool.query(
      'UPDATE candidates SET assigned_recruiter_id = $1 WHERE assigned_recruiter_id = ANY($2)',
      [primaryId, duplicateIds]
    );
    
    await pool.query(
      'UPDATE applications SET recruiter_id = $1 WHERE recruiter_id = ANY($2)',
      [primaryId, duplicateIds]
    );
    
    await pool.query(
      'UPDATE interviews SET recruiter_id = $1 WHERE recruiter_id = ANY($2)',
      [primaryId, duplicateIds]
    );
    
    await pool.query(
      'UPDATE assessments SET recruiter_id = $1 WHERE recruiter_id = ANY($2)',
      [primaryId, duplicateIds]
    );
    
    await pool.query(
      'UPDATE notes SET author_id = $1 WHERE author_id = ANY($2)',
      [primaryId, duplicateIds]
    );

    // Delete duplicates
    await pool.query(
      'DELETE FROM users WHERE id = ANY($1)',
      [duplicateIds]
    );

    await pool.query('COMMIT');

    // Get summary of merged data
    const summary = await pool.query(`
      SELECT 
        (SELECT COUNT(*) FROM candidates WHERE assigned_recruiter_id = $1) as candidates,
        (SELECT COUNT(*) FROM applications WHERE recruiter_id = $1) as applications,
        (SELECT COUNT(*) FROM interviews WHERE recruiter_id = $1) as interviews,
        (SELECT COUNT(*) FROM assessments WHERE recruiter_id = $1) as assessments
    `, [primaryId]);

    console.log('✅ Successfully merged recruiters!');
    console.log('📊 Records now assigned to primary recruiter:');
    console.log(`   - Candidates: ${summary.rows[0].candidates}`);
    console.log(`   - Applications: ${summary.rows[0].applications}`);
    console.log(`   - Interviews: ${summary.rows[0].interviews}`);
    console.log(`   - Assessments: ${summary.rows[0].assessments}`);

  } catch (error) {
    await pool.query('ROLLBACK');
    console.error('❌ Error merging recruiters:', error);
    throw error;
  }
}

async function main() {
  const args = process.argv.slice(2);
  
  if (args.length === 0) {
    console.log('Usage:');
    console.log('  node fix-duplicate-recruiters.js find          # Find duplicates');
    console.log('  node fix-duplicate-recruiters.js merge <primaryId> <duplicateId1> <duplicateId2> ... # Merge duplicates');
    console.log('\nExample:');
    console.log('  node fix-duplicate-recruiters.js find');
    console.log('  node fix-duplicate-recruiters.js merge 123 456 789');
    process.exit(1);
  }

  const command = args[0];

  try {
    if (command === 'find') {
      await findDuplicates();
    } else if (command === 'merge' && args.length >= 3) {
      const primaryId = parseInt(args[1]);
      const duplicateIds = args.slice(2).map(id => parseInt(id));
      
      if (isNaN(primaryId) || duplicateIds.some(isNaN)) {
        console.error('❌ Invalid recruiter IDs provided');
        process.exit(1);
      }

      await mergeRecruiters(primaryId, duplicateIds);
    } else {
      console.error('❌ Invalid command or arguments');
      process.exit(1);
    }
  } catch (error) {
    console.error('❌ Operation failed:', error.message);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

if (require.main === module) {
  main();
}

module.exports = { findDuplicates, mergeRecruiters };
