## 总览结论

1. **是否陷入死胡同**：**没有陷入死胡同，但确实在黑盒木桩测试里原地打转了一圈，现在已到“停止盲测、补机制观察或转入实战”的节点。** 核心问题已经用 `DamageCalculator_CantBreakTarget` 工程上收口，剩余的是两个具体认知缺口（破防状态标识 & `GA_SimpleExecution_GuiTouBlade` 的真实触发条件）。
2. **观测方法缺陷**：**有根本缺陷。** 50 ms 轮询 `Shachi` 抓不到瞬时归零，用“伤害 ×1.5”反推破防易被其他倍率污染（实测已出现未解释的 ×1.35 跳变），靠子弹来源/位移判处决是事后间接信号。改用 **破防持续标签/易伤属性 + 处决 GA 激活状态/标签 + 事件/mixin 探针** 可以直接观测。
3. **0.1.0 能否交付试玩**：**可以作为内部试玩版交给用户（`0.1.0-rc` / 试玩），不建议直接当正式 `0.1.0` 发布。** 剩下的手感、音量、断情真实标签、Boss 战节奏都只能在实战里测；但交付前必须先把几处高风险行为（铸魂溢出破防、彼岸·极高血伤秒小怪、禁用 testbench、备份存档）讲清楚，并清理文档/注释里的陈旧矛盾。
4. **铸魂计数溢出破防**：给出 4 个互斥选项（A 暂不动先试玩、B 同构改 `HitCounter_Explode` 计算器、C 查能否改自动爆炸 `HitStrength` 不叠铸魂、D 短窗口禁简易处决），由用户取舍。
5. **15:05:42 无输入击杀**：mod 代码里**没有任何让角色移动或出刀的逻辑**【已证实】。最可能是 **computer use 切焦点/按键残留触发游戏内攻击或暗杀，或上一轮未结束的 GA 状态残留**【推断】；最便宜验证是先查 15:05:30–15:05:50 原始日志与操作记录，再纯键盘按 3～5 次 `Alt+F5`（不点鼠标）看能否复现。
6. **文档与代码矛盾**：查出 **8 处**自相矛盾、未清理的旧结论及代码细节偏差（含 1 处高危过时代码注释、多处文档待办/API 名/公式冲突、1 处重复行、2 处未解释数值矛盾与 2 处代码边界问题）。

---

## 1. 是否在原地打转 / 进了死胡同？卡在什么认知缺口？

- **严重程度**：中（工程进度未卡死，但调试方法已进入收益递减区）
- **结论**：**不是死胡同，但已出现明显“靠间接数字猜机制 → 来回翻案”的打转特征。**【已证实】
- **证据**：
  1. **未卡死的依据**：效果 1 全部核心功能与 `tickCantBreak` / `ultraCantBreak` 均已实现并在阳性/阴性对照中验证有效（[scarlet-wraithblade-flowers-assets.md](file:///Z:/Mods_crafting/docs/game-notes/scarlet-wraithblade-flowers-assets.md#L285-L317)）。【已证实】
  2. **原地打转的依据**：同一天内围绕“破防与死因”至少翻案 4 次：
     - 误将杀气 `0.1` 当作“已破防”，后更正为未破防（[scarlet-wraithblade-flowers-assets.md](file:///Z:/Mods_crafting/docs/game-notes/scarlet-wraithblade-flowers-assets.md#L198) vs [L267](file:///Z:/Mods_crafting/docs/game-notes/scarlet-wraithblade-flowers-assets.md#L267)）。【已证实】
     - 误将近处自动简易处决归因为“置空灼烧导致秒杀”，后作废（[scarlet-wraithblade-flowers-assets.md](file:///Z:/Mods_crafting/docs/game-notes/scarlet-wraithblade-flowers-assets.md#L270)，且过时结论仍残留在 [main.js](file:///Z:/Mods_crafting/mods/hongzhuang-guizhan-plus/src/main.js#L63)）。【已证实】
     - 对彼岸·极是否破防反复改判，因为 50 ms 轮询读不到 `Shachi == 0`，后才发现破防表现是“0.1 跳起回升 + 后续 ×1.5”（[scarlet-wraithblade-flowers-assets.md](file:///Z:/Mods_crafting/docs/game-notes/scarlet-wraithblade-flowers-assets.md#L301-L315)）。【已证实】
     - 至今无法解释为何同样出现“破防迹象”，自动爆炸会触发 `GA_SimpleExecution_GuiTouBlade`，而原版彼岸·极和铸魂计数溢出却没触发（[scarlet-wraithblade-flowers-assets.md](file:///Z:/Mods_crafting/docs/game-notes/scarlet-wraithblade-flowers-assets.md#L305-L315)）。【已证实】
- **卡住的两个具体认知缺口**：
  1. **缺口 A（核心）**：**不知道游戏内部“真正破防状态”对应的 Tag/GE，也不知道 `GameplayEvent.Ability.Action.SimpleExecution.Activate` 的发送方和前置条件**（[scarlet-wraithblade-flowers-assets.md](file:///Z:/Mods_crafting/docs/game-notes/scarlet-wraithblade-flowers-assets.md#L280)）。【已证实】
     - 高度可疑线索：自动爆炸的命中强度为 `Normal.Light`（[L240](file:///Z:/Mods_crafting/docs/game-notes/scarlet-wraithblade-flowers-assets.md#L240)），它打破防触发了自动简易处决；而铸魂溢出 `HitCounter_Explode` 的 `HitStrength = Income.None`（[L305](file:///Z:/Mods_crafting/docs/game-notes/scarlet-wraithblade-flowers-assets.md#L305)）、彼岸·极是 GE 周期伤害，两者破防都未触发自动处决。触发条件很可能同时检查**命中来源（子弹 vs GE）或 `HitStrength != Income.None` / 目标进入受击硬直**。【推断】
  2. **缺口 B**：**测试工具（无 AI 的 1～2 种小怪木桩 + 50 ms 数值轮询）已触及信息上限**。再多跑木桩也只能增加孤立现象（例如 `QinNv` 无伤害、第 4 跳突然 ×1.35），无法回答底层规则。【推断】
- **建议**：**立刻停止靠木桩血条猜机制**。要么先用 1 次低成本的直接信号探测（见第 2 题）把缺口 A 看清，要么先按当前 `0.1.0` 交给用户做实战试玩，带着实战问题再查。

---

## 2. 现有观测方法的根本缺陷 & PuerTS 反射下的直接信号方案

- **严重程度**：高（直接导致多轮误判与翻案）
- **现有方法的 3 个根本缺陷**：
  1. **时间混叠漏采瞬态**：50 ms 轮询抓不到杀气归零瞬间，游戏破防后会立即开始回升（`0.1 → 1.7` / `0.1 → 2.5`，[scarlet-wraithblade-flowers-assets.md](file:///Z:/Mods_crafting/docs/game-notes/scarlet-wraithblade-flowers-assets.md#L301-L306)）。【已证实】
  2. **用伤害倍率反推破防不唯一**：同文件里在 `CantBreakTarget` 未破防时，彼岸·极伤害也会在第 4 跳从 `−224.6` 跳到 `−303.3`（刚好 `×1.35`，[scarlet-wraithblade-flowers-assets.md](file:///Z:/Mods_crafting/docs/game-notes/scarlet-wraithblade-flowers-assets.md#L313)），11-20 的未破防爆炸也有 `293.2 / 217.1 = 1.35`（[L198](file:///Z:/Mods_crafting/docs/game-notes/scarlet-wraithblade-flowers-assets.md#L198)、[L282](file:///Z:/Mods_crafting/docs/game-notes/scarlet-wraithblade-flowers-assets.md#L282)）。未知增伤层叠时，靠看伤害数字极易误判是否破防。【已证实（存在 ×1.35 跳变）/ 未知（跳变来源）】
  3. **靠子弹来源/位移判处决是事后代理指标**：若处决被打断或未铺花会漏报；位移无法区分处决冲刺、受击推挤或误输入（如 15:05:42 事件）。【推断】

- **仅用 PuerTS 反射的具体可行方案（全部只放在 `pbz-testbench`，不进主 mod）**：
  - **方案 1：直接读“破防持续状态”而非瞬时杀气值（最优先）**
    - 已知 `asc.GetOwnedGameplayTags` 在 JS 不可用，但 `asc.HasMatchingGameplayTag(tag)` 与 `GetAttributeFromCharacter` **已证实可用**（[scarlet-wraithblade-flowers-assets.md](file:///Z:/Mods_crafting/docs/game-notes/scarlet-wraithblade-flowers-assets.md#L184)、[main.js](file:///Z:/Mods_crafting/mods/hongzhuang-guizhan-plus/src/main.js#L203-L204)、[L263-L264](file:///Z:/Mods_crafting/mods/hongzhuang-guizhan-plus/src/main.js#L263-L264)）。
    - 具体做法：
      1. 从已解包/反射可见的 `PDA_GlobalCombatConfig`（[scarlet-wraithblade-flowers-assets.md](file:///Z:/Mods_crafting/docs/game-notes/scarlet-wraithblade-flowers-assets.md#L269)）或小怪受击/破防 GE 资产中找出精确的 Break Tag 名（例如 `CharacterState.Break` / `CharacterState.Stun` / `Hitreact.Break` 等父标签，`HasMatchingGameplayTag` 天然支持父标签前缀匹配）；
      2. 同时直接轮询已证实存在的破防易伤属性 `TakenAdditiveMultiplier_BreakDamage`（[L269](file:///Z:/Mods_crafting/docs/game-notes/scarlet-wraithblade-flowers-assets.md#L269)），以及反射探测木桩 ASC 是否暴露 `ActiveGameplayEffects` / `GetActiveEffectsWithAllTags`。
      3. 因为破防状态持续整个 `Mob Break Duration`（秒级），50 ms 轮询**不会漏采**。【推断可行，基于已证实的 `HasMatchingGameplayTag` 与 `MakeAttribute`】
  - **方案 2：直接观测 `GA_SimpleExecution_GuiTouBlade` 的激活（而非事后看它铺出的花）**
    - 无侵入做法（首选）：利用**已证实存在**的处决标签 `Ability.Action.Execution`、`CharacterState.Action.Phase.Start`（[scarlet-wraithblade-flowers-assets.md](file:///Z:/Mods_crafting/docs/game-notes/scarlet-wraithblade-flowers-assets.md#L71)）以及前缀 `Ability.Action.SimpleExecution`，每 50 ms 对玩家 ASC 调 `HasMatchingGameplayTag`；同时反射读玩家 `asc.ActivatableAbilities.Items`（若暴露给 JS），直接检查 `GA_SimpleExecution_GuiTouBlade` 对应 Spec 的激活计数/状态。【推断可行】
    - 事件载荷探测（仅 testbench 一次性探针）：用已证实可用的 `puerts.blueprint.mixin`（[main.js](file:///Z:/Mods_crafting/mods/hongzhuang-guizhan-plus/src/main.js#L732)）挂接 `GA_SimpleExecution_GuiTouBlade_C` 的 `K2_ActivateAbilityFromEvent`（先验证 `inherit: true` 或只读抓包），打印 `EventData.EventTag`、`Instigator`、`Target`、`OptionalObject`、`EventMagnitude`，直接看清是谁在什么时刻发出了 `SimpleExecution.Activate`。【推断可行；注意 `inherit: false` 会顶掉原蓝图体，探针前需确认是否需要保留执行】
  - **方案 3：探测 ASC / PBZ 自定义多播委托，抓命中与 GE 施加瞬间**
    - 反射检查敌人/玩家 `PBZAbilitySystemComponent` 上带 `BlueprintAssignable` 的多播委托（例如 GE 施加/移除、受击事件等），若存在则用 `.Add(...)` 订阅，记录施加到木桩上的每一个 GE 类名和时间戳。若原生委托未对蓝图暴露，直接用方案 1 + 方案 2 即可满足全部验证需求。【未知（需运行时枚举 ASC 属性验证）】
  - **方案 4：用 `CharacterState.Forbid.Ability.SimpleExecution` 做反证实验**
    - 已证实该标签是 `GA_SimpleExecution_GuiTouBlade` 的 `ActivationBlockedTags`（[scarlet-wraithblade-flowers-assets.md](file:///Z:/Mods_crafting/docs/game-notes/scarlet-wraithblade-flowers-assets.md#L280)）。实验时给玩家挂此 loose tag，可立即区分某次异常击杀是不是简易处决所致。【已证实标签名 / 推断验证有效】

---

## 3. 当前 `0.1.0` 能否交给用户试玩？风险分级

- **结论**：**可以交给用户做内部试玩，不建议直接标为正式发布版 `0.1.0`。** 核心功能与 `stop()` 还原链路均完整（[main.js](file:///Z:/Mods_crafting/mods/hongzhuang-guizhan-plus/src/main.js#L767-L786)），且剩余验证项（手感、音量、视觉遮挡、Boss 战节奏、断情标签实效）必须靠真实游玩获取，继续跑木桩价值很低。【已证实】

### 试玩前必须向用户说明的风险
1. **存档备份（硬性规则 8）**：确认已备份 `ProjectPBZ\Saved\SaveGames\`，并牢记还原前关闭 Steam 云同步（[README.md](file:///Z:/Mods_crafting/mods/hongzhuang-guizhan-plus/README.md#L171)、[L184](file:///Z:/Mods_crafting/mods/hongzhuang-guizhan-plus/README.md#L184)）。【已证实】
2. **试玩前先卸掉/关闭 `pbz-testbench`**：避免测试探针、`pinDummy` 或 `Alt+F5` 刷怪逻辑混入实战。【推断必要】
3. **铸魂（Lv30）计数溢出仍可能打破防**：自动爆炸会给花内敌人叠层，第 5 层后触发的 `HitCounter_Explode` 仍用原版计算器，木桩上已出现破防迹象（杀气回升 + 伤害 ×1.5）；2 轮未触发自动处决，但实战中不同怪/距离下不能保证绝对不触发（[scarlet-wraithblade-flowers-assets.md](file:///Z:/Mods_crafting/docs/game-notes/scarlet-wraithblade-flowers-assets.md#L305-L307)）。【已证实（会破防）/ 未知（实战是否会触发自动处决）】
4. **彼岸·极不破防但血量伤害极高**：即使 `ultraCantBreak: true`，UltraFlower 对 1360 血双斧怪只需约 1.1 s 就能打空血致死（[scarlet-wraithblade-flowers-assets.md](file:///Z:/Mods_crafting/docs/game-notes/scarlet-wraithblade-flowers-assets.md#L313)），实玩中普通小怪仍可能被“极”花快速烧死（非处决）。【已证实】
5. **以下项尚未在真实实战中核实**：
   - **断情标签名** `CharacterState.AbilityState.GuiTouDao.Buff`（之前只用 `forceDuanqing` 测过，[scarlet-wraithblade-flowers-assets.md](file:///Z:/Mods_crafting/docs/game-notes/scarlet-wraithblade-flowers-assets.md#L225)、[L260](file:///Z:/Mods_crafting/docs/game-notes/scarlet-wraithblade-flowers-assets.md#L260)）；请用户在开 `debugLog: true` 时实战开一次断情，看日志是否出现 `断情 (GuiTouDao.Buff) on`。
   - **听感与视觉**：25% 音量、`+25%` 面积、极花循环特效在混战中是否吵闹或遮挡敌人出招。
   - **Boss / 精英 / 切图稳定性**：尚未测过 Boss 与精英怪；另外 `shared.cdoSet` 与 `shared.ultraCalcSet` 只设置一次（[main.js](file:///Z:/Mods_crafting/mods/hongzhuang-guizhan-plus/src/main.js#L754-L755)），如果跨关卡/读档触发资产重载，CDO 改写可能被重置回原版（试玩时注意切图后 E 冷却和彼岸·极是否仍生效）。【推断】

### 可以留到后面的事项
- `BP_Monster_FemaleDoll_QinNv` 作为木桩不受伤的原因排查（[scarlet-wraithblade-flowers-assets.md](file:///Z:/Mods_crafting/docs/game-notes/scarlet-wraithblade-flowers-assets.md#L297)）。
- 彼岸·极第 4 跳起伤害突然 ×1.35（`224.6 → 303.3`）的来源定位（[L313](file:///Z:/Mods_crafting/docs/game-notes/scarlet-wraithblade-flowers-assets.md#L313)）。
- Boss 战单独倍率、效果 2（F 蓄力白花）、聚花、花丛吸血、Mods Menu。

---

## 4. “铸魂计数溢出仍可能破防”的处理选项与代价

背景（[scarlet-wraithblade-flowers-assets.md](file:///Z:/Mods_crafting/docs/game-notes/scarlet-wraithblade-flowers-assets.md#L240)、[L305-L307](file:///Z:/Mods_crafting/docs/game-notes/scarlet-wraithblade-flowers-assets.md#L305-L307)）：被动监听 `PostTakeHit.Source`，花内目标吃 `Normal/Break/Knockdown/Knockup/Launchback` 命中叠 `HitCounter`（上限 5），溢出触发 `HitCounter_Explode`（物理/杀气/元素各 2.0，`PBZPlayerNonLethal`，`HitStrength = Income.None`）。自动爆炸命中强度是 `Normal.Light`，会叠层并触发溢出。【已证实】

| 选项 | 做法 | 优点 | 代价 / 风险 |
|---|---|---|---|
| **A. 暂不处理，先试玩观察** | 保持原版不动，在已知问题中说明 | 零改动；保留玩家自己攻击叠满铸魂时的正常破防手感；目前 2 轮实测未触发自动处决 | 若实战中确实出现溢出引发自动处决，或用户严格要求“花及其派生效果一律不破防”，会违背预期 |
| **B. 把 `HitCounter_Explode` 的计算器也换成 `CantBreakTarget`（可做开关）** | 复用 [main.js](file:///Z:/Mods_crafting/mods/hongzhuang-guizhan-plus/src/main.js#L657-L682) 的 `setUltraCalc` 模式，替换该 GE CDO 的 `CustomCalculator`，`stop()` 还原 | 实现最简单（同构几行代码）；彻底杜绝溢出破防 | **副作用波及原版攻击**：玩家自己拿刀打花内敌人触发的铸魂溢出也会被锁在 0.1 杀气，无法靠铸魂那一下打破防（需再补一刀） |
| **C. 让自动爆炸不叠铸魂计数** | 调查能否在自动爆炸单颗子弹实例上把 `HitStrength` 改为 `Income.None`（不动共享 BD） | 语义最干净：玩家攻击与 E 引爆照常叠铸魂、照常破防；mod 新增的自动爆炸既不白送 5 倍爆发也不引发破防 | 1. 能否按子弹单独改 `HitStrength` 目前【未知】；<br>2. 改成 `Income.None` 可能会一并取消自动爆炸的受击硬直/后仰，且削弱 Lv30 铸魂的联动爽感【推断】 |
| **D. 保留破防，仅尝试短窗口屏蔽自动简易处决** | 仅在自动爆炸前后极短窗口给玩家挂 `CharacterState.Forbid.Ability.SimpleExecution` | 保留铸魂破防与 1.5 倍易伤 | 存在竞争窗口（可能误拦玩家同时段的手动处决）；不能防止花替玩家打破防；改动风险大于 B【推断】 |

---

## 5. 15:05:42 无输入击杀的最可能解释与最便宜验证办法

现象记录：[scarlet-wraithblade-flowers-assets.md](file:///Z:/Mods_crafting/docs/game-notes/scarlet-wraithblade-flowers-assets.md#L318)（“重载后、花出现之前，角色移动并一击打死杀气满的木桩（−500 血、−200 杀气）”）。

- **先排除 mod 自身**：通读 [main.js](file:///Z:/Mods_crafting/mods/hongzhuang-guizhan-plus/src/main.js#L1-L796)，mod 没有任何驱动角色移动、触发攻击 GA 或注入输入的代码。【已证实】
- **最可能的 3 个解释（按可能性排序，均为【推断】）**：
  1. **Computer Use 切焦点或组合键残留触发了游戏内攻击/暗杀（最可能）**：当时是 agent 用 computer use 按 `Alt+F5`（[scarlet-wraithblade-flowers-assets.md](file:///Z:/Mods_crafting/docs/game-notes/scarlet-wraithblade-flowers-assets.md#L210)）。如果点击游戏窗口聚焦时把一次左键/右键送进了游戏，或按键序列产生残留输入，且无 AI 木桩处于静止/非警觉态，一次潜行暗杀或高伤突进正好会带角色位移并一次性打空满血满杀气（`−500 / −200`）。
  2. **上一轮测试的引擎侧状态残留**：`Alt+F5` 只重载 JS，不会中止引擎中正在播放或排队中的 C++/BP GameplayAbility（例如上一轮结尾残留的处决/攻击动作或未清理的旧触发事件），在新木桩刚刷出来时恰好结算或索敌冲了过去。
  3. **`Alt` 或 `F5` 在游戏键位里绑定了动作 / 游戏存在某种自动接近交互**（可能性最低，否则前面十几轮 `Alt+F5` 应高频复现）。
- **最便宜的验证办法（总耗时 < 2 分钟）**：
  1. **先翻旧账（零运行成本）**：看 15:05:30–15:05:50 的完整 `loader.log`（检查 `attribution` 是否记录了那次击杀的 `BulletSourceAbility` / `BulletData`，以及上一轮结束时角色是否处于处决中），再核对 agent 在 15:05:40–15:05:42 的 computer use 工具调用历史（有没有发过鼠标点击）。
  2. **最小复现（若日志无记录）**：用 `pbz-testbench` 关掉刷花、只刷满血满杀气木桩，用户亲自在窗口已聚焦的情况下纯键盘按 5 次 `Alt+F5`（不碰鼠标）。若 0 复现，即可结案为 computer use / 上一轮残留，不必再投入时间。

---

## 6. 文档与代码自相矛盾 / 未清理干净清单

### 高严重度
1. **代码注释残留已作废的错误因果结论**
   - **证据**：[main.js](file:///Z:/Mods_crafting/mods/hongzhuang-guizhan-plus/src/main.js#L63) 写着 `(Blanking the burn GE on the shared BD instead made broken enemies lose all HP ~0.4 s later: 4 of 4 runs.)`；但 [scarlet-wraithblade-flowers-assets.md](file:///Z:/Mods_crafting/docs/game-notes/scarlet-wraithblade-flowers-assets.md#L270) 已明确作废“置空灼烧引起秒杀”的推断。【已证实】
   - **建议修正**：改为说明现行做法（保留首跳后移除 1 层灼烧）的原因是不改共享 BD、避免误伤同帧的 E/到期爆炸。

### 中严重度
2. **文档与代码的武器等级 API 名称及语义矛盾**
   - **证据**：[scarlet-wraithblade-flowers-assets.md](file:///Z:/Mods_crafting/docs/game-notes/scarlet-wraithblade-flowers-assets.md#L225) 写 mod 用 `GetCurrentHoldingWeaponLevel`；但 [main.js](file:///Z:/Mods_crafting/mods/hongzhuang-guizhan-plus/src/main.js#L219-L220) 实际调用 `bp.GetWeaponLevel("GuiTouBlade", true)`，并特意注释“读红妆鬼斩本身等级，而非手持武器”。【已证实】
   - **建议修正**：更新 `game-notes:225` 为 `GetWeaponLevel("GuiTouBlade", true)`。

3. **`game-notes §13` 前半部分保留已弃用的旧灼烧方案与旧伤害公式，与后文及代码冲突**
   - **证据**：[scarlet-wraithblade-flowers-assets.md](file:///Z:/Mods_crafting/docs/game-notes/scarlet-wraithblade-flowers-assets.md#L236)、[L238](file:///Z:/Mods_crafting/docs/game-notes/scarlet-wraithblade-flowers-assets.md#L238)、[L262](file:///Z:/Mods_crafting/docs/game-notes/scarlet-wraithblade-flowers-assets.md#L262) 仍写“0.15 s 置空 BD 灼烧 GE”“不带灼烧，直击 ×(`tickDamageScale` ÷ 0.375)”；而 [L283](file:///Z:/Mods_crafting/docs/game-notes/scarlet-wraithblade-flowers-assets.md#L283)、[README.md](file:///Z:/Mods_crafting/mods/hongzhuang-guizhan-plus/README.md#L26) 和 [main.js](file:///Z:/Mods_crafting/mods/hongzhuang-guizhan-plus/src/main.js#L609) 已改为保留首跳后 0.1 s 移除一层灼烧，公式为 `(tickDamageScale - 0.169) / 0.375`。【已证实】
   - **建议修正**：在 `game-notes:236, 238, 262` 标明“（dev.1/dev.2 旧方案，dev.3 起已改为 L283 方案）”。

4. **`README.md` 多处“待核实 / 待办 / 未确认”在实测完成后未清理，且与自身后文冲突**
   - **证据**：
     - [README.md](file:///Z:/Mods_crafting/mods/hongzhuang-guizhan-plus/README.md#L68) 仍写“待核实：能否解析 JSONC”，而 [L114](file:///Z:/Mods_crafting/mods/hongzhuang-guizhan-plus/README.md#L114) 和 [main.js](file:///Z:/Mods_crafting/mods/hongzhuang-guizhan-plus/src/main.js#L111-L129) 已实现并证实；
     - [README.md](file:///Z:/Mods_crafting/mods/hongzhuang-guizhan-plus/README.md#L88) 仍写“Lv15、Lv20 对应什么标签还不知道，要先导出武器升级表”，而 [game-notes](file:///Z:/Mods_crafting/docs/game-notes/scarlet-wraithblade-flowers-assets.md#L212-L225) 已读完升级表且代码直接读等级数字；
     - [README.md](file:///Z:/Mods_crafting/mods/hongzhuang-guizhan-plus/README.md#L102-L103) 仍写“`Evolution` 推断为 Lv30、升级表未导出、核实前不当作已确认”，与自身 [L80](file:///Z:/Mods_crafting/mods/hongzhuang-guizhan-plus/README.md#L80)、[L126](file:///Z:/Mods_crafting/mods/hongzhuang-guizhan-plus/README.md#L126) 及 [game-notes:223](file:///Z:/Mods_crafting/docs/game-notes/scarlet-wraithblade-flowers-assets.md#L223)（`Evolution` 不在等级表、来自铸魂）矛盾；
     - [README.md](file:///Z:/Mods_crafting/mods/hongzhuang-guizhan-plus/README.md#L170) 仍写“判伤次数要实测”，而 [game-notes:198](file:///Z:/Mods_crafting/docs/game-notes/scarlet-wraithblade-flowers-assets.md#L198) 已证实合批子弹只判一次。【已证实】
   - **建议修正**：逐条清理或改为已证实状态。

5. **规格表与默认行为、参数清单不对齐**
   - **证据**：
     - [README.md](file:///Z:/Mods_crafting/mods/hongzhuang-guizhan-plus/README.md#L25) 规格表写自动爆炸“增加杀气伤害 0.25 / 0.5”，未提默认 `tickCantBreak: true`（停在 0.1 不破防，且普通小怪进花 0.3 s 已到 0.1，见 [L140](file:///Z:/Mods_crafting/mods/hongzhuang-guizhan-plus/README.md#L140)、[game-notes:202](file:///Z:/Mods_crafting/docs/game-notes/scarlet-wraithblade-flowers-assets.md#L202)）；
     - [README.md](file:///Z:/Mods_crafting/mods/hongzhuang-guizhan-plus/README.md#L57) 高级项汇总漏列了 `tickCantBreak`、`ultraCantBreak`、`debugLog`、`areaSpreadRings`（其中 `areaSpreadRings` 在 [main.js](file:///Z:/Mods_crafting/mods/hongzhuang-guizhan-plus/src/main.js#L93)、[L107](file:///Z:/Mods_crafting/mods/hongzhuang-guizhan-plus/src/main.js#L107) 有效，但 README 表格完全未写）；且 [L57](file:///Z:/Mods_crafting/mods/hongzhuang-guizhan-plus/README.md#L57)、[L146](file:///Z:/Mods_crafting/mods/hongzhuang-guizhan-plus/README.md#L146) 把效果 2 键名简写成 `extraWhiteFlowersLv25/30`，代码里是两个独立键 `extraWhiteFlowersLv25`、`extraWhiteFlowersLv30`（[main.js:108](file:///Z:/Mods_crafting/mods/hongzhuang-guizhan-plus/src/main.js#L108)）；
     - [README.md](file:///Z:/Mods_crafting/mods/hongzhuang-guizhan-plus/README.md#L36) 写面积档位同时铺开整圈花，但 [main.js](file:///Z:/Mods_crafting/mods/hongzhuang-guizhan-plus/src/main.js#L562) 写了 `!early`，Lv5 前（3 s）花圈不会被铺开。【已证实】
   - **建议修正**：补全规格表与参数清单，明确 `areaSpreadRings` 和 Lv5 前行为。

6. **伤害数值记录中存在未核对的内部矛盾**
   - **证据**：
     - [scarlet-wraithblade-flowers-assets.md](file:///Z:/Mods_crafting/docs/game-notes/scarlet-wraithblade-flowers-assets.md#L231-L232) 记原版直击 `149.7`、灼烧 `67.4 + 91 + 91`（首跳与直击同帧，合计首帧 `149.7 + 67.4 = 217.1`）；
     - [L282](file:///Z:/Mods_crafting/docs/game-notes/scarlet-wraithblade-flowers-assets.md#L282) 记 E 未破防 `−217.1`（正好是直击 + 首跳）；
     - 但 [L317](file:///Z:/Mods_crafting/docs/game-notes/scarlet-wraithblade-flowers-assets.md#L317) 却写“按 E：**直击 −217.1，灼烧 67.4 + 91 + 91**”（如果 `217.1` 已含首跳 `67.4`，这里把 `67.4` 算了两次；若不含，则需解释为何 `TwinAxe` 的纯直击恰好等于 `Sword_Blue` 的直击 + 首跳）；
     - 同时 [L198](file:///Z:/Mods_crafting/docs/game-notes/scarlet-wraithblade-flowers-assets.md#L198) 的未破防 `−293.2`（`217.1 × 1.35`）与 [L313](file:///Z:/Mods_crafting/docs/game-notes/scarlet-wraithblade-flowers-assets.md#L313) 的未破防 `−224.6 → −303.3`（`224.6 × 1.35`）都出现了精确的 **×1.35** 跳变，笔记未做说明。【已证实（数字关系）/ 未知（原因）】
   - **建议修正**：在 `game-notes` 标出 L317 是否重复记了首跳，以及两处 ×1.35 待查，避免后续平衡计算基准失真。

7. **`main.js` 两处逻辑边界问题（虽不影响主流程，建议试玩前顺手修或注明）**
   - **证据 A**：[main.js](file:///Z:/Mods_crafting/mods/hongzhuang-guizhan-plus/src/main.js#L103)、[L609](file:///Z:/Mods_crafting/mods/hongzhuang-guizhan-plus/src/main.js#L609) 允许 `tickDamageScale` 配置 `0..1`，但公式为 `Math.max(0, (tickDamageScale - 0.169) / 0.375)`，且灼烧首跳恒定保留，导致设 `0` 时实际伤害仍约占原版 16.9%（~67 血）而非 0。【已证实】
   - **证据 B**：[main.js](file:///Z:/Mods_crafting/mods/hongzhuang-guizhan-plus/src/main.js#L477) 的 `stripBurns` 在爆炸 0.1 s 后按敌人当前位置与爆炸点距离 `< p.r + e.r + 50` 删 1 层灼烧。因为自动爆炸会把敌人击退（[game-notes:258](file:///Z:/Mods_crafting/docs/game-notes/scarlet-wraithblade-flowers-assets.md#L258)），边缘敌人若被推出 >50 cm 会漏删灼烧；反之若边缘敌人未被自动爆炸打中、却在 0.1 s 内吃了玩家 E 引爆，则可能误删 E 的 1 层灼烧。【推断】
   - **建议修正**：文档说明 `tickDamageScale` 低于 `0.17` 仍保留灼烧首跳（或在 `tickDamageScale === 0` 时跳过伤害/另处理）；`stripBurns` 可留待实战确认是否真的出现漏删/误删。

### 低严重度
8. **`game-notes` 重复行、未回注的旧推断 & `applyBdRadius` 高频重复写入**
   - **证据**：
     - [scarlet-wraithblade-flowers-assets.md](file:///Z:/Mods_crafting/docs/game-notes/scarlet-wraithblade-flowers-assets.md#L297) 与 [L319](file:///Z:/Mods_crafting/docs/game-notes/scarlet-wraithblade-flowers-assets.md#L319) 字面完全重复（`FemaleDoll_QinNv` 一行）；
     - [L35](file:///Z:/Mods_crafting/docs/game-notes/scarlet-wraithblade-flowers-assets.md#L35)、[L168](file:///Z:/Mods_crafting/docs/game-notes/scarlet-wraithblade-flowers-assets.md#L168) 的 `Lifetime 推断为 0` 和 [L198](file:///Z:/Mods_crafting/docs/game-notes/scarlet-wraithblade-flowers-assets.md#L198)、[L203](file:///Z:/Mods_crafting/docs/game-notes/scarlet-wraithblade-flowers-assets.md#L203) 的 `已破防` 未在原地加更正指向（分别已在 L255、L267 推翻）；
     - [main.js](file:///Z:/Mods_crafting/mods/hongzhuang-guizhan-plus/src/main.js#L490-L500)、[L537](file:///Z:/Mods_crafting/mods/hongzhuang-guizhan-plus/src/main.js#L537) 每 50 ms 对 `P_BD_EXPLODE` 重复 `UE.Object.Load` 并回写 `bd.ColliderData = cd`，可在目标半径已匹配时直接跳过写入。【已证实】
   - **建议修正**：删掉重复的 L297（或 L319），在旧推断处加括号指向 §13 更正；`applyBdRadius` 加相等判断避免每帧重复写 DataAsset。
