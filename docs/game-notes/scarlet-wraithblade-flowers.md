# 红妆鬼斩（Scarlet Wraithblade）彼岸花 / 白花：公开资料调查笔记

> **2026-11-20 更新**：§10 的问题已在第 0 步用本地解包回答，见 `scarlet-wraithblade-flowers-assets.md`。两者冲突时以那份为准（例如：每次铺花是一圈 6～14 朵；“覆盖旧花”在资产里没有对应逻辑，推断是上限淘汰；白花一个动作只生成一颗）。

> 调查日期 2026-11-20。目标 build：Steam 26367565，CL-302256（JKS-17280）。
> 方法：只读公开资料，没有运行任何游戏相关二进制，没有碰游戏目录。
> 标注：**【已证实】**＝有一手来源（反射 SDK、游戏文本、社区解包产物、实机攻略）；**【推断】**＝由已证实事实推出；**【未知】**＝没找到证据。
> 注意：本文所有“SDK 行号”指 `blueprints.d.ts` 的下载副本（拉自 Kintaro fork 的 `release` 分支，12,925,975 字节）。
> 本地副本：`%TEMP%\claude\a5487a7d4d498014\dec4f295-ae05-4598-829b-d170d688ea57\scratchpad\flower-research\blueprints.d.ts`
> 原始 URL：https://raw.githubusercontent.com/KintaroModding/phantombladezero_pbzmodloader/release/sdk/types/generated/blueprints.d.ts
> 另一类一手来源：`muyuanjin/PBZKeyForge` 的 `docs/` 里有按 CL-302256 解出的 GA 字节码调用表和时间轴，见 §0。

## 0. 数据来源与可信度

| 来源 | 内容 | 可信度 |
|---|---|---|
| SDK `blueprints.d.ts`（Kintaro release 分支，上文 URL） | 类继承、成员名、函数签名。**没有默认值、没有字节码** | 高（反射生成；SDK 自述 “not individually call-tested”） |
| `muyuanjin/PBZKeyForge` `docs/complete-move-weapon-special-entries.json`（https://raw.githubusercontent.com/muyuanjin/PBZKeyForge/HEAD/docs/complete-move-weapon-special-entries.json ）、`docs/complete-moves.md`、`docs/complete-move-weapon-audit.md` | 红妆 GA 的 ubergraph **调用的函数列表**、CDO 标签、继承时间轴（时长到秒）。自述证据类型：“Cooked grants, GAS CDO fields, inherited attack timelines and original Blueprint callback…”，build CL-302256 | 高（同 build 的静态解析），但**只有调用列表，没有参数和分支条件** |
| `game-move-names-weapons.json`（同仓库 docs/）第 4373 行 | 游戏内英文描述原文，含 `<dtv id="X073"/>` 占位符（数值在别的表里） | 高（游戏文本） |
| pbz.gg 武器页 https://pbz.gg/zh-hans/weapons/scarlet-wraithblade/ ；metabot.gg 英文页 https://metabot.gg/en/phantom-blade-zero/weapons/scarlet-wraithblade ；biligame wiki https://wiki.biligame.com/yingzhiren/红妆鬼斩 | 逐级效果描述（Lv1/5/10/15/20/25/30）。三家文字一致，应来自同一份游戏文本 | 中高（来自游戏文本，但**不含任何伤害/杀气/数量数值**，只有秒数 3、15、8） |
| 攻略站（dtgre、playnews、powerupgaming、noobfeed、neonsect） | 阿花战的定性描述 | 低到中（玩家观察，没有实测间隔） |
| Nexus | 对抓取返回 403，未获取 | — |
| IdleAltair/ChiRenBlade `research/`（https://github.com/IdleAltair/ChiRenBlade ） | 目录里有 `research/data/schema.txt`（7.3MB，usmap 导出）、`full.usmap`。**没有下载**，且 usmap 只含类型 schema，没有默认值；与本题无关的笔记（break、shachi-cost、damage-burning）未读 | — |
| metabot.gg 方法论 https://metabot.gg/en/phantom-blade-zero/methodology | 只导出数据表（武器、敌人等），页面**没有说**包含 GA/GE 内部数值；没提红妆 | 高（对“它不含这些数据”这件事） |

**一个关键事实**：游戏文本里的“3 秒”“15 秒”“8 秒”是**描述里的数**。真正驱动逻辑的数值在 Blueprint 默认值 / GE 的 Duration / DataTable 里，公开资料里没有。

---

## 1. 普攻 / 重击铺花：哪个 GA、哪个动作生成？小花与大花的区别？

- **【已证实】官方描述：是“重攻击（F）连招”留下石蒜花**，不是普通攻击。原文（pbz.gg）：“Heavy attack combos leave 石蒜花 on the ground”（pbz.gg / metabot 英文页：“Lilies appear on the ground” after Heavy Attack combos）。 https://pbz.gg/zh-hans/weapons/scarlet-wraithblade/
  - 普通轻攻击（`GA_Hun_GuiTouBlade_A*`）是否也铺花：**【未知】**。SDK 里这些 GA 没有任何花相关成员（`blueprints.d.ts` 180196–180340 行）。
- **【已证实】武器 ↔ 类的对应**：游戏内名“红妆鬼斩”对应 `Weapon.Type.GuiTouBlade`，其 `Equip Abilities` 含 `B_Hold_Start` 与 `B_Hold`（PBZKeyForge `docs/complete-move-weapon-audit.md` 第 38 行；`complete-moves.md` 第 30 行把 “红妆鬼斩 · 重攻击 · 蓄力 · 释放” 对应 `BHold`）。这把 A6 里“GuiTouBlade = 红妆鬼斩”的推断变成了已证实。
- **【已证实（调用列表）/ 【推断】（行为）】铺花生成点＝`GA_Hun_GuiTouBlade_B_Hold` 的 “Flower Walk Tick”**。
  - SDK（行 180419–180433）：`B_Hold` 有成员 `"Small Flower": BulletDataBase`、`"Last Flower Location": Vector`、`"Timer Handle": TimerHandle`，函数 `"Flower Walk Tick"`。
  - PBZKeyForge 解出的 `ExecuteUbergraph_GA_Hun_GuiTouBlade_B_Hold` 调用表包含：`BulletDataBase.CreateBullet`、`SweepTraceUtils.TransformFindFloor`、`KismetMathLibrary.Vector_Distance2DSquared`、`Greater_DoubleDouble`、`KismetSystemLibrary.K2_SetTimerDelegate`、`AbilityTask_WaitGameplayTagAdded/Removed`；并带标签 `CharacterState.AbilityState.GuiTouBlade.FlowerWalk`（`complete-move-weapon-special-entries.json` 约第 8470–8490 行）。`K2_OnEndAbility` 清定时器。
  - 推断：`B_Hold` 期间（FlowerWalk 状态）开一个定时器，tick 里量“当前位置与 Last Flower Location 的平面距离²”，超过阈值就在地面（TransformFindFloor）用 `Small Flower` 的 BulletData `CreateBullet` 生成一朵小花——**即“走一段铺一朵”**。距离阈值、tick 周期、是否同时在别处生成：**【未知】**（需要字节码/默认值）。
  - 同一 `B_Hold` 的主时间轴：Montage 3.1667 s；`GAA_BulletBurstWithDeflect_C_1` 在 0–0.37 s；`LGAAction_DurationBulletWithDeflect_0` 在 0.959 s、持续 0.1 s（同上 JSON 第 8519–8560 行）。这些是挥砍子弹，不一定是花。
- **【未知】大花从哪个 GA 生成**。候选：官方描述 Lv15“断情绝路”里“重攻击连招末尾再按重攻击→强力斩击，留下**巨大石蒜花**”，应是 `BB` / `BBB` 一类连招 GA（`GA_Hun_GuiTouBlade_BB` 时间轴含 `GAA_BulletBurst_C_12/13` 在 0.626 s，见 JSON）。成员里没有大花引用，需解包看 BulletData 才能确认。
- **小花 / 大花的类级差别**【已证实，SDK 行 203742–203765】：
  - `BP_Hun_GuiTouBlade_Flower_Big`：**空类**，没有任何新成员或重写。
  - `BP_Hun_GuiTouBlade_Flower_Small`：重写 `Received_PostStart`、`Received_Deactivate`，并新增 `GetTargetPriority / GetTargetSockets / GetTargetTypes`（目标系统接口，**推断**：小花可以被锁定/作为目标）。
  - 大花的差别因此只能在**默认值/资产**里（BulletData、特效、使用的 GE）：见下面 GE 家族 `*_BigFlower`、`Explode_Big`。被动 GA 对大花只有单值 `"Current Big Flower"`（180155），**【推断】场上同时只有 1 个大花**。
  - **【新发现】存在第三档 “UltraFlower”**：`GE_Hun_GuiTouBlade_Debuff_Effect_UltraFlower`（203793），以及 `GE_Hun_GuiTouBlade_HasBuff_Ultimate`（203967）。**推断**对应 Lv15 之后的“大石蒜花”（官方说“增加杀气削减”）。用途未知。

## 2. 存在时间

- **【已证实】游戏文本数值**：基础石蒜花“3 秒后爆炸，范围内敌人短时间内持续受伤”；Lv5「遍地红妆」“持续时间延长至 15 秒”，且能用 E 手动引爆（pbz.gg、metabot、biligame 三处一致）。同样的 3 秒，在 dtgre 对阿花战的描述里是 “roughly three seconds”（https://www.dtgre.com/2026/11/phantom-blade-zero-hua-white-lilies-parry-dodge-grab.html ，中等可信，玩家估计）。
- **【已证实（成员）】驱动存在时间的函数/成员**：花类有 `"Get Lifetime"(): number`、`"Explode Timer": TimerHandle`、`"Expire Explode"()`；父类 `BP_PBZ_ProjectileEmitter` 有 `"Lifetime Timer": TimerHandle` 和 `"On Lifetimer Timer"()`（SDK 行 203713–203741，及 `BP_PBZ_ProjectileEmitter` 定义处）。
- **【推断】哪个驱动**：Boss 版只重写 `"Get Lifetime"`（行 136155、136165，`Omit<..., "Get Lifetime">`），说明寿命的值由这个函数返回，Boss 与玩家用不同的返回值。`Get Lifetime` 大概在 `Received_PostStart` 里被读去设 `Explode Timer`（或父类 `Lifetime Timer`）。两个 timer 谁起主要作用：**【未知】**。
- **【推断】基础值与升级值**：3 s（Lv1）→ 15 s（Lv5）这个切换大概由 `Get Lifetime` 里读“有没有 CanManualExplode 标签/GE”决定。**没有证据**，也可能由两个不同的 BulletData 或不同类实现。**【未知】**
- **【推断，低信度】到期 = “Expire Explode” 爆一次再销毁**。依据只有函数名（`Expire` + `Explode`）和官方文本“3 秒后爆炸”。是否爆后 `Deactivate`、爆前是否要先 `Process Explosion`：**【未知】**。

## 3. 按 E 主动引爆

- **【已证实】入口**：被动 `GA_Hun_GuiTouBlade_Passive`（路径 `/PBZCombatAsset/ActorData/Players/Hun/Abilities/AHuaBlade/GA_Hun_GuiTouBlade_Passive`）自己监听输入：成员 `"InpActEvt_IA_Execution_K2Node_EnhancedInputActionEvent_0"(ActionValue, ElapsedTime, TriggeredTime, SourceAction)`（SDK 行 180174）。这是 Enhanced Input 的 `IA_Execution`（“处决/E 键”这个输入动作，biligame 页的图标是键盘 E / 手柄 B）。**注意**：同名事件在其他 GA 里也出现（行 79382、196985），说明 `IA_Execution` 是通用动作，不是红妆专属。
- **【推断】路径**：`IA_Execution` 事件 → 检查 Lv5 解锁（GE `GE_Weapon_GuiTouBlade_CanManualExplode`，行 203994，**无任何成员**，纯标签 GE）与 `"Max Flowers Can Manual Explode"` → `"Trigger Flowers"()` → `"Process Explosion"(Bullets: ref TArray<Flower>)` → 对每朵花调 `"Trigger Explode"(Transform&, BulletDataBase&)` → `"Play Trigger Effects"()`。函数签名都已证实，**调用顺序和条件是推断**。
- **【已证实】“Passive 回调”**：被动有 `"On Flower Deactivated"(Flower)`（180178），花有 `"Passive Ability"` 引用。**推断**：花消失（`Received_Deactivate`）→ 通知被动从 `Current Flowers` 移除。谁来 Deactivate 花（`Trigger Explode` 本身，还是 `Process Explosion` 之后）：**【未知】**。
- **【推断，低信度】冷却**：被动上有 `"SpecialCooldown": number` 和 `"CanUseSpecial": boolean`（180150–180151）。这是类里**已有的冷却型成员**，很可能是 E 引爆的节流；也可能是 Q「红妆漫天」（Phantom Edge）用的。**【未知】**。
- 官方文本：“Execution manually detonates all active lilies”（metabot，英文原文）。**“all”**（全部），与 `"Max Flowers Can Manual Explode"` 的含义要核对：是“手动引爆时最多处理几朵”还是“有这么多花才允许引爆”。**【未知】**

## 4. 在旧花上铺新花：旧花消失、新花覆盖并立即爆炸一次

- **【未知】没有任何公开资料描述这个行为**，没找到游戏文本、攻略、SDK 成员能直接对应。请注意：这条“已知线索”很可能**不是原版行为**，而是目标 mod 要做的效果；调用方应当当作“待验证设想”，而非原版逻辑。
- 相关的**已证实成员**（可能参与，但不能证明行为）：花上 `"On Overlap"(Actor)` + `"Overlapping Actors": Array<Actor>`（花与角色/子弹的重叠）、`"Find Floor"` + `"Failed To Find Floor": boolean`；被动上 `"Register Flower"(Actor)`、`"Remove Flowers"()`、`"On Flower Deactivated"`、`"Flower Self Explode"(Bullet)`（SDK 行 203713–203741，180173–180191）。
- 推断：`On Overlap` 是**检测敌人/玩家进出花区（挂 InFlower / Debuff GE）**用的，不像“花与花重叠”。`Register Flower` 大概在超过上限时淘汰最旧的一朵（见 §5）。`Remove Flowers` 多半在被动结束 / 切武器时清全部。这些都是**名字推断**。

## 5. 花数量上限

- **【已证实（成员）】** 被动：`"Max Flowers Default": number`、`"Max Flowers Can Manual Explode": number`、`"Current Flowers": TArray<Flower>`（180154、180156、180158）。
- **【已证实（文本）】** Lv5「遍地红妆」“场上同时存在的石蒜花最大数量增加”（所有公开页都**没给数字**）。
- **【推断】** `Max Flowers Default` 是 Lv1~4 的上限，`Max Flowers Can Manual Explode` 是 Lv5 之后（`CanManualExplode` GE 激活时）的上限——名字上两个数通常会被同一次升级换掉。**把握中等偏低**：另一种读法是“允许手动引爆所需的最低花数”。
- **数值：【未知】**（只有默认值能给出）。
- **【未知】超出时的处理**：推断是 `Register Flower` 里把最旧的花 `Flower Self Explode` 或 `Deactivate`，没有证据。

## 6. “Current Tick Explode Timer” / “Process Current Tick Explode” / “Flower Self Explode”

- **【已证实（成员）】**：被动上 `"Current Tick Explode Flowers": TArray<Flower>`、`"Current Tick Explode Timer": TimerHandle`、`"Process Current Tick Explode"()`、`"Flower Self Explode"(Bullet: Flower)`（180162–180183）。
- **【推断，中等】它们不是“周期性爆炸机制”，而是“同一 tick 的爆炸合批”**：
  1. 花到期（`Expire Explode`）时调 `Passive Ability.Flower Self Explode(this)`；
  2. 被动把这朵花加进 `Current Tick Explode Flowers`，并在 `Current Tick Explode Timer` 上起一个很短（可能是 0 延迟 / 下一帧）的 timer；
  3. timer 触发 `Process Current Tick Explode`，把这一批花一次交给 `Process Explosion`，之后清空数组。
  这样同一帧到期的多朵花只触发一次 `Process Explosion` / `Play Trigger Effects`。理由：名字里的 “Tick” 是 “本 tick”；数组与 timer 都是单个而不是 per-flower；且 `Process Explosion` 的入参本来就是数组。
- **反证 / 保留**：`TimerHandle` 也可以是 looping timer。**没有任何公开来源证明玩家版“被动 GA 自带周期爆炸，只是没启用”**。需要字节码确认 `K2_SetTimerDelegate` 的 `bLooping` 与 Time 参数。
- **Boss 侧也没有额外代码**：`GA_AHua_GuiTouBlade_Passive extends GA_Hun_GuiTouBlade_Passive`，**空类、无新成员**（SDK 行 135715–135724）。所以如果 Boss 有“周期爆炸”，要么在继承来的这套逻辑里（只是默认值不同），要么在 Boss 的技能 GA 里（`SpawnFlowers`）。见 §9。

## 7. 杀气削减 / 减速 / 持续掉杀气

- **【已证实（文本）】** 敌人踩进花区“移动速度降低并持续损耗杀气”（pbz.gg / biligame）；Lv10/20/30 分别小/中/大幅提升“爆炸伤害与杀气削减”（无数值）；Lv15 的“断情”期间对花内敌人“增加杀气削减”。
- **【已证实（类名，全部无成员）】**，位于 `/PBZCombatAsset/ActorData/Players/Hun/Weapon/GuiTouBlade/`（SDK 行 203766–203882）：
  - Debuff 家族：`GE_Hun_GuiTouBlade_Debuff`、`_Debuff_Effect`、`_Debuff_Effect_BigFlower`、`_Debuff_Effect_UltraFlower`、`_Debuff_Tick`、`_InDebuffArea`、`_InDebuffArea_BigFlower`、`_ExitDebuffArea`、`_RemoveDebuff`；以及 GameplayCue `GC_GuiTouBlade_Debuff`（行 21839）。
  - 站在花里的玩家侧：`_HasFlower`、`_InFlower`、`_InFlower_Base`、`_InFlower_Lag`。
  - 爆炸：`UpgradeData/GE_Hun_GuiTouBlade_Explode`、`_Explode_Big`（203922、203931）；子弹：`PBZ_GuiTouBlade_FlowerExplodeBulletData`（继承 `BP_PBZ_OverlapBulletData`，成员只有特效/音效/震屏/手柄反馈，行 198315）、`UpgradeData/PBZ_OverlapBullet_GuiTouBlade_Explosion`（`GetOverlapOrigins`、`Parent Bullet Transforms`，行 204039）。
  - 花上 `"Debuff GE": Class` 和 `"Buff GE": Class`（203713 附近）：**推断**，Debuff GE 对敌人（减速 + 周期扣杀气），Buff GE 对友方（花内杀气消耗降低、受治疗提高，对应官方文本“铸魂：此恨绵绵”）。
- **【推断】** “减速 + 持续掉杀气”最可能是 `Debuff_Effect(_BigFlower/_UltraFlower)`（带 Modifier 的 duration GE）+ `Debuff_Tick`（周期 GE，每 tick 扣杀气）；`InDebuffArea / ExitDebuffArea / RemoveDebuff` 负责进出花区的挂/摘。**GE 的 modifier、周期、数值：【未知】**——SDK 的 GE 类没有任何成员，数据在 CDO 里。
- **【未知】** “爆炸削杀气”是 GE（`Explode`）的属性修改，还是子弹伤害字段（如 `Damage.Attack.Target.AngerDamage` 这类 SetByCaller）：SDK 里搜不到 `AngerDamage` 的红妆相关成员；只在其他武器的 GA（如 `GA_SlitheringSword_PenetratePassive.AngerDamageCoefficient/AngerDamageSetByCallerTag`，`PBZCombatAsset.d.ts` 约 2201 行）出现，**证明游戏确实有 “AngerDamage 系数 + SetByCaller 标签”这套机制**，但红妆用没用不知道。
- **【已证实（成员）/ 推断（对应）】铸魂“此恨绵绵”**：`GA_Weapon_GuiTouBlade_Evolution_FlowerBuff` 有成员 `"Shachi Cost Reduction": number`、`"Heal Boost": number`（行 203899 起），与官方文本“在花中，杀气消耗降低、受治疗增加”一一对应；红花计量由 `GE_Weapon_GuiTouBlade_Evolution_HitCounter(_Explode)` 与 `GC_GuiTouBlade_HitCounter_Increment/Explode` 承担（行 22777、22786、204021、204030）。这部分与“花自己的周期爆炸”是**两套机制**。

## 8. F 蓄力白花

- **【已证实】F 长按蓄力 GA ＝ `GA_Hun_GuiTouBlade_B_Hold_Start`**（SDK 180438）：继承 `B_Hold`，成员 `Holding`、`Min Duration`、`OnRelease/OnCancelled/OnAlreadyRelease`。PBZKeyForge 证实：以 `IA_AttackH_PressLong` 激活 `B_Hold_Start`；入口要求 `CharacterState.WeaponUpgrade.GuiTouBlade.CanCharge`（Lv25 解锁，对应 GE `GE_Weapon_GuiTouBlade_CanCharge`，行 203985）、排除 `CharacterState.AbilityState.GuiTouBlade.InBHold`；用 `AbilityTask_WaitSInputRelease` 等松键，释放后按 `Current Reinforced` 用 `ForceActivateExternalActionAbilityByClass` 激活 `B_Hold` 或 `B_Hold_Unreinforced`；提前松键走 `BB_UnCharge` / `BB_UnCharge_Reinforced`（来源：`docs/complete-moves.md` 第 30、193–197 行；`docs/complete-move-weapon-audit.md` 第 31、36 行）。
- **【已证实（文本）】** Lv25「火照黄泉」：“长按重击蓄力；蓄力开始时召唤一朵巨大的白石蒜花飞向敌人，接触后爆炸；蓄满则瞬移到敌人面前，发动一次强力斩击”。
- **【推断】白花的类＝`UpgradeData/BP_GuiTouBlade_Flower_Homing`**（SDK 203883）：成员 `Sphere`、`Success`、`ReceiveTick`、`EventReceived_*`、`Received_PostStart`，放在 `UpgradeData/` 里与 `CanCharge` GE 同目录，行为（`ReceiveTick` 追踪、`Success` 命中标志）符合“飞向敌人接触爆炸”。**未见任何 GA 引用它**，所以“谁生成、在哪个时间点生成”是**【未知】**。
  - 生成位置的候选：(a) `B_Hold_Start` 在 `OnPress`/开始时用 `PlayTimeline`（它的 ubergraph 调用 `LegoAbility.PlayTimeline`，PBZKeyForge 调用表），时间轴上的 BulletBurst 动作；(b) `EventReceived_*` 里直接 `CreateBullet`。
- **数量字段：【未知】**。官方文本是“一朵巨大的白石蒜花”，**1 朵与此一致**，没有“5 朵”的证据。如果走时间轴，数量字段在 `BulletSpawnBurst*` 的 `CountRange`（SDK `SGameCombatSystem.d.ts` 约 1150 行有 `CountRange: Vector2D`），但没有资料指出白花用不用这个类型。
- Boss 的白花是**另一套**：`BP_Bullet_AHua_WhtieFlower(_Fast/_Slow)`（继承 `BP_PBZ_ProjectileBullet`，不是 `ProjectileEmitter`）、`GA_AHua_Homing_Flower(_GEd/_Hard)`（SDK 135970–135996）。`GEd` 是 `GA_ExecutedAbilityBase_Grab` 的子类，说明“白花被吃到接处决/抓取”。攻略也说“白花要格挡，吃到会被抓”。

## 9. Boss 阿花版

- **【已证实（SDK，行 135715、136155–136175、136214–136290）** 继承结构：
  - `BP_AHua_Flower_Big/Small extends BP_Hun_GuiTouBlade_Flower_Base`，只重写 `"Get Lifetime"`。**注意**：是继承 **Base**，不是 `_Big/_Small`；玩家 Small 重写的 `Received_PostStart/Deactivate` 和目标接口，Boss 版**没有**（`Omit<Base,"Get Lifetime">`）。
  - `GA_AHua_GuiTouBlade_Passive extends GA_Hun_GuiTouBlade_Passive`，空类。
  - GE 全部镜像：`GE_AHua_Debuff / _Debuff_Effect / _Debuff_Effect_BigFlower / _Debuff_Tick / _ExitDebuffArea / _InDebuffArea / _RemoveDebuff` 各自继承玩家同名 GE（也无成员）。另有 `GE_YuZan_RemoveDebuff` 继承 `GE_Hun_GuiTouBlade_RemoveDebuff`（行 154426，说明别的 Boss 也复用这套）。
  - Boss 技能：`GA_AHua_Skill_05` 与 `GA_AHua_Special_03_B_Flower`（及 `_CD`）各有 `SpawnFlowers(BaseLocation, ForwardVector, RightVector, Distance, RandomRadius)`（行 135752–135759、136016–136024）；还有 `GA_AHua_SpecialMove_B/L/R`、`GA_AHua_Homing_Flower*`、`GA_AHua_Heavy_01`。
- **【已证实（实机观察，中等可信）】玩家可见的 Boss 行为**：
  - 地面红花“after a short delay, they explode”，约 3 秒（dtgre，“roughly three seconds”）。
  - 花区减速、会掉杀气（同上 / `powerupgaming`：“The lilies can drain Sha-Chi and also explode”，该句在“奖励”一节，实际指红妆鬼斩玩家版）。
  - “多次爆炸”：powerupgaming 原文 “They can cause multiple explosions, so it's best to leave where they appear”。**这里的“multiple”更像是多个花区叠加，而不是同一花区周期重复爆**；没有来源给出“同一朵花反复爆炸”的证据。
  - 红色飘花追人，出现后约 1.7–2.3 秒阿花追出抓取（来自 WebSearch 的摘要，**原页面没有取到**，低可信，仅供参考）。
- **爆炸间隔（秒）：** 没有任何公开来源给出“周期爆炸的间隔秒数”。**只有“约 3 秒后爆一次”**（玩家版 Lv1 的文本值与 Boss 描述吻合）。**不能据此得出“Boss 花丛每 N 秒爆炸”**。这件事需要本地拆包（`BP_AHua_Flower_*."Get Lifetime"` 的返回值；`SpawnFlowers` 的生成数；以及 Boss 花是否用 timer loop）。
- **与玩家版的差别**（已证实的部分）：只有 `Get Lifetime` 不同；Boss 版的 Small 没有玩家 Small 的目标接口与 PostStart/Deactivate 重写（说明 Boss 版小花不能被锁定、也没有玩家 Small 在 PostStart 里做的事）。其他差别（伤害、GE 数值、爆炸 BulletData）：**【未知】**。
- 弱线索：VFX 名里有 `NS_AHua_Flower_004_Timed`、`NS_AHua_Flower_005_Burst`、`NS_AHua_Flower_009_LoopNoTrace`，玩家侧有 `NS_GuiTouBlade_Flower_301_Loop / _Burst`（`Jersyi/cringe-blade-zero:src/character/npc_boss_effects.generated.h`）。“Timed”暗示有计时型花，**不足以证明周期爆炸**。

---

## 10. 必须本地拆包才能回答的问题清单（交给第 0 步）

以下要看 **Blueprint 默认值 / ubergraph 字节码 / 数据表**。建议用只读方式导出这几个资产，**不要改游戏目录**。

资产路径前缀 `P = /PBZCombatAsset/ActorData/Players/Hun/`。

1. **`P/Weapon/GuiTouBlade/FlowerBullet/BP_Hun_GuiTouBlade_Flower_Base`**（及 `_Small`、`_Big`）
   - `Get Lifetime` 的字节码：返回常量，还是读 GE/标签（3 s 与 15 s 的切换点）。
   - `Received_PostStart`：何时设 `Explode Timer`、是否同时设父类 `Lifetime Timer`；`Received_Initialize`：是否调用 `Passive Ability.Register Flower`。
   - `Expire Explode`：是 `Trigger Explode` + `Deactivate`，还是 `Flower Self Explode`；`Trigger Explode` 内部是否 `Deactivate`。
   - `On Overlap`、`Find Floor`、`Failed To Find Floor` 的逻辑；`Debuff GE` / `Buff GE` / `Explode Bullet Data` 的默认值（指向哪个 GE / BulletData）。
2. **`P/Abilities/AHuaBlade/GA_Hun_GuiTouBlade_Passive`**
   - CDO 默认值：`Max Flowers Default`、`Max Flowers Can Manual Explode`、`SpecialCooldown`。
   - `Register Flower`（超限处理：淘汰最旧还是拒绝）、`Remove Flowers`、`Trigger Flowers`、`Process Explosion`、`Process Current Tick Explode`、`Flower Self Explode`：尤其是 `K2_SetTimerDelegate` 的时间与 `bLooping`（判断“Tick Explode”是合批还是周期）。
   - `InpActEvt_IA_Execution…` 的分支条件（Lv5 标签、冷却、是否清 `Current Flowers`）。
   - 两个 `EventReceived_*` 的事件标签；`Added_*/Removed_*` 对应哪些 GE 的挂/摘（`HasFlower`、`CanManualExplode`）。
3. **`P/Abilities/AHuaBlade/V2/GA_Hun_GuiTouBlade_B_Hold` 与 `B_Hold_Start`**
   - `Small Flower` 的 BulletData 是哪个资产；`Flower Walk Tick` 的距离阈值（`Vector_Distance2DSquared` 比较值）与 timer 周期。
   - `B_Hold_Start` 的 `PlayTimeline` 用哪条时间轴、白花（`BP_GuiTouBlade_Flower_Homing`）是否由它生成；若是时间轴动作，`BulletSpawnBurst` 的类型与 `CountRange`。
4. **大花的来源 GA**：在 `BB / BBB / BBBB …`（`V2/GA_Hun_GuiTouBlade_*`）及 `UpgradeData` 里搜 `BP_Hun_GuiTouBlade_Flower_Big` 的引用，确认生成动作与条件（Lv15 “断情”、`HasBuff_Ultimate`、`Current Big Flower`）。
5. **GE 数值**（`P/Weapon/GuiTouBlade/GE_*` 和 `UpgradeData/GE_*`）：`Debuff_Effect(_BigFlower/_UltraFlower)`、`Debuff_Tick`、`InDebuffArea*` 的 Duration、Period、Modifier（移速、杀气）、授予标签；`Explode / Explode_Big` 的杀气伤害是 SetByCaller 还是固定 Modifier；Lv10/20/30 的“杀气削减”提升是改哪个字段。
6. **爆炸子弹** `P/BulletData/LongBlade/GuiTouBlade/Flower/PBZ_GuiTouBlade_FlowerExplodeBulletData` 与 `UpgradeData/PBZ_OverlapBullet_GuiTouBlade_Explosion`：伤害系数、半径、持续时间（“短时间内持续受伤”）、是否带杀气伤害字段。
7. **游戏文本 DataTable**：`<dtv id="X073"/>`（Lv15 断情 8 秒）及同表里 Lv1 的 3、Lv5 的 15 等 `X0xx` 值与 GE/类默认值的对应关系，用来验证 §2 的“文本值 = 默认值”。
8. **Boss**：`/PBZCombatAsset/ActorData/Mobs/042_AHua/Ability/GuiTouDao/Bullets/BP_AHua_Flower_Big|Small` 的 `Get Lifetime` 返回值；`GA_AHua_Skill_05`、`GA_AHua_Special_03_B_Flower(_CD)` 的 `SpawnFlowers` 与调用频率（是否有 timer loop 重复生成/重复引爆）；`GA_AHua_GuiTouBlade_Passive` CDO 与玩家版的默认值差异；`GE_AHua_*` 的数值差异。
9. **旧花覆盖新花 → 旧花消失并立即爆炸**：第一步先确认**原版有没有**这个行为（重点看 `Register Flower` 与 `Received_Initialize`）。公开资料里没有任何证据显示它存在。
10. **普通轻攻击（`GA_Hun_GuiTouBlade_A*`）是否铺花**：看这些 GA 的时间轴里有没有生成花的 BulletBurst。

## 11. 一页结论

- 已证实：红妆 = `GuiTouBlade`；花是 `BP_PBZ_ProjectileEmitter` 子类；被动 GA 管花列表、手动引爆（`IA_Execution` 事件）、合批爆炸入口；Boss 花与被动**直接继承**玩家的类，只重写 `Get Lifetime`。
- 已证实（游戏文本）：基础花 3 秒后爆、Lv5 起 15 秒并可 E 引爆、Lv25 长按 F 出巨大白花；**所有杀气/伤害/数量数值公开资料均缺失**。
- 铺花由 `B_Hold` 的 FlowerWalk 定时器（距离触发 + CreateBullet + TransformFindFloor）生成——来自字节码调用表的强推断。
- “周期爆炸”：没有任何证据；`Current Tick Explode*` 更像同帧合批。Boss 的“每 N 秒”也没有公开数字，只有“约 3 秒后爆炸”。
- “覆盖旧花”：公开资料无此行为，需拆包确认原版有没有。
