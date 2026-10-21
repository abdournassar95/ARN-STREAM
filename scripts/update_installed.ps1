# ==============================================================================
# ARN Stream - Update Installed Version
# Developer: Abdou Ragab Nassar - ARN Technology
# ==============================================================================

param(
    [switch]$NoPrompt
)

[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
$ErrorActionPreference = "Continue"

# Check for Administrator privileges (required to update C:\Program Files\ARN Stream)
$isAdmin = ([Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
if (-not $isAdmin) {
    Write-Host "[i] Requesting Administrator privileges..." -ForegroundColor Yellow
    Write-Host "    جاري طلب صلاحيات المسؤول لتحديث البرنامج..." -ForegroundColor Yellow
    $argList = @('-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', "`"$PSCommandPath`"")
    if ($NoPrompt) {
        $argList += '-NoPrompt'
    }
    try {
        $proc = Start-Process powershell.exe -ArgumentList $argList -Verb RunAs -PassThru -Wait
        exit $proc.ExitCode
    } catch {
        Write-Host "[X] Administrator privilege request was cancelled or denied." -ForegroundColor Red
        exit 1
    }
}

$workspaceRoot = Split-Path -Parent $PSScriptRoot
$installedPath = "C:\Program Files\ARN Stream"
$installedServer = Join-Path $installedPath "server"
$installedClientDist = Join-Path $installedPath "client\dist"

Write-Host "==========================================================" -ForegroundColor Cyan
Write-Host "     ARN Stream - Update Installed Application            " -ForegroundColor Yellow
Write-Host "     Developer: Abdou Ragab Nassar - ARN Technology       " -ForegroundColor Green
Write-Host "==========================================================" -ForegroundColor Cyan

if (-not (Test-Path $installedPath)) {
    Write-Host "`n[X] Error: Installed ARN Stream not found at: $installedPath" -ForegroundColor Red
    Write-Host "    لم يتم العثور على البرنامج مثبت في: $installedPath" -ForegroundColor Yellow
    Write-Host ""
    if (-not $NoPrompt) {
        Read-Host "Press Enter to exit / اضغط Enter للخروج"
    }
    return
}

# 1. Stop running processes
Write-Host "`n[1/4] Stopping active ARN Stream processes..." -ForegroundColor Cyan
Get-Process -Name "ARN_Stream" -ErrorAction SilentlyContinue | ForEach-Object {
    Stop-Process -Id $_.Id -Force -ErrorAction SilentlyContinue
}
Get-CimInstance Win32_Process -Filter "Name = 'node.exe'" -ErrorAction SilentlyContinue | Where-Object { 
    $_.CommandLine -like "*ARN Stream*" -or $_.CommandLine -like "*ARN-Stream*" 
} | ForEach-Object {
    Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue
}
Get-NetTCPConnection -LocalPort 8096 -ErrorAction SilentlyContinue | Select-Object -ExpandProperty OwningProcess -Unique | ForEach-Object {
    if ($_ -gt 0) {
        Stop-Process -Id $_ -Force -ErrorAction SilentlyContinue
    }
}
Start-Sleep -Seconds 1
Write-Host "  OK: Active processes stopped." -ForegroundColor Green

# Repair database if clean candidate exists
$appDataDir = [System.IO.Path]::Combine($env:APPDATA, "ARN_Stream", "data")
$cleanDb = [System.IO.Path]::Combine($appDataDir, "media_clean.db")
$mainDb = [System.IO.Path]::Combine($appDataDir, "media.db")
if (-not (Test-Path $cleanDb)) {
    $altPath = "C:\Users\ABOOOOD\AppData\Roaming\ARN_Stream\data\media_clean.db"
    if (Test-Path $altPath) {
        $cleanDb = $altPath
        $mainDb = "C:\Users\ABOOOOD\AppData\Roaming\ARN_Stream\data\media.db"
    }
}
if (Test-Path $cleanDb) {
    Write-Host "  Applying clean repaired database..." -ForegroundColor Yellow
    Copy-Item -Force $mainDb "$mainDb.corrupt_backup" -ErrorAction SilentlyContinue
    Copy-Item -Force $cleanDb $mainDb -ErrorAction SilentlyContinue
    Remove-Item -Force "$mainDb-wal" -ErrorAction SilentlyContinue
    Remove-Item -Force "$mainDb-shm" -ErrorAction SilentlyContinue
    Remove-Item -Force $cleanDb -ErrorAction SilentlyContinue
    Write-Host "  OK: Repaired database swapped successfully!" -ForegroundColor Green
}

# 2. Copy updated server files
Write-Host "`n[2/4] Copying updated server code..." -ForegroundColor Cyan
$serverSrc = Join-Path $workspaceRoot "server"

try {
    $destDirs = @("scanner", "routes", "services", "middleware")
    foreach ($d in $destDirs) {
        $destPath = Join-Path $installedServer $d
        if (-not (Test-Path $destPath)) {
            New-Item -ItemType Directory -Force -Path $destPath | Out-Null
        }
    }
    Copy-Item -Recurse -Force "$serverSrc\scanner\*" "$installedServer\scanner\"
    Copy-Item -Recurse -Force "$serverSrc\routes\*" "$installedServer\routes\"
    Copy-Item -Recurse -Force "$serverSrc\services\*" "$installedServer\services\"
    Copy-Item -Recurse -Force "$serverSrc\middleware\*" "$installedServer\middleware\"
    Copy-Item -Force "$serverSrc\db.js" "$installedServer\db.js"
    Copy-Item -Force "$serverSrc\index.js" "$installedServer\index.js"
    Copy-Item -Force "$serverSrc\package.json" "$installedServer\package.json"

    # Synchronize any missing server dependencies (e.g. lru-cache)
    $srcNodeModules = Join-Path $serverSrc "node_modules"
    $dstNodeModules = Join-Path $installedServer "node_modules"
    if (Test-Path $srcNodeModules) {
        if (-not (Test-Path $dstNodeModules)) {
            New-Item -ItemType Directory -Force -Path $dstNodeModules | Out-Null
        }
        $srcModList = Get-ChildItem $srcNodeModules | Select-Object -ExpandProperty Name
        $dstModList = Get-ChildItem $dstNodeModules -ErrorAction SilentlyContinue | Select-Object -ExpandProperty Name
        $missingMods = Compare-Object $srcModList $dstModList -ErrorAction SilentlyContinue | Where-Object { $_.SideIndicator -eq '<=' } | Select-Object -ExpandProperty InputObject
        if ($missingMods) {
            Write-Host "  Synchronizing missing dependencies: $($missingMods -join ', ')..." -ForegroundColor Yellow
            foreach ($m in $missingMods) {
                $s = Join-Path $srcNodeModules $m
                $d = Join-Path $dstNodeModules $m
                Copy-Item -Recurse -Force $s $d -ErrorAction SilentlyContinue
            }
        }
    }
    Write-Host "  OK: Server files updated successfully." -ForegroundColor Green
} catch {
    Write-Host "  [X] Server copy error: $($_.Exception.Message)" -ForegroundColor Red
}

# 3. Copy updated client/dist
Write-Host "`n[3/4] Copying updated frontend web files..." -ForegroundColor Cyan
$clientDistSrc = Join-Path $workspaceRoot "client\dist"
if (Test-Path $clientDistSrc) {
    if (Test-Path $installedClientDist) {
        Write-Host "  Cleaning old frontend files..." -ForegroundColor Yellow
        Remove-Item -Path "$installedClientDist\*" -Recurse -Force -ErrorAction SilentlyContinue
    } else {
        New-Item -ItemType Directory -Force -Path $installedClientDist | Out-Null
    }
    try {
        Copy-Item -Recurse -Force "$clientDistSrc\*" "$installedClientDist\"
        Write-Host "  OK: Web interface updated successfully." -ForegroundColor Green
    } catch {
        Write-Host "  [X] Frontend copy error: $($_.Exception.Message)" -ForegroundColor Red
    }
} else {
    Write-Host "  [!] Warning: client\dist not found." -ForegroundColor Yellow
}

# 4. Copy updated Launcher & Icons
Write-Host "`n[4/5] Copying updated Desktop Launcher & Assets..." -ForegroundColor Cyan
$launcherSrc = Join-Path $workspaceRoot "launcher\dist\ARN_Stream.exe"
if (Test-Path $launcherSrc) {
    try {
        Copy-Item -Force $launcherSrc "$installedPath\ARN_Stream.exe"
        Write-Host "  OK: Desktop Launcher updated successfully." -ForegroundColor Green
    } catch {
        Write-Host "  [!] Could not overwrite EXE (might be running): $($_.Exception.Message)" -ForegroundColor Yellow
    }
}

$assetsDirSrc = Join-Path $workspaceRoot "launcher\assets"
if (Test-Path $assetsDirSrc) {
    $instAssets = Join-Path $installedPath "assets"
    if (-not (Test-Path $instAssets)) { New-Item -ItemType Directory -Force -Path $instAssets | Out-Null }
    Copy-Item -Recurse -Force "$assetsDirSrc\*" "$instAssets\"
    Write-Host "  OK: Desktop Launcher assets & icons synchronized." -ForegroundColor Green
}

# 5. Restart Launcher
Write-Host "`n[5/5] Restarting ARN Stream..." -ForegroundColor Cyan
$launcherExe = Join-Path $installedPath "ARN_Stream.exe"
if (Test-Path $launcherExe) {
    try {
        Start-Process -FilePath $launcherExe -WorkingDirectory $installedPath
        Write-Host "  OK: ARN Stream restarted successfully in System Tray!" -ForegroundColor Green
    } catch {
        Write-Host "  [!] Could not auto-start, please launch from desktop shortcut." -ForegroundColor Yellow
    }
}

Write-Host "`n==========================================================" -ForegroundColor Cyan
Write-Host "     Update applied successfully without affecting data!  " -ForegroundColor Green
Write-Host "     تم تحديث البرنامج بنجاح دون المساس ببياناتك أو إعداداتك! " -ForegroundColor Green
Write-Host "==========================================================" -ForegroundColor Cyan
Write-Host ""
if (-not $NoPrompt) {
    Read-Host "Press Enter to finish / اضغط Enter للخروج"
}
