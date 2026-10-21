# ==============================================================================
# ARN Stream - Production Build & Digital Signing Pipeline (Inno Setup Edition)
# Developer: Abdou Ragab Nassar (ARN Technology)
# Copyright (c) 2026 ARN Technology. All Rights Reserved.
# ==============================================================================

$ErrorActionPreference = "Stop"

Write-Host "==========================================================" -ForegroundColor Cyan
Write-Host "  ARN Stream - Production Build & Digital Signing Pipeline" -ForegroundColor Yellow
Write-Host "  Developer: Abdou Ragab Nassar - ARN Technology" -ForegroundColor Green
Write-Host "==========================================================" -ForegroundColor Cyan

# 1. Clean previous build folders
Write-Host "[1/8] Cleaning previous build folders..." -ForegroundColor Cyan
if (Test-Path "dist\setup") {
    Remove-Item -Recurse -Force "dist\setup" -ErrorAction SilentlyContinue
}
$pyinstallerCmd = Get-Command "pyinstaller" -ErrorAction SilentlyContinue
if ($pyinstallerCmd -and (Test-Path "launcher\dist")) {
    Remove-Item -Recurse -Force "launcher\dist" -ErrorAction SilentlyContinue
}
if (Test-Path "launcher\build") {
    Remove-Item -Recurse -Force "launcher\build" -ErrorAction SilentlyContinue
}
Get-ChildItem -Path . -Recurse -Filter "__pycache__" -Directory -ErrorAction SilentlyContinue | Remove-Item -Recurse -Force -ErrorAction SilentlyContinue
Write-Host "  Clean completed successfully." -ForegroundColor Green

# Find available node executable (fallback to installed ARN Stream node.exe if npm/node not in PATH)
$nodeExe = "node"
$arnNode = "C:\Program Files\ARN Stream\bin\node.exe"
if (Test-Path $arnNode) {
    $nodeExe = $arnNode
}

# 2. Database Backup & Clean DB Generation
Write-Host "[2/8] Creating development database backup & clean template..." -ForegroundColor Cyan
Push-Location "server"
try {
    & "$nodeExe" "scripts/backup_and_prepare_clean_db.js"
} finally {
    Pop-Location
}
Write-Host "  Database backup and clean template ready." -ForegroundColor Green

# 3. Build Client Frontend (Vite Build)
Write-Host "[3/8] Building client frontend production bundle..." -ForegroundColor Cyan
Push-Location "client"
try {
    $viteBin = "node_modules\vite\bin\vite.js"
    if (Test-Path $viteBin) {
        & "$nodeExe" $viteBin build
    } else {
        npm run build
    }
} finally {
    Pop-Location
}
Write-Host "  Client production bundle built successfully." -ForegroundColor Green

# Helper function to sign with RFC-3161 Timestamping (Required by Windows 11 Smart App Control & SmartScreen)
function Sign-FileWithTimestamp($filePath, $cert) {
    if (-not (Test-Path $filePath)) { return }
    $tsServers = @(
        "http://timestamp.digicert.com",
        "http://timestamp.sectigo.com",
        "http://tsa.starfieldtech.com"
    )
    $signed = $false
    foreach ($ts in $tsServers) {
        for ($attempt = 1; $attempt -le 3; $attempt++) {
            try {
                Write-Host "  Signing with timestamp server ($attempt/3): $ts ..." -ForegroundColor Yellow
                $sig = Set-AuthenticodeSignature -FilePath $filePath -Certificate $cert -HashAlgorithm SHA256 -TimestampServer $ts -ErrorAction Stop
                if ($sig.Status -eq "Valid" -and $sig.TimeStamperCertificate) {
                    Write-Host "  [OK] Successfully signed and timestamped with $ts" -ForegroundColor Green
                    Write-Host "       Signer: $($sig.SignerCertificate.Subject)" -ForegroundColor DarkGray
                    Write-Host "       Timestamp: $($sig.TimeStamperCertificate.Subject)" -ForegroundColor DarkGray
                    $signed = $true
                    return $sig
                }
            } catch {
                Write-Warning "  Attempt $attempt with $ts failed: $_"
                Start-Sleep -Seconds 2
            }
        }
    }
    if (-not $signed) {
        Write-Error "CRITICAL: Could not obtain an RFC-3161 timestamp from any timestamp server! Binary MUST be timestamped to prevent SmartScreen / Smart App Control blocking!"
        exit 1
    }
}

# 4. Sync and Verify Digital Certificate
Write-Host "[4/8] Syncing ARN Technology Digital Certificate..." -ForegroundColor Cyan
if (-not (Test-Path "cert")) {
    New-Item -ItemType Directory -Force -Path "cert" | Out-Null
}

# Dynamically find the active ARN Technology Code Signing certificate with private key
$arnCert = Get-ChildItem "Cert:\CurrentUser\My" | Where-Object { 
    $_.Subject -like "*ARN Technology*" -and $_.HasPrivateKey 
} | Sort-Object NotAfter -Descending | Select-Object -First 1

if (-not $arnCert) {
    $pfxCandidates = @(
        "ARN_Cert\ARN_Technology_CodeSigning.pfx",
        "e:\مشاريعي\ARN_Cert\ARN_Technology_CodeSigning.pfx",
        "d:\مشاريعي\ARN_Cert\ARN_Technology_CodeSigning.pfx"
    )
    foreach ($pfx in $pfxCandidates) {
        if (Test-Path $pfx) {
            $pwd = ConvertTo-SecureString "ARN2026" -AsPlainText -Force
            $arnCert = Import-PfxCertificate -FilePath $pfx -CertStoreLocation "Cert:\CurrentUser\My" -Password $pwd -Exportable -ErrorAction SilentlyContinue
            if ($arnCert) { break }
        }
    }
}

if ($arnCert) {
    $certThumbprint = $arnCert.Thumbprint
    Write-Host "  Found active ARN Code Signing Certificate: $certThumbprint" -ForegroundColor Green
    
    # Export matching .cer file for Inno Setup packaging
    Export-Certificate -Cert $arnCert -FilePath "cert\ARN_Technology_Root.cer" -Force | Out-Null
    attrib -h "cert\ARN_Technology_Root.cer" 2>$null
    Write-Host "  Certificate exported to cert\ARN_Technology_Root.cer." -ForegroundColor Green

    # Ensure certificate is in Root & TrustedPublisher
    $inRoot = Get-Item "Cert:\CurrentUser\Root\$certThumbprint" -ErrorAction SilentlyContinue
    $inPub = Get-Item "Cert:\CurrentUser\TrustedPublisher\$certThumbprint" -ErrorAction SilentlyContinue
    if (-not $inRoot) {
        & certutil.exe -addstore -user -f "Root" "cert\ARN_Technology_Root.cer" | Out-Null
    }
    if (-not $inPub) {
        & certutil.exe -addstore -user -f "TrustedPublisher" "cert\ARN_Technology_Root.cer" | Out-Null
    }
    Write-Host "  Certificate is active and trusted on current system." -ForegroundColor Green
} else {
    Write-Warning "Could not find active ARN Technology certificate with private key in CurrentUser\My!"
}

# 5. Compile Desktop Launcher (PyInstaller)
Write-Host "[5/8] Compiling Windows desktop launcher (PyInstaller)..." -ForegroundColor Cyan
if ($pyinstallerCmd) {
    Push-Location "launcher"
    try {
        pyinstaller --clean "ARN_Stream.spec"
    } finally {
        Pop-Location
    }
    Write-Host "  Desktop launcher compiled successfully." -ForegroundColor Green
} elseif (Test-Path "launcher\dist\ARN_Stream.exe") {
    Write-Host "  Using existing compiled desktop launcher: launcher\dist\ARN_Stream.exe" -ForegroundColor Green
} else {
    Write-Error "PyInstaller not found and launcher\dist\ARN_Stream.exe does not exist!"
    exit 1
}

# 6. Sign Desktop Executable
Write-Host "[6/8] Signing internal desktop executable with DigiCert timestamp..." -ForegroundColor Cyan
$launcherExe = "launcher\dist\ARN_Stream.exe"
if (Test-Path $launcherExe) {
    if ($arnCert) {
        $sig = Sign-FileWithTimestamp $launcherExe $arnCert
        Write-Host "  Launcher signature status: $($sig.Status)" -ForegroundColor Green
    } else {
        Write-Warning "Code signing certificate not available for launcher."
    }
}

# 7. Compile Final Installer with Inno Setup
Write-Host "[7/8] Compiling final installer with Inno Setup (LZMA2 Ultra64 Solid)..." -ForegroundColor Cyan
$isccCandidates = @(
    "C:\Program Files\Inno Setup 7\ISCC.exe",
    "$env:LOCALAPPDATA\Programs\Inno Setup 6\ISCC.exe",
    "C:\Users\ABOOOOD\AppData\Local\Programs\Inno Setup 6\ISCC.exe",
    "C:\Program Files (x86)\Inno Setup 6\ISCC.exe",
    "C:\Program Files\Inno Setup 6\ISCC.exe"
)
$isccPath = $isccCandidates | Where-Object { Test-Path $_ } | Select-Object -First 1
if (-not $isccPath) {
    Write-Error "ISCC.exe not found. Please ensure Inno Setup is installed."
    exit 1
}

& $isccPath "installer.iss"
if ($LASTEXITCODE -ne 0) {
    Write-Error "Inno Setup compilation failed!"
    exit $LASTEXITCODE
}
Write-Host "  Inno Setup installer created successfully." -ForegroundColor Green

# 8. Digitally Sign Final Setup Package & Prepare 1-Click Distribution
Write-Host "[8/8] Digitally signing the final setup installer with DigiCert timestamp..." -ForegroundColor Cyan
$setupExe = Get-ChildItem -Path "dist\setup" -Filter "*.exe" | Select-Object -First 1

if ($setupExe) {
    if ($arnCert) {
        $sig = Sign-FileWithTimestamp $setupExe.FullName $arnCert
        Write-Host "  Installer digital signature status: $($sig.Status)" -ForegroundColor Green
        Write-Host "  Timestamp Responder: $($sig.TimeStamperCertificate.Subject)" -ForegroundColor Green
    } else {
        Write-Error "CRITICAL: Code signing certificate not available for installer!"
        exit 1
    }

    # Automatically unblock the installer file from Windows Zone.Identifier restrictions
    Unblock-File -Path $setupExe.FullName -ErrorAction SilentlyContinue

    # Prepare SmartScreen-Bypass 1-Click Distribution Package
    Write-Host "  Preparing SmartScreen-Bypass distribution package..." -ForegroundColor Cyan
    $setupCertDir = "dist\setup\cert"
    if (-not (Test-Path $setupCertDir)) {
        New-Item -ItemType Directory -Force -Path $setupCertDir | Out-Null
    }
    Copy-Item "cert\ARN_Technology_Root.cer" -Destination "$setupCertDir\ARN_Technology_Root.cer" -Force
    Copy-Item "cert\ARN_Technology_Root.cer" -Destination "dist\setup\ARN_Technology_Root.cer" -Force
    if (Test-Path "تثبيت_وتوثيق_ARN_Stream.bat") {
        Copy-Item "تثبيت_وتوثيق_ARN_Stream.bat" -Destination "dist\setup\تثبيت_وتوثيق_ARN_Stream.bat" -Force
        Copy-Item "تثبيت_وتوثيق_ARN_Stream.bat" -Destination "dist\setup\Install_ARN_Stream.bat" -Force
    }

    # Copy Quick Guide
    if (Test-Path "تعليمات_التثبيت_وتفادي_الحظر.txt") {
        Copy-Item "تعليمات_التثبيت_وتفادي_الحظر.txt" -Destination "dist\setup\تعليمات_التثبيت_وتفادي_الحظر.txt" -Force
        Copy-Item "تعليمات_التثبيت_وتفادي_الحظر.txt" -Destination "dist\setup\README_INSTALL_GUIDE.txt" -Force
    }

    # Create ZIP Distribution Package
    $issContent = Get-Content "installer.iss" -Raw
    $versionMatch = [regex]::Match($issContent, '#define\s+MyAppVersion\s+"([^"]+)"')
    $appVersion = if ($versionMatch.Success) { $versionMatch.Groups[1].Value } else { "2.0.3" }
    $zipPackageName = "ARN_Stream_v${appVersion}_Setup_Package.zip"
    $zipPackagePath = "dist\setup\$zipPackageName"
    if (Test-Path $zipPackagePath) {
        Remove-Item -Force $zipPackagePath -ErrorAction SilentlyContinue
    }
    
    $stagingDir = "dist\setup_staging"
    if (Test-Path $stagingDir) { Remove-Item -Recurse -Force $stagingDir }
    New-Item -ItemType Directory -Path $stagingDir | Out-Null
    Copy-Item $setupExe.FullName -Destination "$stagingDir\$($setupExe.Name)"
    Copy-Item "dist\setup\تثبيت_وتوثيق_ARN_Stream.bat" -Destination "$stagingDir\تثبيت_وتوثيق_ARN_Stream.bat"
    Copy-Item "dist\setup\Install_ARN_Stream.bat" -Destination "$stagingDir\Install_ARN_Stream.bat"
    Copy-Item "dist\setup\ARN_Technology_Root.cer" -Destination "$stagingDir\ARN_Technology_Root.cer"
    Copy-Item "dist\setup\تعليمات_التثبيت_وتفادي_الحظر.txt" -Destination "$stagingDir\تعليمات_التثبيت_وتفادي_الحظر.txt"
    Copy-Item "dist\setup\README_INSTALL_GUIDE.txt" -Destination "$stagingDir\README_INSTALL_GUIDE.txt"
    Get-ChildItem $stagingDir | Unblock-File -ErrorAction SilentlyContinue

    Add-Type -AssemblyName System.IO.Compression.FileSystem -ErrorAction SilentlyContinue
    $resolvedStaging = (Resolve-Path $stagingDir).Path
    $resolvedZip = (Resolve-Path "dist\setup").Path + "\$zipPackageName"
    [System.IO.Compression.ZipFile]::CreateFromDirectory($resolvedStaging, $resolvedZip, [System.IO.Compression.CompressionLevel]::Optimal, $false, [System.Text.Encoding]::UTF8)
    Remove-Item -Recurse -Force $stagingDir -ErrorAction SilentlyContinue
    Write-Host "  Zip package generated: $zipPackagePath" -ForegroundColor Green

    # Unblock all files in dist\setup
    Get-ChildItem -Path "dist\setup" | Unblock-File -ErrorAction SilentlyContinue

    # Sync installer & package to root E:\ and to E:\اصداراتي
    Copy-Item -Path $setupExe.FullName -Destination "E:\$($setupExe.Name)" -Force -ErrorAction SilentlyContinue
    Unblock-File -Path "E:\$($setupExe.Name)" -ErrorAction SilentlyContinue

    Copy-Item -Path $zipPackagePath -Destination "E:\$zipPackageName" -Force -ErrorAction SilentlyContinue
    Unblock-File -Path "E:\$zipPackageName" -ErrorAction SilentlyContinue

    if (Test-Path "E:\اصداراتي") {
        Copy-Item -Path $setupExe.FullName -Destination "E:\اصداراتي\$($setupExe.Name)" -Force -ErrorAction SilentlyContinue
        Unblock-File -Path "E:\اصداراتي\$($setupExe.Name)" -ErrorAction SilentlyContinue

        Copy-Item -Path $zipPackagePath -Destination "E:\اصداراتي\$zipPackageName" -Force -ErrorAction SilentlyContinue
        Unblock-File -Path "E:\اصداراتي\$zipPackageName" -ErrorAction SilentlyContinue

        Copy-Item -Path "dist\setup\تثبيت_وتوثيق_ARN_Stream.bat" -Destination "E:\اصداراتي\تثبيت_وتوثيق_ARN_Stream.bat" -Force -ErrorAction SilentlyContinue
        Unblock-File -Path "E:\اصداراتي\تثبيت_وتوثيق_ARN_Stream.bat" -ErrorAction SilentlyContinue

        Copy-Item -Path "dist\setup\Install_ARN_Stream.bat" -Destination "E:\اصداراتي\Install_ARN_Stream.bat" -Force -ErrorAction SilentlyContinue
        Unblock-File -Path "E:\اصداراتي\Install_ARN_Stream.bat" -ErrorAction SilentlyContinue

        Write-Host "  Synchronized full installer and packages to: E:\اصداراتي" -ForegroundColor Green
    }

    $sizeMB = [math]::Round($setupExe.Length / 1MB, 2)
    $zipItem = Get-Item $zipPackagePath
    $zipSizeMB = [math]::Round($zipItem.Length / 1MB, 2)
    Write-Host "==========================================================" -ForegroundColor Green
    Write-Host "  ARN Stream - Build and Packaging Completed Successfully!" -ForegroundColor Green
    Write-Host "  Installer EXE:  $($setupExe.Name) [$sizeMB MB]" -ForegroundColor Yellow
    Write-Host "  ZIP Package:    $zipPackageName [$zipSizeMB MB]" -ForegroundColor Yellow
    Write-Host "  RFC-3161 Stamp: $($sig.TimeStamperCertificate.Subject)" -ForegroundColor Cyan
    Write-Host "  Root Drive:     E:\$($setupExe.Name)" -ForegroundColor White
    Write-Host "  Releases Dir:   E:\اصداراتي" -ForegroundColor White
    Write-Host "  SmartScreen:    1-Click Bypass Launcher and Direct Mode Ready" -ForegroundColor Green
    Write-Host "==========================================================" -ForegroundColor Green
} else {
    Write-Error "Setup executable not found in dist\setup!"
    exit 1
}


