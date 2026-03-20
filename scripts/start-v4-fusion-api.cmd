@echo off
setlocal

cd /d "%~dp0..\apps\api"
if not exist ".runtime" mkdir ".runtime"

corepack pnpm dev 1>".runtime\api.log" 2>".runtime\api.err.log"
