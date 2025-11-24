# Schema Mismatch Scan Report

## Summary

Found **1 critical schema mismatch** in the backend that will cause runtime errors similar to the PDF export issues.

---

## Critical Issues Found

### 1. ⚠️ **auditRoutes.js - Column Name Mismatches**

**File:** `backend/routes/auditRoutes.js`

**Issue:** Routes reference non-existent columns in `audit_logs` table

**Actual Schema (server.js:481-492):**

```sql
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
```

**Problematic Queries:**

| Line    | Issue                                  | Expected Column                                       | Used Column                                           | Fix                       |
| ------- | -------------------------------------- | ----------------------------------------------------- | ----------------------------------------------------- | ------------------------- |
| 45-46   | INSERT references non-existent columns | `table_name`, `record_id`, `old_values`, `new_values` | `resource_type`, `resource_id`, `changes`, `metadata` | Use actual schema columns |
| 105     | SELECT filters on non-existent column  | `table_name`                                          | `resource_type`                                       | Change to `table_name`    |
| 191-192 | SELECT references non-existent columns | `table_name`, `record_id`, `old_values`, `new_values` | `resource_type`, `resource_id`, `changes`             | Update SELECT list        |
| 241     | SELECT filters on non-existent column  | `table_name`                                          | `resource_type`                                       | Change to `table_name`    |

**Error Messages When Triggered:**

```
ERROR: column "resource_type" does not exist
ERROR: column "resource_id" does not exist
ERROR: column "changes" does not exist
ERROR: column "metadata" does not exist
```

**Affected Endpoints:**

- `POST /api/v1/audit/log` - Will fail on INSERT
- `GET /api/v1/audit/logs` - Will fail on filtering
- `GET /api/v1/audit/user/:userId/activity` - Will fail on SELECT
- `GET /api/v1/audit/stats` - Will fail on grouping
- `GET /api/v1/audit/export` - Will fail on SELECT

---

## Verified as Correct ✅

The following queries were verified and are using correct schema columns:

- **pdfRoutes.js** - All fixed (attendance_entries, assigned_recruiter_id, current_stage, application_date, scheduled_date, interview_type)
- **server.js** - Candidates, Applications, Interviews, Assessments endpoints all use correct columns
- **server.js** - Performance reports use correct daily_activity columns
- **server.js** - Overview reports use correct schema

---

## Recommended Fixes

### Fix auditRoutes.js

Map the intended functionality to actual schema:

| Intended Use    | Actual Column               | Notes                                        |
| --------------- | --------------------------- | -------------------------------------------- |
| `resource_type` | `table_name`                | Name of the table affected                   |
| `resource_id`   | `record_id`                 | ID of the record affected                    |
| `changes`       | `old_values` + `new_values` | Store as separate JSONB fields               |
| `metadata`      | Not in schema               | Remove or store in `old_values`/`new_values` |

**Priority:** HIGH - These endpoints will crash when called

---

## Implementation Status

- ✅ PDF Export Errors - FIXED
- ⚠️ Audit Routes - NEEDS FIX
- ✅ All other routes - VERIFIED
