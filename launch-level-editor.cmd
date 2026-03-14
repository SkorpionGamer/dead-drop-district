@echo off
setlocal

set "ROOT=%~dp0"
set "EDITOR_URL=http://127.0.0.1:3000/level-editor.html"
set "SERVER_SCRIPT=server/server.js"

where node >nul 2>nul
if errorlevel 1 (
  echo Node.js was not found in PATH.
  echo Install Node.js, then run this launcher again.
  pause
  exit /b 1
)

pushd "%ROOT%"

powershell -NoProfile -ExecutionPolicy Bypass -Command ^
  "$editorUrl = '%EDITOR_URL%';" ^
  "$serverScript = '%SERVER_SCRIPT%';" ^
  "$listener = Get-NetTCPConnection -LocalPort 3000 -State Listen -ErrorAction SilentlyContinue | Select-Object -First 1;" ^
  "if ($listener) {" ^
  "  $process = Get-CimInstance Win32_Process -Filter ('ProcessId = ' + $listener.OwningProcess) -ErrorAction SilentlyContinue;" ^
  "  if ($process -and $process.Name -eq 'node.exe' -and $process.CommandLine -like ('*' + $serverScript + '*')) { Stop-Process -Id $listener.OwningProcess -Force -ErrorAction SilentlyContinue; Start-Sleep -Milliseconds 500 }" ^
  "}" ^
  "Start-Process -WindowStyle Minimized -FilePath 'node' -ArgumentList $serverScript -WorkingDirectory '%ROOT%' | Out-Null; Start-Sleep -Seconds 2;" ^
  "Start-Process $editorUrl | Out-Null"

popd
exit /b 0
