#!/usr/bin/env node

/**
 * Seed application counts (date + recruiter + candidate) for November 2025.
 * - Ensures recruiters exist as users (role=Recruiter) with generated emails/passwords.
 * - Ensures candidates exist, assigning to the recruiter when created.
 * - Upserts into recruiter_candidate_activity and daily_activity.
 *
 * Usage: `node scripts/import_application_counts_nov2025.js`
 */

const path = require('path');
const { Client } = require('pg');
const bcrypt = require('bcryptjs');
const dotenv = require('dotenv');

dotenv.config({ path: path.resolve(__dirname, '../.env') });

const RAW_DATA = `
11/03/2025	Kartavya	dhanalakshmi Nangunuri	75
11/03/2025	Kartavya	sai Krishna Singireddy	70
11/03/2025	Kartavya	Janvi Pandey	80
11/03/2025	Pawan	Jhanvi Jhariwala	130
11/03/2025	Pawan	Jaydev Joshi	70
11/03/2025	Satyam	Subhash Nakka	70
11/04/2025	Pawan	Jhanvi Jhariwala	90
11/04/2025	Pawan	Jaydev Joshi	60
11/04/2025	Kartavya	sai Krishna Singireddy	60
11/04/2025	Satyam	Subhash Nakka	80
11/04/2025	Kartavya	Janvi Pandey	60
11/05/2025	Kartavya	sai Krishna Singireddy	80
11/05/2025	Satyam	Subhash Nakka	90
11/05/2025	Kartavya	Janvi Pandey	80
11/06/2025	Kartavya	sai Krishna Singireddy	80
11/06/2025	Kartavya	Janvi Pandey	80
11/06/2025	Satyam	Subhash Nakka	90
`;

const PASSWORD_PLAINTEXT = 'import123!';
const PASSWORD_HASH = bcrypt.hashSync(PASSWORD_PLAINTEXT, 10);

const clientConfig = {
  host: process.env.DB_HOST || 'localhost',
  port: Number.parseInt(process.env.DB_PORT || '5432', 10),
  user: process.env.DB_USER || 'postgres',
  password: `${process.env.DB_PASSWORD || ''}`,
  database: process.env.DB_NAME || 'postgres',
};

const slugify = (value) =>
  value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '.')
    .replace(/\.+/g, '.')
    .replace(/^\.+|\.+$/g, '');

const titleCase = (value) =>
  value
    .trim()
    .toLowerCase()
    .split(/\s+/)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');

const parseLine = (line) => {
  const match = line.trim().match(/^(\d{2}\/\d{2}\/\d{4})\s+([^\t]+?)\s+(.+)\s+(\d+)$/);
  if (!match) return null;
  const [, dateStr, rawRecruiter, rawCandidate, countStr] = match;
  const [month, day, year] = dateStr.split('/');
  const iso = `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
  return {
    dateIso: iso,
    recruiterName: titleCase(rawRecruiter),
    candidateName: titleCase(rawCandidate),
    count: Number.parseInt(countStr, 10),
  };
};

async function ensureUser(client, name) {
  const existing = await client.query('SELECT id FROM users WHERE lower(name) = lower($1) LIMIT 1', [name]);
  if (existing.rows.length > 0) {
    return existing.rows[0].id;
  }

  // generate unique-ish email
  const baseEmail = `${slugify(name) || 'recruiter'}`;
  let email = `${baseEmail}@import.local`;
  let suffix = 1;
  while (true) {
    const emailCheck = await client.query('SELECT 1 FROM users WHERE email = $1', [email]);
    if (emailCheck.rows.length === 0) break;
    email = `${baseEmail}.${suffix}@import.local`;
    suffix += 1;
  }

  const inserted = await client.query(
    `
      INSERT INTO users (name, email, password_hash, role, daily_quota)
      VALUES ($1, $2, $3, 'Recruiter', 100)
      RETURNING id
    `,
    [name, email, PASSWORD_HASH],
  );
  return inserted.rows[0].id;
}

async function ensureCandidate(client, name, assignedRecruiterId = null) {
  const existing = await client.query('SELECT id FROM candidates WHERE lower(name) = lower($1) LIMIT 1', [name]);
  if (existing.rows.length > 0) {
    return existing.rows[0].id;
  }

  let email = `${slugify(name) || 'candidate'}@import.local`;
  let suffix = 1;
  while (true) {
    const emailCheck = await client.query('SELECT 1 FROM candidates WHERE email = $1', [email]);
    if (emailCheck.rows.length === 0) break;
    email = `${slugify(name)}.${suffix}@import.local`;
    suffix += 1;
  }

  const inserted = await client.query(
    `
      INSERT INTO candidates (name, email, assigned_recruiter_id)
      VALUES ($1, $2, $3)
      RETURNING id
    `,
    [name, email, assignedRecruiterId],
  );
  return inserted.rows[0].id;
}

(async () => {
  const client = new Client(clientConfig);
  const rows = RAW_DATA.split(/\r?\n/).map(parseLine).filter(Boolean);
  if (rows.length === 0) {
    console.error('No rows parsed. Aborting.');
    process.exit(1);
  }

  const dailyTotals = new Map(); // key: recruiterId::dateIso -> count
  let activityUpserts = 0;

  try {
    await client.connect();
    await client.query('BEGIN');

    for (const row of rows) {
      const recruiterId = await ensureUser(client, row.recruiterName);
      const candidateId = await ensureCandidate(client, row.candidateName, recruiterId);

      const result = await client.query(
        `
          INSERT INTO recruiter_candidate_activity (
            recruiter_id, candidate_id, activity_date, applications_count
          )
          VALUES ($1, $2, $3, $4)
          ON CONFLICT (recruiter_id, candidate_id, activity_date)
          DO UPDATE SET
            applications_count = EXCLUDED.applications_count,
            updated_at = CURRENT_TIMESTAMP
          RETURNING xmax = 0 AS inserted
        `,
        [recruiterId, candidateId, row.dateIso, row.count],
      );

      activityUpserts += 1;
      const key = `${recruiterId}::${row.dateIso}`;
      dailyTotals.set(key, (dailyTotals.get(key) || 0) + row.count);
    }

    for (const [key, total] of dailyTotals.entries()) {
      const [recruiterId, dateIso] = key.split('::');
      await client.query(
        `
          INSERT INTO daily_activity (user_id, activity_date, applications_count)
          VALUES ($1, $2, $3)
          ON CONFLICT (user_id, activity_date)
          DO UPDATE SET applications_count = EXCLUDED.applications_count
        `,
        [Number.parseInt(recruiterId, 10), dateIso, total],
      );
    }

    await client.query('COMMIT');
    console.log(`Imported ${rows.length} rows.`);
    console.log(`Upserted ${activityUpserts} recruiter_candidate_activity rows.`);
    console.log(`Updated daily_activity for ${dailyTotals.size} recruiter/day combinations.`);
    console.log('Recruiter passwords for new users set to:', PASSWORD_PLAINTEXT);
  } catch (error) {
    await client.query('ROLLBACK').catch(() => {});
    console.error('Import failed:', error);
    process.exitCode = 1;
  } finally {
    await client.end().catch(() => {});
  }
})();
