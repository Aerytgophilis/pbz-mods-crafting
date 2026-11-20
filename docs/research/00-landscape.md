# 00 · 现状调研（2026-11-20）

## 1. 有没有现成的“拆解游戏资产和代码”的 skill？

| 名称 | 是什么 | 对本项目的用处 |
|---|---|---|
| **REA**（`reverse-engineer-anything`，npm `rea-agents`，morluto/rea） | 本机已有。skill 在 `~/.agents/skills/`，MCP 配在 dsh 的 `rea.patch.yml`（Ghidra 12.1.4 + JDK21）。能分析原生二进制（Ghidra/IDA）、JS/Electron 树、压缩包、IL2CPP 元数据等 | **不认识 UE 的 pak / IoStore / uasset**。能派上用场的是：①解包后分析 PuerTS 的 JS 代码树（`analyze_javascript_application`，不需要 Ghidra）；②万不得已时逆 PBZ.exe |
| ReVa（cyberkaida） | Ghidra 扩展 + MCP | 跟 REA 的 Ghidra 部分重叠 |
| Anthropic 插件目录 “Reverse Engineering”（社区作者） | 纯指令型 skill | 没有工具，价值低 |
| Epic “Unreal Engine Skills” 插件 | 通过 MCP 操作 **Unreal Editor** | 只有在需要自己用 UE 编辑器做蓝图 / 资产再打包时才有用 |
| re-skill（vgrichina） | 面向复古游戏 ROM | 不适用 |

结论：没有一个 skill 能“直接拆 UE5 游戏的文件树”。UE 社区的标准做法是 **FModel（+ AESDumpster 取 key）浏览/导出资产，retoc/repak 打包**。REA 适合放在 FModel 之后，用来读懂 JS 逻辑。

## 2. 有没有公开或官方的 mod 制作指南？

- 官方：没有。S-GAME 没发布编辑器、SDK、文档，也没有 Steam 创意工坊。
- 社区：
  - Nexus Mods 上有约 880 个 PBZ mod，主要框架有：
    - PBZ 专用 UE4SS（官方原版在 PBZ 上不启动 mod）
    - PBZModLoader（TS/JS，借用游戏自带的 PuerTS；开发者包里带 TS 模板和 SDK）
    - Mod Manager（管理 PAK / Blueprint / UE4SS 三类 mod）
  - 通用 UE 指南：Dmgvol/UE_Modding（FModel 导出等）、Cracko298 的 AES key 提取指南。
  - 开源示例：KintaroModding 的几个 PBZModLoader mod、pepperdoesthings/PBZ-Pepper-Scripts（ScriptModLoader，打 override pak）。
  - 国内：B 站、游民星空、3DM、游侠、yzrwiki 有 mod 合集和安装教程，偏向玩家使用，不讲开发。

## 3. 想做的 mod 是否已经存在？

截至今天没找到。最接近的是：
- B 站“把所有人变成负心汉”（红妆鬼斩相关的玩梗 mod，AI 生成的语音和代码，有“阿花同款投技”版本）——说明有人碰过红妆鬼斩 / 阿花 Boss 的技能资源，值得作为参考对象。
- 白赤练外观 + 语音 mod、Baishan Bladestorm 招式重做、True Aureate 武器特效 mod——都可以作为“改武器技能”的参考。

Nexus 页面对自动抓取返回 403，武器分类没有逐个核对，后续可在内置浏览器里人工看。

## 来源

- https://www.nexusmods.com/games/phantombladezero/mods
- https://www.nexusmods.com/phantombladezero/mods/5 （UE4SS for PBZ）
- https://www.nexusmods.com/phantombladezero/mods/113 （PBZModLoader）
- https://www.nexusmods.com/phantombladezero/mods/520 （UE4SS CPP bypass for PAK mods）
- https://www.nexusmods.com/phantombladezero/mods/45 （提到 AESDumpster）
- https://github.com/KintaroModding/phantombladezero_pbzmodloader
- https://github.com/zoneoflkf/PBZModLoader
- https://github.com/pepperdoesthings/PBZ-Pepper-Scripts
- https://github.com/Dmgvol/UE_Modding
- https://github.com/Cracko298/UE4-AES-Key-Extracting-Guide
- https://bladezero.org/mods/
- https://howtovideogame.com/phantom-blade-zero-mods/
- https://www.bilibili.com/video/BV1r6sj6jEia/
- https://www.gamersky.com/news/202611/2240174.shtml
- https://github.com/morluto/rea
