$ErrorActionPreference = 'Stop'
$dock = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
Set-Location $dock

Write-Host 'Parando o Leme em execução...'
Get-Process leme -ErrorAction SilentlyContinue | Stop-Process -Force
Start-Sleep -Milliseconds 600

# Signing key for updater artifacts (kept outside the repository).
$keyPath = Join-Path $env:USERPROFILE '.tauri\leme.key'
$passPath = Join-Path $env:USERPROFILE '.tauri\leme.key.password'
if (Test-Path $keyPath) {
    $env:TAURI_SIGNING_PRIVATE_KEY = (Get-Content -Raw $keyPath).Trim()
    if (Test-Path $passPath) {
        $env:TAURI_SIGNING_PRIVATE_KEY_PASSWORD = (Get-Content -Raw $passPath).Trim()
    }
} else {
    Write-Host 'Aviso: chave de assinatura nao encontrada; o build com updater pode falhar.'
}

Write-Host 'Compilando a última versão (release + instaladores)...'
& npm.cmd run tauri -- build
if ($LASTEXITCODE -ne 0) {
    throw "Falha no build (código $LASTEXITCODE)."
}

$built = Join-Path $dock 'src-tauri\target\release\leme.exe'
$stableDir = Join-Path $env:LOCALAPPDATA 'Programs\Leme'
$stable = Join-Path $stableDir 'leme.exe'
New-Item -ItemType Directory -Force -Path $stableDir | Out-Null
Copy-Item -Force $built $stable
Write-Host "Cópia estável: $stable"

# Mantém o autostart apontando para a cópia estável (sobrevive a cargo clean).
$runKey = 'HKCU\Software\Microsoft\Windows\CurrentVersion\Run'
& reg add $runKey /v Leme /t REG_SZ /d "`"$stable`"" /f | Out-Null

Start-Process -FilePath $stable
Write-Host 'Pronto. O Leme está rodando a partir da cópia estável, com a versão mais recente.'
