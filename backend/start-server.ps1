# PowerShell script to start the backend server with environment variables
$env:JWT_SECRET="your_super_secret_jwt_key_here_change_in_production"
$env:DB_USER="teambuilderz_user"
$env:DB_PASSWORD="teambuilderz_password"
$env:DB_NAME="teambuilderz"
$env:DB_HOST="localhost"
$env:DB_PORT="5432"
$env:ADMIN_PASSWORD="admin123"
$env:RECRUITER_PASSWORD="recruit123"

Write-Host "Starting TeamBuilderz Backend Server..."
Write-Host "Environment variables set successfully!"
Write-Host "Server will be available at: http://localhost:3001"
Write-Host ""

node server.js

