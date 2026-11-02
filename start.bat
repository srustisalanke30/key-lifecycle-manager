@echo off
cd /d "%~dp0"
set "NODE_EXE="
where node >nul 2>nul
if not errorlevel 1 set "NODE_EXE=node"
if not defined NODE_EXE if exist "%USERPROFILE%\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe" set "NODE_EXE=%USERPROFILE%\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe"
if not defined NODE_EXE (
  echo Could not find Node.js. Install Node.js from https://nodejs.org and reopen this file.
  pause
  exit /b 1
)
echo Starting KeyKeeper demo...
start "KeyKeeper server (keep open)" /min "%NODE_EXE%" "%~dp0server.js"
set "READY="
for /l %%i in (1,1,20) do (
  powershell -NoProfile -Command "try { $r=Invoke-WebRequest -UseBasicParsing -TimeoutSec 1 http://127.0.0.1:8765/; if ($r.StatusCode -eq 200) { exit 0 } else { exit 1 } } catch { exit 1 }" >nul 2>nul
  if not errorlevel 1 set "READY=1"
  if defined READY goto :ready
  timeout /t 1 /nobreak >nul
)
echo The local page did not respond. Check the minimized server window for an error.
pause
exit /b 1
:ready
start "" "http://127.0.0.1:8765"
echo The app should open in your browser.
echo Keep the minimized "KeyKeeper server" window open while presenting.
echo Close that server window when you are finished.
pause
