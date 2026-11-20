# Switch the PBZModLoader entry DLL next to the game exe (only one entry at a time).
# Removes only loader DLLs whose hash matches the 2.1.0 package; never touches other tools' DLLs.
# Usage: powershell -ExecutionPolicy Bypass -File tools\scripts\switch-loader-entry.ps1 -Entry hid|winmm|dsound|dxgi|version
param(
    [Parameter(Mandatory)][ValidateSet('version','hid','winmm','dsound','dxgi')][string]$Entry,
    [string]$Game = 'Z:\SteamLibrary\steamapps\common\PBZ',
    [string]$Src = ''
)
if (-not $Src) { $Src = Join-Path (Split-Path -Parent $MyInvocation.MyCommand.Path) '..\bin\PBZModLoader-2.1.0\unzipped' }
$ErrorActionPreference = 'Stop'
if (Get-Process -Name PBZ -ErrorAction SilentlyContinue) { throw 'Close the game first.' }
$ours = @{
    'version' = @{ src = 'platform\steam\version.dll';            sha = 'F443EFF4E2A70CBBEC27E88B6B73BA7347FA0BD4A4365A015F71142A43F1A4DA' }
    'hid'     = @{ src = 'alternative-entries\hid\hid.dll';       sha = 'A741D9F8AB574E7161B972526502FFB3C92FEC1FF2F118EEAE13F4C96620516C' }
    'winmm'   = @{ src = 'alternative-entries\winmm\winmm.dll';   sha = '6A5C3BCA04B576BFBDC0635117E3EDD4360240454234CB1D76E3DA814DB3E3AF' }
    'dsound'  = @{ src = 'alternative-entries\dsound\dsound.dll'; sha = 'E90223DEF5ECE710DF99D98C663CEDC161319057A43A2ACE00AAFB76D01712AB' }
    'dxgi'    = @{ src = 'alternative-entries\dxgi\dxgi.dll';     sha = 'CAFFE51769014947E68C048CCEAA2C37F9B301D516D71C2DE34F3D42B143616B' }
}
$dir = Join-Path $Game 'platform\steam'
$target = Join-Path $dir "$Entry.dll"
if ((Test-Path $target) -and (Get-FileHash $target).Hash -ne $ours[$Entry].sha) { throw "$target exists and is not ours; not touching it." }
foreach ($k in $ours.Keys) {
    $d = Join-Path $dir "$k.dll"
    if ($k -ne $Entry -and (Test-Path $d) -and (Get-FileHash $d).Hash -eq $ours[$k].sha) { Remove-Item $d; "removed our $d" }
}
$s = Join-Path $Src $ours[$Entry].src
if ((Get-FileHash $s).Hash -ne $ours[$Entry].sha) { throw "hash mismatch: $s" }
Copy-Item $s $target -Force
'{0}  {1}' -f (Get-FileHash $target).Hash, $target
"entry is now $Entry.dll. Start the game, then check ProjectPBZ\PBZModLoader\loader.log"
