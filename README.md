# TeamBuilderz Application

TeamBuilderz is a full-stack staffing operations platform that helps recruiters and admins manage candidates, applications, interviews, assessments, and operational alerts in one place. The project is split into a Node.js/Express backend (API + automation jobs) and a Next.js frontend UI.

---

## Tech Stack & Tools

| Layer        | Technology                            | Notes                                                |
|--------------|----------------------------------------|------------------------------------------------------|
| Backend      | Node.js, Express, PostgreSQL, `pg`     | REST API, JWT authentication, background schedulers |
| Frontend     | Next.js 14 (React 18), Tailwind CSS    | Admin & Recruiter dashboards                         |
| Auth & Crypto| JSON Web Tokens, `bcryptjs`            | Password hashing, role-based access                  |
| Scheduling   | Node timers (`setInterval`)            | Quota/assessment/interview checks                    |
| Tooling      | npm, dotenv                            | Dependency management, environment configuration     |

> Recommended to install: **Node.js 18+**, **npm 8+**, **PostgreSQL 14+**, **Git**. Docker is optional if you prefer containerized services.

---

## Repository Structure

```
.
├── backend/                 # Express API + automation jobs
│   ├── package.json
│   ├── server.js            # Main application entry point
│   └── .env                 # Backend environment variables (sample provided)
├── frontend/                # Next.js application
│   ├── package.json
│   ├── next.config.js
│   └── .env                 # Frontend environment variables (sample provided)
└── README.md
```

---

## Quick Start

1. **Clone the repository**
   ```bash
   git clone https://github.com/<your-org>/Teambuilderz-app.git
   cd Teambuilderz-app
   ```

2. **Install dependencies**
   ```bash
   npm install --prefix backend
   npm install --prefix frontend
   ```

3. **Prepare PostgreSQL**
   ```sql
   CREATE DATABASE teambuilderz;
   CREATE USER teambuilderz_user WITH PASSWORD 'teambuilderz_password';
   GRANT ALL PRIVILEGES ON DATABASE teambuilderz TO teambuilderz_user;
   ```

4. **Configure environment variables**
   - Copy `backend/.env` and `frontend/.env` to your own versions (or edit in place).
   - Important backend variables:
     ```env
     DB_HOST=localhost
     DB_PORT=5432
     DB_NAME=teambuilderz
     DB_USER=teambuilderz_user
     DB_PASSWORD=teambuilderz_password
     JWT_SECRET=your_super_secret_jwt_key_here_change_in_production
     BACKEND_PORT=3001
     ```
   - Important frontend variables:
     ```env
     NEXT_PUBLIC_API_URL=http://localhost:3001
     ```
   - Optional security/env hardening toggles:
     ```env
     ENFORCE_TLS=true                 # Redirect HTTP → HTTPS (requires proxy that sets X-Forwarded-Proto)
     COOKIE_SECURE=true               # Force secure cookies even outside NODE_ENV=production
     COOKIE_SAMESITE=strict           # Adjust SameSite policy if embedding in iframes
     SECRETS_FILE=./secrets/local.json# JSON file with key/value overrides (kept out of version control)
     AUDIT_LOG_PATH=logs/audit.log    # Local file to mirror audit events
     AUDIT_WEBHOOK_URL=https://hooks.slack.com/...  # Optional webhook for audit streaming
     AUDIT_CW_LOG_GROUP=teambuilderz/audit          # CloudWatch Logs group (optional)
     AUDIT_CW_LOG_STREAM=backend                    # CloudWatch stream to append to
     AUDIT_CW_REGION=us-east-1                      # Region for CloudWatch logs
     AUDIT_CW_ACCESS_KEY=...                        # Optional explicit AWS creds (otherwise use IAM role/env)
     AUDIT_CW_SECRET_KEY=...
     AUDIT_CW_SESSION_TOKEN=...
     ```
     Values defined in `SECRETS_FILE` take precedence over process env vars, making it easy to source secrets
     from Docker/K8s secret mounts without polluting `.env`.

     When `AUDIT_CW_*` variables are supplied, every `audit_logs` INSERT is mirrored to CloudWatch Logs (and still
     written locally/webhook if those sinks are configured). This creates a tamper-resistant history of approvals,
     rejections, and user changes that SecOps can monitor centrally.

5. **Run the backend**
   ```bash
   npm run dev --prefix backend   # Nodemon hot reload
   # or
   npm start --prefix backend     # Production-style start
   ```
   On first boot the API auto-creates required tables, enums, and default users if they do not already exist.

6. **Run the frontend**
   ```bash
   npm run dev --prefix frontend  # Next.js dev server on http://localhost:3000
   # or
   npm start --prefix frontend    # Production build (requires prior `npm run build`)
   ```

7. **Log in with default credentials**
   - Define secure admin/recruiter accounts via environment variables (`ADMIN_EMAIL`, `ADMIN_PASSWORD`, etc.) or invite users through the Admin → Team Management page after deployment.

---

## Detailed Installation Guide

### 1. Prerequisites

- **Node.js 18+** and **npm 8+** (LTS recommended)
- **PostgreSQL 14+** with network access on `localhost:5432`
- **Git** for source control
- Optional: **Docker Desktop** if you prefer containerized DB/services

Verify your tooling:
```bash
node -v   # should be >= 18
npm -v
psql --version  # if using the native CLI
```

### 2. Environment Setup

1. Create the PostgreSQL database and user (see Quick Start).
2. Update backend `.env` with the same credentials.
3. Update frontend `.env` so API requests point to the backend (`NEXT_PUBLIC_API_URL`).
4. Ensure ports `3000` (frontend) and `3001` (backend) are free; stop conflicting services (Docker Desktop uses these by default on Windows).

### 3. Dependency Installation

```bash
cd Teambuilderz-app
npm ci --prefix backend    # reproducible install (uses package-lock.json)
npm ci --prefix frontend
```

### 4. Database Bootstrapping

The backend automatically ensures enums, tables, indexes, and seed users when it starts. If you want to validate manually:
```bash
npm start --prefix backend
```
You should see logs such as “Connected to PostgreSQL!” and “Database tables already exist. Skipping initialization.”

### 5. Running the Stack

```bash
# Terminal 1 - API
npm run dev --prefix backend

# Terminal 2 - Frontend
npm run dev --prefix frontend

# Browser
open http://localhost:3000  # or: start http://localhost:3000 (Windows)
```

## Docker Compose & Auto-start

The repository ships with `docker-compose.yml` so you can run PostgreSQL, the API, and the frontend with one command:

```bash
# First time: ensure secrets/backend.local.json has your credentials.
docker compose up -d      # start everything (Postgres, backend, frontend)
docker compose down       # stop and remove the containers
```

Need HTTPS? Add `tbz_proxy` and point your browser to `https://localhost`:

```bash
docker compose up -d tbz_postgres tbz_backend tbz_frontend tbz_proxy
```

All services use `restart: unless-stopped`, so once Docker Desktop is running they will automatically resume.

On Windows you can fully automate container start-up with:

1. **Enable Docker Desktop auto-start**  
   Settings → General → ✅ *Start Docker Desktop when you log in*.
2. **Register a scheduled task that runs `docker compose up -d` after you sign in**  
   Open an elevated PowerShell prompt in the repo root and run:
   ```powershell
   $task = New-ScheduledTaskAction -Execute "powershell.exe" -Argument "-NoProfile -WindowStyle Hidden -Command `"cd `"$PWD`"; docker compose up -d`""
   Register-ScheduledTask -TaskName "TeamBuilderz Auto Start" -Action $task -Trigger (New-ScheduledTaskTrigger -AtLogOn) -RunLevel Highest
   ```
   The next time you log in, Docker Desktop will boot and the scheduled task will bring the stack up without manual clicks.

## Bulk recruiter application import

Historical recruiter/candidate submission totals can be backfilled via `backend/scripts/import_application_activity.js`. The script normalises names (case-insensitive), upserts the `recruiter_candidate_activity` table, and mirrors totals into the `applications` + `daily_activity` tables. To run it against the containers:

```bash
docker compose exec tbz_backend node scripts/import_application_activity.js
```

The job reads database credentials from `backend/.env`, so ensure that file matches the credentials defined in `docker-compose.yml` (it already defaults to the correct values for local Docker).

## Managing secrets with `SECRETS_FILE`

The backend now prefers loading credentials from a JSON blob pointed to by `SECRETS_FILE`. The compose file mounts `secrets/backend.local.json` into the container at `/run/secrets/tbz-backend.json` so nothing sensitive lives in the `.env` committed to Git.

1. Copy `secrets/backend.local.json` (already checked in with placeholders) or replace it with your own file:
   ```json
   {
     "DB_USER": "teambuilderz_user",
     "DB_PASSWORD": "super-secret",
     "DB_NAME": "teambuilderz",
     "JWT_SECRET": "change-me",
     "ADMIN_PASSWORD": "<set-your-admin-password>",
     "RECRUITER_PASSWORD": "<set-your-recruiter-password>"
   }
   ```
2. Ensure `docker-compose.yml` mounts it (already configured) and keep it out of version control if you add additional env files.
3. When deploying to Kubernetes/Swarm, mount the secret JSON to `/run/secrets/tbz-backend.json` and set `SECRETS_FILE` accordingly.

Environment variables still work, but `SECRETS_FILE` takes precedence so you can safely inject credentials through Docker/K8s secrets without editing `.env`.

## HTTPS reverse proxy (nginx)

The compose stack includes an optional `tbz_proxy` service (nginx) that terminates TLS, forwards `/api/*` to the backend, and everything else to the Next.js app. Steps:

1. Generate a dev certificate (for localhost):
   ```bash
   mkdir -p certs
   openssl req -x509 -newkey rsa:4096 -sha256 -days 825 \
     -nodes -keyout certs/dev.key -out certs/dev.crt \
     -subj "/CN=localhost"
   ```
   (macOS users can also run `mkcert localhost` and copy the files into `certs/`.)
2. Start the stack with the proxy:
   ```bash
   docker compose up -d tbz_postgres tbz_backend tbz_frontend tbz_proxy
   ```
3. Browse to `https://localhost` – nginx forwards `/api` calls to `tbz_backend:3001`, sets `X-Forwarded-Proto: https`, and the backend enforces TLS thanks to `ENFORCE_TLS=true`.

If you already have an external load balancer, reuse the nginx config under `ops/reverse-proxy/nginx.conf` as a template (ensure it forwards `X-Forwarded-Proto` and `X-Forwarded-For`).
When you serve the frontend through the proxy, build it with `NEXT_PUBLIC_API_URL=https://localhost/api` so browser calls align with the TLS endpoint.

## Audit logging & monitoring

Every create/update/delete event already lands in the `audit_logs` table. The new audit streaming layer mirrors those rows to stdout, optional log files, Slack/webhooks, and AWS CloudWatch Logs:

1. Create the CloudWatch group/stream once:
   ```bash
   aws logs create-log-group --log-group-name teambuilderz/audit
   aws logs create-log-stream --log-group-name teambuilderz/audit --log-stream-name backend
   ```
2. Populate the `AUDIT_CW_*` variables (or grant the container an IAM role with permissions). The backend will call `PutLogEvents` for every audit row.
3. (Optional) Add a metric filter / alarm to alert on high-risk events:
   ```bash
   aws logs put-metric-filter \
     --log-group-name teambuilderz/audit \
     --filter-name audit-rejects \
     --filter-pattern '"submission_rejected"' \
     --metric-transformations \
       metricName=AuditRejects,metricNamespace=TeamBuilderz,metricValue=1
   aws cloudwatch put-metric-alarm --alarm-name "High approval rejects" \
     --metric-name AuditRejects --namespace TeamBuilderz \
     --statistic Sum --period 300 --threshold 5 \
     --comparison-operator GreaterThanThreshold --evaluation-periods 1 \
     --alarm-actions <sns-topic-arn>
   ```

This pairing (database + CloudWatch) gives SecOps a tamper-resistant stream they can query in Athena or wire into dashboards.

### 6. Building for Production

```bash
npm run build --prefix frontend
npm start --prefix frontend  # serves the built Next.js app
```

The backend can be PM2/forever managed; for local prod parity use:
```bash
NODE_ENV=production npm start --prefix backend
```

---

## Common Issues & Troubleshooting

| Symptom                                        | Likely Cause & Fix                                                                 |
|------------------------------------------------|-------------------------------------------------------------------------------------|
| `EADDRINUSE: address already in use :::3000`   | Another process (often Docker Desktop/WSL) is using the port. Stop it or change `PORT`. |
| `password authentication failed for user …`    | PostgreSQL user/password mismatch. Verify credentials or create the expected role. |
| `relation "daily_activity" does not exist`     | Schema wasn’t initialized. Re-run backend start to auto-create tables.              |
| Frontend “Failed to fetch” on login            | `NEXT_PUBLIC_API_URL` not pointing to reachable backend (or backend down).          |
| Blank pages / build errors after updates       | Clear `.next/` (`rimraf frontend/.next`) and rebuild.                               |

---

## Testing & Quality

- No automated tests are currently defined (`npm test` exits with a placeholder message). Add Jest/Mocha for API and React Testing Library/Cypress for UI as needed.
- ESLint and TypeScript checks can be introduced to harden code quality.

---

## Contributing & Next Steps

1. Fork the repository and clone locally.
2. Create a feature branch (`git checkout -b feature/my-update`).
3. Commit with descriptive messages.
4. Run the frontend and backend to verify no regressions.
5. Submit a pull request describing changes and testing performed.

Suggested enhancements:
- Add migrations (using `sequelize-cli` or `knex`) to track schema changes.
- Containerize with Docker Compose for reproducible environments.
- Wire up automated tests and CI for pull requests.

---

## Support

If you encounter setup issues:
- Confirm environment variables and database connectivity.
- Check server logs in the backend terminal.
- Reach out to the TeamBuilderz engineering channel with log excerpts and steps taken.

Happy building! 🚀
