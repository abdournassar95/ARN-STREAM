@echo off
setlocal enabledelayedexpansion
chcp 65001 >nul
title ARN Stream - Development Environment

:: 1. ابحث عن Node.js (النظامي أولاً ثم المدمج)
where node >nul 2>&1
if %errorlevel% equ 0 (
    set "NODE_EXE=node"
) else (
    set "NODE_EXE=C:\Program Files\ARN Stream\bin\node.exe"
    if not exist "!NODE_EXE!" (
        echo [X] لم يتم العثور على Node.js في النظام أو في مسار البرنامج المثبت.
        pause
        exit /b 1
    )
)

echo ==========================================================
echo   ARN Stream - Development Server (Server + Frontend)
echo   Developer: Abdou Ragab Nassar - ARN Technology
echo ==========================================================
echo.

:: 2. فحص وتحرير المنفذين 8096 و 5173 إذا كانا محجوزين
for /f "tokens=5" %%p in ('netstat -aon 2^>nul ^| findstr /r ":8096[ ]"') do (
    if "%%p" neq "0" (
        echo [i] جارٍ تحرير المنفذ 8096 من العملية السابقة (PID: %%p)...
        taskkill /F /PID %%p >nul 2>&1
    )
)
for /f "tokens=5" %%p in ('netstat -aon 2^>nul ^| findstr /r ":5173[ ]"') do (
    if "%%p" neq "0" (
        echo [i] جارٍ تحرير المنفذ 5173 من العملية السابقة (PID: %%p)...
        taskkill /F /PID %%p >nul 2>&1
    )
)

echo [1/2] تشغيل خادم الباك إند (Port: 8096)...
start "ARN Stream Server [Backend]" /d "%~dp0server" cmd /k ""!NODE_EXE!" index.js"

echo [2/2] تشغيل واجهة التطوير الحية (Vite Frontend على Port: 5173)...
echo.
echo 💡 ملحوظة مهمة: افتح المتصفح على رابط التطوير: http://localhost:5173
echo.
cd /d "%~dp0client"
if exist "node_modules\vite\bin\vite.js" (
    "!NODE_EXE!" "node_modules\vite\bin\vite.js" --port 5173 --host
) else (
    call npm run dev
)
