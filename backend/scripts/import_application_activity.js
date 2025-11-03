#!/usr/bin/env node

/**
 * Bulk importer for recruiter/candidate application activity derived from a raw text dump.
 * Normalises names (case-insensitive, fixes aliases) and upserts both the
 * recruiter_candidate_activity table (per candidate) and daily_activity (per recruiter).
 */

const path = require('path');
const { Client } = require('pg');
const dotenv = require('dotenv');

dotenv.config({ path: path.resolve(__dirname, '../.env') });

const RAW_DATA = `
09/23/2025 Kartavya Janvi Pandey 71
09/23/2025 Kartavya Jaydev Joshi 59
09/23/2025 Satyam Subhash 60
09/23/2025 Satyam Smit 60
09/23/2025 Pawan Dhanalakshmi Nangunuri 60
09/23/2025 Pawan Jhanvi Jhariwala 80
09/23/2025 Pawan Sai Krishna Singireddy 60
09/23/2025 Pawan Anusha Bura 60
09/24/2025 Kartavya Janvi Pandey 70
09/24/2025 Kartavya Jaydev Joshi 56
09/24/2025 Satyam Subhash Nakka 40
09/24/2025 Satyam Smit Panchal 100
09/24/2025 Pawan Jhanvi Jhariwala 70
09/24/2025 Pawan Anusha Bura 70
09/24/2025 Pawan Sai Krishna Singireddy 80
09/24/2025 Pawan Dhanalakshmi Nangunuri 70
09/25/2025 Pawan Jhanvi Jhariwala 80
09/25/2025 Pawan Dhanalakshmi Nangunuri 50
09/25/2025 Pawan Anusha Bura 70
09/25/2025 Pawan Sai Krishna Singireddy 60
09/25/2025 Satyam Subhash Nakka 50
09/25/2025 Satyam Smit Panchal 70
09/26/2025 Satyam Smit Panchal 60
09/26/2025 Satyam Subhash Nakka 55
09/26/2025 Kartavya Janvi Pandey 60
09/26/2025 Pawan Sai Krishna Singireddy 60
09/26/2025 Pawan Jhanvi Jhariwala 70
09/26/2025 Pawan Anusha Bura 60
09/26/2025 Pawan Dhanalakshmi Nangunuri 50
09/27/2025 Kartavya Dhanalakshmi Nangunuri 57
09/28/2025 Kartavya Sai Krishna Singireddy 59
09/28/2025 Kartavya Jhanvi Jhariwala 85
09/28/2025 Kartavya Anusha Bura 67
09/28/2025 Kartavya Dhanalakshmi Nangunuri 52
09/29/2025 Satyam Smit Panchal 60
09/29/2025 Satyam Subhash Nakka 75
09/30/2025 Satyam Sai Krishna Singireddy 75
09/30/2025 Satyam Smit Panchal 60
09/30/2025 Satyam Subhash Nakka 75
09/30/2025 Pawan Dhanalakshmi Nangunuri 70
09/30/2025 Kartavya Jhanvi Jhariwala 60
09/30/2025 Kartavya Anusha Bura 80
10/01/2025 Kartavya Jhanvi Jhariwala 50
10/01/2025 Kartavya Anusha Bura 83
10/01/2025 Kartavya Janavi Pandey 40
10/02/2025 Pawan Jhanvi Jhariwala 60
10/02/2025 Pawan Anusha Bura 70
10/02/2025 Satyam Subhash Nakka 80
10/02/2025 Satyam Smit Panchal 70
10/02/2025 Kartavya Janavi Pandey 51
10/02/2025 Kartavya Dhanalakshmi Nangunuri 57
10/02/2025 Kartavya Sai Krishna Singireddy 70
10/03/2025 Satyam Smit Panchal 50
10/03/2025 Satyam Subhash Nakka 80
10/03/2025 Pawan Jhanvi Jhariwala 80
10/03/2025 Pawan Jaydev Joshi 60
10/03/2025 Kartavya Dhanalakshmi Nangunuri 82
10/03/2025 Kartavya Sai Krishna Singireddy 97
10/03/2025 Kartavya Janvi Pandey 45
10/04/2025 Pawan Jhanvi Jhariwala 80
10/04/2025 Pawan Jaydev Joshi 70
10/04/2025 Kartavya Sai Krishna Singireddy 74
10/04/2025 Kartavya Dhanalakshmi Nangunuri 78
10/04/2025 Kartavya Janavi Pandey 81
10/04/2025 Satyam Subhash Nakka 120
10/04/2025 Satyam Smit Panchal 40
10/06/2025 Satyam Smit Panchal 50
10/06/2025 Satyam Subhash Nakka 90
10/06/2025 Pawan Jhanvi Jhariwala 90
10/06/2025 Pawan Jaydev Joshi 80
10/06/2025 Kartavya Janvi Pandey 80
10/06/2025 Kartavya Sai Krishna Singireddy 85
10/06/2025 Kartavya Dhanalakshmi Nangunuri 97
10/07/2025 Kartavya Dhanalakshmi Nangunuri 100
10/07/2025 Kartavya Sai Krishna Singireddy 100
10/07/2025 Kartavya Janvi Pandey 100
10/07/2025 Satyam Subhash Nakka 80
10/07/2025 Pawan Jhanvi Jhariwala 95
10/07/2025 Pawan Jaydev Joshi 80
10/08/2025 Satyam Subhash Nakka 80
10/08/2025 Satyam Smit Panchal 85
10/08/2025 Kartavya Sai Krishna Singireddy 82
10/08/2025 Kartavya Dhanalakshmi Nangunuri 80
10/08/2025 Pawan Jhanvi Jhariwala 90
10/08/2025 Pawan Jaydev Joshi 80
10/09/2025 Kartavya Janavi Pandey 95
10/09/2025 Kartavya Sai Krishna Singireddy 96
10/09/2025 Kartavya Dhanalakshmi Nangunuri 93
10/09/2025 Pawan Jhanvi Jhariwala 120
10/09/2025 Pawan Jaydev Joshi 95
10/09/2025 Satyam Subhash Nakka 100
10/09/2025 Satyam Smit Panchal 60
11/09/2025 Kartavya Sai Krishna Singireddy 92
11/09/2025 Kartavya Janvi Pandey 80
11/09/2025 Kartavya Dhanalakshmi Nangunuri 99
10/10/2025 Pawan Jhanvi Jhariwala 110
10/10/2025 Pawan Jaydev Joshi 90
10/10/2025 Satyam Subhash Nakka 150
10/11/2025 Pawan Jhanvi Jhariwala 90
10/11/2025 Pawan Jaydev Joshi 60
10/11/2025 Satyam Subhash Nakka 100
10/11/2025 Kartavya Janvi Pandey 70
10/11/2025 Kartavya Sai Krishna Singireddy 84
10/11/2025 Kartavya Dhanalakshmi Nangunuri 50
10/13/2025 Pawan Jhanvi Jhariwala 130
10/13/2025 Pawan Jaydev Joshi 70
10/13/2025 Kartavya Dhanalakshmi Nangunuri 83
10/13/2025 Kartavya Sai Krishna Singireddy 82
10/13/2025 Kartavya Janvi Pandey 80
10/14/2025 Pawan Jhanvi Jhariwala 130
10/14/2025 Pawan Jaydev Joshi 70
10/14/2025 Kartavya Janvi Pandey 79
10/14/2025 Kartavya Sai Krishna Singireddy 86
10/14/2025 Kartavya Dhanalakshmi Nangunuri 88
10/15/2025 Satyam Dhanalakshmi Nangunuri 55
10/15/2025 Satyam Sai Krishna Singireddy 60
10/15/2025 Satyam Janvi Pandey 50
10/15/2025 Satyam Subhash Nakka 55
10/15/2025 Pawan Jhanvi Jhariwala 60
10/16/2025 Kartavya Janvi Pandey 25
10/16/2025 Kartavya Sai Krishna Singireddy 80
10/16/2025 Kartavya Dhanalakshmi Nangunuri 80
10/16/2025 Satyam Subhash Nakka 150
10/16/2025 Pawan Jhanvi Jhariwala 80
10/17/2025 Kartavya Sai Krishna Singireddy 80
10/17/2025 Kartavya Dhanalakshmi Nangunuri 80
10/17/2025 Satyam Subhash Nakka 100
10/17/2025 Pawan Jhanvi Jhariwala 80
10/27/2025 Kartavya Dhanalakshmi Nangunuri 80
10/27/2025 Kartavya Sai Krishna Singireddy 80
10/27/2025 Kartavya Janvi Pandey 80
10/27/2025 Satyam Subhash Nakka 70
10/27/2025 Pawan Jhanvi Jhariwala 25
10/28/2025 Kartavya Dhanalakshmi Nangunuri 80
10/28/2025 Kartavya Sai Krishna Singireddy 80
10/28/2025 Kartavya Janvi Pandey 80
10/28/2025 Satyam Subhash Nakka 90
10/28/2025 Pawan Jhanvi Jhariwala 95
10/28/2025 Pawan Jaydev Joshi 70
10/29/2025 Kartavya Dhanalakshmi Nangunuri 80
10/29/2025 Kartavya Sai Krishna Singireddy 80
10/29/2025 Kartavya Janvi Pandey 80
10/29/2025 Pawan Jaydev Joshi 90
10/29/2025 Pawan Jhanvi Jhariwala 140
10/29/2025 Satyam Subhash Nakka 80
10/30/2025 Kartavya Dhanalakshmi Nangunuri 50
10/30/2025 Kartavya Sai Krishna Singireddy 85
10/30/2025 Kartavya Janvi Pandey 25
10/30/2025 Pawan Jhanvi Jhariwala 90
10/30/2025 Satyam Subhash Nakka 70
10/31/2025 Kartavya Dhanalakshmi Nangunuri 80
10/31/2025 Kartavya Sai Krishna Singireddy 75
10/31/2025 Kartavya Janvi Pandey 80
10/31/2025 Pawan Jhanvi Jhariwala 90
10/31/2025 Pawan Jaydev Joshi 70
10/31/2025 Satyam Subhash Nakka 80
`.trim();

const recruiterAliasMap = new Map([
  ['kartavya', 'Kartavya Sonariya'],
  ['satyam', 'Satyam Mahajan'],
  ['pawan', 'Pawan Yadav'],
]);

const candidateCanonicals = [
  { canonical: 'Anusha Bura', aliases: ['anusha', 'anusha bura'] },
  {
    canonical: 'Dhanalakshmi Nangunuri',
    aliases: ['dhanalakshmi', 'dhanalakshmi nangunuri'],
  },
  {
    canonical: 'Janvi Pandey',
    aliases: ['janvi', 'janvi pandey', 'janavi pandey', 'janavi'],
  },
  {
    canonical: 'Jaydev Joshi',
    aliases: ['jaydev', 'jaydev joshi'],
  },
  {
    canonical: 'Jhanvi Jhariwala',
    aliases: ['jhanvi', 'jhanvi jhariwala'],
  },
  {
    canonical: 'Sai Krishna Singireddy',
    aliases: ['sai', 'sai krishna', 'sai krishna singireddy'],
  },
  {
    canonical: 'Smit Panchal',
    aliases: ['smit', 'smit panchal'],
  },
  {
    canonical: 'Subhash Nakka',
    aliases: ['subhash', 'subhash nakka'],
  },
];

const BULK_CHANNEL = 'Bulk Import';
const BULK_COMPANY_PREFIX = 'Bulk Import';
const BULK_JOB_TITLE_PREFIX = 'Imported Application Batch';

function toIsoDate(dateStr) {
  const [month, day, year] = dateStr.split('/');
  if (!month || !day || !year) {
    throw new Error(`Invalid date format: ${dateStr}`);
  }
  return `${year.padStart(4, '0')}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
}

function normaliseWhitespace(value) {
  return value.replace(/\s+/g, ' ').trim();
}

(async () => {
  const client = new Client({
    host: process.env.DB_HOST,
    port: process.env.DB_PORT,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
  });

  const summary = {
    totalRecords: 0,
    dailyTotals: new Map(),
    activityInserts: 0,
    activityUpdates: 0,
    applicationInserts: 0,
    applicationUpdates: 0,
  };

  try {
    await client.connect();

    await client.query(`
      CREATE TABLE IF NOT EXISTS recruiter_candidate_activity (
        id SERIAL PRIMARY KEY,
        recruiter_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
        candidate_id INTEGER REFERENCES candidates(id) ON DELETE CASCADE,
        activity_date DATE NOT NULL,
        applications_count INTEGER NOT NULL,
        created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(recruiter_id, candidate_id, activity_date)
      )
    `);

    const recruiterRes = await client.query(
      `SELECT id, name FROM users WHERE role = 'Recruiter'`
    );
    const recruiterLookup = new Map();

    recruiterRes.rows.forEach((row) => {
      recruiterLookup.set(row.name.toLowerCase(), row);
      const firstName = row.name.split(' ')[0].toLowerCase();
      recruiterLookup.set(firstName, row);
    });

    const candidateRes = await client.query(`SELECT id, name FROM candidates`);
    const candidateLookup = new Map();

    // Ensure canonical naming for candidates and build alias map.
    for (const entry of candidateCanonicals) {
      const canonicalLower = entry.canonical.toLowerCase();

      let record =
        candidateRes.rows.find((row) => row.name.toLowerCase() === canonicalLower) ||
        candidateRes.rows.find((row) => entry.aliases.includes(row.name.toLowerCase()));

      if (!record) {
        throw new Error(
          `Candidate "${entry.canonical}" (aliases: ${entry.aliases.join(', ')}) not found in database.`
        );
      }

      if (record.name !== entry.canonical) {
        await client.query(
          `
            UPDATE candidates
            SET name = $1,
                updated_at = CURRENT_TIMESTAMP
            WHERE id = $2
          `,
          [entry.canonical, record.id]
        );
        record = { ...record, name: entry.canonical };
      }

      candidateLookup.set(canonicalLower, record);
      entry.aliases.forEach((alias) => {
        candidateLookup.set(alias, record);
      });
    }

    const lines = RAW_DATA.split(/\r?\n/)
      .map((line) => line.trim())
      .filter((line) => /^\d{2}\/\d{2}\/\d{4}/.test(line));

    const records = lines.map((line) => {
      const parts = line.split(/\s+/);
      const dateStr = parts.shift();
      const recruiterToken = parts.shift();
      const countToken = parts.pop();

      const candidateRaw = normaliseWhitespace(parts.join(' '));
      const dateIso = toIsoDate(dateStr);
      const count = Number.parseInt(countToken, 10);

      if (!Number.isInteger(count) || count < 0) {
        throw new Error(`Invalid application count "${countToken}" in line: ${line}`);
      }

      const recruiterKey = recruiterToken.toLowerCase();
      let recruiter = recruiterLookup.get(recruiterKey);

      if (!recruiter) {
        const mappedName = recruiterAliasMap.get(recruiterKey);
        if (!mappedName) {
          throw new Error(`Unknown recruiter "${recruiterToken}" in line: ${line}`);
        }
        recruiter = recruiterLookup.get(mappedName.toLowerCase());
        if (!recruiter) {
          throw new Error(`Recruiter "${mappedName}" not found in database.`);
        }
        recruiterLookup.set(recruiterKey, recruiter);
      }

      const candidateAlias = candidateRaw.toLowerCase();
      const candidateRecord =
        candidateLookup.get(candidateAlias) ||
        candidateLookup.get(normaliseWhitespace(candidateAlias));

      if (!candidateRecord) {
        throw new Error(`Candidate "${candidateRaw}" not recognised in line: ${line}`);
      }

      return {
        dateIso,
        recruiterId: recruiter.id,
        recruiterName: recruiter.name,
        candidateId: candidateRecord.id,
        candidateName: candidateRecord.name,
        count,
      };
    });

    await client.query('BEGIN');

    for (const record of records) {
      summary.totalRecords += 1;
      const key = `${record.recruiterId}::${record.dateIso}`;
      const currentTotal = summary.dailyTotals.get(key) || 0;
      summary.dailyTotals.set(key, currentTotal + record.count);

      const result = await client.query(
        `
          INSERT INTO recruiter_candidate_activity (
            recruiter_id,
            candidate_id,
            activity_date,
            applications_count
          )
          VALUES ($1, $2, $3, $4)
          ON CONFLICT (recruiter_id, candidate_id, activity_date)
          DO UPDATE SET
            applications_count = EXCLUDED.applications_count,
            updated_at = CURRENT_TIMESTAMP
          RETURNING xmax = 0 AS inserted
        `,
        [record.recruiterId, record.candidateId, record.dateIso, record.count]
      );

      if (result.rows[0]?.inserted) {
        summary.activityInserts += 1;
      } else {
        summary.activityUpdates += 1;
      }

      const companyName = `${BULK_COMPANY_PREFIX} - ${record.candidateName}`;
      const jobTitle = `${BULK_JOB_TITLE_PREFIX} (${record.dateIso})`;
      const jobDescription = `Imported aggregate submission total for ${record.candidateName} recorded on ${record.dateIso}.`;

      const existingApplication = await client.query(
        `
          SELECT id
          FROM applications
          WHERE recruiter_id = $1
            AND candidate_id = $2
            AND application_date = $3
            AND channel = $4
            AND company_name = $5
        `,
        [record.recruiterId, record.candidateId, record.dateIso, BULK_CHANNEL, companyName],
      );

      if (existingApplication.rows.length === 0) {
        await client.query(
          `
            INSERT INTO applications (
              candidate_id,
              recruiter_id,
              company_name,
              job_title,
              job_description,
              channel,
              status,
              application_date,
              applications_count
            )
            VALUES ($1, $2, $3, $4, $5, $6, 'sent', $7, $8)
          `,
          [
            record.candidateId,
            record.recruiterId,
            companyName,
            jobTitle,
            jobDescription,
            BULK_CHANNEL,
            record.dateIso,
            record.count,
          ],
        );
        summary.applicationInserts += 1;
      } else {
        await client.query(
          `
            UPDATE applications
            SET applications_count = $1,
                job_title = $2,
                job_description = $3,
                company_name = $4,
                updated_at = CURRENT_TIMESTAMP
            WHERE id = $5
          `,
          [record.count, jobTitle, jobDescription, companyName, existingApplication.rows[0].id],
        );
        summary.applicationUpdates += 1;
      }
    }

    for (const [key, totalCount] of summary.dailyTotals.entries()) {
      const [recruiterId, dateIso] = key.split('::');
      await client.query(
        `
          INSERT INTO daily_activity (user_id, activity_date, applications_count)
          VALUES ($1, $2, $3)
          ON CONFLICT (user_id, activity_date)
          DO UPDATE SET applications_count = EXCLUDED.applications_count
        `,
        [Number.parseInt(recruiterId, 10), dateIso, totalCount]
      );
    }

    await client.query('COMMIT');

    console.log('Import completed successfully.');
    console.log(`Processed ${summary.totalRecords} records.`);
    console.log(
      `Activity table upserts - inserted: ${summary.activityInserts}, updated: ${summary.activityUpdates}.`
    );
    console.log(
      `Applications table upserts - inserted: ${summary.applicationInserts}, updated: ${summary.applicationUpdates}.`
    );
    console.log(`Updated daily aggregates for ${summary.dailyTotals.size} recruiter/day combinations.`);
  } catch (error) {
    await client.query('ROLLBACK').catch(() => {});
    console.error('Import failed:', error.message);
    process.exitCode = 1;
  } finally {
    await client.end();
  }
})();
