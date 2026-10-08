# ARN Stream - PowerShell Dev Launcher
$node = "node"

# 1. البحث عن Node.js (النظامي أولاً ثم المدمج في البرنامج المثبت)
$nodeCmd = Get-Command node -ErrorAction SilentlyContinue
if ($nodeCmd) {
    $node = $nodeCmd.Source
} else {
    $fallbackNode = "C:\Program Files\ARN Stream\bin\node.exe"
    if (Test-Path $fallbackNode) {
        $node = $fallbackNode
    } else {
        Write-Host "[X] لم يتم العثور على Node.js في النظام أو في مسار التثبيت." -ForegroundColor Red
        return
    }
}

Write-Host "==========================================================" -ForegroundColor Cyan
Write-Host "   ARN Stream - تشغيل بيئة التطوير (Server + Frontend)     " -ForegroundColor Yellow
Write-Host "   تطوير وبرمجة: عبده رجب نصار - ARN Technology           " -ForegroundColor Green
Write-Host "==========================================================" -ForegroundColor Cyan

# 2. إيقاف أي عملية تشغل المنفذين 8096 أو 5173
@(8096, 5173) | ForEach-Object {
    $p = $_
    Get-NetTCPConnection -LocalPort $p -ErrorAction SilentlyContinue | Select-Object -ExpandProperty OwningProcess -Unique | ForEach-Object {
        if ($_ -gt 0) {
            Write-Host "  [i] تحرير المنفذ $p من العملية السابقة (PID: $_)..." -ForegroundColor Yellow
            Stop-Process -Id $_ -Force -ErrorAction SilentlyContinue
        }
    }
}

Write-Host "`n[1/2] جاري تشغيل سيرفر الباك إند (Port: 8096)..." -ForegroundColor Cyan
Start-Process powershell -ArgumentList "-NoExit", "-Command", "& '$node' index.js" -WorkingDirectory "$PSScriptRoot\server"

Write-Host "[2/2] جاري تشغيل واجهة التطوير (Vite على Port: 5173)..." -ForegroundColor Cyan
Write-Host "`n💡 افتح المتصفح على رابط التطوير: http://localhost:5173`n" -ForegroundColor Green
Set-Location "$PSScriptRoot\client"
if (Test-Path "node_modules\vite\bin\vite.js") {
    & $node "node_modules\vite\bin\vite.js" --port 5173 --host
} else {
    npm run dev
}
