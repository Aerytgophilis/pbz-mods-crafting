# 发布规划：第一次公开发布 mod

适用于本工坊的所有 mod，以红妆鬼斩增强（`hongzhuang-guizhan-plus`）为第一个实例。调研日期 2026-11-20。

## 0. 先说结论

- **主发布平台：Nexus Mods**（PBZ 版块约 880+ 个 mod，是这款游戏事实上的主社区）。**GitHub Release** 作为源码和备用下载。中文圈用 **B 站视频**做展示。
- **没有“官方 mod 社区”。** S-GAME 没有发布 mod 工具、没有 Steam 创意工坊，也没有表态支持 mod。所以发布页要写清“非官方、与 S-GAME 无关”。
- 第一次发布最容易踩的三个坑：
  1. **AI 披露**：Nexus 从 2026-11-03 起强制披露 AI 参与，我们的代码主要由 AI 写成，必须打 **AI-Generated Content** 标签并说明用了哪些工具。
  2. **依赖别人的 mod**：我们依赖 PBZModLoader，Nexus 规定“主要用来和别人的 mod 交互的内容需各方同意”。发布前先礼貌知会加载器作者。
  3. **不能打包游戏资产或别人的文件**：只发我们自己写的 JS 和配置，加载器只链接、不转载。

## 1. 平台与分工

| 平台 | 用途 | 说明 |
|---|---|---|
| Nexus Mods（phantombladezero 版块） | 主下载页、评论、Bug 反馈 | 需要你本人注册账号；作者名用网名，不用真名和邮箱 |
| GitHub Release（本仓库） | 源码、同一份 zip、SHA-256、Issue | 已有仓库，MIT |
| B 站 | 中文展示视频（前后对比） | 简介里放 Nexus 和 GitHub 链接 |
| 3DM / 游侠 / 18183 / yzrwiki | **不主动上传** | 这些站常自行转载；在 Nexus 权限里写明转载规则即可 |

## 2. 发布前必须完成的事（清单）

### 2.1 合规

- [ ] **AI 披露**（Nexus AI 政策 2026-11-05 版）：
  - 打 **AI-Generated Content** 标签（AI 写了大部分代码）。
  - 如果缩略图或说明文字也由 AI 生成，再加 **AI Media** 标签；**真实游戏截图不能用 AI 图冒充**。
  - 说明页写明用了哪些 AI 工具（例如 Claude Code / Opus、Fable、DeepSeek 工人），以及最终 mod 里哪些部分是 AI 产出。
  - 保留版本历史（本仓库 git log 就是证据）；被质询时要能解释代码。
  - 以后版本如果大幅改了 AI 产出的部分，同步更新披露。
- [ ] **依赖知会**：给 PBZModLoader 作者（Nexus mod 113 / GitHub KintaroModding、zoneoflkf）留言，说明我们的 mod 依赖它、只链接不转载、MIT 开源。等对方回复或至少等几天再发布。
- [ ] **不转载**：发布包里不含 `version.dll`、加载器脚本、UE4SS、SDK 的 `.d.ts`，也不含任何游戏资产。
- [ ] **许可**：mod 代码 MIT；说明页写明“游戏截图与游戏内容版权归 S-GAME，不在 MIT 范围内”。
- [ ] **Nexus 权限设置**（与 MIT 一致）：允许修改、允许在注明出处的前提下转载和改编；AI 训练用途保持“Ask Me”或按你的意愿；Donation Points **不开启**（坚持非商用）。
- [ ] **单机声明**：说明页写明只影响单机体验，不涉及联网、成就或反作弊；建议玩家备份存档。

### 2.2 质量

- [ ] 在干净安装（只装加载器 + 本 mod）上完整测试两个效果，存档备份后测试。
- [ ] 测试卸载：删除 mod 文件夹后游戏和存档正常。
- [ ] 测试与常见 mod 共存（UE4SS、Mods Menu、其他改红妆鬼斩的 mod）。
- [ ] 所有平衡参数都有默认值，配置文件有注释。
- [ ] 记录：对应的游戏 build、加载器版本、测试日期。

## 3. 资产管理

### 3.1 仓库里放什么

```
mods/hongzhuang-guizhan-plus/
├─ README.md            规格、安装、配置说明（中文为主）
├─ CHANGELOG.md         每个版本改了什么
├─ src/                 mod 源码（main.js、配置）
└─ release/             说明页文案（Nexus BBCode、B 站简介）
```

- **游戏截图和视频都不进 Git 仓库**（Neon 审计意见，已采纳）：截图是 S-GAME 的游戏画面，放进 MIT 仓库容易被误解为一起授权。成品图上传到 Nexus 和 GitHub Release 的附件，原始素材放在仓库外或被 gitignore 的 `media-raw/`。
- 发布用的 zip 不进仓库，挂在 GitHub Release 上，同时登记 SHA-256。

### 3.2 发布包结构

zip 内部的目录**按游戏目录展开**，这样玩家可以直接解压到游戏根目录，Mod Manager 也能识别：

```
HongzhuangGuizhanPlus-v0.1.0.zip
└─ ProjectPBZ/PBZModLoader/mods/hongzhuang-guizhan-plus/
   ├─ main.js
   ├─ config.json
   └─ README.txt        简短安装说明 + 链接
```

（实际路径以选定加载器的约定为准，第 1 步实现时确认。）

- 文件名：`<英文名>-v<版本>.zip`，例如 `HongzhuangGuizhanPlus-v0.1.0.zip`。
- 版本号用语义化版本：`0.x` 表示试用期；平衡改动升 minor，修 bug 升 patch。
- Nexus 的文件描述写：适配的游戏 build、需要的加载器版本。

## 4. 图片与视频

| 素材 | 建议规格 | 说明 |
|---|---|---|
| 主图 / 缩略图 | 1920×1080（16:9），JPG | 列表页会裁成小图：**关键内容放画面中央**，文字少而大（例如“彼岸花常驻 · 白花 ×5”） |
| 页头横幅 banner | 1400×400 左右，JPG，几百 KB 以内 | 尺寸出自 Nexus 旧版文档，上传时以表单提示为准 |
| 截图 | 4–8 张，16:9，1920×1080 | 必须是真实游戏画面；展示花丛周期爆炸、E 引爆、5 朵白花 |
| 演示视频 | 30–90 秒，前后对比 | 上传到 B 站和 YouTube，Nexus 页面嵌入；开头 5 秒就要看到效果 |

制作建议：
- 用游戏内照相模式或 Steam 截图（F12）。关掉 HUD 的截图做主图，带 HUD 的截图放说明页。
- 主图可以是“一张效果最震撼的截图 + 一行大字标题”，用任何图片编辑器做即可。**不用 AI 生成主图**，省去 AI Media 标签和“像不像真实效果”的争议。
- GIF 太大，用短视频代替。

## 5. 说明页结构（中英双语）

模板见 `docs/release/nexus-description-template.md`。结构：

1. 一句话介绍 + 主图
2. 功能列表（效果 1、效果 2，各配一张截图或视频）
3. 平衡说明与可配置参数
4. **前置要求**：PBZModLoader（链接到它的 Nexus 页面，写明版本）
5. 安装 / 卸载步骤（含“先备份存档”）
6. 兼容性：游戏 build、已知冲突
7. 已知问题
8. AI 披露
9. 致谢与许可（加载器作者、参考过的开源 mod、S-GAME 版权声明）
10. 反馈方式（Nexus Bugs 标签页或 GitHub Issues；需要附上游戏 build、加载器版本和 `loader.log`）

## 6. 发布后

- **游戏更新后**：先检查加载器是否失效、mod 是否正常；不正常就在页面顶部标注“暂不兼容 build XXXX”，修好后发新版。
- **回复评论**：Bug 引导到 Bugs 标签页或 GitHub Issues，统一用模板收集信息。
- **更新日志**：每个版本写进 `CHANGELOG.md`，Nexus 的 Changelog 栏同步。
- **转载**：有人转载到国内站时，只要注明出处和原链接，按 MIT 是允许的。

## 7. 你需要亲自做的事

- 注册 Nexus 账号（网名，不用真名）；需要的话开启两步验证。
- 给加载器作者留言（我可以起草，由你发送）。
- 在游戏里录制演示视频、截图。
- 最终点击上传和发布（这一步我不会代劳）。

## 8. 待核实

- Nexus 当前上传表单里主图和横幅的确切尺寸、大小限制（官方 wiki 页面这次读取失败）。
- 选定加载器的 mod 目录结构（第 1 步确认）。
- S-GAME 的用户协议（EULA）里有没有关于 mod 的条款。

## 来源

- Nexus AI 政策（2026-11-05 更新）：https://help.nexusmods.com/article/180-ai-policy-changes-2026
- Nexus 文件提交规范（2026-11-04 更新）：https://help.nexusmods.com/article/28-file-submission-guidelines
- Nexus 审核政策：https://help.nexusmods.com/article/27-moderation-policy
- Nexus Donation Points 条款：https://help.nexusmods.com/article/68-donation-points-system-terms-of-service
- Nexus 旧版页面制作指南（横幅尺寸）：https://wiki.nexusmods.com/index.php/Creating_a_mod_page 、https://forums.nexusmods.com/topic/6550951-creation-of-a-mod-page-guide/
- PBZ 无官方 mod 支持：https://howtovideogame.com/phantom-blade-zero-mods/ 、https://bladezero.org/mods/
- AI 政策报道：https://www.gaming.net/nexus-mods-expands-ai-rules-but-rejects-an-outright-ban/ 、https://pcgamer.com/games/nexus-mods-takes-the-valve-approach-to-ai-generated-content-no-outright-bans-but-mandatory-disclosures
