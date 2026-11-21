# 影之刃零：未上线 / 未使用 / 被砍资产与设定目录

> 调查日期：2026-11-20。目标 build：Steam 26367565，CL-302256（JKS-17280）。UE 5.7.4（S-GAME 定制）。
> 方法：只读。读取了本地 `extracted/fmodel/`（328 个导出 JSON，全部集中在红妆 / 阿花 / 相关 GA-GE-BulletData）、`docs/game-notes/` 既有笔记、本地缓存的 SDK 类型索引（`type-index.json`，34,593 个条目，全部为 `reflection-generated`）以及 `blueprints.d.ts`。网页检索了社区来源。没有运行游戏、没有运行二进制、没有改游戏目录，也没有下载压缩包。
>
> 标注：
> - **【社区已整理】**：有 URL 的公开来源。
> - **【本地数据推断】**：由本地导出或 SDK 反射数据得出，附文件路径或类型名。
> - **【待核实】**：需要 FModel 导出或字节码才能确认。
>
> 重要限制：这里的 “未使用” 只表示 “SDK 里存在，且在本地导出中找不到引用方”。本地导出只覆盖少量资产，所以 “找不到引用” 不等于 “游戏里从不触发”。**下文每一条 “未使用” 都要以 FModel 导出核实。**
>
> **协调会话更正（2026-11-20）**：
> - **白花不是“生成者未知”**。第 0 步资产笔记（`scarlet-wraithblade-flowers-assets.md` §4）已证实：白花由 `GA_Hun_GuiTouBlade_B_Hold` 主时间轴 t=0 的 `GAA_DelayDeflectProjectileBullet` 动作生成，BulletData 是 `BD_Hun_GuiTouBlade_BHold_HomingFlower`，它的 `BulletClass` 指向 `BP_GuiTouBlade_Flower_Homing`。引用链经过 BulletData，所以在 GA 里直接搜类名搜不到。下文第 1 节第 10 条、第 83、184 行按此理解。
> - **UltraFlower**：第 0 步笔记 §5 已证实它由 `GE_..._Debuff` 在目标带 `InDebuffArea.UltraFlower` 标签时施加，但没找到谁授予这个标签。所以 mod 的“彼岸·极”只要给升级后花里的敌人加这个标签，原版的 Debuff 就会套上 UltraFlower 效果，不需要自己造 GE。

---

## 一页结论（最值得注意的 10 条）

1. **红妆鬼斩有一个只存在于 GE 层的 “UltraFlower” 减速/杀气削减分支，但没有对应的花弹（BulletData）。** `GE_Hun_GuiTouBlade_Debuff_Effect_UltraFlower` 仅被 `GE_Hun_GuiTouBlade_Debuff` 引用，本地导出里没有 `UltraFlower` 类型的 BulletData 或 Actor。【本地数据推断】 对红妆 mod 的用途：可以当作 “大花以上” 的效果模板。**待核实**：它是否被 `Debuff` 实际挂载。
2. **阿花 Boss 有一个 `GA_AHua_Special_02_New`，本地导出里只被自己和它的 BulletData `BD_GA_AHua_Special_02_New_01` 引用。** 它的 “_New” 后缀说明可能有一个旧版 Special_02 已被替换，但旧版在导出里找不到。【本地数据推断，待核实】
3. **`/Game/Test/` 下的测试资产随包打进了 build。** 例如 `Test/HorseTest/`（马车战斗原型）、`Test/GAS/`（溺水、桥、深水鱼怪等）、`Test/Narrative/`、`Test/PCG/` 等。这些类型在 SDK 里有完整的反射定义。【本地数据推断】（`type-index.json`）
4. **马车战斗原型已经完成到一定程度。** 类型 `BP_HorseCart_Skill`、`GA_HorseCart_Charge`、`ABP_HorseCart_Skill`，以及 Hun 唐刀的变体 `BP_Weapon_Hun_TangBlade_HorseCartCombat`。【本地数据推断】（type-index 与 SDK 类型）。是否能在游戏中触发，**待核实**。
5. **调试 / 作弊类 UI 与 Manager 存在于 build 中。** 例如 `/Game/Debug/CheatManagerBP`、`UI/Debug/W_DebugQuest`、`UI/Debug/W_DebugCreditsRoll`、`UI/Help/WB_DebugPrint`、`BP_PBZPerfTestGameMode`、`BP_TestGpuGameMode`。【本地数据推断】（type-index）。注意：我们不使用、也不激活这些类（不碰反作弊与联机）。
6. **旧钩爪 `GA_GrapplingHook_Old` 与 `BP_NPC_MoTian_Old`（含 `_Old_Mask`）是明确命名的旧版本。** 它们在 SDK 中存在，本地没有引用方。【本地数据推断】
7. **占位能力 `GA_Hun_ZhanMa_ChangeArmed_Placeholder`**（路径 `Abilities/ZhanMaBlade/Placeholder/`）是 “战马刀换武器” 的占位，本地没有引用方。【本地数据推断】
8. **别离残钩（`Weapon_Hun_DualHook`）在 SDK 中只有右手 `BP_Weapon_Hun_DualHook_R`，没有对应的左手类。** 双持武器里，其他武器都成对出现（JueYing_L/R、DoubleBlade_L/R、YuuBlade_L/R 等）。【本地数据推断，待核实】（可能是有意只做一边，或另一边的类名不同）。
9. **红妆鬼斩有两个效果名拼写不一致的 GE**：`GE_Weapon_GuiTouBlade_Evoluation_FlowerBuff`（typo “Evoluation”）与 `GE_Weapon_GuiTouBlade_Evolution` 系列。前者仅 2 次引用。这属于开发期的命名残留，不一定是未用。【本地数据推断】
10. **Boss 与玩家的 “花” 系统里，有几个没有对应生成点的花相关 Bullet。** 包括 `BD_AHua_GatheringFlower*`（被 Skill_06/07 引用，已用）、`BD_AHua_Flower_Homing_Hard_04/05`（只被 Skill_05_Hard 引用）。红妆侧的白花 `BP_GuiTouBlade_Flower_Homing` 在本地导出中**没有 GA 引用**，即 “谁生成白花” 仍是【待核实】（与既有笔记 `scarlet-wraithblade-flowers.md` §8 一致）。

**关于官方砍减内容的公开信息**：搜索摘要显示，制作人梁其伟在 2026 年 4 月的采访中提到 “游戏删除了一些内容”，主要为了集中资源打磨剧情文本、角色模型、动作表现、战斗与养成机制；但没有列出具体被删的内容。【社区已整理，仅搜索摘要】 https://news.17173.com/content/01232026/132156943.shtml （未打开原页，**待核实**）。

---

## 0. 检索结论：社区是否已有整理

| 检索方向 | 结果 |
|---|---|
| 英文 “unused / cut content / datamine / leftover” | 没有找到专门的未使用内容整理。结果多为发售信息与采访。【社区已整理，检索摘要】 https://www.wikiwand.com/en/articles/Phantom_Blade_Zero |
| 中文 “未实装 / 拆包 / 废弃资源 / 彩蛋 / 测试关卡” | 没有找到拆包整理。命中的是剧情彩蛋解读（机核）和一条 “侠义之举” 支线快讯。【社区已整理，检索摘要】 https://www.gcores.com/articles/213110 ，https://www.taptap.cn/moment/722554198821964927 |
| MetaBot 方法论 | 页面声明读取了 build 26367565 / CL-302256 的 PC 文件，导出了 DT_ShopTable、DT_InventoryData 等表，但**只覆盖正式内容**（商店、档案、成就、画廊）。【社区已整理】 https://metabot.gg/en/phantom-blade-zero/methodology |
| muyuanjin/PBZKeyForge 文档 | 搜索没有直接命中仓库，但既有笔记已经用 raw URL 读取过：`docs/complete-move-weapon-audit.md`、`docs/complete-moves.md`、`docs/complete-move-weapon-special-entries.json`。这些文档的 “未接入阶段” 计数（如红妆 `Weapon_Hun_GuiTouBlade` 的最后一列 = 1，`Weapon_Hun_Iron` 也是 1）可以作为 “未完整接入” 的线索，但文档本身没有说明它们是 “未使用”。【社区已整理，待核实】 https://github.com/muyuanjin/PBZKeyForge （本地缓存路径：`scratchpad\flower-research\keyforge\complete-move-weapon-audit.md`）
| KintaroModding / zoneoflkf / IdleAltair | 本次只使用了已有的 SDK 副本，没有新下载。 |

**结论**：目前没有现成的 “未使用内容” 目录可复用。本文档主要基于本地反射数据。

---

## 1. 武器与近战

| 名称（内部名） | 类型 | 证据 | 可信度 | 复用价值 |
|---|---|---|---|---|
| 别离残钩 左手 `BP_Weapon_Hun_DualHook_L`（缺失） | 武器 BP | SDK 只有 `DualHook/BP_Weapon_Hun_DualHook_R`；`Weapon_Hun_DualHook` 在 KeyForge 审计表中有 52 / 157 / 3 / 0 的计数 | 待核实 | 低：只是名字缺失，可能在别的 BP 中 |
| 马车唐刀 `BP_Weapon_Hun_TangBlade_HorseCartCombat` | 武器 BP | SDK `Players/Hun/Weapon/Tang/`；`Test/HorseTest/` 下有配套的 `BP_HorseCart_Skill`、`GA_HorseCart_Charge` | 【本地数据推断】 | 中：马车战斗的原型，若做 “骑马/坐车” 玩法 mod，可以参考 |
| 旧版 `GA_GrapplingHook_Old` | GA | SDK `Players/Hun/Abilities/GameplayBlocker/`；本地导出无引用 | 【本地数据推断】 | 低：钩爪类似物，参考用 |
| 战马刀换武器占位 `GA_Hun_ZhanMa_ChangeArmed_Placeholder` | GA | SDK `Players/Hun/Abilities/ZhanMaBlade/Placeholder/` | 【本地数据推断】 | 低：命名即占位 |
| 分身绝影 `BP_Weapon_Hun_Clone_JueYing_L/R` | 武器 BP（敌方 000_Hun） | SDK `Mobs/000_Hun/Weapon/`；与 `Players/Hun/Weapon/Double/BP_Weapon_Hun_JueYing_L/R` 对应 | 【本地数据推断】 | 中：“分身” 类武器，可能是 Boss 或 NPC 版本 |
| 序章木剑 `BP_Weapon_Hun_WoodenSword` / `Young_WoodenSword` | 武器 BP | SDK `Players/Hun/Weapon/WoodenSword/`；`HuaShira/Characters/Hero/Young_Hun/` | 【本地数据推断】（确认仍在序章用） | 低：仍在使用，不算未使用 |
| 黑魔伤序章版 `BP_Weapon_Hun_HeiMoShang_Prologue` | 武器 BP | SDK `Players/Hun/Weapon/HeiMoShang/` | 【本地数据推断】（序章专用，正式流程是否用，待核实） | 低 |

---

## 2. 技能、Buff、GE（玩家侧）

| 名称 | 类型 | 证据 | 可信度 | 复用价值 |
|---|---|---|---|---|
| `GE_Hun_GuiTouBlade_Debuff_Effect_UltraFlower` | GE | 本地导出存在；只被 `GE_Hun_GuiTouBlade_Debuff` 引用；SDK 中无成员；无 UltraFlower 类型的 BulletData 或 Actor | 【本地数据推断】，**待核实** | **高**：红妆大花/超大花减速与杀气削减的模板 |
| `GE_Hun_GuiTouBlade_HasBuff_Ultimate` | GE | 被 `GA_Hun_GuiTouBlade_C`、`GA_Hun_BEx_GuiTouBlade_M_01/02` 引用（4 次） | 【本地数据推断】——已接入，不算未使用 | 中：Lv15 “断情” 状态 |
| `GE_Weapon_GuiTouBlade_Evoluation_FlowerBuff` | GE（拼写 typo） | 与 `GA_Weapon_GuiTouBlade_Evolution_FlowerBuff` 并存，2 次引用 | 【本地数据推断】 | 低：开发期遗留的复制品，但仍被引用 |
| `GE_Weapon_GuiTouBlade_CanBuff` | GE | 本地只有 1 次引用（自身或 SDK 列表） | 【本地数据推断，待核实】 | 低 |
| `GE_Hun_GuiTouBlade_InFlower_Lag` / `GE_Hun_GuiTouBlade_HasBuff_Flower_Lag` | GE | 有 “Lag” 后缀的两组 GE | 【本地数据推断】（“Lag” 可能是延迟生效，不是 bug） | 中：如果做花区延迟效果，可以参考 |
| `GE_Hun_GuiTouBlade_Debuff_Effect_BigFlower` vs `Explode_Big` | GE | 与大花配对 | 【本地数据推断】（已接入） | 高（大花参考） |
| 被动 `GA_Hun_GuiTouBlade_Passive` 的 `Max Flowers Can Manual Explode` | 成员 | SDK 中有成员，数值未导出 | 【待核实】 | 高：红妆手动引爆上限 |
| `GA_Hun_GuiTouBlade_SWT` 与 `BulletData_Hun_GuiTouBlade_SWT_01` | GA / BulletData | `Weapon_Hun_GuiTouBlade` 引用 SWT（2 次）；SWT 含义未知（可能是 “切换/甩” 类招式） | 【本地数据推断，待核实】 | 中 |
| `GA_Hun_GuiTouBlade_C` / `BBB` / `A_Snap` / `B_Snap` | GA | 各 2 次引用，已被武器引用 | 【本地数据推断】（已接入） | 低 |
| `GA_SimpleExecution_GuiTouBlade` 与 `BD_Hun_GuiTouBlade_SimpleExecution_*` | GA / BulletData | 本地有完整定义；有 `Multi_01_1..5` 与 `FrontBack_01_1/2` 变体 | 【本地数据推断】（已接入，`ExE` 目录） | 低 |
| `GA_Hun_BEd_GuiTouBlade_M_02`、`BD_Hun_BEd_GuiTouBlade_02_Head`、`EB_Hun_BEx_GuiTouBlade_M_01_03` | GA / BulletData / EB | 各 2 次引用，`M_02` 与 `M_01` 为一组 | 【本地数据推断】 | 低 |
| 旧版 `GA_Hun_BEd/BEx` 处决 | GA | 与新版并存 | 【待核实】 | 低 |

---

## 3. 白花 / 大花 / 花弹（红妆）

| 名称 | 类型 | 证据 | 可信度 | 复用价值 |
|---|---|---|---|---|
| `BP_GuiTouBlade_Flower_Homing`（白花飞行体） | BP（UpgradeData） | SDK 有定义；本地导出无 GA 引用 | 【本地数据推断】——**生成者未知**（见 `scarlet-wraithblade-flowers.md` §8） | **高**：F 蓄力白花。若只生成 1 朵，要找到数量字段 |
| `BP_Hun_GuiTouBlade_Flower_Big` | BP | SDK 空类；有引用（2 次） | 【本地数据推断】 | 中 |
| `BD_Hun_GuiTouBlade_BHold_HomingFlower` 与 `_Explode` | BulletData | 被 `GA_Hun_GuiTouBlade_B_Hold` 引用 | 【本地数据推断】（已接入） | 高：F 蓄力白花的 BulletData 候选 |
| `PBZ_GuiTouBlade_FlowerExplodeBulletData` | BulletData | SDK 中为子类，只有特效与音效字段 | 【本地数据推断】 | 中 |
| `Wwise SFX_Combat_Hun_GuiTouBlade_Flower_Mix / Flower_Blast / Flower_Short / Flower_Touch` | 音效事件 | 文件存在于 `Content/Wwise/Events/.../GuiTouBlade/`；本地导出里没有引用 | 【本地数据推断，待核实】 | 中：可能是大花/混合爆炸的音效 |
| `NS_Weapon_GuiTounBlade_Trail_004_FlowerOnly` | VFX（名字有拼写错误 “Toun”） | `PBZVFXPack/.../GuiTouBlade/` 下，本地无引用 | 【本地数据推断，待核实】 | 中：只有花的拖尾，可能是白花拖尾 |
| `NS_Weapon_GuiTouBlade_Hint_001..004` | VFX | 本地无引用 | 【本地数据推断，待核实】 | 低：提示型特效 |
| `NS_GuiTouBlade_Flower_301_Loop/Burst` | VFX | 已由 `npc_boss_effects` 参考引用（既有笔记） | 【社区已整理（既有笔记）】 | 中 |

---

## 4. 阿花 Boss（红妆的敌方版本）

| 名称 | 类型 | 证据 | 可信度 | 复用价值 |
|---|---|---|---|---|
| `GA_AHua_Special_02_New` 与 `BD_GA_AHua_Special_02_New_01` | GA / BulletData | 本地只有自身与自己的 BulletData 互相引用（2 次）；`Special_02` 无旧版 | 【本地数据推断，待核实】 | 中：“New” 后缀暗示有旧版被替换，旧版在本地导出中缺失 |
| `GA_AHua_Attack_01`（New 目录） | GA | 本地 1 次引用 | 【本地数据推断，待核实】 | 低 |
| `GA_AHua_Skill_09`（New） | GA | 本地 1 次引用 | 【本地数据推断，待核实】 | 中：可能是未接入的阿花技能 |
| `GA_AHua_Homing_Flower_Hard` | GA | 本地 1 次引用 | 【本地数据推断，待核实】 | 中：Hard 变体，可能未接入 |
| `GA_AHua_Skill_05_B` / `_Hard`、`_06_Hard`、`_07_Hard` | GA（Hard 变体） | 1 次引用（自身） | 【本地数据推断，待核实】 | 中：Hard 模式的变体，可能在 Hard 难度才启用 |
| `GA_AHua_PunishCounter_01` | GA | 1 次引用 | 【本地数据推断，待核实】 | 低 |
| `GA_AHua_Teleport_Left` / `Right`、`GA_AHua_CA_01_GEx_Teleport_RedEye` | GA | 1 次引用 | 【本地数据推断，待核实】 | 中：瞬移 / 红眼瞬移的变体 |
| `GA_AHua_SpecialAttack_12/13/14` | GA | 2 至 4 次引用 | 【本地数据推断】（已接入） | 低 |
| `GE_AHua_InBuffArea_New` | GE | 被 `BP_AHua_Flower_Big/Small` 引用 | 【本地数据推断】（已接入，`_New` 后缀说明有旧版） | 低 |
| `GE_Hun_GuiTouBlade_Debuff_Effect_UltraFlower`（见第 2 节） | GE | 同上 | 【本地数据推断，待核实】 | 高 |
| `BD_AHua_Flower_Homing_Hard_04 / _05` | BulletData | 只被 `GA_AHua_Skill_05_Hard` 引用 | 【本地数据推断】（Hard 专用） | 中 |
| `BD_AHua_GatheringFlower*`（三件） | BulletData | 被 Skill_06/07 与其 Hard 版引用 | 【本地数据推断】（已接入） | 低 |
| `BP_Bullet_AHua_WhtieFlower_Fast/Slow` | BP | 已由 Boss 白花使用 | 【本地数据推断】（已接入） | 低 |

---

## 5. 测试 / 调试 / 原型类（随 build 打包，SDK 可见）

以下类型只来自 `type-index.json`（reflection-generated）。我们**不激活、不使用**，只做目录记录。【本地数据推断】

| 路径（前缀 `/Game/`） | 说明 | 复用价值 |
|---|---|---|
| `Debug/CheatManagerBP`、`Debug/Compnt_DebugInfos` | 作弊管理器、调试信息组件 | 不用（反作弊与联机相关，见 AGENTS.md 规则 5） |
| `PBZContent/Blueprint/BP_PBZPerfTestGameMode`、`BP_TestGpuGameMode` | 性能 / GPU 测试关卡模式 | 低 |
| `PBZContent/Blueprint/Character/Player/BP_TestPawn` | 测试用玩家 Pawn | 低 |
| `PBZContent/Blueprint/Character/NPC/BP_NPC_Test`、`BP_Test_NPC_Narrative` | 测试 NPC、叙事测试 NPC | 低 |
| `PBZContent/Blueprint/GA_WeakWalkTest` | 虚弱行走测试 GA（与 `Enum_WeakWalkState` 有关） | 低 |
| `Test/HorseTest/BP_HorseCart_Skill`、`GA_HorseCart_Charge`、`ABP_HorseCart_Skill`、`GAA_SimPhyWeight`、`GA_Passive_NiToucheNavMeshCheck` | 马车战斗原型（技能、冲撞、物理权重、导航检查） | **中**：若做马车类玩法的参考 |
| `Test/GAS/BP_Bridge`、`Test/GAS/UI/*`、`Test/GAS/W_LoadingTime` | GAS 测试桥、UI 测试 | 低 |
| `Test/MultiRoleTimline/GA_DrownByFish`、`BP_Monster_BaiheDisciple_DeepWater` | 溺水鱼、深水白鹤弟子 | 中：水下敌人与溺水 GA 的参考 |
| `Test/Narrative/Actor/BP_SplineActor` | 样条路径 Actor | 低 |
| `Test/PCG/PCG_New/.../BP_RoadArea` | PCG 道路区域测试 | 低 |
| `Test/QinYiTong/GearHouse/TriggerTrap/*` | 陷阱（崩山、倒树、陷阱触发器） | 中：环境陷阱参考 |
| `Test/Tianyi/Lift_damage/BP_Lift_SonFengxue`、`BP_Lift_WangChuan`、`GE_RouJiaMoDamage1` | 升降伤害测试 | 低 |
| `Test/LyraUi/WB_PBZHelpManager`、`WB_OverLayerOut*` | UI 帮助与遮罩测试 | 低 |
| `Test/Han/2024_5_8_PVintro/LS_PV_Tutorial_00/02_Start` | 2024 年 5 月 PV 教程序列（旧版剧情） | 低 |
| `Test/Han/HeartPain_ShanDao_New/*` | 心痛刀（新版测试）、呼吸镜头震动 | 低 |
| `Game/PBZContent/Sequencer/_Temps/Mboss_Finish` | Boss 结束序列（临时目录） | 中：Boss 收尾动画参考 |
| `Game/PBZContent/Sequencer/CG/Seqs017_Render_cut`、`_Sound` | CG 剪辑渲染版本（名字带 “cut”，但可能只是镜头切换） | 低 |
| `RenewalContent/Prototypes/*`、`RenewalContent/Actors/Mobs/Normal/BP_Monster_GoldMaskMan_Dummy_DeflectAndHit`、`_Dummy_OnlyHit` | 原型角色、金面具人的 Dummy 变体（只格挡 / 只受击） | **中**：Dummy 变体可能是训练或测试用的假人 |
| `RenewalContent/Actors/SpecialMove/Bp_TempLadder`、`BP_ASM_UpRunExecution`、`GE_HouHouHouHead_ForceCooldown` | 临时梯子、向上处决（ASM）、强制冷却 GE | 中 |
| `PBZContent/Environments/BPP/BP_OldBoard_1905_001`、`SM_OldBoard_89_Blueprint`、`SM_PaiFang_wood_cage_Old` | 旧版木板、旧牌坊笼子（名字带 “Old”） | 低（环境素材，可复用） |
| `PBZContent/Blueprint/Character/NPC/FlowNpc/BP_NPC_MoTian_Old`、`BP_NPC_MoTian_Old_Mask` | 旧版 NPC（魔天 Old 与面具版） | 低 |
| `PBZContent/Blueprint/Item/GameplayEffect/GC_TempUltimateBuff` | 临时大招 Buff 的 GameplayCue | 中：大招 Buff 参考 |
| `PBZContent/Blueprint/Item/GameplayEffect/GE_ClearTempEffects_Strong`、`GE_ClearTempNegativeEffects` | 清除临时效果的 GE | 低 |

---

## 6. 敌人 / Boss（非阿花）

| 名称 | 证据 | 可信度 | 说明 |
|---|---|---|---|
| `BP_Monster_BaiheDisciple_DeepWater`（深水白鹤弟子） | 在 `Test/MultiRoleTimline/` 下 | 【本地数据推断】 | 深水版敌人，可能是测试版 |
| `BP_Monster_GoldMaskMan_Dummy_DeflectAndHit`、`_OnlyHit` | `RenewalContent/Actors/Mobs/Normal/` | 【本地数据推断】 | 金面具人的假人变体 |
| `BP_Monster_ZhengDaoRenShi_Execute` | `RenewalContent/Actors/Mobs/Normal/` | 【本地数据推断】 | “正道人士” 处决版，可能是处决测试用 |
| `BP_NPC_SickDog_Golden` | `FlowNpc/` | 【本地数据推断】 | 金色病狗 NPC，单一变体 |
| `FemaleDoll` 的 `GE_FemaleDoll_Golden_BodyThunder`、`GA_FemaleDoll_Golden_ThunderRagePassive` | `Mobs/FemaleDoll/` | 【本地数据推断】（已接入，仅列出） | 金色女傀的雷怒被动 |
| `WeaponData/GuiTouDao/PBZ_ABP_Item_AHua_GuiTouDao` | `Mobs/042_AHua/WeaponData/` | 【本地数据推断】 | 阿花武器展示用 ABP |

---

## 7. 道具 / 剧情 / 其他

| 名称 | 证据 | 可信度 | 说明 |
|---|---|---|---|
| `Game/PBZContent/Blueprint/Ability/GameplayEffects/AbilityTree/GA_AddAccessorySlot_MemoryFlower` 等 | SDK 类型索引 | 【本地数据推断】 | 记忆花系统（饰品槽），已接入（“MemoryFlower” 名称出现在多个 GE 中），不属于未使用 |
| `FlowNpc/BP_NPC_*_WhiteFlower`（白花 NPC 五个） | SDK 类型索引 | 【本地数据推断】 | NPC 化的白花，可能是 “白花” 剧情 NPC。使用状态待核实 |
| `Game/PBZstory/PBZQuest/Simple/DaHuang` | SDK 类型索引 | 【本地数据推断】 | 大黄（剧情任务的一个单元），是否已接入待核实 |
| `UI/Debug/W_DisplayQuestEntry`、`W_DebugQuest` | SDK 类型索引 | 【本地数据推断】 | 任务调试 UI，不使用 |
| `UI/UINew/HUD/wb_TempCompleteUI`、`W_TempGameLogo`、`WB_TempLoadingScreen` | SDK 类型索引 | 【本地数据推断】 | 临时 UI，可能被正式 UI 替换，**待核实** |
| `UI/UINew/System/W_SystemPanel_V1` | SDK 类型索引 | 【本地数据推断】 | 旧版系统面板（与 `W_SystemPanel` 并存） |
| `BP_Ability_hold`、`BP_SkillWidgetHoldData` | SDK 类型索引 | 【本地数据推断】 | 旧版长按技能 UI |

---

## 8. 红妆鬼斩 / 阿花相关（单独成节）

这一节把前面几节中与红妆鬼斩（`GuiTouBlade`）及阿花（`AHua`）直接相关的条目合并。与 `docs/game-notes/scarlet-wraithblade-flowers.md` 和 `scarlet-wraithblade-flowers-assets.md` 互相参照。

### 8.1 已确认存在、可能未使用

- `GE_Hun_GuiTouBlade_Debuff_Effect_UltraFlower`：减速和杀气削减的超大花版。引用方只有 `GE_Hun_GuiTouBlade_Debuff`，没有对应的花弹。**最可能是未完成的 “超大花” 分支。**【待核实】
- `GE_Weapon_GuiTouBlade_Evoluation_FlowerBuff`：拼写错误的重复 GE（正确名为 `Evolution`）。仍被 2 处引用，属于开发期残留，**不算未使用**。
- `GE_Weapon_GuiTouBlade_CanBuff`：本地只有 1 次引用，**待核实**。
- `NS_Weapon_GuiTounBlade_Trail_004_FlowerOnly`（VFX）：只有花的拖尾，本地无引用，**待核实**。
- `SFX_Combat_Hun_GuiTouBlade_Flower_Mix / Flower_Blast / Flower_Short / Flower_Touch`（音效）：本地无引用，**待核实**。
- `BP_GuiTouBlade_Flower_Homing`：白花飞行体。本地没有 GA 引用它，但它的类存在于 `UpgradeData/`，**大概率是已接入但生成者不在本地导出中**。

### 8.2 阿花侧可能的未使用或 Hard 变体

- `GA_AHua_Special_02_New`（与 `BD_GA_AHua_Special_02_New_01`）：只被自己引用。
- `GA_AHua_Skill_09`、`GA_AHua_Attack_01`、`GA_AHua_PunishCounter_01`、`GA_AHua_Teleport_Left/Right`、`GA_AHua_CA_01_GEx_Teleport_RedEye`、`GA_AHua_Homing_Flower_Hard`：本地各 1 次引用。
- `BD_AHua_Flower_Homing_Hard_04/05`：只被 Hard 版技能引用，Hard 模式专用的可能性高。

### 8.3 与 mod 的关系

| 用途 | 可复用的资产 | 注意 |
|---|---|---|
| 场地彼岸花（第一个效果）的大花模板 | `BP_Hun_GuiTouBlade_Flower_Big`、`GE_Hun_GuiTouBlade_Debuff_Effect_BigFlower`、`GE_Hun_GuiTouBlade_Explode_Big`、`GE_Hun_GuiTouBlade_Debuff_Effect_UltraFlower`（超大花参考） | UltraFlower 没有花弹，直接启用会缺生成点 |
| F 蓄力白花（第二个效果）的白花模板 | `BP_GuiTouBlade_Flower_Homing`、`BD_Hun_GuiTouBlade_BHold_HomingFlower(_Explode)` | 数量字段（1 朵 → 5 朵）**仍未找到**，需要 FModel 导出 `B_Hold_Start` 时间线与 `BulletSpawnBurst.CountRange` |
| 花区 “延迟” 效果 | `GE_Hun_GuiTouBlade_InFlower_Lag`、`GE_Hun_GuiTouBlade_HasBuff_Flower_Lag` | 名称暗示延迟生效，需确认 |

---

## 9. 需要 FModel 导出核实的清单

以下每条都需要 FModel 导出资产或字节码才能定案。交给后续会话（按 AGENTS.md 第 6 步第 3 级，先用 FModel 导出 `extracted/`，再用 ripgrep 读取）。

**A. 红妆鬼斩（优先）**
1. `/PBZCombatAsset/ActorData/Players/Hun/Weapon/GuiTouBlade/GE_Hun_GuiTouBlade_Debuff`：导出它的 Modifier 列表与授予的 GE。确认是否挂 `GE_Hun_GuiTouBlade_Debuff_Effect_UltraFlower`，以及它的触发条件。
2. `/PBZCombatAsset/ActorData/Players/Hun/Weapon/GuiTouBlade/GE_Hun_GuiTouBlade_Debuff_Effect_UltraFlower`：导出 Duration、Period、移速与杀气字段，判断是否真的 “超大花”。
3. 全局搜索 `UltraFlower`（包括 `GA_Hun_GuiTouBlade_BBB`、`GA_Hun_GuiTouBlade_C`、`BP_Weapon_Hun_GuiTouBlade`）：确认是否有任何生成者。
4. `/PBZCombatAsset/ActorData/Players/Hun/Abilities/AHuaBlade/V2/GA_Hun_GuiTouBlade_B_Hold_Start` 的 `PlayTimeline`：找白花 `BP_GuiTouBlade_Flower_Homing` 的生成节点，并读取数量字段（对应 F 蓄力白花 1 → 5 朵）。
5. `/PBZCombatAsset/ActorData/Players/Hun/Weapon/GuiTouBlade/UpgradeData/BP_GuiTouBlade_Flower_Homing`：读取 `Received_PostStart`、`ReceiveTick`，确认其生成后的行为。
6. `/PBZCombatAsset/ActorData/Players/Hun/Weapon/GuiTouBlade/GA_Hun_GuiTouBlade_SWT` 与 `BulletData_Hun_GuiTouBlade_SWT_01`：确认 SWT 的含义与是否在玩家招式表中可触发。
7. `Content/Wwise/.../GuiTouBlade/SFX_Combat_Hun_GuiTouBlade_Flower_Mix / _Blast / _Short / _Touch`：在 `B_Hold`、`BBB`、`GA_Hun_GuiTouBlade_C` 的时间线里搜索这四个音效事件名，确认是否被引用。
8. `PBZVFXPack/.../GuiTouBlade/NS_Weapon_GuiTounBlade_Trail_004_FlowerOnly`：搜索引用方。

**B. 阿花 Boss**
9. `/PBZCombatAsset/ActorData/Mobs/042_AHua/Ability/GuiTouDao/Abilities/New/GA_AHua_Skill_09` 与 `GA_AHua_Attack_01`：确认是否在 `BP_Monster_AHua_GuiTouDao` 的技能表中。
10. `/PBZCombatAsset/ActorData/Mobs/042_AHua/Ability/GuiTouDao/Abilities/New/GA_AHua_Special_02_New`：确认旧版 `Special_02` 是否存在于 Boss 技能表中。
11. `Abilities/New/GA_AHua_Homing_Flower_Hard`、`GA_AHua_Skill_05_B`、`_06_Hard`、`_07_Hard`：确认 Hard 难度是否在 Boss 的 DataTable 中启用。
12. `GA_AHua_Teleport_Left/Right` 与 `GA_AHua_CA_01_GEx_Teleport_RedEye`：确认是否由 Boss 的技能树或 AI 调用。
13. `BD_AHua_Flower_Homing_Hard_04/05`：确认只被 `Skill_05_Hard` 引用，且该 Hard 版是否可达。

**C. 测试 / 原型资产（只做目录记录，不激活）**
14. `/Game/Test/HorseTest/BP_HorseCart_Skill`、`GA_HorseCart_Charge`：确认马车战斗原型是否有完整的 Blueprint 逻辑（能否在正式关卡中找到）。
15. `/PBZCombatAsset/ActorData/Players/Hun/Weapon/Double/BP_Weapon_Hun_DualHook_L`（缺失）：在 `Weapon/DualHook/` 下重新搜索，确认左手类是否改名或缺失。
16. `/PBZCombatAsset/ActorData/Players/Hun/Abilities/GameplayBlocker/GA_GrapplingHook_Old`：确认其 Modifier 与引用方。
17. `/PBZCombatAsset/ActorData/Players/Hun/Abilities/ZhanMaBlade/Placeholder/GA_Hun_ZhanMa_ChangeArmed_Placeholder`：确认占位是否实际执行。
18. `/RenewalContent/Actors/Mobs/Normal/BP_Monster_GoldMaskMan_Dummy_DeflectAndHit` 与 `_OnlyHit`：确认它们是否被关卡放置（若放置，则为正式敌人的训练版）。
19. `/Game/PBZContent/Blueprint/BP_NPC_MoTian_Old` 与 `_Old_Mask`：确认是否在任何关卡 / 任务中引用。
20. `/Game/PBZContent/Blueprint/Character/NPC/FlowNpc/BP_NPC_*_WhiteFlower`（五个）：确认是否在关卡中放置。

**D. 武器未接入阶段**
21. `docs/complete-move-weapon-audit.md`（KeyForge）里的 “未接入阶段” 计数：红妆 `Weapon_Hun_GuiTouBlade` 最后一列为 1，`Weapon_Hun_Iron` 也是 1。需要找到这些未接入阶段是什么（可能是 `B_Hold_Start` 的某个分支，也可能是无关的段落）。

---

## 10. 来源列表

| 来源 | URL / 路径 | 用途 | 可信度 |
|---|---|---|---|
| 本地 FModel 导出 | `Z:\Mods_crafting\extracted\fmodel\Exports\ProjectPBZ\`（328 个 JSON） | 红妆 / 阿花资产的引用关系 | 高（本地） |
| 既有笔记 | `Z:\Mods_crafting\docs\game-notes\scarlet-wraithblade-flowers.md`、`scarlet-wraithblade-flowers-assets.md` | 花的逻辑与未知项 | 中高 |
| SDK 类型索引 | `%TEMP%\claude\a5487a7d4d498014\dec4f295-ae05-4598-829b-d170d688ea57\scratchpad\flower-research\type-index.json`（34,593 条，reflection-generated） | 测试 / 调试 / 原型类型的存在性 | 高（反射） |
| SDK `blueprints.d.ts` | `…\scratchpad\flower-research\blueprints.d.ts`（原始：https://raw.githubusercontent.com/KintaroModding/phantombladezero_pbzmodloader/release/sdk/types/generated/blueprints.d.ts ） | 类成员与继承 | 高（反射，无默认值） |
| PBZKeyForge 文档 | https://github.com/muyuanjin/PBZKeyForge （`docs/complete-move-weapon-audit.md`、`docs/complete-moves.md`，本地缓存于 `…\flower-research\keyforge\`） | 武器的未接入阶段计数 | 高（同 build 静态解析），但不说明 “未使用” |
| MetaBot 方法论 | https://metabot.gg/en/phantom-blade-zero/methodology | 确认其数据范围不含 GA/GE 内部数值，也不含未使用内容 | 高（对 “它不含这些” 这件事） |
| 媒体报道（搜索摘要，未打开原页） | https://news.17173.com/content/01232026/132156943.shtml | 官方 2026 年 4 月关于删减内容的说法 | 中（**待核实**） |
| 网页检索摘要 | https://www.wikiwand.com/en/articles/Phantom_Blade_Zero 、 https://www.gcores.com/articles/213110 | 没有找到 datamine 或 cut 内容整理 | 低（检索摘要） |
| 既有笔记中引用的 pbz.gg / metabot / biligame 武器页 | https://pbz.gg/zh-hans/weapons/scarlet-wraithblade/ 、https://metabot.gg/en/phantom-blade-zero/weapons/scarlet-wraithblade 、https://wiki.biligame.com/yingzhiren/红妆鬼斩 | 红妆的文本描述 | 中高（沿用既有笔记，本次未重新打开） |
| Nexus | 既有笔记记录：返回 403，未获取 | — | — |

**未使用的远程来源**：IdleAltair/ChiRenBlade 的 `research/` 与 zoneoflkf/PBZModLoader 的 `sdk/` 本次没有下载，因为本地已有 Kintaro SDK 副本，且 usmap 只含类型 schema，不足以判断 “未使用”。
