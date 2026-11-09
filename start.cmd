@echo off
cd /d "%~dp0"
echo AuronexAI website
echo Open http://localhost:3000 after the server starts.
echo Keep this window open. Press Ctrl+C to stop.
if exist "%ProgramFiles%\nodejs\node.exe" (
  "%ProgramFiles%\nodejs\node.exe" --env-file-if-exists=.env server.mjs
) else (
  where node >nul 2>nul
  if errorlevel 1 (
    echo Node.js is not installed yet. Complete the Node.js LTS installation first.
  ) else (
    node --env-file-if-exists=.env server.mjs
  )
)
pause

