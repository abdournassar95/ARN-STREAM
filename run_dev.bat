@echo off
chcp 65001 >nul
title ARN Stream - Development Environment

powershell.exe -NoExit -NoProfile -ExecutionPolicy Bypass -File "%~dp0run_dev.ps1"
if %errorlevel% neq 0 (
    echo.
    echo [X] Encountered an issue running PowerShell.
    pause
)
