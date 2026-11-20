# AGENTS.md — 影之刃零（Phantom Blade Zero, PBZ）Mod 工坊

本文件是所有在此工作区工作的 agent（Claude Code、子代理、dsh/DeepSeek、Codex 等）的共同约定。`CLAUDE.md` 只是指向本文件的入口。

## 1. 工作区目标

- 学习 / 模仿现有的影之刃零 mod，开发自己的 mod。**非商用、开源（MIT）、纯爱好。**
- 本仓库是“PBZ mod 工坊”：可以容纳多个 mod，红妆鬼斩增强是第一个。
- 第一个 mod：**红妆鬼斩增强**（目录 `mods/hongzhuang-guizhan-plus/`）
  1. 普攻铺开的彼岸花（石蒜花）像 Boss 战时一样：**每隔几秒自动爆炸、爆炸后不消失**，持续削减敌人杀气。
  2. F 蓄力放出的白色彼岸花：**数量从 1 朵增加到 5 朵**。
- 英文名未确认（候选：Scarlet Wraithblade / Infernal Rouge / Crimson Rouge Ghost Slash），以游戏内文本为准。

## 2. 已知事实（标注来源可信度）

| 事实 | 状态 |
|---|---|
| 游戏路径 `Z:\SteamLibrary\steamapps\common\PBZ`，Steam 版 | 已观察 |
| 真正的主程序 `platform\steam\PBZ.exe`（约 476 MB）；根目录 `steam\PBZ.exe` 只是 1 MB 的启动器 | 已观察 |
| 资产容器为 UE5 IoStore：`ProjectPBZ\Content\Paks\ProjectPBZ-Windows.{pak,utoc,ucas}` + `_s1.._s65.ucas` 分片 | 已观察 |
| 引擎为 UE5（社区 UE4SS 包注明在 5.7.4 上测试） | 社区来源，未核实 |
| 游戏逻辑大量跑在 PuerTS（JS/TS）上，社区 PBZModLoader 借用它加载 TS/JS mod | 社区来源，未核实 |
| 资源加密，社区用 AESDumpster 从 PBZ.exe 取 AES key | 社区来源，未核实 |
| 2026-11 的游戏更新会对游戏脚本做 SHA-256 校验，社区出了补丁 / bypass | 社区来源，未核实 |
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

## 4. 工具约定

| 用途 | 首选工具 | 备注 |
|---|---|---|
| 浏览 / 导出 IoStore 资产、DataTable、JS 脚本 | FModel（+ AESDumpster 取 key） | UE 社区标准做法 |
| IoStore 解包 / 重新打包 | retoc / repak | 需要做 pak 替换类 mod 时 |
| 改 uasset 结构 | UAssetGUI / UAssetAPI | 需要 usmap 映射文件 |
| 运行时 hook、Lua mod | UE4SS（PBZ 专用社区版） | 官方原版在 PBZ 上不启动 mod |
| TS/JS 逻辑 mod | PBZModLoader（KintaroModding fork） | 支持 Alt+F5 热重载 |
| 阅读解包出的 JS 逻辑 | ripgrep + 直接读文件 | 默认做法，不需要额外工具 |
| JS 太大/压缩/打包到 grep 追不动 | REA CLI：`npx -y rea-agents@6.7.0 analyze-javascript-application <绝对路径> --json` | 升级手段，一次性运行，不注册 MCP |
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

## 7. 写作约定

- 文档用中文；代码注释中英皆可；标识符用英文。
- 游戏版本更新会让 mod 失效：每条 game-notes 记录都写上对应的游戏 build / 日期。
