param(
  [Parameter(Mandatory = $true)][string]$PackagePath,
  [Parameter(Mandatory = $true)][string]$ExpectedVersion,
  [string]$DeployRoot = "$env:USERPROFILE\CodexRemote",
  [string]$TaskName = 'CodexApp Remote',
  [int]$Port = 5900,
  [switch]$DryRun
)

$ErrorActionPreference = 'Stop'

$PackagePath = (Resolve-Path -LiteralPath $PackagePath).Path
$Timestamp = Get-Date -Format 'yyyyMMdd-HHmmss'
$DeploymentsDir = Join-Path $DeployRoot 'deployments'
$LogsDir = Join-Path $DeployRoot 'logs'
$StateDir = Join-Path $DeployRoot 'state'
$StatePath = Join-Path $StateDir 'last-deploy.json'
$LogPath = Join-Path $LogsDir "deploy-$Timestamp.log"
$InstalledPackage = 'D:\Program Files\nodejs\node_global\node_modules\codexapp\package.json'
$InstalledModule = Split-Path -Parent $InstalledPackage
$RollbackDir = Join-Path $DeploymentsDir "rollback-$Timestamp"
$RollbackPackage = ''

function Write-DeployLog([string]$Message) {
  "$(Get-Date -Format 'yyyy-MM-dd HH:mm:ss') $Message" | Out-File -LiteralPath $LogPath -Append
}

function Write-DeployState([string]$Phase, [string]$Outcome = '', [string]$Error = '') {
  $state = [ordered]@{
    phase = $Phase
    outcome = $Outcome
    expectedVersion = $ExpectedVersion
    packagePath = $PackagePath
    rollbackPackage = $RollbackPackage
    logPath = $LogPath
    error = $Error
    updatedAt = (Get-Date).ToUniversalTime().ToString('o')
  }
  $temporary = "$StatePath.tmp"
  $state | ConvertTo-Json | Set-Content -LiteralPath $temporary -Encoding utf8
  Move-Item -LiteralPath $temporary -Destination $StatePath -Force
}

function Wait-ForPort([bool]$ShouldListen, [int]$TimeoutSeconds) {
  $deadline = (Get-Date).AddSeconds($TimeoutSeconds)
  do {
    $listening = [bool](Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction SilentlyContinue)
    if ($listening -eq $ShouldListen) { return }
    Start-Sleep -Milliseconds 500
  } while ((Get-Date) -lt $deadline)
  throw "Port $Port did not reach listening=$ShouldListen within $TimeoutSeconds seconds."
}

function Invoke-CodexAppTask([string]$Action) {
  & schtasks.exe "/$Action" /TN $TaskName | Out-File -LiteralPath $LogPath -Append
  if ($LASTEXITCODE -ne 0) { throw "Scheduled task action $Action failed with exit code $LASTEXITCODE." }
}

function Install-Package([string]$Path) {
  $previous = $ErrorActionPreference
  try {
    $ErrorActionPreference = 'Continue'
    & npm.cmd install -g $Path *>> $LogPath
    $exitCode = $LASTEXITCODE
  } finally {
    $ErrorActionPreference = $previous
  }
  if ($exitCode -ne 0) { throw "npm install failed with exit code $exitCode." }
}

function Read-PackageVersion([string]$Path) {
  $packageJson = (& tar.exe -xOf $Path 'package/package.json') -join [Environment]::NewLine
  if ($LASTEXITCODE -ne 0 -or -not $packageJson) { throw "Could not read package/package.json from $Path." }
  return (ConvertFrom-Json $packageJson).version
}

function Assert-Health() {
  . (Join-Path $DeployRoot 'secrets.ps1')
  $token = [Convert]::ToBase64String([Text.Encoding]::UTF8.GetBytes(":$CodexAppPassword"))
  $headers = @{ Authorization = "Basic $token" }
  $page = Invoke-WebRequest -UseBasicParsing -Uri "http://127.0.0.1:$Port/" -Headers $headers -TimeoutSec 20
  if ($page.StatusCode -ne 200) { throw "HTTP health check returned $($page.StatusCode)." }
  $unread = Invoke-WebRequest -UseBasicParsing -Uri "http://127.0.0.1:$Port/codex-api/thread-unread-state" -Headers $headers -TimeoutSec 20
  if ($unread.StatusCode -ne 200) { throw "Unread-state health check returned $($unread.StatusCode)." }
}

New-Item -ItemType Directory -Force -Path $DeploymentsDir, $LogsDir, $StateDir | Out-Null
if (-not (Test-Path -LiteralPath $InstalledPackage)) { throw "Installed codexapp package not found: $InstalledPackage" }

try {
  Write-DeployState 'validating'
  $candidateName = Split-Path -Leaf $PackagePath
  if ($candidateName -notmatch '^codexapp-[0-9]+\.[0-9]+\.[0-9]+.*\.tgz$') {
    throw "Expected a codexapp tarball, received: $candidateName"
  }
  $candidateVersion = Read-PackageVersion $PackagePath
  if ($candidateVersion -ne $ExpectedVersion) {
    throw "Tarball version is $candidateVersion, expected $ExpectedVersion."
  }

  $currentVersion = (Get-Content -Raw -LiteralPath $InstalledPackage | ConvertFrom-Json).version
  Write-DeployLog "Preparing codexapp $ExpectedVersion from $candidateName; current version is $currentVersion."

  if ($DryRun) {
    Write-DeployLog 'Dry run completed before service shutdown.'
    Write-DeployState 'succeeded' 'dry-run'
    exit 0
  }

  Write-DeployState 'backing-up'
  New-Item -ItemType Directory -Force -Path $RollbackDir | Out-Null
  Push-Location $InstalledModule
  try {
    $previous = $ErrorActionPreference
    try {
      $ErrorActionPreference = 'Continue'
      & npm.cmd pack --ignore-scripts --pack-destination $RollbackDir *>> $LogPath
      $exitCode = $LASTEXITCODE
    } finally {
      $ErrorActionPreference = $previous
    }
    if ($exitCode -ne 0) { throw "npm pack failed with exit code $exitCode." }
  } finally {
    Pop-Location
  }
  $RollbackPackage = (Get-ChildItem -LiteralPath $RollbackDir -Filter 'codexapp-*.tgz' -File | Select-Object -First 1).FullName
  if (-not $RollbackPackage) { throw 'Rollback package was not created.' }
  Write-DeployState 'restarting'

  Write-DeployLog 'Stopping current CodexApp Remote service.'
  Invoke-CodexAppTask 'End'
  Wait-ForPort $false 30

  Write-DeployLog "Installing codexapp $ExpectedVersion."
  Install-Package $PackagePath
  $installedVersion = (Get-Content -Raw -LiteralPath $InstalledPackage | ConvertFrom-Json).version
  if ($installedVersion -ne $ExpectedVersion) {
    throw "Installed version is $installedVersion, expected $ExpectedVersion."
  }

  Write-DeployLog 'Starting updated CodexApp Remote service.'
  Invoke-CodexAppTask 'Run'
  Wait-ForPort $true 45
  Write-DeployState 'verifying'
  Assert-Health
  Write-DeployLog 'Deployment succeeded.'
  Write-DeployState 'succeeded' 'deployed'
} catch {
  $failure = $_.Exception.Message
  Write-DeployLog "Deployment failed: $failure"
  Write-DeployState 'rolling-back' '' $failure
  try {
    if ($RollbackPackage) {
      Write-DeployLog 'Installing rollback package.'
      Install-Package $RollbackPackage
    }
    Invoke-CodexAppTask 'Run'
    Wait-ForPort $true 45
    Write-DeployLog 'Rollback succeeded.'
    Write-DeployState 'failed' 'rolled-back' $failure
  } catch {
    $rollbackFailure = $_.Exception.Message
    Write-DeployLog "Rollback failed: $rollbackFailure"
    Write-DeployState 'failed' 'rollback-failed' "$failure | rollback: $rollbackFailure"
  }
  exit 1
}
