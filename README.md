codex# TeamBuilderz Application

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
   - Admin: `admin@tbz.us / admin123`
   - Recruiter: `sarthi@tbz.us / recruit123`

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
