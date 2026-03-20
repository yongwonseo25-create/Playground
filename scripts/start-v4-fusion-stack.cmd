@echo off
setlocal

cd /d "%~dp0.."

start "voxera-fusion-api" /min cmd /c "%~dp0start-v4-fusion-api.cmd"
start "voxera-fusion-web" /min cmd /c "%~dp0start-v4-fusion-web.cmd"
