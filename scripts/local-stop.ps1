$workspacePath = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
$statePath = Join-Path $workspacePath '.local/runtime.json'
if (-not (Test-Path -LiteralPath $statePath)) { Write-Output 'No managed local runtime recorded.'; exit 0 }
$state = Get-Content -LiteralPath $statePath -Raw | ConvertFrom-Json
if ($state.stopped) { Write-Output 'Local runtime already stopped.'; exit 0 }
if ($state.root -ne $workspacePath) { throw 'Runtime workspace mismatch' }
$pgControl = Join-Path $workspacePath 'node_modules/@embedded-postgres/windows-x64/native/bin/pg_ctl.exe'
& $pgControl -D (Join-Path $workspacePath '.local/postgres') -m fast -w stop
foreach ($processId in $state.pids) {
 $process = Get-CimInstance Win32_Process -Filter "ProcessId=$processId"
 if ($process -and $process.CommandLine.Contains($workspacePath)) { Stop-Process -Id $processId -ErrorAction SilentlyContinue }
}
if ($state.launcherPid) {
 $launcher = Get-CimInstance Win32_Process -Filter "ProcessId=$($state.launcherPid)"
 if ($launcher -and $launcher.CommandLine.Contains('scripts/local-start.ts')) { Stop-Process -Id $state.launcherPid -ErrorAction SilentlyContinue }
}
@{stopped=$true} | ConvertTo-Json | Set-Content -LiteralPath $statePath
Write-Output 'Managed local services stopped. Databases and deployment backups preserved.'
