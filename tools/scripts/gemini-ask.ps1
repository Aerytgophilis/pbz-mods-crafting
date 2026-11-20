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
  [int]$TimeoutMin = 20,
  # 要审阅的文件（相对仓库根或绝对路径）。内容直接嵌进提示词，Gemini 不需要用工具读文件：
  # 无头模式下工具调用没法审批，会被自动拒绝。
  [string[]]$IncludeFiles = @()
)

$ErrorActionPreference = 'Stop'
$repo = (Resolve-Path (Join-Path $PSScriptRoot '..\..')).Path
if (-not $Cwd) { $Cwd = $repo }
$agy = Join-Path $env:LOCALAPPDATA 'agy\bin\agy.exe'
if (-not (Test-Path $agy)) { throw "找不到 agy：$agy" }
if (-not $Prompt -and -not $PromptFile) { throw '需要 -Prompt 或 -PromptFile' }

$preamble = @{
  advisor      = '你是这个项目的外部顾问（另一家模型）。不要修改任何文件。先给结论，再给理由和风险；明确区分已证实 / 推断 / 未知。'
  auditor      = '你是这个项目的审计员。不要修改任何文件。逐条列出问题：严重程度、证据（文件:行号）、建议修正。没有问题就直说没有。'
}[$Role]
$toolNote = if ($IncludeFiles.Count -gt 0) { '需要的文件内容已经附在本提示词末尾，直接阅读，不要再调用工具。' } else { '需要看文件时只用只读的文件读取工具；命令、写文件、联网都会被拒绝。' }
$preamble = "$preamble$toolNote"
$mode = 'plan'

$stamp = Get-Date -Format 'yyyyMMdd-HHmmss'
$runDir = Join-Path $repo ".agent-runs\gemini\$stamp-$Role"
New-Item -ItemType Directory -Force $runDir | Out-Null
$body = if ($PromptFile) { [IO.File]::ReadAllText((Resolve-Path $PromptFile), [Text.Encoding]::UTF8) } else { $Prompt }
$attached = New-Object Text.StringBuilder
# powershell -File 调用时逗号列表会作为一个字符串传进来，这里统一按逗号拆开
$fileList = @($IncludeFiles | ForEach-Object { $_ -split ',' } | ForEach-Object { $_.Trim() } | Where-Object { $_ })
foreach ($f in $fileList) {
  $full = if ([IO.Path]::IsPathRooted($f)) { $f } else { Join-Path $repo $f }
  if (-not (Test-Path $full)) { throw "找不到要附带的文件：$f" }
  $lines = [IO.File]::ReadAllLines($full, [Text.Encoding]::UTF8)
  [void]$attached.AppendLine("`n===== 文件：$f（共 $($lines.Count) 行，行号在左）=====")
  for ($i = 0; $i -lt $lines.Count; $i++) { [void]$attached.AppendLine(('{0,4}: {1}' -f ($i + 1), $lines[$i])) }
}
$promptPath = Join-Path $runDir 'prompt.md'
[IO.File]::WriteAllText($promptPath, "$preamble`n`n$body`n$($attached.ToString())", (New-Object Text.UTF8Encoding($false)))

$resultPath = Join-Path $runDir 'result.json'
$errLog = Join-Path $runDir 'stderr.log'
$final = Join-Path $runDir 'final.md'

# agy 1.5.13 的 `-p -` 不读 stdin（实测：会把 "-" 当成提示词）；完整提示词又超过 Windows 命令行长度上限。
# 所以参数里只放一句短指令，让模型用读文件工具读 prompt.md（读文件不需要审批，shell 命令会被自动拒绝）。
$relPrompt = $promptPath.Substring($Cwd.TrimEnd('\').Length + 1) -replace '\\', '/'
$instruction = "Read the file $relPrompt with your file-reading tool (do not run shell commands) and follow every instruction in it. Answer in Chinese."
# 只读权限（每次运行传入，不改全局配置）：只允许读工作区，拒绝命令、写文件、联网、MCP 和敏感路径。
# 不使用 --dangerously-skip-permissions：文档对它能否越过 deny 规则说法矛盾。
$roSettings = Join-Path $repo 'tools\agy\readonly-settings.json'
$argList = @('-p', "`"$instruction`"", '--settings', "`"$roSettings`"", '--model', $Model, '--mode', $mode, '--output-format', 'json', '--print-timeout', "$($TimeoutMin)m")
$p = Start-Process -FilePath $agy -ArgumentList $argList -WorkingDirectory $Cwd `
  -RedirectStandardOutput $resultPath -RedirectStandardError $errLog `
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
  if (-not $answer.Trim()) {
    $denied = @($j.denied_actions | ForEach-Object { $_.display_name }) -join ', '
    $answer = "[agy 没有给出答案]" + $(if ($denied) { " 被拒绝的工具调用：$denied（无头模式不能审批，用 -IncludeFiles 把文件内容附进提示词）" } else { '' })
    if ($code -eq 0) { $code = 1 }
  }
}
if ($code -eq 124) { $answer = "[超时：$TimeoutMin 分钟后被强制结束]`n$answer" }
[IO.File]::WriteAllText($final, [string]$answer, (New-Object Text.UTF8Encoding($false)))

Write-Output "exit=$code"
Write-Output $final
exit $code
