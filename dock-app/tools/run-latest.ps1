$ErrorActionPreference = 'Stop'
$dock = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
Set-Location $dock

Write-Host 'Parando o Leme em execução...'
Get-Process leme -ErrorAction SilentlyContinue | Stop-Process -Force
Start-Sleep -Milliseconds 600

Write-Host 'Compilando a última versão (release + instaladores)...'
& npm.cmd run tauri -- build
if ($LASTEXITCODE -ne 0) {
    throw "Falha no build (código $LASTEXITCODE)."
}

$exe = Join-Path $dock 'src-tauri\target\release\leme.exe'
Write-Host "Iniciando $exe"
Start-Process -FilePath $exe
Write-Host 'Pronto. O Leme está rodando com a versão mais recente.'
