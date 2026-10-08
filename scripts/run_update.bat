@echo off
chcp 65001 >nul
title ARN Stream - Update Installed Version
color 0b

echo ==========================================================
echo      ARN Stream - Update Installed Version
echo      Developer: Abdou Ragab Nassar (ARN Technology)
echo ==========================================================
echo.

powershell -NoProfile -ExecutionPolicy Bypass -NoExit -File "%~dp0update_installed.ps1"

pause
