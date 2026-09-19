#define MyAppName "ImageForge AI Studio Native"
#define MyAppVersion "1.1.2"
#define MyAppPublisher "ImageForge AI"
#define MyAppExeName "ImageForgeAI.exe"

[Setup]
AppId={{6B12D693-0FE4-4FC8-8B40-57E3A56CE112}
AppName={#MyAppName}
AppVersion={#MyAppVersion}
AppPublisher={#MyAppPublisher}
DefaultDirName={autopf}\ImageForge AI Studio
DefaultGroupName={#MyAppName}
OutputDir=dist-installer
OutputBaseFilename=ImageForgeAI-Setup-x64-v1.1.2
Compression=lzma2
SolidCompression=yes
WizardStyle=modern
ArchitecturesAllowed=x64compatible
ArchitecturesInstallIn64BitMode=x64compatible
PrivilegesRequired=lowest
UninstallDisplayName={#MyAppName}
DisableProgramGroupPage=yes
SetupLogging=yes

[Languages]
Name: "brazilianportuguese"; MessagesFile: "compiler:Languages\BrazilianPortuguese.isl"

[Tasks]
Name: "desktopicon"; Description: "Criar atalho na área de trabalho"; GroupDescription: "Atalhos:"; Flags: unchecked

[Files]
Source: "dist\ImageForgeAI.exe"; DestDir: "{app}"; Flags: ignoreversion

[Icons]
Name: "{autoprograms}\{#MyAppName}"; Filename: "{app}\{#MyAppExeName}"
Name: "{autodesktop}\{#MyAppName}"; Filename: "{app}\{#MyAppExeName}"; Tasks: desktopicon

[Run]
Filename: "{app}\{#MyAppExeName}"; Description: "Abrir {#MyAppName}"; Flags: nowait postinstall skipifsilent

[Messages]
WelcomeLabel2=Este assistente vai instalar o [name/vername] no seu computador.
FinishedHeadingLabel=Instalação concluída
FinishedLabelNoIcons=O [name] foi instalado com sucesso.
