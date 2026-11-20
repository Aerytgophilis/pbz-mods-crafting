<#
.SYNOPSIS
  静默无头运行一个 dsh（DeepSeek Harness）工人任务：不开端口，跑完自动退出，超时强杀进程树。
  默认先用 MiniMax M3.1 Flash，失败时自动退到 DeepSeek V4.1 Flash。

.EXAMPLE
  powershell -NoProfile -File tools\scripts\dsh-worker.ps1 -TaskFile .agent-runs\tasks\extract.md
  powershell -NoProfile -File tools\scripts\dsh-worker.ps1 -Task "列出 extracted/ 下所有含 lycoris 的 JS 文件" -TimeoutMin 10

.NOTES
  - 用 headless profile：没有 HTTP/浏览器层，不监听任何端口（见 dsh-headless README）。
  - 沙箱根目录 = -Cwd（默认仓库根）；权限模式默认 read-only（写入一律被拒）。需要写文件时传 -PermissionMode workspace-write，并把 -Cwd 指到专门的输出目录。
  - dsh 安装位置默认 Z:\Tools\deepseek-harness，可用环境变量 DSH_HARNESS_DIR 覆盖。
  - 复用 dsh Web 界面已保存的凭据（tools/dsh/headless-stored-credentials.patch.yml），脚本不接触密钥。
  - 模型：-Model auto（默认）= minimax-flash，失败（退出码非 0、没有 final 事件、或答案为空）时改用 deepseek-flash 重跑一次。
    超时（124）不重跑：超时说明任务太大，换模型也一样。指定具体模型时不做回退。
  - 日志写到 .agent-runs/dsh/<时间戳>-<名字>/：task.md、每次尝试的 events-<模型>.jsonl 和 stderr-<模型>.log、
    model.txt（最终给出答案的模型）、final.md。
  - 退出码：0 成功；1 dsh 报失败（回退后仍失败）；124 超时被杀。stdout 打印 exit=、model=，最后一行是 final.md 路径。
#>
param(
  [string]$Task,
  [string]$TaskFile,
  [string]$Name = 'task',
  [string]$Cwd,
  [int]$TimeoutMin = 30,
  [ValidateSet('read-only', 'workspace-write')]
  [string]$PermissionMode = 'read-only',  # 默认只读；要写文件时显式传 workspace-write，并尽量把 -Cwd 指到输出目录
  # auto = MiniMax M3.1 Flash，失败时回退 DeepSeek V4.1 Flash（T3）
  # minimax-flash / deepseek-flash = 只用这一个（T3）；deepseek-v4-pro = DeepSeek-V4-Pro（T2）
  [ValidateSet('auto', 'minimax-flash', 'deepseek-flash', 'deepseek-v4-pro')]
  [string]$Model = 'auto'
)

$ErrorActionPreference = 'Stop'
$repo = (Resolve-Path (Join-Path $PSScriptRoot '..\..')).Path
if (-not $Cwd) { $Cwd = $repo }
$dshHome = if ($env:DSH_HARNESS_DIR) { $env:DSH_HARNESS_DIR } else { 'Z:\Tools\deepseek-harness' }
$dshBin = Join-Path $dshHome 'node_modules\@deepseek-ai\dsh\lib\bin.js'
$credPatch = Join-Path $repo 'tools\dsh\headless-stored-credentials.patch.yml'
$modelPatches = @{ 'minimax-flash' = 'model-minimax-m3.1-flash.patch.yml'; 'deepseek-v4-pro' = 'model-deepseek-v4-pro.patch.yml' }

if (-not $Task -and -not $TaskFile) { throw '需要 -Task 或 -TaskFile' }
if (-not (Test-Path $dshBin)) { throw "找不到 dsh：$dshBin" }

$stamp = Get-Date -Format 'yyyyMMdd-HHmmss'
$safeName = ($Name -replace '[^\w\-]', '_')
$rand = [Guid]::NewGuid().ToString('N').Substring(0, 6)
$runDir = Join-Path $repo ".agent-runs\dsh\$stamp-$safeName-$rand"
New-Item -ItemType Directory -Force $runDir | Out-Null

$taskPath = Join-Path $runDir 'task.md'
# TaskFile 按 BOM 自动识别编码（无 BOM 视为 UTF-8），统一转成无 BOM 的 UTF-8 再交给 dsh
if ($TaskFile) { $Task = [IO.File]::ReadAllText((Resolve-Path $TaskFile), [Text.Encoding]::UTF8) }
[IO.File]::WriteAllText($taskPath, $Task, (New-Object Text.UTF8Encoding($false)))

# 只对本进程生效的环境变量
$env:DSH_PERMISSION_MODE = $PermissionMode
$env:DSH_TELEMETRY_DISABLED = '1'

function Invoke-DshAttempt([string]$m) {
  $events = Join-Path $runDir "events-$m.jsonl"
  $errLog = Join-Path $runDir "stderr-$m.log"
  $argList = @("`"$dshBin`"", '--profile', 'headless', '--patch', "`"$credPatch`"")
  if ($modelPatches[$m]) { $argList += @('--patch', "`"$(Join-Path $repo "tools\dsh\$($modelPatches[$m])")`"") }
  $argList += @('--json', '-')
  $p = Start-Process -FilePath 'node' -ArgumentList $argList -WorkingDirectory $Cwd `
    -RedirectStandardInput $taskPath -RedirectStandardOutput $events -RedirectStandardError $errLog `
    -NoNewWindow -PassThru
  $null = $p.Handle  # 缓存句柄，否则 PowerShell 5.1 读不到 ExitCode

  $code = 0
  if (-not $p.WaitForExit($TimeoutMin * 60 * 1000)) {
    & taskkill.exe /T /F /PID $p.Id | Out-Null
    $code = 124
  } else {
    $p.WaitForExit()
    $code = $p.ExitCode
  }

  # 只取第一个 final 事件
  $answer = $null
  if (Test-Path $events) {
    foreach ($line in [IO.File]::ReadAllLines($events, [Text.Encoding]::UTF8)) {
      if ($line -match '"type"\s*:\s*"final"') {
        try { $answer = [string](($line | ConvertFrom-Json).text) } catch { $answer = '' }
        break
      }
    }
  }
  if ($code -eq 124) {
    $answer = "[超时：$TimeoutMin 分钟后被强制结束]`n$answer"
  } elseif ($null -eq $answer) {
    $answer = "[没有 final 事件：dsh 未正常结束，见 stderr-$m.log / events-$m.jsonl]"
    if ($code -eq 0) { $code = 1 }
  } elseif (-not $answer.Trim()) {
    $answer = "[$m 返回了空答案]"
    if ($code -eq 0) { $code = 1 }
  }
  return @{ Code = $code; Answer = $answer; Model = $m }
}

$chain = if ($Model -eq 'auto') { @('minimax-flash', 'deepseek-flash') } else { @($Model) }
$notes = @()
$result = $null
foreach ($m in $chain) {
  $result = Invoke-DshAttempt $m
  if ($result.Code -eq 0 -or $result.Code -eq 124) { break }
  $notes += "[$m 失败（exit=$($result.Code)），已回退]"
}
if ($result.Code -ne 0 -and $notes.Count -gt 0) { $notes = $notes[0..($notes.Count - 2)] }  # 最后一次失败不算“已回退”

$final = Join-Path $runDir 'final.md'
$text = (($notes + @($result.Answer)) -join "`n")
[IO.File]::WriteAllText($final, $text, (New-Object Text.UTF8Encoding($false)))
[IO.File]::WriteAllText((Join-Path $runDir 'model.txt'), $result.Model, (New-Object Text.UTF8Encoding($false)))

Write-Output "exit=$($result.Code)"
Write-Output "model=$($result.Model)"
Write-Output $final
exit $result.Code
