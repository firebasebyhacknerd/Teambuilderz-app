# Environment Setup Instructions

## Required Environment Variables

Create a `.env` file in the root directory with the following variables:

```env
# Database Configuration
DB_USER=teambuilderz_user
DB_PASSWORD=teambuilderz_password
DB_NAME=teambuilderz
DB_HOST=localhost
DB_PORT=5432

# JWT Secret for authentication
JWT_SECRET=your_super_secret_jwt_key_here_change_in_production

# Seed Users (optional — provide your own secure credentials)
# ADMIN_EMAIL=admin@example.com
# ADMIN_PASSWORD=change_me
# ADMIN_NAME=Operations Admin
# RECRUITER_EMAIL=recruiter@example.com
# RECRUITER_PASSWORD=change_me
# RECRUITER_NAME=Lead Recruiter

# Application Ports
BACKEND_PORT=3001
FRONTEND_PORT=3000
```

## Quick Start Commands

1. **Install Dependencies:**
   ```bash
   # Backend
   cd backend
   npm install
   
   # Frontend
   cd ../frontend
   npm install
   ```

2. **Run with Docker (Recommended):**
   ```bash
   # From root directory
   docker-compose up --build
   ```

3. **Run in Development Mode:**
   ```bash
   # Terminal 1 - Backend
   cd backend
   npm run dev
   
   # Terminal 2 - Frontend
   cd frontend
   npm run dev
   ```

## Access URLs

- **Frontend:** http://localhost:3000
- **Backend API:** http://localhost:3001
- **Accounts:** Create your own admin/recruiter users by setting the optional seed environment variables above or by inviting users from the admin console.

## Features

✅ User Authentication & Authorization
✅ Admin Dashboard with Performance Metrics
✅ Recruiter Dashboard with Candidate Management
✅ Candidate Detail Pages with Edit Functionality
✅ Responsive UI with Tailwind CSS
✅ Docker Containerization
✅ PostgreSQL Database Integration
