# AGENTS.md — 影之刃零（Phantom Blade Zero, PBZ）Mod 工坊

本文件是所有在此工作区工作的 agent（Claude Code、子代理、dsh/DeepSeek、Codex 等）的共同约定。`CLAUDE.md` 只是指向本文件的入口。

## 1. 工作区目标

- 学习 / 模仿现有的影之刃零 mod，开发自己的 mod。**非商用、开源（MIT）、纯爱好。**
- 本仓库是“PBZ mod 工坊”：可以容纳多个 mod，红妆鬼斩增强是第一个。
- 第一个 mod：**红妆鬼斩增强**（目录 `mods/hongzhuang-guizhan-plus/`）
  1. 场地彼岸花：存在时间不变，期间**每隔几秒自动爆炸且不消失**，到期仍爆炸一次再消失；**按 E 主动引爆后花不消失**，E 有 5 s 冷却；持续削减敌人杀气。完整规格与平衡参数见该 mod 的 README。
  2. F 蓄力（= 按住重击，Lv25“火照黄泉”）放出的白色彼岸花：**数量从 1 朵增加到 5 朵**。用户的武器 ≥ Lv25，两个效果都能实测。
- 英文名 **Scarlet Wraithblade**（多个来源一致；Infernal Rouge 是另一把武器 `weapon_hei_mo_shang`）。内部代号候选 `GuiTouBlade` / `AHuaBlade` / `HongZhuangGuiZhan`，待 DataTable 核实。

## 2. 已知事实（标注来源可信度）

| 事实 | 状态 |
|---|---|
| 游戏路径 `Z:\SteamLibrary\steamapps\common\PBZ`，Steam 版 | 已观察 |
| 真正的主程序 `platform\steam\PBZ.exe`（约 476 MB）；根目录 `steam\PBZ.exe` 只是 1 MB 的启动器 | 已观察 |
| 资产容器为 UE5 IoStore：`ProjectPBZ\Content\Paks\ProjectPBZ-Windows.{pak,utoc,ucas}` + `_s1.._s65.ucas` 分片 | 已观察 |
| Steam build `26367565`，exe 版本串 `CL-302256_JKS-17280`（11-04 补丁之后） | 已观察（appmanifest、exe） |
| 引擎为 S-GAME 定制的 UE 5.7.4 | 社区来源（usmap 文件名、UE4SS 测试记录） |
| 游戏自带 PuerTS，约 216 个 JS 模块打在 `ProjectPBZ-Windows.pak` 的 `Content/JavaScript/`；已知模块偏 UI、存档、Boss 记录。**彼岸花和技能的战斗逻辑在 Blueprint / GAS 里，不在 JS 里** | 社区来源 + SDK 反射（路线 A、C 论证） |
| 资源加密（utoc ContainerFlags 含 Encrypted 位，pak 索引加密）；key 的获取方式待定，见 ADR-0001 | 已观察 |
| 11-04 补丁起，游戏逐字节校验自带 JS 脚本：用 pak 改 JS 会卡在标题画面；纯资产 pak 不受影响 | 社区实测（pepperdoesthings、随机器项目） |
| 主容器 utoc 未签名（ContainerFlags=0x0B，无 Signed 位），目录里无 .sig | 已观察（路线 C 论证） |
| 官方（S-GAME）没有发布 mod 工具、SDK、文档，也没有表态支持 mod | 二手来源 |
| 尚未发现实现上述两个效果的现成 mod | 截至 2026-11-20 的检索 |
| 游戏目录里目前没有装任何 mod 框架（无 UE4SS / LogicMods / PBZModLoader） | 已观察 |

写结论时一律区分 **观察到的 / 推断的 / 未知的**，并写明来源（文件路径、URL、Evidence ID）。

## 3. 硬性规则

1. **游戏目录默认只读。** 往游戏目录安装、替换、删除任何文件之前：先征得用户同意，先把要动的文件备份到 `backups/<日期>/`，并在 `docs/install-log.md` 记一笔。
2. **不提交游戏资产。** 解包出来的 uasset、JS 脚本、贴图、音频等只放在被 gitignore 的 `extracted/`；仓库里只放我们自己写的代码、文档和必要的小段引用（附出处）。
3. **第三方 mod 只做学习参考。** 下载的 mod 放进 `references/<mod名>/`（gitignore），每个一个独立目录；未经许可不把别人的代码复制进 `mods/`。借鉴思路时在 README 致谢并链接原作。
4. **下载的工具和压缩包视为不可信。** 各自放进 `tools/bin/<工具名>-<版本>/` 的独立空目录，不在其目录里运行解释器；下载前向用户说明文件名、来源和大小并取得同意。工具清单和版本登记在 `tools/README.md`。
5. **不做联网 / 反作弊相关的事。** 只做单机体验修改；不碰账号、联机、成就伪造。
6. **不在对话外部泄露用户的个人信息**（邮箱、账号名等）。
7. **避免过度工程。** 先用最简单、能解决问题的工具和做法；新增工具、框架、MCP、抽象层之前，要说清楚“不加它就卡在哪一步”。即使用户点名某个工具，如果评估后不必要，也要直说并给出理由，而不是照做。
8. **改动游戏之前备份存档。** 第一次装任何 mod、以及每次测试可能影响存档的改动之前，把 `ProjectPBZ\Saved\SaveGames\` 复制到 `backups/<日期>/saves/`。存档有 Steam 云同步，坏档会被同步上去，所以本地备份是唯一的回退手段。

## 4. 工具约定

| 用途 | 首选工具 | 备注 |
|---|---|---|
| 浏览 / 导出 IoStore 资产、DataTable、JS 脚本 | FModel（+ AESDumpster 取 key） | UE 社区标准做法 |
| IoStore 解包 / 重新打包 | retoc / repak | 需要做 pak 替换类 mod 时 |
| 改 uasset 结构 | UAssetGUI / UAssetAPI | 需要 usmap 映射文件 |
| 运行时 hook、Lua mod | UE4SS v4.0.0+（PBZ 配置已于 2026-11-12 合并进上游，PR #1484） | 热重载 Ctrl+R 会崩；改 BP 函数返回值可行 |
| TS/JS 逻辑 mod | PBZModLoader（KintaroModding fork） | 支持 Alt+F5 热重载 |
| 阅读解包出的 JS 逻辑 | ripgrep + 直接读文件 | 默认做法，不需要额外工具 |
| JS 太大/压缩/打包到 grep 追不动 | REA CLI：`npx -y rea-agents@6.7.0 analyze-javascript-application <绝对路径> --json` | 升级手段，一次性运行，不注册 MCP；`npx` 会下载包，运行前按规则 4 征得同意 |
| 二进制逆向 PBZ.exe | 在 dsh 的 REA 会话里用 Ghidra 12.1.4（`Z:\Tools\Ghidra`，JDK 21 `Z:\Tools\jdk21`） | 最后手段；476 MB 的 exe 导入分析很慢 |

### REA 的定位（2026-11-20 评估）

结论：**REA 不在默认工作流里，也不在 Claude Code 里注册 MCP。**

- REA 不认识 pak / IoStore / uasset，解包这一步必须靠 FModel / retoc。
- 解包后的 JS 如果是可读文本，ripgrep + 读文件已经够用，REA 的模块依赖图只是锦上添花。
- 注册 MCP 代价高：dsh 里 REA 有 207 个工具，约 22 万 token 的上下文开销。
- 只有出现以下情况才启用，并且优先用 CLI：① JS 是压缩或打包过的大文件，grep 追不出调用链；② 需要的逻辑不在 JS / 资产层，只能逆 PBZ.exe（这时去 dsh 的 REA 会话，启动脚本 `Z:\Tools\deepseek-harness\start-dsh-re.cmd`）。
- skill 位置：`~/.agents/skills/reverse-engineer-anything`；dsh 配置：`~/.dsh/patches/rea.patch.yml`。

## 5. 目录结构

```
Z:\Mods_crafting\
├─ AGENTS.md / CLAUDE.md / README.md / LICENSE / .gitignore
├─ docs/
│  ├─ research/            调研、路线对比、工具笔记
│  │  └─ routes/           三条技术路线的论证与反驳
│  ├─ game-notes/          逆向发现：技能、Buff、DataTable、JS 模块的定位记录
│  ├─ decisions/           决策记录（ADR），编号 0001-xxx.md
│  └─ install-log.md       每次改动游戏目录的记录
├─ mods/
│  └─ hongzhuang-guizhan-plus/   第一个 mod（内部结构等路线确定后再定）
├─ tools/
│  ├─ README.md            工具清单、版本、下载来源、哈希
│  ├─ scripts/             我们自己的脚本（解包、部署、备份、打包）
│  └─ bin/                 （gitignore）下载的第三方工具
├─ extracted/              （gitignore）解包产物
├─ references/             （gitignore）下载来学习的第三方 mod
└─ backups/                （gitignore）游戏文件备份
```

## 6. 工作流程

1. 调研 → `docs/research/`
2. 定路线 / 做取舍 → `docs/decisions/` 写 ADR
3. 解包定位 → `docs/game-notes/` 记录找到的资产路径、函数、数值。逐级升级，上一级能解决就不进下一级：
   1. AESDumpster 取 key → FModel 加载 `ProjectPBZ\Content\Paks`，按名字搜武器 / 彼岸花 / 石蒜 / 阿花相关的资产和 JS 脚本，导出到 `extracted/`
   2. 用 ripgrep 和读文件追踪 JS 逻辑和 DataTable 字段
   3. 追不动时，用 REA CLI 分析 `extracted/` 里的 JS 树
   4. JS 和资产层都找不到时，才用 dsh + REA + Ghidra 逆向 PBZ.exe
4. 实现 → `mods/<mod>/`
5. 部署测试：由用户在游戏里验证；agent 只在用户同意后部署，并写 `docs/install-log.md`
6. 发布：GitHub（MIT），README 写清前置依赖、安装方法、兼容的游戏版本、致谢

### 会话划分

- 工作流的每一步（第 0 步解包定位、实现、测试、发布……）**尽量在一个新会话里做**。上一步的结论必须先落到文件（`docs/game-notes/`、`docs/decisions/`、mod README），新会话从文件开始，不依赖旧会话的上下文。
- 开新会话时，交接说明里写清：读哪些文件、这一步要回答的问题、完成标准、禁止做的事。

## 7. 写作约定

- 文档用中文；代码注释中英皆可；标识符用英文。
- 游戏版本更新会让 mod 失效：每条 game-notes 记录都写上对应的游戏 build / 日期。

## 8. 模型分档与多 agent 编排

原则：**能用低档就不用高档**；升档要说得出低档卡在哪。高档只做判断，不做体力活。

### 8.1 分档

| 档 | 模型 | 怎么调用 | 状态 |
|---|---|---|---|
| T0 超旗舰 | Fable 5.2 | Claude Code advisor（`advisorModel: "fable"`，写在不提交的 `.claude/settings.local.json`） | 可用。Pro 计入 usage credits，Max 计入套餐额度 |
| T1 旗舰 | Opus 5.5 | 主会话；或 Agent 工具 `model: "opus"` 做对抗审计、设计类子任务 | 可用 |
| T1 旗舰（跨厂商） | Gemini 4 Neon | `tools/scripts/gemini-ask.ps1`（agy 无头） | **可用**（2026-11-20 起）：跨厂商审计 / 顾问。每次运行都带 `tools/agy/readonly-settings.json`：只能读工作区，命令、写文件、联网、MCP 和敏感路径（`extracted/_local`、`.git`、本地设置）一律拒绝（2026-11-20 实测）。**禁止使用 `--dangerously-skip-permissions`**。要审的文件可用 `-IncludeFiles` 直接嵌进提示词。只能在用户的真实终端里跑（凭据在用户的系统钥匙串里，Claude 的沙箱 shell 读不到） |
| T2 中档 | Sonnet 5.5；DeepSeek V4 Pro（dsh `deepseek-v4-pro`） | Agent 工具 `model: "sonnet"`；`dsh-worker.ps1 -Model deepseek-v4-pro` | 可用 |
| T3 Flash | **MiniMax M3.1 Flash（默认）**，失败时自动回退 DeepSeek V4.1 Flash（dsh 别名 `deepseek-flash`）；Haiku 5.5 | `tools/scripts/dsh-worker.ps1`（`-Model auto` 为默认；也可指定 `minimax-flash` / `deepseek-flash`，指定时不回退）；Agent 工具 `model: "haiku"` | 可用（默认和回退都已实测，2026-11-20） |

### 8.2 什么活给哪一档

| 工作 | 默认档 | 说明 |
|---|---|---|
| 大量阅读、grep 解包产物、整理资产清单、日志分拣、批量格式化 | T3 dsh 工人 | 默认 `-PermissionMode read-only`；需要写文件时只写 `.agent-runs/` 或指定输出目录 |
| 反复调试循环（改一个数 → 看结果）、机械性重复修改 | T3 dsh 工人 | 每轮一个任务文件，结果看 `final.md` |
| 常规实现、调研综述、代码审查 | T2 | |
| 路线辩护、对抗审计、跨文件设计 | T1 Opus 子代理 | |
| 编排、做决定、和用户沟通、最终把关 | T1 主会话 | |
| 关键节点的第二意见 | T0 advisor | 见 8.4 |

**必须交给 T3 工人的情形**（2026-11-20 审计：第 0、1 步共约 1500 条消息，工人调用次数为 0，体力活全由 Opus 主会话自己做）：

- 为了写一份摘要或清单，要读 5 个以上文件，或者 200 KB 以上的导出 JSON、字节码文本、日志；
- 在 `extracted/` 里跨文件 grep 并整理成表（资产引用链、字段默认值、类型清单）；
- 批量转换或格式化（例如批量跑 `kismet2txt.py` 后挑出相关函数）；
- `loader.log`、测试日志超过约 200 行时的分拣和统计。

做法：会话在任务清单里标出哪些步骤交给工人；不交的话写一行理由（例如“只有 2 个文件”“需要逐行对照字节码做判断”）。主会话对工人结果抽查 1～2 处再采用。

### 8.3 dsh 无头工人约定

- 一律通过 `tools/scripts/dsh-worker.ps1` 调用：headless profile，**不开任何端口**，任务完成后进程自动退出，超时（默认 30 分钟）强杀进程树，退出码 124。
- **模型**：默认先用 MiniMax M3.1 Flash；退出码非 0、没有 final 事件或答案为空时，自动用 DeepSeek V4.1 Flash 重跑一次。超时不重跑。stdout 的 `model=` 和运行目录里的 `model.txt` 记录最终给出答案的模型。
- **默认 `read-only`**：写入会被自动拒绝，不会卡在审批上。需要写文件时显式传 `-PermissionMode workspace-write`，并把 `-Cwd` 指到专门的输出目录，而不是仓库根。理由：工人会读解包出来的、不受信的游戏 JS，不能让它有权限改 `.claude/` 或 `.git/`。
- 复用 dsh Web 界面已保存的凭据（`tools/dsh/headless-stored-credentials.patch.yml`），脚本不接触密钥；关闭 dsh 遥测。
- 日志在 `.agent-runs/dsh/<时间戳>-<名字>/`（不提交）。主会话只读 `final.md`，需要时再翻 `events.jsonl`。
- 如果确实需要常驻的 dsh Web 实例，端口用 3090 以上，避开日常的 3080 和逆向用的 3081。

### 8.4 关键节点咨询 advisor（Fable）

以下节点，主会话先咨询 advisor 再继续（同一节点在本会话已咨询过就不重复）：

1. 路线 / 架构决策（ADR）定稿前
2. 第一次往游戏目录安装或替换任何文件前
3. 推送到 GitHub、发布 release 前
4. 同一个问题连续两次调试失败后
5. 宣布某个 mod 效果完成前

`.claude/hooks/advisor-gate.mjs`（PreToolUse）会在 `git push`、`gh release create/upload/edit`、写游戏目录、改 `docs/decisions/` 时注入提醒。**钩子只能提醒，不能强制咨询，也不会阻止操作**；advisor 不可用时，改为派一个 T1 Opus 子代理做对抗审计。

### 8.5 环境注意

- Claude Code 的 Bash / PowerShell 工具跑在沙箱里：写到工作区和临时目录以外（例如 `%LOCALAPPDATA%`）的内容，用户的真实环境看不到。要装到用户环境的东西，用 Terminal 面板在用户 shell 里执行。
- Windows PowerShell 5.1 读 `.ps1` 需要 **UTF-8 带 BOM**，否则中文会乱码导致解析失败。
