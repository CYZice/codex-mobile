param(
  [string]$ManagedRoot = 'D:\DevCodex Desktop',
  [int]$Port = 5900,
  [switch]$SkipTests,
  [switch]$DryRun
)

$ErrorActionPreference = 'Stop'

$RepoRoot = (Resolve-Path -LiteralPath (Join-Path $PSScriptRoot '..\..')).Path
$PackageJsonPath = Join-Path $RepoRoot 'package.json'
$DeployScriptPath = Join-Path $PSScriptRoot 'deploy-codexapp.ps1'
$ReleaseRoot = Join-Path $RepoRoot 'output\local-release'

function Invoke-CheckedCommand {
  param(
    [Parameter(Mandatory = $true)][string]$Label,
    [Parameter(Mandatory = $true)][string]$Command,
    [Parameter(Mandatory = $true)][string[]]$Arguments
  )

  Write-Host "`n==> $Label"
  & $Command @Arguments
  if ($LASTEXITCODE -ne 0) {
    throw "$Label failed with exit code $LASTEXITCODE."
  }
}

if (-not (Test-Path -LiteralPath $PackageJsonPath)) {
  throw "package.json not found: $PackageJsonPath"
}
if (-not (Test-Path -LiteralPath $DeployScriptPath)) {
  throw "Deploy script not found: $DeployScriptPath"
}

$PackageJson = Get-Content -Raw -LiteralPath $PackageJsonPath | ConvertFrom-Json
$Version = [string]$PackageJson.version
$PackageName = [string]$PackageJson.name
if (-not $Version -or -not $PackageName) {
  throw 'package.json must contain name and version.'
}

$ReleaseDir = Join-Path $ReleaseRoot $Version
New-Item -ItemType Directory -Force -Path $ReleaseDir | Out-Null

Push-Location $RepoRoot
try {
  Write-Host "Preparing $PackageName $Version from $RepoRoot"

  if (-not $SkipTests) {
    Invoke-CheckedCommand -Label 'Unit tests' -Command 'npm.cmd' -Arguments @('run', 'test:unit')
  } else {
    Write-Host "`n==> Unit tests skipped"
  }

  Invoke-CheckedCommand -Label 'Frontend build' -Command 'npm.cmd' -Arguments @('run', 'build:frontend')
  Invoke-CheckedCommand -Label 'CLI build' -Command 'npm.cmd' -Arguments @('run', 'build:cli')

  Write-Host "`n==> npm pack"
  $PackOutput = @(& npm.cmd pack --ignore-scripts --pack-destination $ReleaseDir --silent)
  if ($LASTEXITCODE -ne 0) {
    throw "npm pack failed with exit code $LASTEXITCODE."
  }
  $PackageFileName = ($PackOutput | Select-Object -Last 1).ToString().Trim()
  if (-not $PackageFileName) {
    throw 'npm pack did not report a package file name.'
  }
  $PackagePath = Join-Path $ReleaseDir $PackageFileName
  if (-not (Test-Path -LiteralPath $PackagePath)) {
    throw "Packed tarball not found: $PackagePath"
  }
  Write-Host "Packed: $PackagePath"

  Write-Host "`n==> Deploy $Version"
  $DeployArguments = @(
    '-NoProfile',
    '-ExecutionPolicy', 'Bypass',
    '-File', $DeployScriptPath,
    '-PackagePath', $PackagePath,
    '-ExpectedVersion', $Version,
    '-ManagedRoot', $ManagedRoot,
    '-Port', [string]$Port
  )
  if ($DryRun) {
    $DeployArguments += '-DryRun'
  }
  & powershell.exe @DeployArguments
  if ($LASTEXITCODE -ne 0) {
    throw "Deployment failed with exit code $LASTEXITCODE."
  }

  if ($DryRun) {
    Write-Host "`nDry run succeeded for $PackageName $Version."
  } else {
    Write-Host "`nDeployed $PackageName $Version successfully."
  }
  Write-Host "Package: $PackagePath"
} finally {
  Pop-Location
}
