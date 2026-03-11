param(
  [int]$Port = 3010,
  [string]$Route = '/free-trial-modal'
)

$ErrorActionPreference = 'Stop'

$projectRoot = Split-Path -Parent $PSScriptRoot
Set-Location $projectRoot

$env:NEXT_PUBLIC_APP_ENV = 'local'
$env:NEXT_PUBLIC_WSS_URL = 'ws://localhost:8787/voice-session'
$env:NEXT_PUBLIC_WEBHOOK_URL = 'http://localhost:8080/api/webhook'

if (Test-Path '.next/dev/lock') {
  Remove-Item '.next/dev/lock' -Force
}

$logPath = ".codex-dev-$Port.log"
$psExe = 'C:\Windows\System32\WindowsPowerShell\v1.0\powershell.exe'
$cmd = "Set-Location '$projectRoot'; `$env:NEXT_PUBLIC_APP_ENV='local'; `$env:NEXT_PUBLIC_WSS_URL='ws://localhost:8787/voice-session'; `$env:NEXT_PUBLIC_WEBHOOK_URL='http://localhost:8080/api/webhook'; npm.cmd run dev -- --port $Port *> '$logPath'"
Start-Process -FilePath $psExe -ArgumentList '-NoProfile','-Command',$cmd -WorkingDirectory $projectRoot | Out-Null

$targetUrl = "http://127.0.0.1:$Port$Route"
$deadline = (Get-Date).AddSeconds(90)
$ready = $false

while ((Get-Date) -lt $deadline) {
  Start-Sleep -Milliseconds 800
  try {
    $res = Invoke-WebRequest -UseBasicParsing -Uri $targetUrl -TimeoutSec 5
    if ($res.StatusCode -ge 200 -and $res.StatusCode -lt 400) {
      $ready = $true
      break
    }
  }
  catch {
  }
}

if (-not $ready) {
  throw "Preview server did not become ready at $targetUrl. Check $logPath"
}

Start-Process $targetUrl | Out-Null
Write-Output "READY $targetUrl"
