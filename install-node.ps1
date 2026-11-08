[CmdletBinding()]
param(
    [ValidatePattern('^24\.\d+\.\d+$')]
    [string]$Version = '24.22.2',

    [ValidateSet('Auto', 'User', 'Machine')]
    [string]$Scope = 'Auto'
)

$ErrorActionPreference = 'Stop'

if (-not [Environment]::Is64BitOperatingSystem) {
    throw 'This installer supports 64-bit Windows only.'
}

$architecture = switch ([System.Runtime.InteropServices.RuntimeInformation]::OSArchitecture) {
    'X64' { 'x64' }
    'Arm64' { 'arm64' }
    default { throw "Unsupported Windows architecture: $($_)" }
}

$isAdministrator = ([Security.Principal.WindowsPrincipal] [Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole(
    [Security.Principal.WindowsBuiltInRole]::Administrator
)

if ($Scope -eq 'Auto') {
    $Scope = if ($isAdministrator) { 'Machine' } else { 'User' }
}

if ($Scope -eq 'Machine' -and -not $isAdministrator) {
    throw 'A machine-wide installation requires an elevated PowerShell session. Use -Scope User instead.'
}

$downloadDirectory = Join-Path $env:TEMP "codex-node-v$Version"
$checksumPath = Join-Path $downloadDirectory 'SHASUMS256.txt'
$releaseUrl = "https://nodejs.org/dist/v$Version"

New-Item -ItemType Directory -Path $downloadDirectory -Force | Out-Null

function Get-VerifiedNodeAsset {
    param(
        [Parameter(Mandatory)]
        [string]$AssetName
    )

    $assetPath = Join-Path $downloadDirectory $AssetName

    Write-Host "Downloading $AssetName from nodejs.org..."
    Invoke-WebRequest -Uri "$releaseUrl/$AssetName" -OutFile $assetPath -UseBasicParsing
    Invoke-WebRequest -Uri "$releaseUrl/SHASUMS256.txt" -OutFile $checksumPath -UseBasicParsing

    $checksumLine = Get-Content -LiteralPath $checksumPath |
        Where-Object { $_ -match "^[0-9a-fA-F]{64}  $([regex]::Escape($AssetName))$" } |
        Select-Object -First 1

    if (-not $checksumLine) {
        throw "The official checksum list does not contain $AssetName."
    }

    $expectedChecksum = ($checksumLine -split '\s+')[0].ToUpperInvariant()
    $actualChecksum = (Get-FileHash -LiteralPath $assetPath -Algorithm SHA256).Hash.ToUpperInvariant()

    if ($actualChecksum -ne $expectedChecksum) {
        throw "Checksum verification failed for $AssetName."
    }

    Write-Host "Checksum verified for $AssetName."
    return $assetPath
}

function Add-UserPathEntry {
    param(
        [Parameter(Mandatory)]
        [string]$PathEntry
    )

    $userPath = [Environment]::GetEnvironmentVariable('Path', 'User')
    $pathEntries = @(
        $userPath -split ';' |
            Where-Object { -not [string]::IsNullOrWhiteSpace($_) }
    )
    $normalizedEntry = $PathEntry.TrimEnd('\')
    $alreadyPresent = $pathEntries | Where-Object {
        [Environment]::ExpandEnvironmentVariables($_).TrimEnd('\') -ieq $normalizedEntry
    }

    if (-not $alreadyPresent) {
        $newUserPath = (@($pathEntries) + $PathEntry) -join ';'
        [Environment]::SetEnvironmentVariable('Path', $newUserPath, 'User')
    }
}

if ($Scope -eq 'Machine') {
    $installerName = "node-v$Version-$architecture.msi"
    $installerPath = Get-VerifiedNodeAsset -AssetName $installerName
    $installLogPath = Join-Path $downloadDirectory 'install.log'

    Write-Host 'Installing Node.js and npm for all users...'
    $installerProcess = Start-Process -FilePath 'msiexec.exe' -ArgumentList @(
        '/i'
        $installerPath
        '/qn'
        '/norestart'
        '/L*v'
        $installLogPath
    ) -Wait -PassThru

    if ($installerProcess.ExitCode -notin @(0, 3010)) {
        throw "Node.js installation failed with Windows Installer exit code $($installerProcess.ExitCode). See $installLogPath"
    }

    $nodeDirectory = Join-Path $env:ProgramFiles 'nodejs'
}
else {
    $archiveName = "node-v$Version-win-$architecture.zip"
    $archivePath = Get-VerifiedNodeAsset -AssetName $archiveName
    $extractDirectory = Join-Path $downloadDirectory ("extract-" + [guid]::NewGuid().ToString('N'))
    $extractedNodeDirectory = Join-Path $extractDirectory "node-v$Version-win-$architecture"
    $nodeDirectory = Join-Path $env:LOCALAPPDATA 'Programs\nodejs'

    if (Test-Path -LiteralPath $nodeDirectory) {
        $existingNodePath = Join-Path $nodeDirectory 'node.exe'
        if (-not (Test-Path -LiteralPath $existingNodePath)) {
            throw "$nodeDirectory already exists but does not contain node.exe. It was left unchanged."
        }

        $existingVersion = (& $existingNodePath --version).TrimStart('v')
        if ($existingVersion -ne $Version) {
            throw "$nodeDirectory already contains Node.js v$existingVersion. It was left unchanged."
        }
    }
    else {
        Write-Host 'Installing Node.js and npm for the current Windows user...'
        Expand-Archive -LiteralPath $archivePath -DestinationPath $extractDirectory
        if (-not (Test-Path -LiteralPath $extractedNodeDirectory)) {
            throw "The downloaded archive did not contain the expected folder: $extractedNodeDirectory"
        }

        New-Item -ItemType Directory -Path (Split-Path -Parent $nodeDirectory) -Force | Out-Null
        Move-Item -LiteralPath $extractedNodeDirectory -Destination $nodeDirectory
    }

    Add-UserPathEntry -PathEntry $nodeDirectory
}

$nodePath = Join-Path $nodeDirectory 'node.exe'
$npmPath = Join-Path $nodeDirectory 'npm.cmd'

if (-not (Test-Path -LiteralPath $nodePath) -or -not (Test-Path -LiteralPath $npmPath)) {
    throw "Installation completed, but node.exe or npm.cmd was not found in $nodeDirectory."
}

$env:Path = "$nodeDirectory;$env:Path"
$nodeVersion = & $nodePath --version
$npmVersion = & $npmPath --version

Write-Host "Installed Node.js $nodeVersion"
Write-Host "Installed npm $npmVersion"
Write-Host "Install location: $nodeDirectory"
Write-Host 'Restart open terminal apps before using node or npm so they receive the updated PATH.'
