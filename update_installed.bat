@echo off
chcp 65001 >nul
title ARN Stream - Update Installed Version
color 0b

echo ==========================================================
echo   ARN Stream - Update Installed Version
echo   Developer: Abdou Ragab Nassar - ARN Technology
echo ==========================================================
echo.

:: Check for Administrator privileges
net session >nul 2>&1
if %errorLevel% neq 0 (
    echo [i] Requesting Administrator privileges...
    echo     جاري طلب صلاحيات المسؤول لتحديث البرنامج...
    echo.
    powershell -NoProfile -ExecutionPolicy Bypass -Command "Start-Process powershell.exe -ArgumentList @('-NoProfile', '-ExecutionPolicy', 'Bypass', '-NoExit', '-File', '%~dp0scripts\update_installed.ps1') -Verb RunAs"
    exit /b
)

:: If already running as Administrator:
powershell -NoProfile -ExecutionPolicy Bypass -NoExit -File "%~dp0scripts\update_installed.ps1"
