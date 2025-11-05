# PowerShell script to start the backend server with environment variables
$env:JWT_SECRET="your_super_secret_jwt_key_here_change_in_production"
$env:DB_USER="teambuilderz_user"
$env:DB_PASSWORD="teambuilderz_password"
$env:DB_NAME="teambuilderz"
$env:DB_HOST="localhost"
$env:DB_PORT="5432"
# Optional: set ADMIN_EMAIL/ADMIN_PASSWORD or RECRUITER_EMAIL/RECRUITER_PASSWORD before running
# if you want the backend to seed initial users automatically.

Write-Host "Starting TeamBuilderz Backend Server..."
Write-Host "Environment variables set successfully!"
Write-Host "Server will be available at: http://localhost:3001"
Write-Host ""

node server.js

