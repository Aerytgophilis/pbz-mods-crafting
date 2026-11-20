# ADR-0001：红妆鬼斩增强 mod 的技术路线

- 状态：**已接受（效果 1）**，2026-11-20 第 1 步游戏内验证后定稿；**效果 2 动手前先做同样的最小验证**，不通过时局部退到 B 或 C。历史：第 0 步前为“暂定”
- 日期：2026-11-20
- 依据：`docs/research/routes/` 下 A、B、C 三份辩护，D 主持人反驳；Fable advisor 意见；Opus 对抗审计（见文末）
- 游戏版本：Steam build 26367565（CL-302256_JKS-17280）

## 背景

两个目标效果（完整规格见 `mods/hongzhuang-guizhan-plus/README.md`，2026-11-20 修订）：
1. 场地彼岸花：存在时间不变；期间每 `tickInterval` 秒自动爆炸一次且不消失；到期仍爆炸一次后消失；按 E 主动引爆后花**不消失**，E 有 5 s 冷却；在旧花上铺新花的原版规则不变；花数量上限不变。
2. F 蓄力（按住重击，Lv25 火照黄泉）的白色彼岸花 1 朵 → 5 朵。

候选路线：A PBZModLoader + JS（运行时改反射对象、PuerTS mixin），B UE4SS Lua，C pak / IoStore 资产替换。

## 关键事实（路线 A 从 SDK 反射查到，与路线无关）

- Boss 的 `BP_AHua_Flower_Big/Small` 继承玩家的 `BP_Hun_GuiTouBlade_Flower_Base`，**只重写 `"Get Lifetime"`**。
- Boss 被动 `GA_AHua_GuiTouBlade_Passive` 继承玩家的 `GA_Hun_GuiTouBlade_Passive`，**没有新增成员**。
- 玩家被动里已经有 `"Current Tick Explode Timer"`、`"Process Current Tick Explode"`、`"Flower Self Explode"`、`"Max Flowers Default"`。

**注意**：更长的 Lifetime 只能解释“不消失”，**解释不了“定时爆”**。

## 决定性问题（第 0 步必须回答）

> Boss 战里花的周期爆炸由谁驱动？

- **情况 1**：由被动 GA 的 tick 爆炸（`Process Current Tick Explode`）驱动，受某个默认值控制。→ 效果 1 可能只要改 Lifetime 和一个默认值。A、B、C 都能做，选 A 主要因为热重载。
- **情况 2**：由 Boss 自己的技能反复触发（`GA_AHua_Skill_05` / `SpawnFlowers` 等）。→ 需要从脚本定时调用爆炸。A 的 `"Trigger Explode"` / `SpawnBullets` 从 JS 调用**零先例**，风险高；要重新比较 A 与 B。
- **情况 3**：关键逻辑在 native C++ 里、不可 hook。→ 三条路线都要重估。

### 第 0 步结论（2026-11-20，build 26367565）

详见 `docs/game-notes/scarlet-wraithblade-flowers-assets.md`。

- **问题的前提不成立：Boss 的花本身不周期爆炸。** `BP_AHua_Flower_Small/Big` 的 `Get Lifetime` 是常量 3.0，花只有一个不循环的到期 timer，爆一次后消失。被动的 `Process Current Tick Explode` 是“下一帧合批”，不是周期。【已证实】
- Boss 战里周期性的伤害来自另一种子弹 `BD_AHua_GatheringFlower`（`Skill_06/07`，每 2.0 s 判定一次、持续 8 s、最后一次大爆炸），由原生 BulletData 驱动，与花 Actor 和被动 GA 无关。【已证实（数据）/ 推断（这是玩家记忆中的“周期爆炸”）】
- 因此归为**情况 2**：原版没有“花常驻并周期爆炸”的机制，mod 要自己定时触发爆炸。不是情况 3：爆炸路径（`BulletDataBase.CreateBullet` → `Initialize` → `Start`，设 `Parent Bullet Transforms`）和被动的各函数都是 Blueprint 可见的 UFunction。
- 情况 2 触发了本 ADR 的重议条件，所以**状态保持“暂定”**，不在这里宣布 A 定稿。路线现在取决于两件事：
  1. 能否**替换被动 `Trigger Flowers` 的函数体**（E 引爆只爆不消失；还要避免它移除 `HasFlower` GE，否则被动会走 `Remove Flowers` 把花全部清掉）。
  2. 能否**从脚本调用 `CreateBullet` → `Initialize` → `Start`**（周期爆炸、额外 4 朵白花都靠它）。
  - A（PuerTS mixin）和 B（UE4SS）理论上都能做这两件事；A 仍是首选（热重载），但第 1 步的第一件事应是**最小验证**：在 A 里从 JS 让一朵花生成一次爆炸而不消失。不行再按 B 试同样的验证。
  - C（只改资产）做不到第 1 件，除非改字节码。【推断】周期爆炸有一个纯数据的备选（原生 `BulletEvent_Interval` + `BulletEvent_SubBullet`，Boss GatheringFlower 就是这么做的），但现有爆炸子弹靠 `Parent Bullet Transforms` 定位，要另做爆炸 BD，`LoopCount` 语义也未验证。
- 好消息：**E 已经有冷却**（被动 `SpecialCooldown = 0.4`），5 秒冷却只需改这一个默认值。
- **`tickInterval` 建议 4 s**（README 的下限）。花 Actor 没有周期可参考；找到的唯一周期是 GatheringFlower 的 2.0 s，低于下限。**没有看战斗录像**。
- 规格需要用户确认的点（见笔记第 0、9 节）：原版没有“覆盖旧花”的逻辑，推断用户看到的是超上限淘汰（每次铺 6～14 朵，Lv5 前上限 6、之后 25）；玩家花的爆炸本身不削杀气，杀气主要靠花里的 `Debuff_Tick`，`tickAngerScale` 可能无事可调；5 朵白花会各留一朵大花；白花需要“杀气强化”状态（`Ability.Action.ShaqiReinforced`）。

### 第 1 步结论（2026-11-20，build 26367565，PBZModLoader Kintaro 2.1.0）

详见 `docs/game-notes/scarlet-wraithblade-flowers-assets.md` §11、§12。用户在游戏里实测，武器 Lv30；结论都与 `loader.log` 核对过。

**已证实**（范围：爆炸用的 Overlap 子弹，和被动 GA 的 `Trigger Flowers`）：
1. **从 JS 生成爆炸子弹可行**：`BD.CreateBullet(Transform(), passive)` → `Initialize(null, avatar, passive, BD, false)` → `Parent Bullet Transforms = UE.NewArray(UE.Transform)` → `Start()`。花不消失，同一帧到点的花合成 1 个子弹。
2. **能替换 `Trigger Flowers`**：PuerTS mixin（`inherit:false`）覆盖后，E 引爆只爆不消失，也不移除 `HasFlower` GE；被 E 引爆过的花到期时仍按原版爆一次后消失。
3. **E 冷却改 5 s**：在覆盖函数里写 `this.SpecialCooldown`，随后的 `WaitDelay` 读到新值；日志里相邻两次 E 正好相隔 5.08 s。
4. **热重载（Alt+F5）可用**：停止、重新载入，状态正确恢复。
5. **爆炸真实判伤**：刷进花丛的木桩被自动爆炸打了一下（−293 HP，木桩已破防），一个合批子弹对同一目标只判一次。
6. **自动爆炸不震屏**：只在 `Start()` 前后临时把共享 BD 的 `Explosion Shake` / `Explosion Force Feedback` 置空，E 引爆和到期爆炸仍保留原版震动。

**未证实**：
- 追踪白花（效果 2）走同一条路径是否可行。它的 BD 带“从能力取目标”的目标选择器，生成时的目标来源不一样。所以效果 2 实现前先做最小验证：从 JS 额外生成 1 朵白花并让它追踪。
- 自动爆炸的 40% 伤害和杀气项：伤害系数是在 `Initialize` 时拷进子弹，还是命中时从 BD 读，要先查 `BP_PBZ_OverlapBullet(Data)` 的字节码，再决定是改子弹实例、克隆 BD，还是另加 GE。“置空再还原”只适用于在 `Start()` 里同步读取的字段。

**决定**：
1. **效果 1 定稿为路线 A**（PBZModLoader Kintaro 2.1.0 + JS），不再试 B。
2. 效果 2 先做最小验证；不通过时只对效果 2 局部改用 B（UE4SS）或 C（改资产给时间轴加动作）。

**后果（新增）**：
- **加载器入口**：本机的游戏进程不加载放在 exe 旁的 `version.dll`，加载的是 `C:\WINDOWS\SYSTEM32\VERSION.dll`，原因【未知】。改用备用入口 `hid.dll` 后正常。发布说明要写清“没有生成 `loader.log` 就换入口（hid / winmm / dsound / dxgi）”。注意 Mods Menu 自己占用 `hid.dll`。
- **成就影响**：仍【未知】。
- **测试工具**：本地的 `mods/pbz-testbench/`（刷木桩、记伤害），不发布。

## 决定（暂定）

1. **第 0 步（与路线无关）**：**不安装任何 mod 框架**，结论写进 `docs/game-notes/`。
   1. 先找一段阿花战录像，确认“花定时爆、不消失”确实存在、频率大约多少。
   2. 用 FModel + AES key + Kintaro usmap 只读查看下列资产的字节码和默认值：
      - `BP_Hun_GuiTouBlade_Flower_Base`、`BP_AHua_Flower_Big/Small`（`Get Lifetime`、`Expire Explode`、`Trigger Explode`）
      - 父类 `BP_PBZ_ProjectileEmitter` 的 Lifetime Timer 逻辑
      - `GA_Hun_GuiTouBlade_Passive`、`GA_AHua_GuiTouBlade_Passive`（tick 爆炸成员、`Max Flowers Default`、`Remove Flowers`）
      - Boss 技能 `GA_AHua_Skill_05`、`GA_AHua_Special_03_B_Flower`（是否反复触发爆炸）
      - F 蓄力 GA（候选 `GA_Hun_GuiTouBlade_B_Hold*`）及其时间轴上发白花的动作（`CountRange` 等）
      - `DT_WeaponData`，核实武器内部代号
      - JS 树里有没有针对这些类的 TS mixin（`TsMixinObject.js` 等）
      - **E 主动引爆**：对应的能力 / GE（候选 `GE_Weapon_GuiTouBlade_CanManualExplode`、被动的 `Max Flowers Can Manual Explode`），引爆后是谁让花消失（`Trigger Explode` 内部、`Remove Flowers`、还是 Deactivate），以及有没有现成的冷却机制可以挂 5 s 冷却
      - **铺花覆盖规则**：新花替换旧花并立即爆炸一次的逻辑在哪，确保常驻和周期爆炸不破坏它
      - **Boss 阿花的花丛爆炸间隔**：给出具体秒数（资产默认值 + 录像实测），作为 `tickInterval` 的依据
   3. 如果 FModel 看不懂 ubergraph 字节码，再评估 UAssetGUI；不提前装。
2. **主路线：A（PBZModLoader + JS），B 为同等候选**。选 A 的理由：Alt+F5 热重载；同 build 有多个开源先例；不分发游戏资产。B（UE4SS）同样能改写 BP 函数返回值，在效果 1 上的差距**要实测**；如果 A 的关键调用不可用，转 B。
3. **效果 1 的实现要点**：花的上限保持原版（规格要求），但要确认周期爆炸不会触发 `Remove Flowers`；把“爆炸”和“消失”拆开（周期爆、E 引爆只爆不消失，到期爆完再消失）；定时用游戏时间，不用真实时间的 `setInterval`；平衡参数（`tickInterval`、`tickDamageScale` 等）做成可配置。
4. **效果 2**：先试运行时改时间轴 `CountRange`；如果运行时修改无效、而数量是纯资产数据，局部退到 C（C 的 `-UserDir` 方案可以不碰游戏目录）。
5. **AES key 的来源待定**：AESDumpster 没有许可证、二进制未经审计，网页版要上传 exe，不能用。优先用社区公开且可核对的 key；没有的话，运行 AESDumpster 前单独征得用户同意。

## 后果

- 需要往游戏目录装 PBZModLoader（`version.dll` 代理 + 引导脚本）。这属于 AGENTS.md 规则 1 和 §8.4 的关键节点：要用户同意、先备份、记 install-log、先咨询 advisor。
- 加载器靠字节特征 hook 游戏的脚本校验函数，游戏更新可能让它失效（11-04 已发生过一次，社区约 1 天修复；仅此一个样本）。
- 改动前备份存档（Steam 云同步也要考虑），见 AGENTS.md 规则 8。
- 未调查：反作弊、成就、Steam“验证文件完整性”对 mod 文件的影响。第一次安装前查清。
- 加载器是 GPL-3.0；我们的 mod 独立运行时加载，用 MIT 发布。SDK 生成的 `.d.ts` 不提交。

## 审计记录

- 第 1 步（2026-11-20）定稿前咨询 Fable advisor：要求先补测热重载、爆炸是否判伤、E 引爆过的花到期是否消失（都已补测）；ADR 只把效果 1 定稿为 A，效果 2 另做验证；修正合批逻辑和卸载脚本。

- Fable advisor：Lifetime 只解释“不消失”，不解释“定时爆”，因此本 ADR 定为暂定，并点名决定性问题。
- Opus 对抗审计：UE4SS 也能改写 BP 函数返回值（B 不是明显劣势）；花的数量上限与“不消失”冲突；A 草图的热重载和计时 bug；存档备份、反作弊和 Steam 文件校验未调查。详见 `docs/research/routes/D-rebuttal-draft.md` §3.5。
- 第 0 步（2026-11-20）后咨询 Fable advisor：同意归为情况 2、状态保持暂定；指出 E 引爆的第二条消失路径（`HasFlower` GE 移除 → `Remove Flowers`），要求核对 `CountRange`、`B_Hold_Start` 时间轴和爆炸子弹的 `GetOverlapOrigins`，均已补进笔记。

## 重议条件

- 第 0 步结论为情况 2 或情况 3。
- PBZModLoader 两个分支都停更，且游戏更新使其失效。
