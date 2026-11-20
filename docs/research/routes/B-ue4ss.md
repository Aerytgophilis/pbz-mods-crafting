# 路线 B · UE4SS（PBZ 专用社区包）运行时 mod：Lua hook 和 / 或 Blueprint LogicMods

> 辩护人立场文件。调研日期 2026-11-20。本机游戏为 Steam build **26367565**（`Z:\SteamLibrary\steamapps\appmanifest_4115450.acf` 的 `buildid`），`platform\steam\PBZ.exe` 文件版本 **CL-302256_JKS-17280**，也就是 11-04 补丁 “1.0302256” 之后的版本。
> 标注：**【已证实】** = 有一手来源（源码、README、issue、本地文件）；**【推断】** = 从已证实事实推出，没有直接验证；**【未知】** = 目前没有证据。
> Nexus 对抓取返回 403，凡是 “Nexus 页面内容” 都来自搜索引擎摘要，可信度低于 GitHub 源码，下文单独标出。

## 一句话主张

PBZ 的战斗是标准 UE 的 GAS 架构：能力 `GA_*`，效果 `GE_*`，子弹数据 `BD_*`，属性 `Shachi`。UE4SS Lua 已经在**当前 build 26367565** 上被多个开源 mod 用来 hook 能力激活、改子弹伤害、施加 GE、生成 Niagara 特效、往能力时间轴里注入新动作。两个目标效果（彼岸花常驻并周期爆炸、白彼岸花 1→5）都可以拆成 “找到这些对象，再在运行时改它们或多调用几次”。而且 Lua mod 不改游戏脚本和资产，11-04 的脚本校验对它没有影响。

---

## 论点列表

### A. PBZ 版 UE4SS 的现状

1. **【已证实】有一个维护中的 PBZ 包，在当前 build 上测过。** KintaroModding 的 `phantombladezero_ue4ss_v4.0.0.zip` 就是官方 UE4SS v4.0.0（2026-11-12，commit `30afe5ff`）加一份 PBZ 配置：`UE4SS_Signatures\GUObjectArray.lua`、`UE4SS_Signatures\GNatives.lua`、`MemberVariableLayout.ini`。2026-11-13 在 Steam build 26367565 上测过：启动游戏、读档、两个签名都找到、C++ mod 和脚本 pak mod 都能跑。zip 的 SHA-256 公开（`7d7fae12…abf48`）。
   - https://github.com/KintaroModding/ue4ss/releases
   - https://openmods.nexus/mods/kintaromodding/ue4ss
   - https://raw.githubusercontent.com/KintaroModding/ue4ss/release/FORK.md
2. **【已证实】这份 PBZ 配置已经合进 UE4SS 上游。** PR #1484 “Added custom config for Phantom Blade Zero” 在 2026-11-12 由维护者 narknon 合并。作者在 PR 里写了在 build 26266538 上的测试：CXX 头文件 dump、不含 BP 类型的 mapping dump、一个读写玩家属性的 Lua mod；11-12 又补了一句配置在 26367565 上仍然可用。PBZ 支持因此不只靠一个人维护，下一个官方 release 会自带。
   - https://github.com/UE4SS-RE/RE-UE4SS/pull/1484
3. **【已证实】UE4SS 维护者为 PBZ 修过 bug。** issue #1483：在 PBZ 上做 usmap dump 会崩，原因是 `SGameAI` 插件里有 enum 为 null 的 `FEnumProperty`。上游修复后在 build 1195 关闭（2026-11-01），报告者确认生成的 .usmap 一致。
   - https://github.com/UE4SS-RE/RE-UE4SS/issues/1483
4. **【已证实】已知问题（主持人反驳时会提，我先列出来）：**
   - `ProcessConsoleExec` hook 装不上，mod 自己加的控制台命令可能无效（openmods 页、PR #1484、releases 页）。
   - **v4.0.0 / 1195 / 1188 都没有用真实的 Blueprint mod（LogicMods）测过。** 1183 时 BPModLoaderMod 找不到 LogicMods，因为 exe 在 `platform\steam\`；1188 起上游修了目录识别，但仍然只用一个带 `config.lua` 的 mod 测过（FORK.md、releases 页）。
   - **Ctrl+R 热重载会让游戏崩溃。** PhantomPact 记录了两次；Summon Enhancement 的页面也要求把热重载关掉（搜索摘要）。
     - https://github.com/appdoze/PhantomPact/blob/main/docs/RECON_NOTES.md
     - https://www.nexusmods.com/phantombladezero/mods/802 （仅搜索摘要）
   - `APBZCharacter::OnDamage` 是 native 函数，不是可 hook 的 UFunction：“never fires under UE4SS”（PhantomPact RECON_NOTES）。**所以不是什么都能 hook。**
   - ChiRenBlade 的源码注释：类对象上的静态方法在这个 build 里调不了；`DestroyComponent` 没有暴露；短时间内大量 `FindAllOf` 会卡住游戏线程。
     - https://raw.githubusercontent.com/IdleAltair/ChiRenBlade/master/src/ChiRenBlade/Scripts/main.lua
5. **【已证实】11-04 补丁之后的情况。** 本机 exe 是 CL-302256，就是社区说的 “1.0302256”。Kintaro 的配置在这个 build 上仍然有效（第 1 条）。另一些 UE4SS 包在这次补丁后找不到 `GNatives / GUObjectArray`，社区为此出了 “UE4SS Patch Fix”（Nexus mods/530）。可见签名在补丁后可能失效，但这一次换签名就修好了。
   - https://www.nexusmods.com/phantombladezero/mods/530 （仅搜索摘要）
6. **【已证实】本机目前没有装 UE4SS。** `platform\steam\` 下只有 `PBZ.exe`、`steam_api64.dll`、`tbbmalloc.dll`、`D3D12\`，没有 `dwmapi.dll` 和 `ue4ss\`；`ProjectPBZ\Content\Paks\` 下也没有 `LogicMods\` 或 `~mods\`（只读列目录）。

### B. 在 PBZ 上能 hook 和操作什么（有源码或开源记录）

7. **【已证实】战斗用的是 GAS。** 玩家 `BP_Renewal_Hun_Young_C` 身上有 `PBZAbilitySystemComponent`、`AttributeComponent`、`DeflectComponent` 等组件；`Shachi / Shachi_Max` 在 `AttributeSetBase`（`UBasicAttributeSet`）上；能力类在 `/PBZCombatAsset/ActorData/Players/Hun/Abilities/...`；`TryActivateAbilityByClass` 可以调用。
   - https://github.com/appdoze/PhantomPact/blob/main/docs/RECON_NOTES.md
8. **【已证实】武器能力可以按类 hook。** ChiRenBlade 用 `RegisterHook` 挂在 `GA_Hun_ChiRen_B_C / _BB_C / _BBB_C / _BD_C / _BSup_C / _C_C` 的 `K2_ActivateAbility` 和 `K2_OnEndAbility` 上，也挂了 `DeflectComponent:ConsumeReceivedFrame` 和 `HitreactComponent:PlayHitreactToAvatar`。README 写明目标是 Steam build 26367565。这是**单把武器的招式级改动**，跟我们要做的最接近。
   - https://github.com/IdleAltair/ChiRenBlade （MIT）
9. **【已证实】子弹数据可以在运行时改，包括 “削减敌人杀气” 字段。** ChiRenBlade 加载 `/PBZCombatAsset/ActorData/Players/Hun/BulletData/LongBlade/ChiRen/BD_GA_Hun_ChiRen_BSup_01`，再用 `asset.DamageData:ForEach` 修改 `Damage.Attack.Target.PhysicalDamage / ElementDamage`。源码注释说明敌人杀气伤害走 `Damage.Attack.Target.AngerDamage`，这个 mod 有意没改它。**这说明 “削减敌人杀气” 是 BD 资产里一个按 tag 索引的数值，可读可写。**
10. **【已证实】GE 可以施加到敌人身上，也可以临时改 CDO。** `MakeSpecHandleByClass` 后接 `BP_ApplyGameplayEffectSpecToTarget`（例如 `/PBZCombatAsset/Prototypes/GameplayEffects/Inflictions/GE_Ignite.GE_Ignite_C`），还有 `BP_ApplyGameplayEffectToSelf / ToOwner`、`RemoveActiveGameplayEffect`、`SetActiveGEDuration`。改 GE CDO 上的 `DurationMagnitude`，用完再改回来（ChiRenBlade main.lua）。
11. **【已证实】可以往能力时间轴里注入新动作。** ChiRenBlade 用 `StaticConstructObject` 构造 `GAA_DeflectFrame_C`，追加到 `GA_Hun_ChiRen_SWT_C` 的时间轴 actions 数组里。这正是 “给一个招式多加几个生成动作” 的手法（main.lua，偏移 100000 之后那一段）。
12. **【已证实】可以生成特效和音效。** 用 `/Script/Niagara.Default__NiagaraFunctionLibrary:SpawnSystemAtLocation`（9 个参数）放出 `/PBZVFXPack/VFX/BattleFX/Weapon/HeiShang/NS_LongBlade_Firetornado_401`，两秒后手动 Deactivate 并销毁组件；用 `AkGameplayStatics:PostEvent` 播放 Wwise 事件（main.lua）。
13. **【已证实】可以生成 Actor 和 NPC。** PhantomPact 生成了第二个 `BP_Renewal_Hun_Young_C`，敌人按类生成后调用 `SpawnDefaultController()`；PhantomGladiator（MIT，build 26367565）通过游戏原生的召唤、阵营、仇恨接口召唤成队 NPC。另外 PhantomPact 的 RECON_NOTES 提醒：生成后要自己 teleport；游戏自己生成的单位有 owner 和寿命规则。
    - https://github.com/LingYi-Liang/PhantomGladiator
14. **【已证实，通用能力】UE4SS 自带的工具：**
    - `RegisterHook`（UFunction）
    - `NotifyOnNewObject`（某类有新实例时回调，含子类）
    - `RegisterBeginPlayPostHook`
    - `LoopAsync / ExecuteWithDelay / ExecuteInGameThread`
    - `StaticFindObject / FindAllOf / LoadAsset / StaticConstructObject`
    - `RegisterCustomEvent`（让 Lua 和 BP mod 互相调用）
    - **Live View**：搜索、查看、修改、watch 对象属性，还能在 GUI 里直接调用 UFunction 做试验，不用写代码。

    限制：`RegisterHook` 要求目标 UFunction 已经加载；不支持委托；**非 `/Script/` 路径（也就是 BP 函数）只有执行后的回调**。ChiRenBlade 把它对 BP 能力的 hook 称作 “pre-hook”，跟文档说法不一致，需要实测。
    - https://docs.ue4ss.com/lua-api.html
    - https://docs.ue4ss.com/dev/lua-api/global-functions/registerhook.html
    - https://docs.ue4ss.com/feature-overview/live-view.html

### C. 已有的 PBZ UE4SS gameplay mod（改技能、武器、Buff 的）

| Mod | 做了什么 | 框架依据 | 来源可信度 |
|---|---|---|---|
| ChiRenBlade（IdleAltair） | 单把武器：拼刀后重击免杀气、刀身附火、旋风伤害按连拼倍增、重击杀气消耗减半 | 源码可读，UE4SS Lua，MIT | 【已证实】https://github.com/IdleAltair/ChiRenBlade |
| BetterHeiMoShang – Infernal Rouge Buff | 强化 Infernal Rouge（`weapon_hei_mo_shang`）：气刃更久更强、幻魂强化、可选攻速倍率；作者说 “只改运行时内存” | UE4SS Lua（`Scripts\main.lua`） | 搜索摘要 https://www.nexusmods.com/phantombladezero/mods/362 |
| Infernal Rouge Unbound – Moveset Overhaul | Infernal Rouge 招式重做 | ChiRenBlade 致谢其 `iru_clash.lua`，据此推断是 UE4SS Lua | 搜索摘要 https://www.nexusmods.com/phantombladezero/mods/1009 |
| PBZ Weapon Tuner | 按武器或按招式组改伤害、破防、异常累积，读取的是真实招式数据 | 需要 UE4SS | 搜索摘要 https://www.nexusmods.com/phantombladezero/mods/412 |
| Longer Buff Duration – PBZBuffDuration | 武器和技能 Buff 时长倍率 | 搜索摘要未写明框架 | https://www.nexusmods.com/phantombladezero/mods/99 |
| Summon Enhancement v2.3.5 | 改影刃召唤行为，并同步改游戏内说明文本；“pure UE4SS Lua, reflection only” | UE4SS Lua | 搜索摘要 https://www.nexusmods.com/phantombladezero/mods/802 |
| PBZ Tuner AIO | 敌我血量、伤害、杀气上限和回复、弹反窗口；F5 重载配置 | UE4SS Lua（`Scripts\config.lua`） | https://vgtimes.com/games/phantom-blade-zero/files/99501-pbz-tuner-aio-universalnyjj.html |
| PhantomGladiator | 召唤 NPC 小队、怪物互相处决 | UE4SS Lua，MIT | 【已证实】https://github.com/LingYi-Liang/PhantomGladiator |
| PhantomPact | 联机同步、生成第二个主角、复放能力 | UE4SS Lua + C++ dll | 【已证实】https://github.com/appdoze/PhantomPact |

**【已证实】顺带的事实：红妆鬼斩的英文名是 Scarlet Wraithblade，不是 Infernal Rouge。** 红妆鬼斩是双手武器，新娘阿花（Hua, Deadly Betrothed）掉落；Infernal Rouge 是 Sanguine 铸魂后的单手剑。所以 BetterHeiMoShang 改的**不是我们的武器**，但它证明了 “用 UE4SS Lua 增强单把武器” 这条路有人走通。
- https://pbz.gg/zh-hans/weapons/scarlet-wraithblade/
- https://phantombladezero.th.gl/db/main_weapons/weapon_hei_mo_shang
- https://gamerfuzion.com/phantom-blade-zero-secret-boss-hua-location-scarlet-wraithblade/

**【未知】目前没有找到任何公开的 UE4SS mod 改过红妆鬼斩，也没有找到改阿花 Boss 技能的。**

### D. dump 和 usmap 对解包的帮助

15. **【已证实】UE4SS 有 6 种 dump。** Object Dump（`UE4SS_ObjectDump.txt`，Ctrl+J）、C++ 头文件（Ctrl+H）、UHT 兼容头文件（Ctrl+Num9，可以建镜像 uproject）、`.usmap`（Ctrl+Num6）、`.jmap`（Ctrl+Num5，含默认值和近似 vtable）、umap 重建。PBZ 上的 usmap 崩溃已经在 1195 修好（#1483）。
    - https://docs.ue4ss.com/feature-overview/dumpers.html
16. **【已证实】社区已经在用 PBZ 的 usmap 做研究。** ChiRenBlade 的 `research/` 有从游戏反射数据生成的 `data/full.usmap`，并用 `tools/usmap_dump.js` 转成 `schema.txt / schema.json`。auto-defense-next 也有 USMAP 采集工具链。
    - https://raw.githubusercontent.com/IdleAltair/ChiRenBlade/master/research/README.md
    - https://github.com/High-cla/auto-defense-next
17. **【推断】这些 dump 对另外两条路线同样必需。** UE5 cooked 资产一般是 unversioned properties，FModel 和 UAssetGUI 要正确解析属性，需要 usmap。所以**就算最后选 A 或 C，第一步也很可能要装 UE4SS 来 dump**；UE4SS 至少是公共基础设施。（本机还没有验证 FModel 不带 usmap 能读到什么程度。）

### E. 能不能和 PuerTS（JS）层配合

18. **【已证实】11-04 补丁校验的是 JS 脚本，Lua mod 不受影响。** 补丁之后，游戏拒绝加载被改过的 `project/` 脚本（cppbypass README 列出了 218 个脚本），JS 类 pak mod 全部失效，需要 PBZModLoader 或 cppbypass 才能恢复。UE4SS Lua mod 不碰脚本文件：ChiRenBlade、PhantomGladiator 都在补丁后的 26367565 上运行，BetterHeiMoShang 自称只改内存。
    - https://github.com/KintaroModding/phantombladezero_cppbypass
19. **【已证实】UE4SS 的 C++ 层可以伸进 JS 加载流程。** cppbypass 本身就是一个 UE4SS C++ mod（MinHook）：先按 SHA-256 核对 exe 和 UE4SS 版本，再 hook 游戏的脚本内容校验器。
20. **【已证实】两套 loader 能共存，也有现成的桥。** PBZModLoader 的 Kintaro fork 写明 “与 UE4SS 及其 mod 一起测试过”（build 26367565）。Mods Menu 的 “UE4SS Bridge” 能把 UE4SS mod 的设置显示在 JS 写的游戏内菜单里，具体机制未读到。
    - https://github.com/KintaroModding/phantombladezero_pbzmodloader
    - https://www.nexusmods.com/phantombladezero/mods/149 （仅搜索摘要）
21. **【推断，也是风险】并非所有逻辑都在 JS 里。** ChiRenBlade 发现 “游戏不读能力上的 Shachi Cost 字段”，只好改成事后退还。可见有些数值的真正来源在 GAS 资产以外，可能在 JS，也可能在 native 代码，**目前不知道是哪一个**。如果红妆鬼斩的彼岸花逻辑写在 JS 里、又不是 UFunction，UE4SS 就 hook 不到函数本身，只能操作它生成出来的 UObject（Actor、GE、子弹）。
22. **【未知】PuerTS 生成的 TS 类（如果游戏用了）在 UE4SS 里能不能当 UFunction hook。** 目前没有找到任何 PBZ 上的实证。

---

## 两个效果的实现草图

### 第 0 步：先在 dump 里找什么（两个效果共用）

在本地装 UE4SS，打开 GUI，装备红妆鬼斩（≥ Lv25，才有火照黄泉）去打木桩或小怪，分别在**出花前、出花后、爆炸后**各做一次 Object Dump，再做一次 usmap；之后用 FModel 加 usmap 浏览资产。要找的东西：

1. **武器资产**：类似 `/PBZCombatAsset/ActorData/Players/Hun/Weapon/<双手类目录>/Weapon_Hun_<X>`。ChiRenBlade 的武器是 `.../Weapon/Long/Weapon_Hun_ChiRen`，我们的内部代号还不知道，候选是拼音 HongZhuang / GuiZhan，也可能另有代号。
2. **能力**：`GA_Hun_<X>_*`，其中要分清重击连段（会留下石蒜花）、蓄力（火照黄泉）、绝技红妆漫天，以及 Lv5 “遍地红妆” 的 **E 键主动引爆**能力。
3. **子弹数据**：`.../BulletData/<目录>/<X>/BD_*`，在 `DamageData` 里找 `Damage.Attack.Target.AngerDamage`（削减杀气）。
4. **石蒜花本体**：用 Live View 搜带 `Flower / Lily / ShiSuan / Bian / Hua` 的类，判断它是什么：Actor？挂 GE 的区域？子弹？要找到它的寿命字段（基础 3 秒，Lv5 后 15 秒）、减速和杀气损耗用的 GE，以及爆炸的触发点（Timer、时间轴动作，还是某个 UFunction）。
5. **阿花 Boss 版**：在阿花战（或者用召唤类 mod 把 `BP_Monster_*Hua*` 叫出来）里同样 dump，看 Boss 的石蒜花为什么能 “周期爆炸且不消失”：是另一个类、BD 里的循环参数，还是 Boss AI 在反复引爆。
6. 爆炸用的 Niagara `NS_*` 和 Wwise 事件名，留给自制爆炸做表现。

### 效果 1：普攻铺的石蒜花常驻，每隔几秒自动爆炸，持续削杀气

按优先级给出三个方案。主持人请注意：**用哪一个取决于第 0 步的结果，现在无法确定。**

- **方案 1A，借用 Boss 版资产（改动最小）。** 如果第 0 步发现 Boss 的花是另一个类或另一个 BD，而且自带周期爆炸：在玩家重击能力的 `K2_ActivateAbility` 回调里，或者干脆在武器加载时，把玩家能力引用的花的 class 或 BD 换成 Boss 版。用的是第 9、11 条已证实的 “运行时改资产字段” 手法，改动在内存里，不落盘。
- **方案 1B，延长寿命，再周期性 “伪爆炸”（最稳的兜底）。**
  1. 用 `NotifyOnNewObject("<花的类>")` 收集新生成的花，记下位置和 owner。
  2. 把它的寿命字段改得足够长（或者每帧续命），让它不再自己爆炸消失。减速和持续削杀气的区域效果因此保留。
  3. 用 `LoopAsync(间隔)` 配合 `ExecuteInGameThread`，每 N 秒对每朵花做一次：
     - 取半径内的敌人：`FindAllOf` 太重（第 4 条），应该用花自身的 overlap 列表或者游戏的 targeting；
     - 对每个敌人 `MakeSpecHandleByClass(<爆炸 GE 或带 AngerDamage 的 GE>)`，再 `BP_ApplyGameplayEffectSpecToTarget`（第 10 条）；
     - 在花的位置用 `NiagaraFunctionLibrary:SpawnSystemAtLocation(<爆炸 NS>)`，再 `PostEvent(<爆炸音效>)`（第 12 条）。
  4. 切图或花被销毁时清理表项，设置花的数量上限，防止越积越多。
- **方案 1C，调用游戏自己的引爆。** 如果 Lv5 的 E 键引爆对应一个可调用的 UFunction，就定时调用它，然后在 post-hook 里马上在原位置补生成一朵新花。补生成可以调用游戏的子弹或召唤生成函数，或者 `BeginDeferredActorSpawnFromClass` 加 `FinishSpawningActor`，再按 PhantomPact 的经验 teleport 到位。这个方案的风险在第 0 步之前无法评估：Lua 的 hook 能否阻止原函数执行属于【未知】，花被销毁后再生成，可能缺少 owner 或伤害归属。

### 效果 2：F 蓄力放出的白石蒜花从 1 朵变成 5 朵

这里说的 F 蓄力就是火照黄泉（Lv25）：蓄力开始时召唤巨型白石蒜花飞向敌人，碰到后爆炸（pbz.gg）。

- **先确认**：蓄力能力 `GA_Hun_<X>_Charge*` 是怎么放出白花的。看它的时间轴里有没有 “生成子弹” 类的 `GAA_*` 动作，以及对应的 `BD_*`；BD 或者生成动作里有没有数量、角度、散射之类的字段。
- **方案 2A，数据层。** 如果 BD 或生成动作本身有数量字段，直接把它从 1 改成 5，再配一个扇形角度。
- **方案 2B，往时间轴注入动作（有先例）。** 照 ChiRenBlade 注入 `GAA_DeflectFrame_C` 的做法（第 11 条），用 `StaticConstructObject` 复制 4 个 “生成白花” 动作，追加到蓄力能力的时间轴 actions 数组。每个副本设置不同的偏移角，或者不同的目标：最近的 5 个敌人，或者对单个目标呈扇形。
- **方案 2C，hook 生成函数后补调。** 如果白花是由某个 UFunction 生成的，比如 PBZ 的子弹或召唤接口，就在它的回调里补调 4 次，改方向或改目标。要加一个重入标志，免得补调的那几次再次触发回调。
- **验证点**：5 朵各自命中、伤害结算都正常；削减敌人杀气不会被成倍放大到破坏平衡（可以配置）；蓄力完成时瞬移斩不受影响。

### Blueprint LogicMods 在这条路线里的位置

**只在 Lua 做不到时才用**，比如需要一个全新的 BP Actor 类，带碰撞、带特效、能被复用。做法：用 UHT dump 建一个 UE 5.7 镜像项目，写 `ModActor`，打成 pak 放进 `LogicMods`，Lua 和 BP 之间用 `RegisterCustomEvent` 互通。**【已证实】这条在 PBZ 上没有人用真实 BP mod 验证过（第 4 条）**，所以不作为主路径。

---

## 上手成本

| 项 | 评估 | 依据 |
|---|---|---|
| 安装 | 把一个 8.35 MB 的 zip 解压到 `platform\steam\`，出两样东西：`dwmapi.dll` 和 `ue4ss\`。删掉这两样即可卸载。**需要按 AGENTS.md 先征得同意、备份、登记。** | 【已证实】releases 页 |
| 语言 | Lua 5.4，脚本是纯文本，不用编译，不用装 UE 编辑器 | 【已证实】auto-defense-next 页面提到 “游戏里跑的是 Lua 5.4” |
| 能抄的东西 | ChiRenBlade（MIT）跟我们是同类需求：单武器、GA hook、改 BD、施加 GE、生成 Niagara、注入时间轴，可以逐条照着学；PhantomPact 的 RECON_NOTES 有类名表 | 【已证实】 |
| 调试 | Live View 能看属性、调函数、加 watch；日志写在 `ue4ss\UE4SS.log` | 【已证实】 |
| 迭代速度 | **比 PBZModLoader 慢**：Ctrl+R 热重载会崩，改代码基本要重启游戏。可以把数值放进 config，用按键重读（PBZ Tuner AIO 用 F5 重读配置），部分缓解。 | 【已证实】崩溃；【推断】缓解办法 |
| 要学的概念 | GAS（GA、GE、AttributeSet、tag）、UObject 路径和 CDO | 【推断】 |
| 粗估工作量 | dump 和定位 1–3 个晚上；效果 2 用方案 2A/2B，若顺利 1–2 个晚上；效果 1 用方案 1B 2–4 个晚上。**这是凭经验估的，没有依据。** | 【推断】 |

## 游戏更新后的维护成本

- **框架层**：游戏更新后签名可能失效。11-04 那次，Kintaro 的配置照样能用，另一些包需要 “Patch Fix” 换签名（第 1、5 条）。现在 PBZ 配置已经进了上游（第 2 条），以后有上游维护者和 Kintaro 两个来源；也可以自己按官方的 AOB 修复指南用 x64dbg 修。【已证实】机制；【推断】以后的修复速度。
  - https://docs.ue4ss.com/dev/guides/fixing-compatibility-problems-advanced.html
- **mod 层**：我们的 Lua 依赖资产路径和类名（`GA_*`、`BD_*`、属性名）。游戏改名或改结构，mod 就会失效。缓解办法：每次 `StaticFindObject` 都包一层 `pcall` 并在失败时降级（ChiRenBlade 就是这么写的，`TryRegisterHook` 外面套 `pcall`）；启动时自检，把缺失的对象写进日志。
- **对比**：pak 资产替换（路线 C）在游戏改动对应资产时需要重新打包，而且 11-04 已经出现过 “改过的脚本直接被拒绝”。PBZModLoader（路线 A）同样依赖字节签名，补丁之后也要跟着更新（它的 README 写着 “game updates may still require a loader update”）。**三条路线都有维护成本，B 的特点是改动只在内存里，不受脚本校验影响。**
- **Steam 校验文件完整性会删掉 `dwmapi.dll` 和 `ue4ss\`**，要重新安装（搜索摘要，Nexus）。

## 开源发布的友好程度

- **【已证实】许可证**：UE4SS 是 MIT（KintaroModding fork 也是 MIT），我们发布 MIT 的 Lua mod 没有许可证冲突。cppbypass 是 GPL-3.0，但我们不需要它。
- **【已证实】仓库里只有自己的代码。** Lua mod 是纯文本，不含任何游戏资产，符合 AGENTS.md “不提交游戏资产” 的要求。相比之下，pak 替换的产物里必然有改过的游戏资产。
- **【已证实】有现成的发布范式。** ChiRenBlade 的仓库结构（`src/<Mod>/Scripts/main.lua`、`mod.json`、`enabled.txt`、`deploy.ps1`、`pack.ps1`）可以照搬；用户先装 UE4SS 包，再把文件夹放进 `ue4ss\Mods`。
- **代码透明**：Lua 源码就是发布物，用户能直接读，也方便别人审查。

## 证据缺口（诚实列出）

1. **【未知，最大缺口】红妆鬼斩的石蒜花和白石蒜花在引擎里是什么**：Actor、GE 区域还是子弹？爆炸由谁触发？逻辑在 GAS 资产、native 代码还是 JS 里？**我没有解包也没有 dump，以上所有草图都建立在 “它们和 ChiRen 的子弹、能力是同一套机制” 这个假设上。** 如果逻辑在 JS 里、又不是 UFunction，hook 和数据层方案会退化成方案 1B 那种 “外部伪造爆炸”，表现可能不如原版。
2. **【未知】阿花 Boss 的花为什么能 “周期爆炸、不消失”**：是数据差异，还是 AI 在反复引爆？这决定方案 1A 能不能用。
3. **【未知】UE4SS Lua 的 hook 能否阻止原函数执行**；BP 函数的 hook 到底是前置还是后置（文档和 ChiRenBlade 的说法不一致）。
4. **【已证实，缺口】PBZ 上没有人验证过真实的 Blueprint LogicMods**，所以 “BP mod” 这一半目前只是理论上可行。
5. **【未知】PuerTS 生成的类能否被 UE4SS hook**；没有找到 Lua 和 JS 直接互调的公开 API。UE4SS Bridge 的机制没读到。
6. Nexus 上的 BetterHeiMoShang、Weapon Tuner、BuffDuration、Summon Enhancement、Infernal Rouge Unbound、UE4SS Patch Fix 等**都只看了搜索摘要**，没有读到源码；它们具体 hook 了什么不清楚。BuffDuration 用的是什么框架也没确认。
7. 我**没有在本机运行过 UE4SS**。“能在 26367565 上跑” 来自 Kintaro 的测试记录，以及 ChiRenBlade、PhantomGladiator 声明的目标 build。
8. 上手工作量是凭经验估计的，没有依据。
9. 有些 native 函数（如 `APBZCharacter::OnDamage`）hook 不到，说明 “UE4SS 能 hook 一切” 的说法**不成立**。如果关键逻辑恰好在这类函数里，就要用 C++ mod 加 MinHook 按签名 hook，成本会明显上升。

## 主要来源

- https://github.com/KintaroModding/ue4ss/releases ・ https://raw.githubusercontent.com/KintaroModding/ue4ss/release/FORK.md ・ https://openmods.nexus/mods/kintaromodding/ue4ss
- https://github.com/UE4SS-RE/RE-UE4SS/pull/1484 ・ https://github.com/UE4SS-RE/RE-UE4SS/issues/1483
- https://github.com/IdleAltair/ChiRenBlade （main.lua、research/README.md）
- https://github.com/appdoze/PhantomPact/blob/main/docs/RECON_NOTES.md ・ https://github.com/LingYi-Liang/PhantomGladiator ・ https://github.com/High-cla/auto-defense-next ・ https://github.com/Kevin-hDev/Mods-Phantom-Blade-Zero
- https://github.com/KintaroModding/phantombladezero_cppbypass ・ https://github.com/KintaroModding/phantombladezero_pbzmodloader
- https://docs.ue4ss.com/lua-api.html ・ https://docs.ue4ss.com/dev/lua-api/global-functions/registerhook.html ・ https://docs.ue4ss.com/feature-overview/dumpers.html ・ https://docs.ue4ss.com/feature-overview/live-view.html
- https://pbz.gg/zh-hans/weapons/scarlet-wraithblade/ ・ https://pbz.gg/zh-hans/bosses/hua/
- https://vgtimes.com/games/phantom-blade-zero/files/99510-ue4ss-modding-framework-and-loader-for.html ・ https://vgtimes.com/games/phantom-blade-zero/files/99501-pbz-tuner-aio-universalnyjj.html
- Nexus（仅搜索摘要）：mods/5、13、21、99、149、362、412、520、530、802、1009
- 本地：`Z:\SteamLibrary\steamapps\appmanifest_4115450.acf`（buildid 26367565）、`Z:\SteamLibrary\steamapps\common\PBZ\platform\steam\PBZ.exe`（FileVersion CL-302256_JKS-17280）
