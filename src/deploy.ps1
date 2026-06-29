Write-Host "========================================" -ForegroundColor Cyan
Write-Host "BUILDING TECH STORE FOR DEPLOYMENT" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Check Node.js
$nodeVersion = node --version 2>$null
if (-not $nodeVersion) {
    Write-Host "[ERROR] Node.js chưa được cài đặt!" -ForegroundColor Red
    exit 1
}
Write-Host "[OK] Node.js: $nodeVersion" -ForegroundColor Green

# Build Frontend
Write-Host "`n[1/5] Building Frontend..." -ForegroundColor Yellow
Set-Location frontend
if (-not (Test-Path "node_modules")) {
    Write-Host "Installing frontend dependencies..." -ForegroundColor Yellow
    npm install
}
npm run build
if (-not $?) {
    Write-Host "[ERROR] Frontend build failed!" -ForegroundColor Red
    exit 1
}
Write-Host "[OK] Frontend built successfully!" -ForegroundColor Green

# Copy build to backend
Write-Host "`n[2/5] Copying build to backend..." -ForegroundColor Yellow
if (Test-Path "../backend/build") {
    Remove-Item "../backend/build" -Recurse -Force
}
Copy-Item -Path "build" -Destination "../backend/build" -Recurse
Write-Host "[OK] Build copied!" -ForegroundColor Green

# Copy images to backend/public
Write-Host "`n[3/5] Copying images..." -ForegroundColor Yellow
if (-not (Test-Path "../backend/public")) {
    New-Item -Path "../backend/public" -ItemType Directory | Out-Null
}
if (Test-Path "public/img") {
    Copy-Item -Path "public/img" -Destination "../backend/public/img" -Recurse -Force
    Write-Host "[OK] Images copied!" -ForegroundColor Green
} else {
    Write-Host "[SKIP] No images found in frontend/public/img" -ForegroundColor Yellow
}

# Install backend dependencies
Write-Host "`n[4/5] Checking backend dependencies..." -ForegroundColor Yellow
Set-Location ../backend
if (-not (Test-Path "node_modules")) {
    Write-Host "Installing backend dependencies..." -ForegroundColor Yellow
    npm install
}
Write-Host "[OK] Backend ready!" -ForegroundColor Green

# Create production env reminder
Write-Host "`n[5/5] Final checks..." -ForegroundColor Yellow
if (-not (Test-Path ".env")) {
    Write-Host "[WARNING] Backend .env file not found!" -ForegroundColor Red
    Write-Host "Please create .env file with production settings" -ForegroundColor Yellow
} else {
    Write-Host "[OK] .env file exists" -ForegroundColor Green
}

# Summary
Write-Host "`n========================================" -ForegroundColor Cyan
Write-Host "BUILD COMPLETED SUCCESSFULLY!" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "Next steps:" -ForegroundColor Cyan
Write-Host "1. Update backend/.env with production settings" -ForegroundColor White
Write-Host "2. Run: cd backend && npm start" -ForegroundColor White
Write-Host "3. Access: http://your-ip:5000" -ForegroundColor White
Write-Host ""
Write-Host "For detailed instructions, see DEPLOYMENT_GUIDE.md" -ForegroundColor Yellow
Write-Host ""
pause
