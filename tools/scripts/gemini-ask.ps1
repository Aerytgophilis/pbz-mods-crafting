<#
.SYNOPSIS
  无头调用 Antigravity CLI（agy）里的 Gemini，担任顾问 / 审计 / 分项编排。跑完自动退出。

.EXAMPLE
  powershell -NoProfile -File tools\scripts\gemini-ask.ps1 -Role auditor -PromptFile .agent-runs\tasks\audit-adr-0001.md
  powershell -NoProfile -File tools\scripts\gemini-ask.ps1 -Role advisor -Prompt "评估 docs/decisions/0001 的路线选择"

.NOTES
  - advisor / auditor：--mode plan，只读调研，不改文件。
  - 不提供会改文件的编排角色：等有具体分项需要时再加（AGENTS.md 规则 7）。
  - 可用模型取决于账号套餐，slug 以 `agy models` 为准。
  - 2026-11-20 状态：当前账号未通过 Antigravity 资格检查，暂不可用。
  - 日志写到 .agent-runs/gemini/<时间戳>-<角色>/：prompt.md、result.json、stderr.log、final.md。
  - 退出码：0 成功；非 0 为 agy 报错或超时。最后一行 stdout 打印 final.md 路径。
#>
param(
  [string]$Prompt,
  [string]$PromptFile,
  [ValidateSet('advisor', 'auditor')]
  [string]$Role = 'advisor',
  [string]$Model = 'gemini-4-neon-high',
  [string]$Cwd,
  [int]$TimeoutMin = 20
)

$ErrorActionPreference = 'Stop'
$repo = (Resolve-Path (Join-Path $PSScriptRoot '..\..')).Path
if (-not $Cwd) { $Cwd = $repo }
$agy = Join-Path $env:LOCALAPPDATA 'agy\bin\agy.exe'
if (-not (Test-Path $agy)) { throw "找不到 agy：$agy" }
if (-not $Prompt -and -not $PromptFile) { throw '需要 -Prompt 或 -PromptFile' }

$preamble = @{
  advisor      = '你是这个项目的外部顾问（另一家模型）。只读调研，不要修改任何文件。先给结论，再给理由和风险；明确区分已证实 / 推断 / 未知。项目约定见 AGENTS.md。'
  auditor      = '你是这个项目的审计员。只读检查，不要修改任何文件。逐条列出问题：严重程度、证据（文件:行号或 URL）、建议修正。没有问题就直说没有。项目约定见 AGENTS.md。'
}[$Role]
$mode = 'plan'

$stamp = Get-Date -Format 'yyyyMMdd-HHmmss'
$runDir = Join-Path $repo ".agent-runs\gemini\$stamp-$Role"
New-Item -ItemType Directory -Force $runDir | Out-Null
$body = if ($PromptFile) { [IO.File]::ReadAllText((Resolve-Path $PromptFile), [Text.Encoding]::UTF8) } else { $Prompt }
$promptPath = Join-Path $runDir 'prompt.md'
[IO.File]::WriteAllText($promptPath, "$preamble`n`n$body", (New-Object Text.UTF8Encoding($false)))

$resultPath = Join-Path $runDir 'result.json'
$errLog = Join-Path $runDir 'stderr.log'
$final = Join-Path $runDir 'final.md'

# 任务正文从 stdin 传入，避免命令行长度和引号问题
$argList = @('-p', '-', '--model', $Model, '--mode', $mode, '--output-format', 'json', '--print-timeout', "$($TimeoutMin)m")
$p = Start-Process -FilePath $agy -ArgumentList $argList -WorkingDirectory $Cwd `
  -RedirectStandardInput $promptPath -RedirectStandardOutput $resultPath -RedirectStandardError $errLog `
  -NoNewWindow -PassThru
$null = $p.Handle

$code = 0
if (-not $p.WaitForExit(($TimeoutMin + 2) * 60 * 1000)) {
  & taskkill.exe /T /F /PID $p.Id | Out-Null
  $code = 124
} else {
  $p.WaitForExit()
  $code = $p.ExitCode
}

$answer = ''
$j = $null
try { $j = Get-Content $resultPath -Raw -Encoding UTF8 | ConvertFrom-Json } catch { }
if ($null -eq $j) {
  $answer = '[agy 没有输出可解析的 JSON，见 result.json / stderr.log]'
  if ($code -eq 0) { $code = 1 }
} else {
  $answer = [string]$j.response
  if ($j.status -ne 'SUCCESS' -and $j.error) { $answer = "[agy $($j.status)] $($j.error)`n$answer" }
}
if ($code -eq 124) { $answer = "[超时：$TimeoutMin 分钟后被强制结束]`n$answer" }
[IO.File]::WriteAllText($final, [string]$answer, (New-Object Text.UTF8Encoding($false)))

Write-Output "exit=$code"
Write-Output $final
exit $code
