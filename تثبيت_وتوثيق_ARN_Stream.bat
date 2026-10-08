@echo off
chcp 65001 >nul
title ARN Stream - مثبت وموثق الشهادة التلقائي (ARN Technology)

:: 1. Elevate to Administrator if not already elevated
net session >nul 2>&1
if %errorlevel% neq 0 (
    echo [ARN Technology] جاري طلب صلاحيات المسؤول لتوثيق الشهادة وتثبيت البرنامج...
    powershell -NoProfile -ExecutionPolicy Bypass -Command "Start-Process cmd -ArgumentList '/c \"\"%~f0\"\"' -Verb RunAs"
    exit /b
)

cd /d "%~dp0"

echo ==============================================================================
echo   ARN Stream - برنامج التثبيت الذكي وتخطي فحص Windows SmartScreen
echo   تطوير وبرمجة: عبده رجب نصار (ARN Technology)
echo ==============================================================================
echo.

:: 2. Remove Mark of the Web (Zone.Identifier) to prevent SmartScreen triggers
echo [*] جاري إزالة قيود علامة الويب وفك حظر الملفات (Unblock-File)...
powershell -NoProfile -ExecutionPolicy Bypass -Command "Get-ChildItem -Path '%~dp0' -Recurse | Unblock-File -ErrorAction SilentlyContinue" >nul 2>&1

:: 3. Register ARN Technology Root Certificate in Trusted Stores
echo [*] جاري توثيق شهادة أمان ARN Technology كناشر موثوق ومعتمد لدى Windows...
set "CER_PATH="
if exist "%~dp0cert\ARN_Technology_Root.cer" set "CER_PATH=%~dp0cert\ARN_Technology_Root.cer"
if exist "%~dp0ARN_Technology_Root.cer" set "CER_PATH=%~dp0ARN_Technology_Root.cer"
if exist "%~dp0..\cert\ARN_Technology_Root.cer" set "CER_PATH=%~dp0..\cert\ARN_Technology_Root.cer"

if defined CER_PATH (
    certutil.exe -addstore -f "Root" "%CER_PATH%" >nul 2>&1
    certutil.exe -addstore -f "TrustedPublisher" "%CER_PATH%" >nul 2>&1
    certutil.exe -addstore -user -f "Root" "%CER_PATH%" >nul 2>&1
    certutil.exe -addstore -user -f "TrustedPublisher" "%CER_PATH%" >nul 2>&1
    echo [OK] تم تثبيت وتوثيق الشهادة بنجاح في مخازن ويندوز الرسمية!
) else (
    echo [!] تنبيه: لم يتم العثور على ملف الشهادة ARN_Technology_Root.cer بجانب المثبت.
)

echo.
:: 4. Locate and Run Setup Executable
echo [*] جاري تشغيل برنامج التثبيت...
set "SETUP_EXE="
for %%F in ("%~dp0ARN_Stream_Setup*.exe") do set "SETUP_EXE=%%~fF"
if not defined SETUP_EXE (
    for %%F in ("%~dp0dist\setup\ARN_Stream_Setup*.exe") do set "SETUP_EXE=%%~fF"
)

if defined SETUP_EXE (
    echo [+] تم العثور على: %SETUP_EXE%
    start "" "%SETUP_EXE%"
) else (
    echo [!] تنبيه: لم يتم العثور على ملف التثبيت ARN_Stream_Setup*.exe
    pause
)
