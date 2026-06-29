# ========================================
# KHỞI ĐỘNG TECH STORE
# ========================================

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "KHỞI ĐỘNG TECH STORE" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Kiểm tra Node.js
$nodeVersion = node --version 2>$null
if (-not $nodeVersion) {
    Write-Host "[ERROR] Node.js chưa được cài đặt!" -ForegroundColor Red
    Write-Host "Vui lòng cài đặt từ: https://nodejs.org/" -ForegroundColor Yellow
    pause
    exit 1
}

Write-Host "[OK] Node.js: $nodeVersion" -ForegroundColor Green
Write-Host ""

# Kiểm tra backend dependencies
if (-not (Test-Path "backend\node_modules")) {
    Write-Host "[SETUP] Cài đặt backend dependencies..." -ForegroundColor Yellow
    Set-Location backend
    npm install
    Set-Location ..
    Write-Host ""
}

# Kiểm tra frontend dependencies
if (-not (Test-Path "frontend\node_modules")) {
    Write-Host "[SETUP] Cài đặt frontend dependencies..." -ForegroundColor Yellow
    Set-Location frontend
    npm install
    Set-Location ..
    Write-Host ""
}

# Kiểm tra file .env
if (-not (Test-Path "backend\.env")) {
    Write-Host "[WARNING] File backend\.env không tồn tại!" -ForegroundColor Yellow
    Write-Host "Vui lòng cấu hình OAuth credentials trong backend\.env" -ForegroundColor Yellow
    Write-Host "Xem hướng dẫn trong OAUTH_QUICKSTART.md" -ForegroundColor Cyan
    Write-Host ""
}

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "ĐANG KHỞI ĐỘNG SERVERS..." -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "[BACKEND]  http://localhost:5000" -ForegroundColor Green
Write-Host "[FRONTEND] http://localhost:3000" -ForegroundColor Green
Write-Host ""
Write-Host "Nhấn Ctrl+C để dừng servers" -ForegroundColor Yellow
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Khởi động backend
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$PSScriptRoot\backend' ; npm run dev"

# Đợi 3 giây
Start-Sleep -Seconds 3

# Khởi động frontend
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$PSScriptRoot\frontend' ; npm start"

Write-Host ""
Write-Host "[OK] Servers đang chạy!" -ForegroundColor Green
Write-Host "Trình duyệt sẽ tự động mở trong giây lát..." -ForegroundColor Cyan
Write-Host ""
Write-Host "Nhấn phím bất kỳ để đóng cửa sổ này..." -ForegroundColor Gray
pause
