@echo off
echo ========================================
echo KHOI DONG TECH STORE
echo ========================================
echo.

REM Kiem tra Node.js
where node >nul 2>nul
if %ERRORLEVEL% NEQ 0 (
    echo [ERROR] Node.js chua duoc cai dat!
    echo Vui long cai dat Node.js tu: https://nodejs.org/
    pause
    exit /b 1
)

echo [OK] Node.js: 
node --version
echo.

REM Kiem tra backend dependencies
if not exist "backend\node_modules" (
    echo [SETUP] Cai dat backend dependencies...
    cd backend
    call npm install
    cd ..
    echo.
)

REM Kiem tra frontend dependencies
if not exist "frontend\node_modules" (
    echo [SETUP] Cai dat frontend dependencies...
    cd frontend
    call npm install
    cd ..
    echo.
)

REM Kiem tra file .env
if not exist "backend\.env" (
    echo [WARNING] File backend\.env khong ton tai!
    echo Vui long tao file .env tu .env.example
    pause
    exit /b 1
)

echo ========================================
echo DANG KHOI DONG SERVERS...
echo ========================================
echo.
echo [BACKEND]  http://localhost:5000
echo [FRONTEND] http://localhost:3000
echo.
echo Nhan Ctrl+C de dung servers
echo ========================================
echo.

REM Khoi dong backend (background)
start "Tech Store Backend" cmd /k "cd backend && npm run dev"

REM Doi 3 giay
timeout /t 3 /nobreak >nul

REM Khoi dong frontend
start "Tech Store Frontend" cmd /k "cd frontend && npm start"

echo.
echo [OK] Servers dang chay!
echo Trinh duyet se tu dong mo trong giay lat...
echo.
pause
