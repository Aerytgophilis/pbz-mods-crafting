# Copy a mod from mods\<id>\src\ to the game's PBZModLoader mods folder (mirror: files removed from src are removed there too).
# Run in the user's own shell. Hot reload in game: Alt+F5.
# Usage: powershell -ExecutionPolicy Bypass -File tools\scripts\deploy-mod.ps1 [-Id hongzhuang-guizhan-plus] [-Remove]
param(
    [string]$Id = 'hongzhuang-guizhan-plus',
    [string]$Game = 'Z:\SteamLibrary\steamapps\common\PBZ',
    [switch]$Remove
)
$ErrorActionPreference = 'Stop'
$src = Join-Path $PSScriptRoot "..\..\mods\$Id\src"
$dst = Join-Path $Game "ProjectPBZ\PBZModLoader\mods\$Id"
if (-not (Test-Path (Join-Path $Game 'ProjectPBZ\PBZModLoader'))) { throw 'PBZModLoader is not installed.' }
if ($Remove) { if (Test-Path $dst) { Remove-Item -Recurse $dst; "removed $dst" }; return }
if (-not (Test-Path (Join-Path $src 'main.js'))) { throw "no main.js in $src" }
New-Item -ItemType Directory -Force $dst | Out-Null
Get-ChildItem $dst -File | Where-Object { -not (Test-Path (Join-Path $src $_.Name)) } | Remove-Item
Copy-Item (Join-Path $src '*') $dst -Recurse -Force
Get-ChildItem $dst -File | ForEach-Object { '{0}  {1}' -f (Get-FileHash $_.FullName -Algorithm SHA256).Hash.Substring(0,16), $_.Name }
"deployed $Id -> $dst  ($(Get-Date -Format s))"
