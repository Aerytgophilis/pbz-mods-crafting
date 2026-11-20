// PreToolUse 钩子：在关键节点前提醒主模型先咨询 advisor（Fable）。
// 钩子不能直接调用 advisor，只能注入提醒；是否咨询仍由模型决定。不阻止任何操作。
// 关键节点：推送/发布、写游戏目录、写 ADR。其他调用不输出任何东西。
import { readFileSync } from 'node:fs';

let input = {};
try { input = JSON.parse(readFileSync(0, 'utf8') || '{}'); } catch { process.exit(0); }

const tool = input.tool_name || '';
const ti = input.tool_input || {};
const cmd = String(ti.command || '');
const path = String(ti.file_path || ti.path || ti.destination || '').replace(/\\/g, '/');

const GAME = String.raw`steamapps[\\/]+common[\\/]+PBZ`;
const gameDir = new RegExp(GAME, 'i');
const reasons = [];

// 1. 推送 / 发布：只匹配处于命令位置的调用（行首或 ; & | 之后），避免 heredoc / 字符串里的字样误报
if (/(^|[;&|]\s*|\n\s*)(git(\s+-C\s+\S+)?\s+push|gh\s+release\s+(create|upload|edit)|gh\s+repo\s+create|gh\s+pr\s+merge)\b/i.test(cmd)) {
  reasons.push('推送或发布到 GitHub');
}

// 2. 用命令写游戏目录
if (gameDir.test(cmd)) {
  const copyLike = /\b(copy-item|move-item|new-item|remove-item|rename-item|robocopy|xcopy|cp|mv|rm|install|retoc|repak)\b/i;
  const writeInto = new RegExp(String.raw`\b(out-file|set-content|add-content|tee(-object)?)\b[^|;\n]*` + GAME, 'i');
  const redirectInto = new RegExp(String.raw`(^|[^0-9])>{1,2}\s*['"]?[^'"\s|;]*` + GAME, 'i');
  if (copyLike.test(cmd) || writeInto.test(cmd) || redirectInto.test(cmd)) reasons.push('写入游戏目录');
}

// 3. 用文件工具写游戏目录或 ADR
const isFileWrite = /^(Write|Edit|NotebookEdit)$/.test(tool) || /desktop-commander__(write_file|edit_block|move_file|create_directory)$/.test(tool);
if (isFileWrite && gameDir.test(path)) reasons.push('写入游戏目录');
if (isFileWrite && /(^|\/)docs\/decisions\/\d{4}-[^/]+\.md$/i.test(path)) reasons.push('修改架构决策记录（ADR）');
// 用命令改 ADR
if (/docs[\\/]+decisions[\\/]+\d{4}-[^\s'"]+\.md/i.test(cmd) && /\b(set-content|out-file|add-content|tee|sed\s+-i|mv|cp|move-item|copy-item)\b|>/i.test(cmd)) {
  reasons.push('修改架构决策记录（ADR）');
}

if (reasons.length) {
  const msg = `关键节点（${[...new Set(reasons)].join('、')}）：按 AGENTS.md §8.4，如果本会话还没就这一步咨询过 advisor（Fable），先咨询再继续；已经咨询过就照常进行。advisor 不可用时改派 Opus 子代理做对抗审计。`;
  process.stdout.write(JSON.stringify({
    hookSpecificOutput: { hookEventName: 'PreToolUse', additionalContext: msg },
  }));
}
process.exit(0);
