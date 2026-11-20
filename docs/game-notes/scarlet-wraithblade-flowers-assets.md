# 红妆鬼斩彼岸花 / 白花：本地解包结论（第 0 步）

> 日期 2026-11-20。游戏 Steam build **26367565**（CL-302256_JKS-17280），UE 5.7（S-GAME 定制）。
> 方法：FModel nov-2026 只读加载 `ProjectPBZ\Content\Paks`，AES key 来自社区公开来源、在本地解密 pak 索引核实过（key 不进仓库）；usmap 用 Kintaro v1.1。
> 导出：`Properties (.json)`，开启 “Serialize Script Bytecode”。导出物在 `extracted/fmodel/Exports/`（gitignored），用 `tools/scripts/kismet2txt.py` 转成 `extracted/txt/*.txt` 阅读。
> 标注：**【已证实】**＝直接读到资产默认值或字节码；**【推断】**＝由已证实事实推出；**【未知】**＝本步没查到。
> 资产路径前缀：`P = /PBZCombatAsset/ActorData/Players/Hun/`，`M = /PBZCombatAsset/ActorData/Mobs/042_AHua/Ability/GuiTouDao/`（磁盘上在 `ProjectPBZ/Plugins/Secret/PBZCombatAsset/Content/` 下）。
> 公开资料版的笔记见 `scarlet-wraithblade-flowers.md`，本文件以资产为准，两者冲突时以本文件为准。

## 0. 一页结论

1. **Boss 的花本身不周期爆炸。** `BP_AHua_Flower_Small/Big` 的 `Get Lifetime` 都是常量 **3.0**，花在 `Received_Initialize` 里只设一个**不循环**的 timer（`bLooping=false`）到 `Expire Explode`，爆一次后被 `Deactivate`。【已证实】
2. 被动 GA 里的 `Current Tick Explode Timer` / `Process Current Tick Explode` **是同帧合批**：`Flower Self Explode` 用 `K2_SetTimerForNextTickDelegate`（下一帧、一次性）把同一帧到期的花合成一批。**不是周期机制。**【已证实】
3. Boss 战里“每隔几秒伤一次”的东西是**另一套**：`M/BulletData/Flower/BD_AHua_GatheringFlower(_Hard)`，由 `GA_AHua_Skill_06/07(_Hard)` 放出的粒子子弹，`HitInterval 2.0` 秒、`UE_TotalTime 8.0`、半径参数 2500；8 秒时由原生 `BulletEvent_Interval`（`Interval 8.0`）放出 `BD_AHua_GatheringFlower_Explode`（半径 800）并 `Deactivate`。【已证实（数据）/ 推断（这就是玩家记忆中的“周期爆炸”）】
4. **E 主动引爆本来就有冷却**：被动 CDO `SpecialCooldown = 0.4` 秒，用 `CanUseSpecial` + `WaitDelay(SpecialCooldown)` 实现。5 秒冷却只需要把这个默认值改成 5.0。【已证实】
5. **E 引爆后花消失**是被动的 `Process Explosion` 干的：它先让每朵花 `Trigger Explode`（交出位置与爆炸 BulletData、**清掉花自己的 Explode Timer**），按大小花分组各生成**一个**爆炸子弹（`Parent Bullet Transforms` = 这组所有花的位置），最后对传入的每朵花 `Deactivate(0)`。【已证实】
6. **花数量上限**：Lv5 前 `Max Flowers Default = 6`，Lv5（有 `CanManualExplode` 标签）后 `Max Flowers Can Manual Explode = 25`；Boss 被动只改 `Max Flowers Default = 50`。超限时 `Register Flower` 把**最旧的**几朵交给 `Process Explosion`：**旧花立即爆炸并消失**。【已证实】
7. **资产里没有“花与花重叠”的逻辑**（花的 `On Overlap` 只处理角色；被动的 `Current Big Flower` 变量只出现在名字表里，字节码没用它）。但每次铺花是**一圈 6～14 朵小花**（见第 3 节 `CountRange`），Lv5 前上限只有 6、Lv5 起 25，所以**几乎每次新铺一圈，最旧的花就因超限立即爆炸并消失**。玩家看到的“新花铺上去、旧花消失并爆炸”很可能就是这个上限淘汰（爆的是旧花，不是新花）。【已证实（无重叠逻辑、数量与上限）/ 推断（这就是用户看到的现象）】
8. **F 蓄力白花**是 `GA_Hun_GuiTouBlade_B_Hold` 主时间轴 t=0 的**一个** `GAA_DelayDeflectProjectileBullet` 动作（要求标签 `Ability.Action.ShaqiReinforced`），BulletData `BD_Hun_GuiTouBlade_BHold_HomingFlower`。这种动作**一次只生成一颗子弹，没有 CountRange 之类的数量字段**。要 5 朵，只能再生成 4 颗（脚本）或加 4 个动作（改资产）。【已证实】
9. **轻攻击**：`A / AA / AAA` 不铺花；**第 4 段轻攻击 `AAAA` 铺一圈 6 朵小花**（中心偏移 Y=400）。含重击的连段（`B`、`AB`、`AAB`、`BB` …）和 `C`、冲刺 / 拔刀 / 闪避反击类重击都铺一圈小花（6～14 朵）；`BBB`、`ABB`、`AABB`、`AAABB`、`C` 的终结技另铺 **1 朵大花**。【已证实】

**对 ADR-0001 决定性问题的回答**：周期爆炸既不由被动 GA 的 tick 驱动（不是情况 1），也不在花的类里。原版**没有**“花常驻并周期爆炸”的现成机制，mod 必须自己定时触发爆炸（ADR 的**情况 2**）。不过爆炸的生成路径全部是 Blueprint 可见的普通 UFunction（`BulletDataBase.CreateBullet` → `Initialize` → `Start`），而且有两条原生、数据驱动的替代路径（第 9 节），所以**不是情况 3**。

---

## 1. 花类 `P/Weapon/GuiTouBlade/FlowerBullet/BP_Hun_GuiTouBlade_Flower_Base`

父类 `BP_PBZ_ProjectileEmitter_C`。子类 `_Small`、`_Big`，Boss 的 `M/Bullets/BP_AHua_Flower_Small/Big` 也直接继承 Base。

| 项 | 内容 | 状态 |
|---|---|---|
| `Get Lifetime` | 读 `BulletOwnerAvatar` 的 ASC：有 `CharacterState.WeaponUpgrade.GuiTouBlade.CanManualExplode` 返回 **15.0**，否则 **3.0** | 【已证实】 |
| Boss `Get Lifetime` | `BP_AHua_Flower_Small` 与 `_Big` 都返回常量 **3.0** | 【已证实】 |
| `Received_Initialize`（ubergraph 1023 起） | `Find Floor()`（从 +100 到 −300 cm 竖直射线贴地，失败则 `Failed To Find Floor=true`）→ 记 `Ability System` → `K2_SetTimerDelegate(Expire Explode, Get Lifetime(), bLooping=false)` 存进 `Explode Timer` → 向主人发 `GameplayEvent.Ability.Action.GuiTouBlade.SpawnFlower`（带 `EventObjectPayload`），被动收到后把自己写回 `EventObject`，花据此记下 `Passive Ability` | 【已证实】 |
| 父类 `Lifetime Timer` | `BP_PBZ_ProjectileEmitter` 只在 `MyData.Lifetime > 0` 时设 `Lifetime Timer`（到时 `Deactivate`）。花的 BD（`BD_Hun_GuiTouBlade_Flower_Small/Big`）没有写 `Lifetime`，用类默认值；花的寿命实际由上面的 `Explode Timer` 决定 | 【已证实（父类逻辑）/ 推断（类默认值为 0）】 |
| `Received_PostStart` | 贴地失败就 `Deactivate(0)`；否则挂 `Flower Niagara` 特效、开 Capsule 碰撞 | 【已证实】 |
| `Expire Explode` | 清 `Explode Timer`；若 `Passive Ability` 有效 → `Passive.Flower Self Explode(self)` 后返回（由被动下一帧合批爆炸并 Deactivate）；若无被动 → 自己 `Explode Bullet Data.CreateBullet(…, self)` → `Initialize(self, Owner, Passive, BD, false)` → `Start()` → `Deactivate(0)` | 【已证实】 |
| `Trigger Explode(out Transform, out BD)` | **清 `Explode Timer`**，输出 `GetBulletTransform` 和 `Explode Bullet Data`。**自己不生成爆炸、不 Deactivate** | 【已证实】 |
| `On Overlap(Actor)`（Capsule BeginOverlap，花状态==2 时） | 记进 `Overlapping Actors`；对敌对阵营且非无敌、非死亡的角色施加 `Debuff GE`，对友方（玩家自己）施加 `Buff GE`；都走 `BPL_PBZCombatUtils.ApplyGameplayEffectWithWeaponUpgradeData`（数值由武器升级数据填）。EndOverlap 时移除这两个 GE | 【已证实】 |
| `Received_Deactivate` | 关特效 → `Passive.On Flower Deactivated(self)`（被动从 `Current Flowers` 删掉它） | 【已证实】 |

CDO 默认值：

| 类 | `Explode Bullet Data` | `Debuff GE` | `Buff GE` | 特效 |
|---|---|---|---|---|
| Base | — | — | `GE_Hun_GuiTouBlade_InFlower` | — |
| `_Small` | `BD_Hun_GuiTouBlade_Flower_Explode` | `GE_Hun_GuiTouBlade_InDebuffArea` | 继承 | `NS_AHua_Flower_009_LoopNoTrace` |
| `_Big` | `BD_Hun_GuiTouBlade_Flower_Big_Explode` | `GE_Hun_GuiTouBlade_InDebuffArea_BigFlower` | 继承 | `NS_GuiTouBlade_Flower_301_Loop`；Capsule 半径/半高 280 |
| `BP_AHua_Flower_Small` | `BD_AHua_Flower_Explode` | `GE_AHua_InDebuffArea` | `GE_AHua_InBuffArea_New` | `NS_AHua_Flower_004_Timed` |
| `BP_AHua_Flower_Big` | `BD_AHua_Flower_Explode_Big` | `GE_AHua_InDebuffArea` | `GE_AHua_InBuffArea_New` | `NS_AHua_Flower_010_BigTimed` |

`_Small` 额外实现目标接口（`Targeting.Target.GuiTouBlade.SmallFlower`），PostStart 注册、Deactivate 注销。【已证实】

## 2. 被动 GA `P/Abilities/AHuaBlade/GA_Hun_GuiTouBlade_Passive`

CDO：`CanUseSpecial=true`、**`SpecialCooldown=0.4`**、**`Max Flowers Default=6`**、**`Max Flowers Can Manual Explode=25`**、`InstancingPolicy=InstancedPerExecution`。Boss 子类 `M/../GA_AHua_GuiTouBlade_Passive` 只改 **`Max Flowers Default=50`**。【已证实】

| 函数 | 行为 | 状态 |
|---|---|---|
| `Register Flower(Actor)` | 第一朵时施加 `GE_Hun_GuiTouBlade_HasFlower`；加入 `Current Flowers`；上限 = 有 `CanManualExplode` ? 25 : 6；超出几朵就从数组头（最旧）取几朵 → `Process Explosion(这些)`（爆炸并消失） | 【已证实】 |
| `Flower Self Explode(Bullet)` | 若 `Current Tick Explode Flowers` 为空，`K2_SetTimerForNextTickDelegate(Process Current Tick Explode)`；把花加进数组 | 【已证实】 |
| `Process Current Tick Explode` | `Process Explosion(Current Tick Explode Flowers)` 后清空数组 | 【已证实】 |
| `Process Explosion(Bullets)` | 对每朵调 `Trigger Explode`，按返回的 BD 分 4 组（玩家大/小、Boss 大/小）；每组非空就用该 BD `CreateBullet` → `Initialize(…, self, BD, debug)` → 转型 `PBZ_OverlapBullet_GuiTouBlade_Explosion` → 设 `Parent Bullet Transforms` = 该组位置 → `Start()`；最后对每朵花 `Deactivate(0)` | 【已证实】 |
| `Trigger Flowers` | `Process Explosion(Current Flowers)`，再移除 `HasFlower` GE | 【已证实】 |
| `Remove Flowers` | 逐个 `Deactivate` 全部花（不爆炸）；`K2_OnEndAbility` 调用它并清 tick timer | 【已证实】 |
| `On Flower Deactivated(Flower)` | 从 `Current Flowers` 删除 | 【已证实】 |

**E 键（`IA_Execution`，`Triggered`）**：事件先 `DelayUntilNextTick`，然后依次检查（任一不满足就什么都不做）：
1. `Actor State Component.CanActivateNewState(CharacterState.Action)`；
2. 同时有 `Weapon.Type.GuiTouBlade` 和 `CharacterState.WeaponUpgrade.GuiTouBlade.CanManualExplode`（Lv5 解锁）；
3. 不在处决起手（`Ability.Action.Execution` + `CharacterState.Action.Phase.Start`）；
4. 若有 `Ability.Action.Hun.BreakBlocker`，必须处于 Combo / Cancel 阶段；
5. `Current Flowers` 非空；
6. `CanUseSpecial == true`。

通过后：`CanUseSpecial=false` → `Play Trigger Effects`（特效、手柄震动、镜头抖动、音效）→ `Trigger Flowers` → `WaitDelay(SpecialCooldown)` 结束时 `CanUseSpecial=true`。【已证实】

**谁让花消失**：E 引爆、超限淘汰、到期都走 `Process Explosion` 末尾的 `Deactivate(0)`；切武器 / 被动结束走 `Remove Flowers`。【已证实】

**第二条消失路径（E 引爆时也会触发）**：`Register Flower` 在第一朵花时施加 `GE_Hun_GuiTouBlade_HasFlower` 并 `WaitForGameplayEffectRemoved(Has Flower Handle)`；这个 GE 一被移除（`OnRemoved_…` / `InvalidHandle_…` → ubergraph 2186 / 2158），被动就调 `Remove Flowers()`，把剩下的花全部 `Deactivate`。`Trigger Flowers` 在 `Process Explosion` 之后正好会移除这个 GE。所以“E 引爆后花不消失”必须**同时**避开 `Process Explosion` 的 Deactivate 循环和这次 GE 移除。【已证实】

## 3. 铺花 `P/Abilities/AHuaBlade/V2/`

- `GA_Hun_GuiTouBlade_B_Hold`（蓄满后释放的重斩，父类 `BP_HeavyAttack_Base_C`，时间轴 `Main` 长 3.1667 s）：
  - t=0～0.37 s：`GAA_BulletBurstWithDeflect_C_1`，`OnFloor`，`Spawn Interval 0.15`，BD `BD_Hun_GuiTouBlade_Flower_Small`。【已证实】
  - **FlowerWalk**：拿到 `CharacterState.AbilityState.GuiTouBlade.FlowerWalk` 标签时开 `K2_SetTimerDelegate(Flower Walk Tick, 0.05, bLooping=true)`；每 0.05 s 比较角色位置与 `Last Flower Location` 的平面距离²，**> 22500（即 1.5 m）**就在地面生成一朵小花并更新位置；标签移除或 GA 结束时清 timer。【已证实】
  - `Shachi Cost 120`、`Shachi Cost Mul 0.08`、`Shachi Cost Min 70`（CDO）。【已证实】
- `GA_Hun_GuiTouBlade_B_Hold_Start`（按住 F 的蓄力 GA）**继承 `B_Hold`**，自己没有时间轴，`K2_ActivateAbility` 里 `PlayTimeline(self.Main)` 播的是继承来的 `Main`。松键时按 `Current Reinforced` 和是否满足 `Min Duration`，用 `ForceActivateExternalActionAbilityByClass` 激活 `B_Hold` / `B_Hold_Unreinforced` / `BB_UnCharge(_Reinforced)`。【已证实】
- `B_Hold` 主时间轴 `bAutoPlay=true`、`StartTimeSeconds=0.49`、`bStopAbility=true`。【已证实】
- 普通连段用 `GAA_BulletBurst(WithDeflect)_C`，`bIsSingleFrame=true`，每个动作在固定偏移处按 `BulletSpawnBurstTransform_LocationAndRotation` + `BulletSpawnBurstLocation_Circle` 生成**一圈**，数量 `CountRange`：`AAAA` 6；`AAB`/`AB`/`B`/`BB`/`B_Dash`/`B_DashDraw`/`B_Draw`/`B_Snap` 两个动作 6 与 8（按条件二选一）；`AAABB` 13、`AABB` 12、`ABB` 11、`BBB` 12、`C` 14 或 5，外加大花 1；`B_Hold` 8；`SWT` 6。【已证实】涉及：
  - 小花：`AAAA`、`AAAB`、`AAABB`、`AAB`、`AABB`、`AB`、`ABB`、`B`、`BB`、`BBB`、`B_Dash`、`B_DashDraw`、`B_Draw`、`B_Snap`（另有 `BD_..._Flower_Small_DashSnap`）、`C`、`SWT`、`GA_SimpleExecution_GuiTouBlade`、`GA_Hun_BEx_GuiTouBlade_M_01/02`。【已证实】
  - 大花 `BD_Hun_GuiTouBlade_Flower_Big`：`BBB`、`ABB`、`AABB`、`AAABB`、`C` 的终结动作。【已证实】
  - `B` 在有 / 无 `CharacterState.AbilityState.GuiTouDao.Buff` 时用不同偏移的两个动作；`C` 的小花按有无 `CanManualExplode` 选不同动作。【已证实】
- UltraFlower（`GE_..._Debuff_Effect_UltraFlower`，要求 `InDebuffArea.UltraFlower` 标签）：本步**没有找到谁施加这个标签**。【未知】

## 4. F 蓄力白花

- 动作：`B_Hold` 主时间轴 t=0、时长 0.033 s 的 `GAA_DelayDeflectProjectileBullet_C_0`，`Bullet Data = BD_Hun_GuiTouBlade_BHold_HomingFlower`，`ActivationRequirements.RequireTags = [Ability.Action.ShaqiReinforced]`。【已证实】
- 动作类 `/PBZDeflectSystem/Actions/GAA_DelayDeflectProjectileBullet` 的成员（SDK）：`Bullet Data`、`Random Bullet Data`（BD→随机数据的 Map）、单个 `Bullet`、`Create Bullet`、`Launch Bullet` 等，**没有数量字段**。【已证实（SDK 反射）】
- Boss 的多朵白花就是**多个动作**：`GA_AHua_Skill_05` 有 `GAA_DelayDeflectProjectileBullet_C_1/2/3`，分别用 `BD_AHua_Flower_Homing_Hard_01/02/03`。【已证实】
- BD：`BulletClass = UpgradeData/BP_GuiTouBlade_Flower_Homing_C`，`Lifetime 10.0`，起点 `root` 上方 250 cm，带速度型运动和“从能力取目标”的目标选择器。命中爆炸 BD `BD_Hun_GuiTouBlade_BHold_HomingFlower_Explode`（`BP_PBZ_OverlapBullet_FaceOwnerAvatar`，物理 / 杀气 / 元素伤害系数各 1.0）。【已证实】
- 白花的 BD 里有 `BulletEvent_ModifyEventTransform(OnFloor)` → `BulletEvent_SubBullet(BD_Hun_GuiTouBlade_Flower_Big)`：**每朵白花结束时会在地上留下一朵大花**。白花变成 5 朵，就可能一次多出 5 朵大花（都计入 25 朵上限）。【已证实（数据）/ 推断（触发时机）】
- 白花在“蓄力开始”还是“释放时”出现：两个 GA 播的是同一条 `Main`。`B_Hold`（释放）激活时时间轴自动从 **0.49 s** 开始播，t=0 的白花动作会被跳过；`B_Hold_Start`（蓄力）在 `K2_ActivateAbility` 里手动 `PlayTimeline(self.Main, 1.0, 0.0, …)`，从 0 播，所以白花在**蓄力开始**时生成，与官方文本一致。`B_Hold_Start` 的 JSON 只有 9 个导出（7 个函数、CDO、类），没有自己的时间轴；`B_Hold_Unreinforced` 只改了 CDO 的 `Current Reinforced`。【已证实（数据）/ 推断（`PlayTimeline` 第三个参数是起始时间）】

## 5. GE 数值（`P/Weapon/GuiTouBlade/` 与 `UpgradeData/`）

| GE | Duration / Period | Modifier / 伤害 | 状态 |
|---|---|---|---|
| `InDebuffArea`（`_BigFlower` 继承） | Infinite | 施加时附带 `GE_..._Debuff` | 【已证实】 |
| `Debuff` | Infinite，Period 0.5；栈 1（AggregateBySource） | 附带 `Debuff_Tick` 和 `Debuff_Effect`；授予 `InDebuff` 标签；处决、无敌、受击连段 / 取消阶段时暂停 | 【已证实】 |
| `Debuff_Tick` | Infinite，**Period 0.3**，栈上限 4 | 杀气伤害 = SetByCaller `SetByCaller.MainWeapon.GuiTouBlade.DebuffTickShachi` | 【已证实】 |
| `Debuff_Effect` | Infinite，栈上限 4 | `FinalWalkSpeed` MultiplyCompound（CDO 写 0.0，实际值推断由升级数据填） | 【已证实 / 推断】 |
| `Debuff_Effect_BigFlower` | 继承，栈 1 | `TakenAdditiveMultiplier_{Impact,Reflect,Defence}Shachi` Additive（CDO 0.0） | 【已证实 / 推断】 |
| `Debuff_Effect_UltraFlower` | Period 0.4 | 物理 0.3、杀气 0.3 | 【已证实】 |
| `UpgradeData/GE_..._Explode` | HasDuration = SetByCaller `ExplosionBuffDuration`，**Period 0.3** | 物理 0.09（“爆炸后短时间内持续受伤”） | 【已证实】 |
| `UpgradeData/GE_..._Explode_Big` | 继承 | 物理 0.135 | 【已证实】 |
| `HasFlower` | Infinite | 标记“场上有花” | 【已证实】 |
| `ExitDebuffArea` | 1.0 s，到期执行 `RemoveDebuff` | — | 【已证实】 |
| Boss `GE_AHua_Debuff_Tick` | 继承 Period 0.3 | 杀气 0.1（固定值） | 【已证实】 |
| Boss `GE_AHua_Debuff_Effect` | 继承 | 移速 ×0.8 | 【已证实】 |

两个 SetByCaller 的数值来自武器升级数据（花的 `On Overlap` 通过 `ApplyGameplayEffectWithWeaponUpgradeData` 施加），本步没有导出那张表。【未知】

## 6. 爆炸子弹

| BD | 碰撞半径 | 伤害系数 | 备注 |
|---|---|---|---|
| `P/BulletData/LongBlade/GuiTouBlade/Flower/BD_Hun_GuiTouBlade_Flower_Explode` | **120** | 物理 0.2、元素 0.2 | 类 `PBZ_GuiTouBlade_FlowerExplodeBulletData_C` → 子弹 `UpgradeData/PBZ_OverlapBullet_GuiTouBlade_Explosion_C`；命中施加 `GE_..._Explode`；`Elemental` 权重 250 |
| `.../BD_Hun_GuiTouBlade_Flower_Big_Explode` | **500** | 物理 0.3、元素 0.3 | 同上 |
| `M/BulletData/Flower/BD_AHua_Flower_Explode` | 90 | 物理 / 元素 / 韧性 / **杀气** 各 0.5 | |
| `M/.../BD_AHua_Flower_Explode_Big` | 300 | 物理 1.8，元素 / 韧性 / 杀气 1.0 | |
| `M/.../BD_AHua_GatheringFlower` | 粒子半径参数 2500 | 杀气 / 物理 / 韧性 1.0，`HitInterval 2.0` | 8 s 后放 `_Explode`（半径 800，物理 1.5、韧性 100） |

玩家花的爆炸 BD **没有直接的杀气伤害项**；杀气削减来自 `Debuff_Tick`（SetByCaller）。“Lv10/20/30 提升爆炸伤害与杀气削减”改的是哪项：【未知】（应在武器升级数据里）。`Weapon_Hun_GuiTouBlade` 只有通用的 `Weapon Attack Multipliers`（物理 1.2、杀气 1.064516），没有这些 SetByCaller 值。【已证实】

**震屏和手柄震动从哪来**（2026-11-20 第 1 步补查，build 26367565）：这个子弹的 ubergraph 先对 `Parent Bullet Transforms` 里每个位置播 `Explosion Particle` 和 `Explosion Sound`。循环结束后，以玩家（`BulletOwnerAvatar`）的位置调**一次** `PlayWorldCameraShake(BD.Explosion Shake, 内半径 1500, 外半径 3000, 0.5)`，再对 0 号玩家控制器调 `K2_ClientPlayForceFeedback(BD.Explosion Force Feedback, BD.Explosion Force Feedback Tag)`。三个字段都在 BD（`PBZ_GuiTouBlade_FlowerExplodeBulletData`）上：小花 BD 是 `ShakeLevel1` / `ForceFeedbackLevel1_PS5` / `Hitreact`。所以**每个爆炸子弹只震一次**，与合批的花数无关；**用一份 Shake 和 ForceFeedback 置空的克隆 BD 就能让自动爆炸不震**，不用 hook 子弹。【已证实（字节码）/ 推断（置空后不震：未实测，UE 对空类的 PlayWorldCameraShake 通常直接返回）】

爆炸子弹 `UpgradeData/PBZ_OverlapBullet_GuiTouBlade_Explosion`：`GetOverlapOrigins` **直接返回 `Parent Bullet Transforms`**；PostStart 时对列表里每个位置播爆炸特效和音效，再对玩家播镜头抖动和手柄震动。**列表为空时推断不会命中任何东西、也没有特效**。因此 `Expire Explode` 的“无被动”后备路径、以及单纯用 `BulletEvent_SubBullet` 生成这种爆炸，都需要另想办法填 `Parent Bullet Transforms`。【已证实（函数）/ 推断（为空时的结果）】

## 7. Boss 阿花

- 花丛：`BD_AHua_Flower_Base`（小，`BP_AHua_Flower_Small`）被 `Skill_01/02/03/04`、`Special_02_New/03/05_A/07`、`SpecialMove_Base`、`CA_01_GEx(_Trap)` 的时间轴动作生成；`BD_AHua_Flower_Base_Big` 只被 `Special_03_B_Flower` 用。花寿命 3 s、爆一次、消失，与玩家 Lv1 花同一套代码。【已证实】
- `GA_AHua_Skill_05` 和 `Special_03_B_Flower` 的 `SpawnFlowers(...)` 函数**只生成 4～5 个 `NS_AHua_Flower_001` 特效**，不生成花 Actor，而且在导出的字节码里**没有任何调用者**。【已证实】
- 周期伤害：`BD_AHua_GatheringFlower(_Hard)`，用于 `Skill_06/07(_Hard)`，见第 0 节第 3 条。【已证实】
- **花丛爆炸间隔的“实测值”**：花 Actor 没有间隔（单次，3 s）。唯一的周期是 GatheringFlower 的 **2.0 s**（持续 8 s）。没有看战斗录像。

## 8. JS / DataTable

- 本步没有导出 `DT_WeaponData` 和含 `<dtv id="X073"/>` 的文本表，也没有查 JS 树里的 mixin。资产已经能证明武器内部名是 `GuiTouBlade`（`Weapon_Hun_GuiTouBlade`，被动 CDO 的 `WeaponConfig`）。【已证实（内部名）/ 未做（文本表）】

## 9. 对 mod 实现的含义

| 需求 | 原版现状 | 最小改法 | 状态 |
|---|---|---|---|
| E 冷却 5 s | 已有冷却，`SpecialCooldown=0.4` | 把被动的 `SpecialCooldown` 改成 5.0（单个默认值） | 【已证实】 |
| E 引爆后花不消失 | `Trigger Flowers` → `Process Explosion` 末尾逐个 `Deactivate`，随后移除 `HasFlower` GE → `Remove Flowers` 再 Deactivate 一遍 | 替换 `Trigger Flowers` 的整个函数体：只生成爆炸，不 Deactivate，**也不移除 `HasFlower` GE**。**`Trigger Explode` 会清掉花的 `Explode Timer`**：借用它取位置的话花就不会再到期，所以要么不调它（直接读花的 Transform 和 `Explode Bullet Data`），要么之后重设到期 timer。只改资产数值做不到，需要改字节码或运行时替换函数（推断 C 路线在这一项上不可行） | 【已证实（机制）/ 推断（改法）】 |
| 花周期爆炸且不消失 | 无现成机制 | 方案 a（脚本，首选）：每 `tickInterval` 秒对存活的花复刻 `Process Explosion` 的前半段：按 BD 分组，`CreateBullet` → `Initialize` → 设 `Parent Bullet Transforms` → `Start`，**不 Deactivate**。方案 b（数据，备选）：在 `BD_Hun_GuiTouBlade_Flower_Small/Big` 的 `StartEvents` 里加原生 `BulletEvent_Interval`（字段 `Interval`、`LoopCount`、`StartDelay`、`IntervalEvents`），里面放 `BulletEvent_SubBullet`，与 Boss GatheringFlower 同一套机制。但现有爆炸子弹靠 `Parent Bullet Transforms` 定位，SubBullet 不会填它，所以要另做一个普通 `BP_PBZ_OverlapBulletData` 的爆炸 BD；`LoopCount` 的语义也**未验证** | 【已证实（API 存在）/ 推断（可行性）】 |
| 到期仍爆炸并消失 | 现状就是这样 | 不动 | 【已证实】 |
| 上限不变 | 6 / 25 | 不动；超限淘汰会让最旧的花爆炸消失，这是原版行为，也就是规格里“在旧花上铺新花”那一条的实际来源 | 【已证实 / 推断】 |
| 白花 5 朵 | 1 个动作 = 1 颗 | 脚本：在白花生成时再用 `BD_Hun_GuiTouBlade_BHold_HomingFlower` 生成 4 颗（同 `CreateBullet/Initialize/Start` 路径），自己算扇形偏移；或改资产给时间轴加 4 个动作（Boss 就是这么做的）。注意每朵白花结束会留一朵大花，且白花要求 `Ability.Action.ShaqiReinforced` | 【已证实（机制）/ 推断（改法）】 |
| 平衡：每次 tick 的伤害 | — | 合批爆炸时一组只生成一个子弹，25 朵花一起 tick 也只多一个子弹 | 【推断】 |
| 平衡：`tickAngerScale` | 玩家花的爆炸 BD 没有杀气伤害项 | 周期爆炸本身几乎不削杀气；杀气主要靠敌人站在花里时的 `Debuff_Tick`（每 0.3 s）。花常驻会延长这段时间，这才是“持续削杀气”的主要来源。`tickAngerScale` 可能无事可调，规格需要重新确认 | 【已证实（数据）/ 推断（影响）】 |

## 10. 本步未完成 / 留给后续

- 武器升级数据表（`DebuffTickShachi`、`ExplosionBuffDuration`、移速、各等级提升项）。
- `BulletEvent_Interval.LoopCount` 的默认值和语义（Boss 资产没写，说明用的是类默认值）。
- `BP_PBZ_ProjectileEmitterData` 的 `Lifetime` 类默认值（推断为 0）。
- UltraFlower 的施加者。
- JS 树、`DT_WeaponData`、文本表 `X073`。
- 战斗录像核对（只能由用户在游戏里看）。

## 11. 第 1 步最小验证结果（2026-11-20，build 26367565，PBZModLoader Kintaro 2.1.0，mod 0.0.2-verify）

用户在游戏里实测（武器 ≥ Lv25），并对照了 `ProjectPBZ\PBZModLoader\loader.log`：

| 项 | 结果 | 依据 |
|---|---|---|
| 加载器入口 | **`version.dll` 没被加载**：游戏进程用的是 `C:\WINDOWS\SYSTEM32\VERSION.dll`，没生成 `loader.log`。改用备用入口 **`hid.dll`** 后加载器正常起来（`script validation adapters installed`）。`version.dll` 不加载的原因【未知】：本机 Windows 10.0.26300，智能应用控制关闭，进程的 PreferSystem32 关闭，exe 的 DependentLoadFlags 为 0 | 进程模块列表、loader.log |
| a 周期爆炸、花不消失 | **通过**。从 JS 调 `BD.CreateBullet(Transform(), passive)` → `Initialize(null, avatar, passive, BD, false)` → 给 `Parent Bullet Transforms` 赋 `UE.NewArray(UE.Transform)` → `Start()`，每一步都成功；数组长度与花数一致 | 日志 `tick: N flower(s) exploded in 1 bullet(s), kept`；用户目视确认 |
| b E 引爆不消失 | **通过**。mixin 覆盖 `Trigger Flowers` 成功（`inherit:false`）；12 朵、25 朵都合成 1 个子弹，花保留，`HasFlower` GE 没被移除 | 日志 `E: 25 flower(s) exploded in 1 bullet(s), kept` |
| c E 冷却 5 s | **通过**。在覆盖函数里写 `this.SpecialCooldown`，随后的 `WaitDelay` 读到 5 | 用户目视确认，日志 `cooldown 5` |
| 计时 | 每朵花的寿命取 `K2_GetTimerElapsedTimeHandle(花, 花.Explode Timer)`，可用 | 日志里每朵花约 4 s 一次 |
| 读升级标签 | `asc.GetOwnedGameplayTags` 在 JS 里**不存在**。0.0.3 改用 `HasMatchingGameplayTag(ConvertStringToGameplayTag(...))`，待验证 | 日志 |

**观察到的问题**：一圈花是在约 0.1～0.4 s 内陆续生成的，所以按每朵花各自的 4 s 计时，一圈会分成 2～4 次连续的小爆炸，每次都震屏一下，用户觉得太频繁。0.0.3 的处理：把计时提前 `tickCoalesce`（0.4 s），让同一圈在同一帧合批；另外自动爆炸时在 `Start()` 前后临时把共享 BD 的 `Explosion Shake` 和 `Explosion Force Feedback` 置空，用完马上还原，所以 E 引爆和到期爆炸仍然震（`tickShake` 默认 false）。【已实现，待实测】

**刚进游戏时鼠标指针浮在外面、转不了视角，点一下窗口后恢复**：只看到一次，跟加载器有没有关系【未知】。可能只是游戏启动时窗口没拿到焦点（UE 常见现象）。如果每次启动都出现、而且只在装了 `hid.dll` 时才有，就换 `winmm.dll` 入口试。
