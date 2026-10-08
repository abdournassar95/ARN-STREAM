# ARN Stream - Hotfix Patcher for Installed Application
$ErrorActionPreference = "Stop"

Write-Host "==========================================================" -ForegroundColor Cyan
Write-Host "  ARN Stream - Hotfix Patch (EMFILE & Resource Leak Fix)  " -ForegroundColor Yellow
Write-Host "==========================================================" -ForegroundColor Cyan

$installedServer = "C:\Program Files\ARN Stream\server"
if (-not (Test-Path $installedServer)) {
    Write-Error "Could not find installed ARN Stream at $installedServer"
    exit 1
}

# 1. Stop current processes
Write-Host "1. Stopping running ARN Stream processes..." -ForegroundColor Cyan
Get-Process | Where-Object { $_.ProcessName -match "ARN_Stream" } | Stop-Process -Force -ErrorAction SilentlyContinue
Get-Process | Where-Object { $_.ProcessName -eq "node" -and $_.Path -like "*ARN Stream*" } | Stop-Process -Force -ErrorAction SilentlyContinue
Start-Sleep -Seconds 1

# 2. Copy updated server and client files
Write-Host "2. Copying updated server and client files..." -ForegroundColor Cyan
Copy-Item -Force "d:\PersonalStream\server\routes\stream.js" "$installedServer\routes\stream.js"
Copy-Item -Force "d:\PersonalStream\server\routes\download.js" "$installedServer\routes\download.js"
Copy-Item -Force "d:\PersonalStream\server\routes\libraries.js" "$installedServer\routes\libraries.js"
Copy-Item -Force "d:\PersonalStream\server\routes\settings.js" "$installedServer\routes\settings.js"
Copy-Item -Force "d:\PersonalStream\server\services\ffmpeg-manager.js" "$installedServer\services\ffmpeg-manager.js"
Copy-Item -Force "d:\PersonalStream\server\scanner\helpers.js" "$installedServer\scanner\helpers.js"
Copy-Item -Force "d:\PersonalStream\server\index.js" "$installedServer\index.js"

$installedClientDist = "C:\Program Files\ARN Stream\client\dist"
if (Test-Path $installedClientDist) {
    Copy-Item -Recurse -Force "d:\PersonalStream\client\dist\*" $installedClientDist
    Write-Host "  Client web interface bundle updated!" -ForegroundColor Green
}

Write-Host "3. Patch successfully applied!" -ForegroundColor Green

# 3. Restart Launcher
$launcherExe = "C:\Program Files\ARN Stream\ARN_Stream.exe"
if (Test-Path $launcherExe) {
    Write-Host "4. Restarting ARN Stream Launcher..." -ForegroundColor Cyan
    Start-Process -FilePath $launcherExe
    Write-Host "  ARN Stream is now restarted and running with the patch!" -ForegroundColor Green
}
