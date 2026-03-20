@echo off
setlocal

cd /d "%~dp0..\apps\web"
if not exist ".runtime" mkdir ".runtime"

corepack pnpm exec vite --host 127.0.0.1 --port 3404 1>".runtime\web.log" 2>".runtime\web.err.log"
