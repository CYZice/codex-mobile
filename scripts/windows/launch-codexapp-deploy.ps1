param(
  [Parameter(Mandatory = $true)][string]$PackagePath,
  [Parameter(Mandatory = $true)][string]$ExpectedVersion,
  [string]$DeployRoot = "$env:USERPROFILE\CodexRemote",
  [switch]$DryRun
)

$ErrorActionPreference = 'Stop'
$Worker = Join-Path $DeployRoot 'deploy-codexapp.ps1'
$PackagePath = (Resolve-Path -LiteralPath $PackagePath).Path

if (-not (Test-Path -LiteralPath $Worker)) { throw "Deployment worker not found: $Worker" }

$arguments = @(
  '-NoProfile',
  '-ExecutionPolicy', 'Bypass',
  '-File', $Worker,
  '-PackagePath', $PackagePath,
  '-ExpectedVersion', $ExpectedVersion,
  '-DeployRoot', $DeployRoot
)
if ($DryRun) { $arguments += '-DryRun' }

$worker = Start-Process -FilePath "$env:SystemRoot\System32\WindowsPowerShell\v1.0\powershell.exe" -ArgumentList $arguments -WindowStyle Hidden -PassThru
[PSCustomObject]@{
  deploymentProcessId = $worker.Id
  expectedVersion = $ExpectedVersion
  statusPath = (Join-Path $DeployRoot 'state\last-deploy.json')
}
