# Install / uninstall PBZModLoader 2.1.0 (Kintaro fork) in the game folder. Adds files only; never overwrites.
# Run in the user's own shell (the agent sandbox cannot write the game folder for real).
# Usage: powershell -ExecutionPolicy Bypass -File tools\scripts\install-loader.ps1 [-Entry hid|version|winmm|dsound|dxgi] [-Uninstall]
# On this machine version.dll is not picked up by the game (it loads System32's), so the default entry is hid.dll.
# To change the entry later: tools\scripts\switch-loader-entry.ps1
param(
    [ValidateSet('version','hid','winmm','dsound','dxgi')][string]$Entry = 'hid',
    [string]$Game = 'Z:\SteamLibrary\steamapps\common\PBZ',
    [string]$Src = '',
    [switch]$Uninstall
)
$ErrorActionPreference = 'Stop'
if (-not $Src) { $Src = Join-Path (Split-Path -Parent $MyInvocation.MyCommand.Path) '..\bin\PBZModLoader-2.1.0\unzipped' }
if (Get-Process -Name PBZ -ErrorAction SilentlyContinue) { throw 'Close the game first.' }

# every entry DLL of this loader version, by hash (so we only ever remove our own files)
$entries = @{
    'version' = @{ src = 'platform\steam\version.dll';            sha = 'F443EFF4E2A70CBBEC27E88B6B73BA7347FA0BD4A4365A015F71142A43F1A4DA' }
    'hid'     = @{ src = 'alternative-entries\hid\hid.dll';       sha = 'A741D9F8AB574E7161B972526502FFB3C92FEC1FF2F118EEAE13F4C96620516C' }
    'winmm'   = @{ src = 'alternative-entries\winmm\winmm.dll';   sha = '6A5C3BCA04B576BFBDC0635117E3EDD4360240454234CB1D76E3DA814DB3E3AF' }
    'dsound'  = @{ src = 'alternative-entries\dsound\dsound.dll'; sha = 'E90223DEF5ECE710DF99D98C663CEDC161319057A43A2ACE00AAFB76D01712AB' }
    'dxgi'    = @{ src = 'alternative-entries\dxgi\dxgi.dll';     sha = 'CAFFE51769014947E68C048CCEAA2C37F9B301D516D71C2DE34F3D42B143616B' }
}
$common = @(
    @{ rel = 'ProjectPBZ\Content\JavaScript\PBZModLoader\bootstrap.js'; sha = '8079B254F18A6307FADE6646771C69F86A4EE849E00D6460EF9A3F1CD77FCEA5' },
    @{ rel = 'ProjectPBZ\PBZModLoader\LICENSES.txt';                    sha = '85B2BA9B64DF32A714321E15808F447BA1015593AE3AACA75CC6FECF4FF3C5C9' }
)
$exeDir = Join-Path $Game 'platform\steam'
$ourEntries = @($entries.Keys | Where-Object { $d = Join-Path $exeDir "$_.dll"; (Test-Path $d) -and (Get-FileHash $d).Hash -eq $entries[$_].sha })

if ($Uninstall) {
    foreach ($k in $ourEntries) { $d = Join-Path $exeDir "$k.dll"; Remove-Item $d; "removed $d" }
    foreach ($f in $common) { $d = Join-Path $Game $f.rel; if ((Test-Path $d) -and (Get-FileHash $d).Hash -eq $f.sha) { Remove-Item $d; "removed $d" } }
    "Left in place (delete by hand if wanted): $Game\ProjectPBZ\PBZModLoader\ (mods, loader.log)"
    return
}

if ($ourEntries.Count -gt 0) { throw "already installed with entry: $($ourEntries -join ', '). Use switch-loader-entry.ps1 to change it." }
$target = Join-Path $exeDir "$Entry.dll"
if (Test-Path $target) { throw "$target belongs to another tool; pick another -Entry." }
$plan = @(@{ s = Join-Path $Src $entries[$Entry].src; d = $target; sha = $entries[$Entry].sha }) +
        @($common | ForEach-Object { @{ s = Join-Path $Src $_.rel; d = Join-Path $Game $_.rel; sha = $_.sha } })
foreach ($p in $plan) {
    if ((Get-FileHash $p.s).Hash -ne $p.sha) { throw "hash mismatch: $($p.s)" }
    if ((Test-Path $p.d) -and (Get-FileHash $p.d).Hash -ne $p.sha) { throw "exists with other content, not overwriting: $($p.d)" }
}
foreach ($p in $plan) {
    New-Item -ItemType Directory -Force (Split-Path $p.d) | Out-Null
    if (-not (Test-Path $p.d)) { Copy-Item $p.s $p.d }
    '{0}  {1}' -f (Get-FileHash $p.d).Hash, $p.d
}
New-Item -ItemType Directory -Force (Join-Path $Game 'ProjectPBZ\PBZModLoader\mods') | Out-Null
"PBZModLoader 2.1.0 installed (entry $Entry.dll)."
