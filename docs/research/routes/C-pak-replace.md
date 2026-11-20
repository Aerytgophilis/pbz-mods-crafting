# 路线 C 辩护：Pak / IoStore 资产替换

- 撰写日期：2026-11-20
- 对应游戏版本：Steam build `26367565`（本机 `steamapps\appmanifest_4115450.acf` 的 `buildid`），exe 内版本串 `CL-302256_JKS-17280`（本机 `platform\steam\PBZ.exe` 字符串）。社区称引擎为 S-GAME 定制的 UE 5.7.4（来源见 C7）。
- 标注约定：**【已证实】** 指本机观察或公开源码 / 作者实测可直接核对；**【已证实·社区】** 指第三方作者自述的实测，本项目没有复现；**【推断】** 指由证据推出、尚未验证；**【未知】** 指目前没有证据。
- 本次只读检查了游戏目录（列目录、读 acf、读 utoc / pak 文件头和尾部、在 exe 里搜字符串），没有修改、解包或运行任何东西。

---

## 一句话主张

红妆鬼斩的两个效果，最可能落在**武器配置和“子弹”（Bullet）数据**上：彼岸花的持续时间、重复爆炸、爆后销毁、生成数量，看起来都是数据字段。所以第一步应该是**纯数据的 IoStore 覆盖包**：从玩家自己的游戏里读出原资产，按一份公开的“配方”改字段，用 retoc 打成 `~mods` 三件套。它运行时不需要任何注入、DLL 或 UE4SS，不受 11-04 脚本校验影响，开源仓库里也可以一个游戏资产都不放。

我先承认它的边界：如果“每隔几秒爆炸”这件事写在 JS 里，或者需要全新的逻辑，这条路线单独做不到（见 C3、C10），只能退回路线 A / B，或者花大成本自己 cook 蓝图。

---

## 论点列表

### C1　pak 不需要签名绕过；`~mods` 三件套是社区标准安装方式

- **【已证实】游戏容器没有开启签名。** 本机 `ProjectPBZ\Content\Paks\` 里没有任何 `.sig` 文件。主容器 `ProjectPBZ-Windows.utoc` 的头部 `ContainerFlags`（偏移 0x50）= `0x0B`，即 Compressed | Encrypted | Indexed，**没有 Signed（0x04）位**；`global.utoc` 的这个字段为 `0x00`。头部版本字节是 `8`（`ReplaceIoChunkHashWithIoHash`，对应 UE 5.5 以后的格式，见 retoc 的 `retoc/src/version.rs`）。UE 引擎自带的签名校验代码确实在 exe 里（字符串 `Couldn't find pak signature file '%s'`、`SignedArchiveReader.cpp`），但官方容器没有签名，这段代码就不会对 mod 包生效。
- **【已证实·社区】`~mods` 的同名三件套能直接加载，不需要 UE4SS：**
  - 2B 外观替换（“Updated for the November 4 game patch”）：把 pak / utoc / ucas 放进 `ProjectPBZ/Content/Paks/~mods/`。<https://vgtimes.com/games/phantom-blade-zero/files/100426-yorha-2b-replace-soul_outfit-options_v2.html>
  - Easier or Harder Parry（2026-10-30，4.28 kB，“只替换基础战斗配置文件”，“plain pak mod，不需要 UE4SS”）：<https://vgtimes.com/games/phantom-blade-zero/files/99509-easier-or-harder-parry-adjustable-parry.html>；The Outerhaven 的原话是 “since this is PAK mod, you don't need UE4SS”：<https://www.theouterhaven.net/check-out-these-phantom-blade-zero-pc-mods-that-change-how-the-game-plays/>
  - PBZHardMode 1.0.2（敌人属性）用 `~mods` 三件套。这条是随机器项目的转述：<https://github.com/Player-MINEPIG/phantom-blade-zero-randomizer/blob/main/docs/integration-research.md>
  - Bladesmith 直接替用户“build a pak mod for your `~mods` folder”：<https://github.com/ayokiru/pbz-bladesmith>
- **【已证实·社区】还有一个不碰游戏目录的挂载位置。** 随机器项目实测：游戏用 `-UserDir=<目录>` 启动时，会打开 `<目录>/Saved/Paks` 里的 `.utoc/.ucas`。这样 mod 文件可以完全放在游戏目录外，正好符合本仓库 AGENTS.md 的“游戏目录默认只读”。来源同上 `integration-research.md` 的“零售版启动与存档边界”一节。
- **关于 “(UE4SS) CPP BYPASS for PAK Mods”（Nexus 520）**【已证实·社区，来自搜索摘要，Nexus 页面本身返回 403】：它绕过的是 11-04 的**脚本校验**，让“替换了游戏 JS 的 pak”重新能用，不是 UE 的 pak 签名。见 C2。Mod Manager 把一个通用的 `UniversalSigBypasser.asi` 当作前置（<https://github.com/dddfeiyu/pbz-mod-manager>）。**【推断】这个前置对纯资产包是多余的**：它被拷进 `ProjectPBZ\Binaries\Win64\`，可本机这个目录里根本没有游戏主程序（主程序在 `platform\steam\PBZ.exe`）。
- **反证，必须列出。** cringe-blade-zero 的文档（2026-11-09～12）写道：在他们适配的版本上，“游戏启动挂载流程会跳过额外 pak，单纯改成 `pakchunk...`、放进 `~mods` 或 `LogicMods` 没有让这些包自动生效”，所以他们改用 `version.dll` 主动调用 `FPakPlatformFile::Mount`。<https://github.com/Jersyi/cringe-blade-zero/blob/main/docs/PAK_WORKFLOW.md> 这和上面多个 `~mods` 成功案例矛盾。**【推断】**他们的容器只包含新的包路径（`/Game/Mods/...`、`PBZDebugSupplement`），不覆盖任何原版包，也许挂载或引用方式有别。不过 Bladesmith 也会在自己的文件夹里放新的特效副本，并且能用。所以这一点算**未决**，第一次实测必须先做一个最小覆盖包来确认（见“证据缺口”）。

### C2　11-04 的脚本校验针对 JS，不针对 uasset

- **【已证实·社区】校验存在，对象是脚本。** pepperdoesthings 的 `tools/instructions.md` 写道：自 build 26367565 起，“the game checks its scripts byte for byte”；`~mods` 里的 pak 只要用不同字节替换游戏脚本，游戏就停在标题画面，而字节完全相同的替换可以正常加载（作者用单文件测试包在游戏内验证过）。<https://github.com/pepperdoesthings/PBZ-Pepper-Scripts/blob/main/tools/instructions.md>
- **【已证实·社区，搜索摘要】实现方式。** “PBZ Script Table”（Nexus 1043）的说明称：游戏维护一张表，记录每个脚本的大小和 SHA-256，只要有一个已加载的脚本对不上，就停掉全部 UI 脚本。<https://www.nexusmods.com/phantombladezero/mods/1043>
- **【已证实·社区】uasset 覆盖包在校验上线之后仍然生效：**
  - 随机器项目在 2026-11-19、build 26367565 上做了游戏内实测：改了 4 个关卡分区和掉落相关资产的覆盖包，拾取、展示、装备界面都正常。同一个项目里，试图通过 pak 替换 `ProjectPBZ/Content/JavaScript/MainStart.js` 的探针**没有执行**。正好一正一反。（`integration-research.md` 的“地面武器拾取实测”和“零售版启动与存档边界”两节）
  - Bladesmith 0.5.0～0.5.3 在 11-04～11-05 连续发版，修的是解包工具问题，没有提到资产包被拦（<https://github.com/ayokiru/pbz-bladesmith/releases>）。
  - 2B 外观 mod 标明适配 11-04 补丁（C1 链接）。
- **【推断】** 我们改 DataTable / DataAsset / Niagara 参数，不碰 `ProjectPBZ/Content/JavaScript/`，所以不会触发这项校验。**【未知】** S-GAME 以后会不会把校验扩大到 uasset。官方补丁说明只写了“部分第三方 Mod 与本次更新不兼容……请先移除已安装的 Mod”，没有提校验。<https://pbz.s-game.com/zh-CN/news/patch-notes-2026-11-03/>

### C3　JS 脚本确实在 pak 里，但“用 pak 改 JS”这条子路线已经被堵，我不为它辩护

- **【已证实·社区】** 游戏 JS 在**传统 pak** `ProjectPBZ-Windows.pak` 的 `ProjectPBZ/Content/JavaScript/` 下，不在 IoStore 里。build 26367565 解出 216 个 `.js`、2 个 `.json`、5 个 `.wasm`；该 pak 有 5181 个条目，Oodle 压缩，索引用 AES 加密（pepperdoesthings `tools/instructions.md`）。
- **【已证实】本机文件尾印证了这一点。** `ProjectPBZ-Windows.pak` 末尾 221 字节是标准 pak footer：`bEncryptedIndex = 1`，magic `0x5A6F12E1`，压缩方法名 `Oodle`；原始版本字段读出来是 `12`，pepper 的笔记也说 listpak 看到的是 v12，而 repak 0.2.3 显示 V11 并且能解。
- **【已证实·社区】** pepperdoesthings 的 ScriptModLoader（把 JS 打成 override pak）在 11-04 之后会让游戏卡在标题画面，作者已经改投 Mods Menu 的松散文件加载（README 的“Updating from 0.9.x”一节）。
- 想恢复“pak 改 JS”，现有三种办法都要额外的原生组件：UE4SS C++ 插件（Nexus 520、Nexus 1043），或者直接改 `PBZ.exe` 的补丁器（Nexus 573，只支持 `CL-302256_JKS-17280`，信息来自搜索摘要）。**结论**：改 JS 在形式上属于这条路线，但现在一定要带上路线 B 的依赖（UE4SS）或者改 exe，**纯 pak 路线的优势就没有了**。本路线只主张资产替换。

### C4　已经有人用 pak 改过武器数值、连段和特效，包括跨角色借用资产

| 项目 | 改了什么 | 是不是 pak 路线 | 来源 |
|---|---|---|---|
| Phantom Blade Zero Randomizer（Player-MINEPIG） | 38 件武器的 `Weapon Attack Multipliers`（物理、失衡、格挡失衡倍率）；白影 `BaiYing` ↔ 偃月刀 `RenOuYanYueDao` 整套武器配置对调（连段跟着走） | 是，`z_PBZSeedRandomizer_P` 三件套，由本机原版 IoStore 读出后重建 | <https://github.com/Player-MINEPIG/phantom-blade-zero-randomizer/blob/main/integrations/weapons/README.md> 【已证实·源码】；连段对调的游戏内表现，作者自己写“仍需在游戏里确认” |
| Bladesmith（ayokiru，MIT） | 武器模型、刀鞘、每招的拖尾特效，大约 300 种 Niagara 拖尾可选，“enemy ones included”；改色时把特效复制到自己的文件夹 | 是，`~mods` | <https://github.com/ayokiru/pbz-bladesmith> 【已证实·社区】 |
| Easier or Harder Parry（DeathTheReaper9） | 完美弹反帧窗口（战斗配置） | 是，4.28 kB 三件套 | C1 链接【已证实·社区】 |
| PBZHardMode 1.0.2 | 敌人伤害、属性 | 是，`~mods` | C1 链接【已证实·社区，转述】 |
| Weapon Transmog（Nexus 316） | 外观 | 有一个“pak edition” | 搜索摘要【已证实·社区】 |
| 对照：PBZ Weapon Tuner（Nexus 412） | 武器伤害、按招式组调数值 | **不是**，需要 UE4SS | 搜索摘要 |
| 对照：Soft Slithering Steel（Nexus 1146） | 把敌人招式给玩家用 | **不是**，走 Mods Menu / PBZ Moveset Editor（JS 路线） | 搜索摘要 |

**【已证实·源码】** 随机器的代码给出了一条可复用的定位链：`ProjectPBZ/Content/PBZContent/DataTable/UI/DT_WeaponData.uasset` 的行（`ItemId`、`WeaponType`、`WeaponConfig`、`WeaponSnapSoulData`＝铸魂形态）→ `WeaponConfig` 指向 `ProjectPBZ/Plugins/Secret/PBZCombatAsset/Content/` 下类型为 `PBZ_MainWeaponConfig_C` 的配置资产 → 配置里有 `Weapon Attack Multipliers`、`Display Data.WeaponClass`、挂点和“武器技能字段”。（`integrations/weapons/stats.py`、`movesets.py`）

**【推断】** Soft Slithering Steel 证明敌人或 Boss 的招式数据可以给玩家用，Bladesmith 证明敌人的特效资产可以通过引用挂到玩家武器上。这两件事放在一起看，“引用 Boss 版彼岸花”在数据层面是可行的思路；只是 Soft Slithering Steel 本身不是 pak 路线。

### C5　战斗系统是数据驱动的，“子弹”字段正好覆盖两个目标

**【已证实】** `PBZ.exe` 里的反射名（ASCII 字符串）包括：
- 能力与技能：`PBZGameplayAbility`、`PBZSkillManager`、`PBZCombatAsset`、`AbilityTimelines`、`PBZAbilityTimelineData`、`AbilityNodes`、`CombatArtSkillDataTableStructure`
- 子弹定义：`BulletDataTableStructure`、`BulletData`、`InlineBulletData`、`BulletClass`、`BulletAssetPath`
- 数量、持续、重复：`BulletNum`、`BulletRepetitions`、`BulletDuration`、`SpawnInterval`、`bDestroyOnHit`、`GetBulletLifeTime`
- 批量生成：`BulletSpawnBurst`、`BulletSpawnBurstTransform_LocationAndRotation`、`BulletsPerHorizontalLine`、`CreateBulletBurstTask`、`LGAAction_MixedBulletBurst`、`MixedBulletBurstEntry`、`EBulletBurstBaseRotationOffsetType`
- 事件与效果：`BulletEvent_GameplayEffect_WithWeaponData`、`BulletEvent_ContinuousEffect`、`BulletEvent_NSParam`（Niagara 参数）、`BulletLifeCycleEffectPrefabData`、`EBulletFactionTarget`
- 其他：`bIsWhiteFlower`（含义未知，名字和“白色彼岸花”吻合）

**【推断】**
- 地上的彼岸花和飞出去的白色彼岸花，大概率都是“子弹”实体（这套系统里，持续区域、地面陷阱、投射物都可以是 bullet）。
- “多久爆一次、爆几次、爆后销不销毁、一次生成几个”很可能就是上面的字段，用 UAssetGUI 改数值或数组就行，不需要写代码。
- **【未知】** 这些字段究竟在 DataTable 行、DataAsset、能力时间线节点，还是 C++ 默认值里。要用 FModel 看过才知道。

### C6　“Boss 版石蒜花”可能只是另一行数据或另一份资产

- **【已证实·社区】玩家武器的彼岸花机制**：重击连段在地上铺彼岸花，范围内的敌人减速、持续掉杀气；3 秒后爆炸，在短时间内持续伤害。Lv5 提高同时存在的花的上限、持续时间延长到 15 秒，处决可以手动引爆全部花。Lv10/20/30 提高爆炸伤害和杀气削减。Lv25 按住重击蓄力，开始时放出一朵巨大的白色彼岸花飞向敌人，接触就爆。<https://metabot.gg/en/phantom-blade-zero/weapons/scarlet-wraithblade>、<https://allthings.how/phantom-blade-zero-scarlet-wraithblade/>
- **【已证实·社区】名字**：metabot 上这把武器的渲染图文件名是 `t_weapon_hongzhuangguizhan`，所以红妆鬼斩的英文名是 **Scarlet Wraithblade**。内部 ID **推断**为 `HongZhuangGuiZhan`（命名风格参照随机器里的 `BaiYing`、`RenOuYanYueDao`）。Boss 是 Hua, Deadly Betrothed（新娘阿花）。
- **【已证实·社区】Boss 战的花**：战斗中有三种花，有的先开再爆（<https://www.playnews.gg/en/guides/hua-the-mortal-fiancee-in-phantom-blade-zero-how-to-beat-her>）；燃烧的花丛延迟片刻后喷发（allthings.how 的 Hua 攻略）。
- **【未知】** Boss 版是否真的“每隔几秒爆、爆后不消失”。这一点目前只有用户的游戏观察，没有找到文字或数据佐证。
- **【推断】** 敌人的配置链是 `DT_CodexEnemyDataTable` → `DA_ActorConfig` → `ActorC_*`（<https://metabot.gg/en/phantom-blade-zero/methodology>，又经随机器转述）。阿花的技能如果同样通过 bullet 生成花，Boss 版就是另一个 bullet 定义，例如更长的 `BulletDuration`、`BulletRepetitions > 1`、`bDestroyOnHit = false`。那么有两种做法：**照抄字段**到玩家那行，或者**把玩家生成节点里的引用改成指向 Boss 那行**。要注意三件事：阵营（`EBulletFactionTarget`，Boss 的花是打玩家的）、伤害来源（玩家版用 `..._WithWeaponData` 吃武器数值，Boss 版可能吃怪物属性）、Boss 资产在玩家场景里不一定已经加载（引用会带来依赖包）。随机器在对调配置时专门处理了导入依赖（`movesets.py` 的 `PackageStore.imports`），说明这类问题可以解决，但需要工程投入。

### C7　UE 5.7.4 和 PBZ 容器的工具链已经有人跑通

- **【已证实·源码】** retoc 的 `version.rs` 有 `UE5_7`；UAssetAPI 的 `EngineVersion.cs` 有 `VER_UE5_7`；CUE4Parse（FModel 的底层）有 `GAME_UE5_7`；UAssetGUI 支持 `tojson` / `fromjson` 命令行，可以写成脚本流水线（<https://github.com/atenfyr/UAssetGUI#command-line-arguments>）。retoc、UAssetGUI 都是 MIT，repak 是 MIT/Apache-2.0。
- **【已证实·社区】映射文件**：KintaroModding 为 build 26367565 发布了 `ProjectPBZ-5.7.4-302256-full.usmap`（v1.1）。实测 UAssetGUI 1.1.0 读通了 77/78 张数据表和 416/425 个资产，CUE4Parse 读了 1,750 个玩法包的 31,772 个导出、没有报错。<https://openmods.nexus/mods/kintaromodding/phantombladezero_pbzusmap> Bladesmith 用的是 Nexus 55 的 “USMAP File (Proper)”。
- **【已证实·社区】一个必须知道的坑**：上游 retoc 只打开第一个 `.ucas`，读不到 `_s1…_sN` 分片。Bladesmith 为此带了补丁 `patches/retoc-partitioned-ucas.patch`。本机主容器头部的 PartitionCount = `0x42` = 66（主文件加上 `_s1`～`_s65`），所以一定要用打过补丁的 retoc（或 Bladesmith 自带的那份）。
- **【未知】** UAssetGUI 写回 `PBZCombatAsset` 里的自定义结构，能否保持字节一致。映射作者只测了读取；随机器为此自己写了 zen 包读写器（`integrations/weapons/zen.py`），没有用 UAssetGUI。

### C8　运行时零侵入

- **【已证实】** 本机游戏目录里没有任何 mod 框架。纯资产包不需要 `dwmapi.dll`（UE4SS）、`hid.dll`（Mods Menu）、`version.dll` 这类代理 DLL，也不 hook 进程。
- **【推断】** 所以路线 C 不会跟 UE4SS 或 PBZModLoader 的 exe 版本适配一起坏，exe 换版本也不影响它（资产没变的话，包照样能用）。代价是不能在运行时做判断，见 C10。

### C9　适合开源发布，而且有“只发配方、本地构建”的先例

- **【已证实·社区】** Bladesmith 原话：“It reads everything from your own copy of the game and writes only the few files it changes. Nothing from the game ships with Bladesmith”；游戏更新后会提示哪些源文件变了，可以按原配方一键重建。
- **【已证实·源码】** 随机器读取本机游戏的 IoStore，按种子生成补丁，再用 retoc / UnrealPak 打包；构建前先校验原版数据表的 SHA-256（`stats.py` 的 `DATA_TABLES`），对不上就拒绝构建。这正好防止在新版本上套用旧补丁。
- **【已证实·社区】** pepperdoesthings 把 AES key 放在被 gitignore 的 `.secrets/`，仓库不提交任何游戏脚本。

### C10　劣势，主动承认

1. **不能新增逻辑。** 如果字段不够用，比如需要“每 N 秒对范围内敌人重新结算一次”而 bullet 不支持重复，就只能 cook 一个新蓝图，用 S-GAME 定制的 5.7.4 编辑器加上占位类来做（cringe-blade-zero 的“路线 A”说明这能做，但成本很高），或者退回路线 A / B。
2. **同一个资产只能有一个覆盖者。** 如果我们改的是整张大 DataTable，就会和其他同样改这张表的 pak mod 互相覆盖（随机器调研原话：“多个包覆盖同一资产时，游戏只能使用其中一份”）。
3. **迭代慢。** 每次改完都要重新打包、重启游戏，没有热重载（PBZModLoader 有 Alt+F5）。

---

## 两个效果的实现草图

前置：用 FModel 加载 `Paks` 目录。AES key 按社区方法获取（AESDumpster，或 unknowncheats 帖子，见 pepperdoesthings 的 `tools/instructions.md`），**不写进仓库**。映射用 `ProjectPBZ-5.7.4-302256-full.usmap`，版本选 UE5.7。

### 共同的定位步骤（FModel 里依次做）

1. 打开 `ProjectPBZ/Content/PBZContent/DataTable/UI/DT_WeaponData`，搜 `HongZhuang`（或按 `t_weapon_hongzhuangguizhan` 的同名规则），记下这一行的 `WeaponConfig` 和 `WeaponSnapSoulData.WeaponConfig`（铸魂形态）。
2. 打开对应的 `/PBZCombatAsset/.../*`（类型 `PBZ_MainWeaponConfig_C`），找重击连段、Lv5 / Lv10 / Lv25 成长项、被动“彼岸花”分别引用了哪些能力（`PBZGameplayAbility` 子类）、`AbilityTimelines` 和 bullet。
3. 在 FModel 里全局搜 `Bullet`、`Lily`、`Flower`、`HongZhuang`、`Hua`，找类型为 `BulletDataTableStructure` 的 DataTable，或带 `BulletData` / `InlineBulletData` 的资产。
4. 用同样的方法找 Boss：`DT_CodexEnemyDataTable` → `DA_ActorConfig` → 阿花的 `ActorC_*` → 她的技能 → 她的花用的 bullet。
5. 把玩家版和 Boss 版的 bullet 定义导出成 JSON，逐字段对比，重点是 `BulletDuration`、`BulletRepetitions`、`SpawnInterval`、`bDestroyOnHit`、`BulletEvents`、`LifeCycle` 效果、`EBulletFactionTarget`、伤害 GE。
6. 记下每个文件的 SHA-256 和 build 号，写进 `docs/game-notes/`。

### 效果 1：普攻铺的花定时自动爆炸、爆后不消失、持续削杀气

- **方案 1a（只改数值，首选）**：只改玩家的彼岸花 bullet 定义。
  - `bDestroyOnHit = false`，或把“爆炸事件后销毁”的 LifeCycle 设置改掉。
  - `BulletRepetitions` 改成大于 1，`SpawnInterval`（或时间线里的重复间隔）设为 2～3 秒。
  - `BulletDuration` 拉长，可以参照 Lv5 的 15 秒，或者更久。
  - 削杀气的 GE（`BulletEvent_GameplayEffect_WithWeaponData` / `BulletEvent_ContinuousEffect`）倍率可以顺手微调；Lv10 那组成长项正好是同类字段，可作参照。
- **方案 1b（照抄 Boss 版）**：如果第 5 步对比发现 Boss 版本身就是“循环爆、不消失”，就把这几个字段**照抄**到玩家那行。只有字段抄不过来时，才把玩家生成节点的引用**改指**到 Boss 那行：这时要把 `EBulletFactionTarget` 改成攻击敌人，确认伤害来源用武器数值，并在打包时带上 Boss 资产的依赖包（参照随机器对导入依赖的处理）。
- **验证**：对单个普通敌人铺一片花，确认 3 秒后爆一次、花不消失、之后每 N 秒再爆、杀气条持续下降；同时检查同时存在的花数上限（Lv5 改过上限）会不会导致性能问题。
- **失败退路**：如果重复爆炸写在 JS 的定时器里（第 2 步能看出来：能力里找不到相应字段，而 `ProjectPBZ/Content/JavaScript/` 下有相关逻辑），本路线就做不了，改用路线 A（Mods Menu / PBZModLoader）。

### 效果 2：F 蓄力的白色彼岸花从 1 朵变 5 朵

- 用户说的“F 蓄力”，资料里对应 Lv25“按住重击蓄力，开始时放出一朵巨大的白色彼岸花”，**键位待核实**。
- 在第 2 步里找到 Lv25 的蓄力能力，打开它的 `AbilityTimelines`，找生成白花的节点（`CreateBulletBurstTask`、`LGAAction_MixedBulletBurst` 或 `SpawnBullets` 一类）。顺便看 `bIsWhiteFlower` 在哪个结构上。
- **情况 A**：节点有 `BulletNum` / `BulletSpawnBurst`，直接把 1 改成 5，再用 `EBulletBurstBaseRotationOffsetType` 或每个生成点的 `Transform` 把 5 朵扇形散开（比如 ±30°），避免 5 朵完全重叠成一次伤害。
- **情况 B**：生成点是数组（`BulletSpawnBurstTransform_LocationAndRotation` 或 `MixedBulletBurstEntry[]`），在 UAssetGUI 的 JSON 里把一个元素复制成 5 个，分别改偏移。
- **情况 C**：只有一个单发节点，就把节点复制 4 份，各加一点时间偏移。这要改导出表，风险更高。
- **注意**：白花“接触即爆”，5 朵可能打 5 次伤害，可能需要降低单朵伤害；Lv25 的满蓄瞬移斩不要动。
- **失败退路**：同效果 1。

### 打包与安装

1. 用打过补丁的 retoc 执行 `to-legacy --filter <路径>`，只导出要改的包。
2. 用 `UAssetGUI tojson` 转成 JSON，按配方打补丁，再 `fromjson` 转回。
3. 用 retoc `to-zen --version UE5_7` 打成 `zzz_HongZhuangPlus_P.{pak,utoc,ucas}`。
4. 经用户同意并备份后，放进 `~mods`；或者用 `-UserDir` 放到游戏目录外。

流程参照 Dmgvol 的 <https://github.com/Dmgvol/UE_Modding/blob/main/BasicModding/EditingIoStoreAssets.md>。如果 UAssetGUI 写回自定义结构时不保真，就参照随机器的做法，直接改 zen 包里的属性字节。

---

## 上手成本

| 项目 | 内容 | 评估 |
|---|---|---|
| 工具 | FModel、retoc（打分片补丁的版本，或 Bladesmith 自带的）、UAssetGUI 1.1.0、usmap、Oodle DLL（retoc 首次运行会下载，见 Bladesmith 0.5.3 的说明）、AES key | 都是免费开源或社区公开的；按 AGENTS.md，下载前要征得用户同意 |
| 技能 | 读懂 UE 反射结构（DataTable、DataAsset、软引用、导出和导入）；不用写 C++，也不用写 JS | 中等 |
| 时间（**推断**） | 搭工具链、读通第一张表：半天到一天。找到彼岸花的资产链：1～3 天，最大的不确定性在这里。做出效果 1a 或 2A 的第一个可测包：再要 1 天 | 前提是字段确实在数据里 |
| 风险最高的一步 | 自定义结构写回不保真、依赖包没带齐，都会导致崩溃或静默失效；排查只能靠游戏日志和二分 | 用最小改动（先改一个数字）的包逐步推进 |

和其他两条路线的公平对比：路线 A / B 改 JS 或 Lua 逻辑更灵活，但也要先弄清“花”的数据在哪里（读 FModel 或 JS 源码）。**定位成本三条路线差不多**；路线 C 多出来的成本是打包，省下的是运行时依赖。

---

## 游戏更新后的维护成本

- **【已证实】更新会改资产和格式。** 11-04 补丁让 usmap 新增了 4 个原生结构、改了 6 个类型（映射作者的记录）。Bladesmith README 写的是 build 5.7.4-301524 时主容器有 50 个分片，本机现在是 65 个，说明分片布局会随更新变化。
- **【推断】每次更新要做的事：**
  1. 等新版 usmap 发布，或用 UE4SS 的 dumper 自己生成。
  2. 对比要改的源资产哈希；没变就继续用旧包，变了就按配方重建。
  3. 进游戏回归测试一次。
  只要配方写的是“字段路径加新值”而不是二进制补丁，大部分更新只需要重跑构建脚本。Bladesmith 的 0.5.0 已经把这个过程自动化了。
- **比另外两条路线有利的地方【推断】**：exe 更新不影响我们（UE4SS 要等 PBZ 专用版重新适配签名；PBZModLoader 依赖的 JS 类名和方法名一改就失效）。**不利的地方**：DataTable 的列一改，旧包可能被错误读取（随机器调研提到“旧版覆盖包曾让游戏误读移速和抗性”），而且这种错误**不一定会报错**。因此构建脚本必须像随机器那样校验源资产哈希，对不上就拒绝构建。
- **【未知】** 如果 S-GAME 把校验扩大到 uasset，这条路线就会整体失效。到那时所有三件套 mod 都会一起坏，社区会很快给出绕过方法，但那样也就要引入原生依赖了。

---

## 开源发布的友好程度

- **仓库（MIT）只放我们自己的东西**：
  - 配方，比如 `recipe.json`：每条写目标包路径、对象和字段路径、原值、新值，外加适用的 build 号和源资产 SHA-256。
  - 构建脚本：调用用户本机的 retoc 和 UAssetGUI，从用户自己的游戏里取出原资产，打补丁后打包。
  - 文档。
  
  这和 Bladesmith、随机器的做法一致（C9）。**仓库里不放任何 uasset、uexp，也不放 AES key**；usmap 由用户另外下载。
- **成品包**：`.utoc/.ucas` 里是改过的 S-GAME 资产（虽然只有几个包）。社区普遍把这种成品发到 Nexus，但它确实是在分发衍生的游戏资产，MIT 许可证管不到这部分。**建议**：GitHub 只发配方和脚本；如果要方便玩家，另外在 Nexus 附一个“按 build 号构建好的包”，在说明里注明游戏资产归 S-GAME 所有，并提供“自己构建”的方法。
- **跟另外两条路线比**：JS / Lua mod 天然只含自己的代码，这一点路线 C 稍逊一筹。但只要采用“配方加本地构建”，路线 C 也能做到仓库零游戏资产。代价是用户要装工具、取 AES key，我们可以学 Bladesmith 做一个一键构建器来降低门槛。

---

## 证据缺口（诚实列出）

1. **完全没有解包验证。** 彼岸花用哪个 bullet、哪张表，字段在 DataTable、DataAsset 还是时间线节点里，C5、C6 的推断全部还没核实。**这是本路线最大的缺口**：如果关键行为写在 JS 里，路线 C 对两个效果都无能为力。
2. **我们自己还没确认 `~mods` 会自动挂载。** 社区多个案例说可以，cringe-blade-zero 说不行（C1）。需要用一个最小覆盖包实测，比如只改某个可见的数值。
3. **Boss 版行为没有核实。** “每隔几秒爆、不消失”只来自用户观察；Boss 的花和玩家的花是不是同一个类、能否换引用，还未知。
4. **写回保真度。** UAssetGUI 写回 `PBZCombatAsset` 自定义结构（可能含 instanced struct）的结果没有任何人测过；随机器选择自己写 zen 读写器，可能暗示 UAssetGUI 不够用。
5. **retoc 分片支持**：上游是否已经合入多分片 `.ucas` 的读取，没有核实（最新 release v0.1.5 发于 2026-01-02，早于游戏发售）。
6. **Nexus 页面（520、1043、573、412、1146、62、316）都没有直接读到（403）**，内容来自搜索摘要和二手转述，细节可能不准。
7. **11-04 校验的范围**：“只校验 JS”是从多个 uasset 包仍然能用推出来的，没有找到反编译级别的证据；exe 里也没有搜到明确的脚本哈希表字符串（只有 V8 自带的 `getScriptHash`）。
8. **“F 蓄力”和 Lv25“按住重击”是不是同一个招式**，需要在游戏里确认键位，并确认武器已到 Lv25。
9. **多 mod 共存**：如果要改的是共享大表，会和哪些现有 mod 冲突，还未知。
