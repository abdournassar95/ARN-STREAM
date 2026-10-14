; ==============================================================================
; ARN Stream - Unified Windows Installer Script (Inno Setup 7)
; Developer: Abdou Ragab Nassar (ARN Technology)
; Copyright (c) 2026 ARN Technology. All Rights Reserved.
; ==============================================================================

#define MyAppName "ARN Stream"
#define MyAppVersion "2.0.2"
#define MyAppPublisher "ARN Technology"
#define MyAppURL "https://facebook.com/abdouragab.nassar"
#define MyAppExeName "ARN_Stream.exe"

[Setup]
AppId={{C8E91A23-F6D4-498A-B82E-73D963F9B021}
AppName={#MyAppName}
AppVersion={#MyAppVersion}
AppPublisher={#MyAppPublisher}
AppPublisherURL={#MyAppURL}
AppSupportURL={#MyAppURL}
AppUpdatesURL={#MyAppURL}
DefaultDirName={autopf}\ARN Stream
DefaultGroupName={#MyAppName}
AllowNoIcons=yes
OutputDir=dist\setup
OutputBaseFilename=ARN_Stream_Setup_v{#MyAppVersion}
SetupIconFile=launcher\assets\icon.ico
Compression=lzma2/ultra64
SolidCompression=yes
WizardStyle=modern
PrivilegesRequired=admin
ArchitecturesInstallIn64BitMode=x64compatible
UninstallDisplayIcon={app}\{#MyAppExeName}

; Version Info & PE Metadata for SmartScreen & Windows Explorer
VersionInfoVersion={#MyAppVersion}
VersionInfoCompany={#MyAppPublisher}
VersionInfoDescription=ARN Stream Setup - Media Server & Platform
VersionInfoTextVersion={#MyAppVersion}
VersionInfoCopyright=Copyright (c) 2026 ARN Technology. All Rights Reserved.
VersionInfoProductName={#MyAppName}
VersionInfoProductVersion={#MyAppVersion}

[Languages]
Name: "ar"; MessagesFile: "compiler:Languages\Arabic.isl"
Name: "en"; MessagesFile: "compiler:Default.isl"

[CustomMessages]
ar.CompServerDesc=منصة البث وخادم الوسائط المنزلي الكامل (ARN Stream)
ar.TaskDesktopIcon=إنشاء اختصار لـ ARN Stream على سطح المكتب
ar.TaskAutoStart=تشغيل خادم وسائط ARN Stream تلقائياً في الخلفية مع بدء تشغيل ويندوز
ar.RunProgram=تشغيل ARN Stream الآن والدخول إلى الواجهة
ar.CertRootStatus=جاري توثيق شهادة أمان ARN Technology Root...
ar.CertPubStatus=جاري توثيق ناشر التطبيق في قائمة الناشرين الموثوقين...

en.CompServerDesc=ARN Stream Media Server Platform
en.TaskDesktopIcon=Create a desktop shortcut for ARN Stream
en.TaskAutoStart=Start ARN Stream Media Server automatically in background with Windows
en.RunProgram=Launch ARN Stream now
en.CertRootStatus=Registering ARN Technology Root Certificate...
en.CertPubStatus=Adding ARN Technology to Trusted Publishers...

[Tasks]
Name: "desktopicon"; Description: "{cm:TaskDesktopIcon}"; GroupDescription: "{cm:AdditionalIcons}"
Name: "autostart"; Description: "{cm:TaskAutoStart}"; GroupDescription: "{cm:AdditionalIcons}"; Flags: checkedonce

[Files]
; 1. Launcher and System Tray Executable
Source: "launcher\dist\ARN_Stream.exe"; DestDir: "{app}"; Flags: ignoreversion

; 2. Embedded Portable Node.js runtime
Source: "C:\Program Files\nodejs\node.exe"; DestDir: "{app}\bin"; Flags: ignoreversion

; 3. Production Frontend Static Build
Source: "client\dist\*"; DestDir: "{app}\client\dist"; Flags: ignoreversion recursesubdirs createallsubdirs

; 4. Production Backend Server
Source: "server\*"; DestDir: "{app}\server"; Flags: ignoreversion recursesubdirs createallsubdirs; Excludes: "data,data\*,*\data\*,*.db*,*.sqlite*,*.log,*\node_modules\.cache\*,*\.cache\*"

; 5. Fresh Clean Database Template (Ensuring it does not overwrite existing user databases on update)
Source: "backups\clean_media.db"; DestDir: "{userappdata}\ARN_Stream\data"; DestName: "media.db"; Flags: onlyifdoesntexist

; 6. Security Certificate and Icons
Source: "cert\ARN_Technology_Root.cer"; DestDir: "{app}\cert"; Flags: ignoreversion
Source: "launcher\assets\*"; DestDir: "{app}\assets"; Flags: ignoreversion recursesubdirs createallsubdirs

[Icons]
Name: "{group}\{#MyAppName}"; Filename: "{app}\{#MyAppExeName}"; WorkingDir: "{app}"; IconFilename: "{app}\assets\icon.ico"
Name: "{group}\{cm:UninstallProgram,{#MyAppName}}"; Filename: "{uninstallexe}"; WorkingDir: "{app}"
Name: "{autodesktop}\{#MyAppName}"; Filename: "{app}\{#MyAppExeName}"; WorkingDir: "{app}"; IconFilename: "{app}\assets\icon.ico"; Tasks: desktopicon

[Registry]
; Windows Background Autostart Key
Root: HKLM; Subkey: "Software\Microsoft\Windows\CurrentVersion\Run"; ValueType: string; ValueName: "ARN Stream"; ValueData: """{app}\{#MyAppExeName}"" --autostart"; Flags: uninsdeletevalue; Tasks: autostart

[Run]
; Certificate registration in Windows Certificate Store (LocalMachine and CurrentUser)
Filename: "certutil.exe"; Parameters: "-addstore -f ""Root"" ""{app}\cert\ARN_Technology_Root.cer"""; StatusMsg: "{cm:CertRootStatus}"; Flags: runhidden waituntilterminated
Filename: "certutil.exe"; Parameters: "-addstore -f ""TrustedPublisher"" ""{app}\cert\ARN_Technology_Root.cer"""; StatusMsg: "{cm:CertPubStatus}"; Flags: runhidden waituntilterminated
Filename: "certutil.exe"; Parameters: "-addstore -user -f ""Root"" ""{app}\cert\ARN_Technology_Root.cer"""; StatusMsg: "{cm:CertRootStatus}"; Flags: runhidden waituntilterminated
Filename: "certutil.exe"; Parameters: "-addstore -user -f ""TrustedPublisher"" ""{app}\cert\ARN_Technology_Root.cer"""; StatusMsg: "{cm:CertPubStatus}"; Flags: runhidden waituntilterminated

; Remove any Mark-of-the-Web (Zone.Identifier) on installed executable
Filename: "powershell.exe"; Parameters: "-NoProfile -ExecutionPolicy Bypass -Command ""Unblock-File -Path '{app}\{#MyAppExeName}'"""; Flags: runhidden waituntilterminated

; Post-install Launch
Filename: "{app}\{#MyAppExeName}"; Description: "{cm:RunProgram}"; WorkingDir: "{app}"; Flags: nowait postinstall skipifsilent
