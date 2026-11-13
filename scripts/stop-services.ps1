$ErrorActionPreference = 'Stop'
$projectRoot = [System.IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..'))
$scriptsToStop = @(
    (Join-Path $projectRoot 'scripts\launcher.js'),
    (Join-Path $projectRoot 'server\src\index.js'),
    (Join-Path $projectRoot 'client\node_modules\vite\bin\vite.js')
)
# Only stop Node processes whose first script argument is an exact project path.
foreach ($scriptPath in $scriptsToStop) {
    $argumentPattern = [regex]::Escape($scriptPath)
    $commandPattern = '^\s*(?:"[^"]+"|\S+)\s+(?:"' + $argumentPattern + '"|' + $argumentPattern + ')(?:\s|$)'
    $ownedProcesses = @(Get-CimInstance Win32_Process -Filter "Name = 'node.exe'" | Where-Object { $_.CommandLine -match $commandPattern })
    foreach ($ownedProcess in $ownedProcesses) {
        Stop-Process -Id $ownedProcess.ProcessId -ErrorAction SilentlyContinue
        Write-Output ('Stopped project process PID ' + $ownedProcess.ProcessId)
    }
}
Write-Output 'Project stop check completed.'
