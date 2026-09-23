param(
  [Parameter(Mandatory = $true)][string]$PackagePath,
  [Parameter(Mandatory = $true)][string]$ExpectedVersion,
  [string]$ManagedRoot = 'D:\DevCodex Desktop',
  [int]$Port = 5900,
  [switch]$DryRun
)

$ErrorActionPreference = 'Stop'

$PackagePath = (Resolve-Path -LiteralPath $PackagePath).Path
$Timestamp = Get-Date -Format 'yyyyMMdd-HHmmss'
$ComponentDir = Join-Path $ManagedRoot 'components\codex-mobile'
$ManagedPackagesDir = Join-Path $ManagedRoot 'packages'
$ManifestPath = Join-Path $ManagedRoot 'component-manifest.json'
$ComponentPackagePath = Join-Path $ComponentDir 'package.json'
$ComponentLockPath = Join-Path $ComponentDir 'package-lock.json'
$InstalledModulePath = Join-Path $ComponentDir 'node_modules\codexapp'
$InstalledPackagePath = Join-Path $ComponentDir 'node_modules\codexapp\package.json'
$BackupDir = Join-Path $ManagedPackagesDir "deploy-backups\mobile-$Timestamp"
$InstalledModuleBackupPath = Join-Path $BackupDir 'codexapp'
$LogPath = Join-Path $ManagedRoot "logs\mobile-deploy-$Timestamp.log"
$StatePath = Join-Path $ManagedRoot 'data\desktop\last-mobile-deploy.json'
$ManagedPackagePath = Join-Path $ManagedPackagesDir "codexapp-$ExpectedVersion.tgz"
$PreviousVersion = ''

function Write-DeployLog([string]$Message) {
  "$(Get-Date -Format 'yyyy-MM-dd HH:mm:ss') $Message" | Tee-Object -FilePath $LogPath -Append | Write-Host
}

function Write-DeployState([string]$Phase, [string]$Outcome = '', [string]$Error = '') {
  $state = [ordered]@{
    phase = $Phase
    outcome = $Outcome
    expectedVersion = $ExpectedVersion
    previousVersion = $PreviousVersion
    packagePath = $PackagePath
    managedPackagePath = $ManagedPackagePath
    logPath = $LogPath
    error = $Error
    updatedAt = (Get-Date).ToUniversalTime().ToString('o')
  }
  $temporary = "$StatePath.tmp"
  $state | ConvertTo-Json | Set-Content -LiteralPath $temporary -Encoding utf8
  Move-Item -LiteralPath $temporary -Destination $StatePath -Force
}

function Read-PackageVersion([string]$Path) {
  $packageJson = (& tar.exe -xOf $Path 'package/package.json') -join [Environment]::NewLine
  if ($LASTEXITCODE -ne 0 -or -not $packageJson) {
    throw "Could not read package/package.json from $Path."
  }
  return [string](ConvertFrom-Json $packageJson).version
}

function Get-MobileListenerPid() {
  $listener = Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction SilentlyContinue | Select-Object -First 1
  if (-not $listener) { return 0 }
  return [int]$listener.OwningProcess
}

function Assert-MobileProcess([int]$ProcessId) {
  if ($ProcessId -le 0) { throw "No listener is running on port $Port." }
  $process = Get-CimInstance Win32_Process -Filter "ProcessId=$ProcessId" -ErrorAction Stop
  $expectedEntry = (Join-Path $ComponentDir 'node_modules\codexapp\dist-cli\index.js').ToLowerInvariant()
  $commandLine = [string]$process.CommandLine
  if (-not $commandLine.ToLowerInvariant().Contains($expectedEntry)) {
    throw "Port $Port is owned by an unexpected process: $commandLine"
  }
}

function Wait-ForHealthyMobile([int]$PreviousPid, [int]$TimeoutSeconds = 45) {
  $deadline = (Get-Date).AddSeconds($TimeoutSeconds)
  do {
    $listenerProcessId = Get-MobileListenerPid
    if ($listenerProcessId -gt 0 -and $listenerProcessId -ne $PreviousPid) {
      try {
        Assert-MobileProcess $listenerProcessId
        $health = Invoke-WebRequest -UseBasicParsing -Uri "http://127.0.0.1:$Port/healthz" -TimeoutSec 5
        if ($health.StatusCode -eq 200) { return $listenerProcessId }
      } catch {
        # The managed Desktop supervisor may still be starting the replacement process.
      }
    }
    Start-Sleep -Milliseconds 500
  } while ((Get-Date) -lt $deadline)
  throw "Codex Mobile did not restart healthy on port $Port within $TimeoutSeconds seconds."
}

function Install-ManagedPackage([string]$TarballPath) {
  $relativeSpec = "../../packages/$(Split-Path -Leaf $TarballPath)"
  Push-Location $ComponentDir
  try {
    $previousPreference = $ErrorActionPreference
    try {
      $ErrorActionPreference = 'Continue'
      & npm.cmd install --save-exact $relativeSpec *>> $LogPath
      $exitCode = $LASTEXITCODE
    } finally {
      $ErrorActionPreference = $previousPreference
    }
    if ($exitCode -ne 0) { throw "npm install failed with exit code $exitCode." }
  } finally {
    Pop-Location
  }
}

function Update-ManifestVersion([string]$Version) {
  $manifest = Get-Content -Raw -LiteralPath $ManifestPath | ConvertFrom-Json
  $manifest.codexMobileVersion = $Version
  $manifest | ConvertTo-Json -Depth 20 | Set-Content -LiteralPath $ManifestPath -Encoding utf8
}

function Stop-ManagedMobile() {
  $processId = Get-MobileListenerPid
  Assert-MobileProcess $processId
  Write-DeployLog "Stopping managed Codex Mobile PID $processId."
  Stop-Process -Id $processId -Force -ErrorAction Stop
  $deadline = (Get-Date).AddSeconds(10)
  do {
    if (-not (Get-Process -Id $processId -ErrorAction SilentlyContinue)) {
      return $processId
    }
    Start-Sleep -Milliseconds 100
  } while ((Get-Date) -lt $deadline)
  throw "Codex Mobile PID $processId did not exit within 10 seconds."
}

foreach ($requiredPath in @($ComponentDir, $ManagedPackagesDir, $ManifestPath, $ComponentPackagePath, $InstalledPackagePath)) {
  if (-not (Test-Path -LiteralPath $requiredPath)) {
    throw "Required managed Desktop path is missing: $requiredPath"
  }
}

New-Item -ItemType Directory -Force -Path (Split-Path -Parent $LogPath), (Split-Path -Parent $StatePath) | Out-Null
$candidateVersion = Read-PackageVersion $PackagePath
if ($candidateVersion -ne $ExpectedVersion) {
  throw "Tarball version is $candidateVersion, expected $ExpectedVersion."
}
$PreviousVersion = [string](Get-Content -Raw -LiteralPath $InstalledPackagePath | ConvertFrom-Json).version
$currentPid = Get-MobileListenerPid
Assert-MobileProcess $currentPid

Write-DeployLog "Preparing managed Codex Mobile $ExpectedVersion; currently $PreviousVersion on PID $currentPid."
Write-DeployState 'validating'

if ($DryRun) {
  Write-DeployLog 'Dry run completed before managed files were changed.'
  Write-DeployState 'succeeded' 'dry-run'
  exit 0
}

$mobileWasStopped = $false
$installedModuleWasMoved = $false
$stoppedProcessId = 0

try {
  Write-DeployState 'backing-up'
  New-Item -ItemType Directory -Force -Path $BackupDir | Out-Null
  Copy-Item -LiteralPath $ComponentPackagePath -Destination (Join-Path $BackupDir 'package.json') -Force
  if (Test-Path -LiteralPath $ComponentLockPath) {
    Copy-Item -LiteralPath $ComponentLockPath -Destination (Join-Path $BackupDir 'package-lock.json') -Force
  }
  Copy-Item -LiteralPath $ManifestPath -Destination (Join-Path $BackupDir 'component-manifest.json') -Force

  Copy-Item -LiteralPath $PackagePath -Destination $ManagedPackagePath -Force

  Write-DeployState 'stopping'
  $stoppedProcessId = Stop-ManagedMobile
  $mobileWasStopped = $true
  Move-Item -LiteralPath $InstalledModulePath -Destination $InstalledModuleBackupPath
  $installedModuleWasMoved = $true

  Write-DeployState 'installing'
  Install-ManagedPackage $ManagedPackagePath
  $installedVersion = [string](Get-Content -Raw -LiteralPath $InstalledPackagePath | ConvertFrom-Json).version
  if ($installedVersion -ne $ExpectedVersion) {
    throw "Managed component installed $installedVersion, expected $ExpectedVersion."
  }
  Update-ManifestVersion $ExpectedVersion

  Write-DeployState 'restarting'
  $newProcessId = Wait-ForHealthyMobile -PreviousPid $stoppedProcessId -TimeoutSeconds 60
  Write-DeployLog "Codex Mobile restarted healthy as PID $newProcessId."

  $finalVersion = [string](Get-Content -Raw -LiteralPath $InstalledPackagePath | ConvertFrom-Json).version
  if ($finalVersion -ne $ExpectedVersion) {
    throw "Managed component reports $finalVersion after restart, expected $ExpectedVersion."
  }
  Write-DeployLog "Managed Codex Mobile deployment succeeded: $PreviousVersion -> $ExpectedVersion."
  Write-DeployState 'succeeded' 'deployed'
} catch {
  $failure = $_.Exception.Message
  Write-DeployLog "Deployment failed: $failure"
  Write-DeployState 'rolling-back' '' $failure
  try {
    if ($installedModuleWasMoved) {
      $rollbackListenerPid = Get-MobileListenerPid
      if ($rollbackListenerPid -gt 0) {
        try {
          Assert-MobileProcess $rollbackListenerPid
          Write-DeployLog "Stopping replacement Codex Mobile PID $rollbackListenerPid for rollback."
          Stop-Process -Id $rollbackListenerPid -Force -ErrorAction Stop
          Start-Sleep -Milliseconds 500
        } catch {
          Write-DeployLog "Rollback listener stop warning: $($_.Exception.Message)"
        }
      }
      if (Test-Path -LiteralPath $InstalledModulePath) {
        Remove-Item -LiteralPath $InstalledModulePath -Recurse -Force
      }
      if (-not (Test-Path -LiteralPath $InstalledModuleBackupPath)) {
        throw "Rollback module backup is missing: $InstalledModuleBackupPath"
      }
      Move-Item -LiteralPath $InstalledModuleBackupPath -Destination $InstalledModulePath
    }

    Copy-Item -LiteralPath (Join-Path $BackupDir 'package.json') -Destination $ComponentPackagePath -Force
    $backupLock = Join-Path $BackupDir 'package-lock.json'
    if (Test-Path -LiteralPath $backupLock) {
      Copy-Item -LiteralPath $backupLock -Destination $ComponentLockPath -Force
    }
    Copy-Item -LiteralPath (Join-Path $BackupDir 'component-manifest.json') -Destination $ManifestPath -Force

    if ($mobileWasStopped) {
      $rollbackProcessId = Wait-ForHealthyMobile -PreviousPid $stoppedProcessId -TimeoutSeconds 60
      Write-DeployLog "Rollback Codex Mobile restarted healthy as PID $rollbackProcessId."
    }
    Write-DeployLog "Rollback succeeded; restored Codex Mobile $PreviousVersion."
    Write-DeployState 'failed' 'rolled-back' $failure
  } catch {
    $rollbackFailure = $_.Exception.Message
    Write-DeployLog "Rollback failed: $rollbackFailure"
    Write-DeployState 'failed' 'rollback-failed' "$failure | rollback: $rollbackFailure"
  }
  exit 1
}
