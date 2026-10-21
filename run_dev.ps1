[Console]::OutputEncoding = [System.Text.Encoding]::UTF8

# Ensure Administrator privileges so previous elevated processes on 8096 can be killed
$isAdmin = ([Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
if (-not $isAdmin) {
    Write-Host "[i] جاري طلب صلاحيات المسؤول لتحرير المنافذ وبدء بيئة التطوير..." -ForegroundColor Yellow
    $argList = @("-NoExit", "-NoProfile", "-ExecutionPolicy", "Bypass", "-File", "`"$PSCommandPath`"")
    try {
        Start-Process powershell.exe -ArgumentList $argList -Verb RunAs
    } catch {
        Write-Host "[X] تم إلغاء طلب صلاحيات المسؤول." -ForegroundColor Red
        Read-Host "اضغط Enter للخروج"
    }
    exit
}

Write-Host "==========================================================" -ForegroundColor Cyan
Write-Host "   ARN Stream - تشغيل بيئة التطوير (Server + Frontend)     " -ForegroundColor Yellow
Write-Host "   تطوير وبرمجة: عبده رجب نصار - ARN Technology           " -ForegroundColor Green
Write-Host "==========================================================" -ForegroundColor Cyan

# 1. إيقاف مشغل ARN_Stream المثبت لتفادي حجز المنفذ في الخلفية
Write-Host "`n[1/3] إيقاف مشغل النظام في الخلفية (ARN_Stream)..." -ForegroundColor Cyan
Get-Process -Name "ARN_Stream" -ErrorAction SilentlyContinue | Stop-Process -Force -ErrorAction SilentlyContinue
Start-Sleep -Milliseconds 800

# 2. إيقاف أي عملية تشغل المنفذين 8096 أو 5173
Write-Host "[2/3] تحرير المنفذين 8096 و 5173..." -ForegroundColor Cyan
@(8096, 5173) | ForEach-Object {
    $p = $_
    Get-NetTCPConnection -LocalPort $p -ErrorAction SilentlyContinue | Select-Object -ExpandProperty OwningProcess -Unique | ForEach-Object {
        if ($_ -gt 0) {
            Write-Host "  - تحرير المنفذ $p من العملية (PID: $_)..." -ForegroundColor Yellow
            Stop-Process -Id $_ -Force -ErrorAction SilentlyContinue
        }
    }
}
Start-Sleep -Milliseconds 800

$workspace = $PSScriptRoot
if (-not $workspace) { $workspace = Split-Path -Parent $MyInvocation.MyCommand.Definition }
$serverDir = Join-Path $workspace "server"
$clientDir = Join-Path $workspace "client"

# Find available node executable (fallback to installed ARN Stream node.exe if npm/node not in PATH)
$nodeExe = "node"
$arnNode = "C:\Program Files\ARN Stream\bin\node.exe"
if (Test-Path $arnNode) {
    $nodeExe = $arnNode
}

# 3. تشغيل سيرفر الباك إند في نافذة منفصلة
Write-Host "`n[3/3] جاري تشغيل سيرفر الباك إند (Port: 8096)..." -ForegroundColor Cyan
$serverCmd = "Set-Location -LiteralPath '$serverDir'; & '$nodeExe' --watch-path=index.js --watch-path=db.js --watch-path=routes --watch-path=scanner --watch-path=services index.js"
Start-Process powershell.exe -ArgumentList @("-NoExit", "-ExecutionPolicy", "Bypass", "-Command", $serverCmd)

# 4. تشغيل واجهة التطوير (Vite) في هذه النافذة
Write-Host "----------------------------------------------------------" -ForegroundColor DarkGray
Write-Host "  خادم الباك إند يعمل الآن على المنفذ 8096 في نافذة منفصلة." -ForegroundColor Green
Write-Host "  جاري تشغيل واجهة التطوير الحية (Vite)..." -ForegroundColor Cyan
Write-Host "  الرابط: http://localhost:5173" -ForegroundColor Yellow
Write-Host "----------------------------------------------------------`n" -ForegroundColor DarkGray

Set-Location -LiteralPath $clientDir
$vitePath = Join-Path $clientDir "node_modules\vite\bin\vite.js"
try {
    if (Test-Path $vitePath) {
        & "$nodeExe" "$vitePath" --port 5173 --host 0.0.0.0
    } else {
        npm run dev
    }
} finally {
    Write-Host "`nتم إيقاف خادم الواجهة." -ForegroundColor Yellow
    Read-Host "اضغط Enter للإغلاق"
}