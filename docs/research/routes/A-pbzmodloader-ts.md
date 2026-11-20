# 路线 A 论证：PBZModLoader + JS/TS mod（借用游戏自带 PuerTS）

> 辩护人：路线 A。调研日期 2026-11-20。本地游戏 build：`appmanifest_4115450.acf` 中 `buildid=26367565`（已观察）。
> 标注：**【已证实】**＝有源码、README 或本地文件直接支持；**【推断】**＝由已证实的事实推出，还没在游戏里跑过；**【未知】**＝没找到证据。
> 本文没有下载或运行任何工具和压缩包，也没有改动游戏目录。只从 GitHub 拉了 SDK 的类型声明（纯文本 `.d.ts`/`.json`）到会话临时目录，用来 grep。

---

## 一句话主张

红妆鬼斩的彼岸花在游戏里是现成的 Blueprint 子弹 Actor 和 GAS 技能（`BP_Hun_GuiTouBlade_Flower_*`、`GA_Hun_GuiTouBlade_Passive`），而 Boss 阿花的花**直接继承玩家这套类**。所以两个效果都可以在运行时做：改类默认值和实例字段、用 PuerTS `blueprint.mixin` 覆盖 Blueprint 函数、调用现成的子弹生成 API。整个过程不用重打 IoStore，也不碰游戏脚本的校验；同一套做法已有多个开源 PBZModLoader mod 在当前 build 上用过，并且支持 Alt+F5 热重载调试。

---

## 1. 论点列表

### A1. 加载器怎么挂进游戏：proxy DLL，复用游戏自己的 PuerTS 引导【已证实】
- `version.dll` 放在 `platform/steam/PBZ.exe` 旁，进程启动时由 Windows 加载。它用字节特征（不用固定地址）找到 `MainStart`、PuerTS 启动点和日志接口；匹配不唯一就跳过全部 mod，不做任何改动。
  - https://github.com/KintaroModding/phantombladezero_pbzmodloader （README “How the loader hooks into the game”）
  - https://github.com/zoneoflkf/PBZModLoader （README 第 40–41 行“特征扫描与校验”“复用游戏内置脚本环境”）
- mod 是 `ProjectPBZ/PBZModLoader/mods/<id>/main.js`，通过游戏自己的模块系统加载；可以 `require('ue')`、`require('puerts')`、`require('Library/TsHelper')`；导出 `stop()` 后支持 Alt+F5 热重载。来源同上（Kintaro README “API available to mods”“Hot reload”）。
- 两个版本并存：上游 zoneoflkf **v1.0.4**（2026-11-14，启动时自动编译 TS，把 mod 同步到 `Content/JavaScript/PBZModLoader/generated-mods`）；Kintaro fork **v2.1.0**（2026-11-07，脚本嵌在 DLL 里，只加载 JS，不复制文件）。两者都是 GPL-3.0。（`gh api repos/.../releases`）

### A2. 2026-11-04 的脚本校验对本路线影响很小，加载器已经适配，而且我们不用改任何原版脚本【已证实，细节有一处推断】
- 上游 README 0.3.6-preview 一节说，新版游戏增加了“模块字节与执行源码校验”。加载器识别了两个校验函数和五处调用，**只对 `PBZModLoader` 下的引导、管理器、配置和生成的 mod 目录放行**（内容必须和本地文件一致）；“原游戏脚本仍由原校验函数处理”。来源：https://github.com/zoneoflkf/PBZModLoader README 第 73–94 行。
- Kintaro fork 的 FORK.md 说，它在“现有的 validator 调用处”替换引导脚本的字节，2026-11-04 之前的 build 不再支持；2026-11-05 起也兼容已被 UE4SS C++ BYPASS 用 5 字节跳转 hook 过的 validator。来源：https://raw.githubusercontent.com/KintaroModding/phantombladezero_pbzmodloader/release/FORK.md
- 校验是不是 SHA-256：KintaroModding/phantombladezero_cppbypass 的 `src/compatibility.cpp` 用 BCrypt SHA-256 校验 **PBZ.exe 和内存里的函数段**；游戏内嵌的 `ScriptRecord` 表有 64 字节的 `hashes` 字段（`src/policy.hpp`）。**游戏自己的脚本校验算法是不是 SHA-256，我没有找到直接证据**（推断：64 字节字段像 SHA-256 的十六进制串）。pepperdoesthings 的 README 只说“since build 26367565 … checks its scripts byte for byte”。
- 对我们的结论：本路线**不替换任何游戏脚本**。mod 是新增模块，改动发生在运行时（CDO、实例字段、mixin、原型包装），所以不会和校验正面冲突。真正受校验影响的是“用 pak 覆盖游戏 JS”这一类做法（例如 bossphasereset 1.0 原来往 pak 里的 `TsMixinObject.js` 加一行，2.0 因此改用 PBZModLoader，见 A5）。
- 本地 build 正好是加载器标注的测试 build：本机 `buildid=26367565`；Kintaro README 写的是“Tested: Steam build 26367565 (`CL-302256_JKS-17280`)”。

### A3. mod 能拿到完整的 UE 反射 API，包括 GAS、子弹系统和 Lego 技能时间轴【已证实】
- SDK 0.3.3 从 2026-11-04 的 build（CL-302256_JKS-17280）重新采集反射，覆盖 **34,593 个类型**（18,457 个原生、16,136 个资产/Blueprint）、49,386 个函数。来源：https://raw.githubusercontent.com/zoneoflkf/PBZModLoader/HEAD/sdk/README.md
- SDK 的注释写着 “reflection-generated, not individually call-tested”，所以**类型可见不等于调用一定可用**（SDK README 和 pbz-mod-dev SKILL.md 都这么说）。
- 已有 mod 在游戏里实际用过的 API【已证实】：
  - 改类默认值（CDO）：`UE.SGameAIFunctionLibrary.GetClassDefaultObject(cls)`，再写 GE 的 `DurationMagnitude`（phantombladezero_longerbuffs `main.js`）。
  - 拿 ASC、改正在生效的效果：`ASL.GetAbilitySystemComponent(pawn)`、`asc.GetActiveEffects(...)`、`UE.AbilityUtils.ModifyActiveEffectStartTime`、`UE.AbilityUtils.FindAbilityByClass`（longerbuffs）。
  - 遍历敌人的技能和时间轴字段：`GetAllActorsOfClass(PBZCharacter_NPC)` → `ActivatableAbilities.Items` → `Timelines` / `KnownTasks`，直接改 `LGAAction_CheckParry` 等动作对象的字段（phantombladezero_easierparryanddodge README）。
  - 生成 Actor：`UE.GameplayStatics.BeginDeferredActorSpawnFromClass` + `FinishSpawningActor`；施加 GE：`asc.BP_ApplyGameplayEffectToSelf(...)`（kevinbarfleur/phantom-blade-zero-bosses `mod/Sources/inanis.js` 第 55–61 行）。
  - 世界级子系统：`SlomoWorldSubsystem.ApplySlomo`（easierparryanddodge）。

### A4. 能覆盖 Blueprint 函数：PuerTS `blueprint.mixin` 已在 PBZ 上用过【已证实】
- phantombladezero_moredustandmaterials 用 `puerts.blueprint.mixin(puerts.blueprint.tojs(cls), methods, { objectTakeByNative: true, inherit: false, noMixinedWarning: true })` 覆盖了 `BP_Rubbish.TryToAddDust`、`BP_Chest["Pickup Items"]`、`BP_NPCLootComp["Loot Items"]` 这些**带空格的 Blueprint 函数**。它的覆盖实现是照原版字节码一步一步重写的，没有调用原函数。
  源码：https://raw.githubusercontent.com/KintaroModding/phantombladezero_moredustandmaterials/HEAD/src/phantombladezero_moredustandmaterials/main.js
- phantom-blade-zero-bosses 用 `inherit:true` 生成私有子类，先保存 `native.prototype.IsValidInteract`，再在覆盖里 `.call(this, ...)` 调用原实现，所以“调用原函数”可行，但**只在 inherit:true（新子类）的情况下**（`inanis.js` 第 23–33 行）。
- phantombladezero_bossphasereset 用 mixin 覆盖剧情 Blueprint 节点，在 `stop()` 里调 `blueprint.unmixin` 撤销；需要原逻辑时，**从烘焙 Blueprint 的 ubergraph 入口偏移重新执行**，这个偏移跟 changelist 绑定（README）。注意：moredust 的注释说 mixin“cannot be taken off again”，和 bossphasereset 的做法矛盾，**unmixin 是否可靠还没定论**。
- PuerTS 官方文档：Blueprint 里定义的所有函数和事件都能 mixin；C++ 函数只有 `BlueprintNativeEvent` / `BlueprintImplementableEvent` 可以。https://puerts.github.io/en/docs/puerts/unreal/mixin

### A5. 能拿到并 hook 游戏自己的 JS 模块【已证实】
- pepperdoesthings 的 EarnedProgression 直接 `require("../../../Gameplay/RenewalPlayer").RenewalPlayerinXinInterface`、`require("../../../UI/Widget/Foundation/DustTips")`，用 `proto[methodName] = function(...){ ... inner.apply(this,args) ... }` 包装原型方法（`lib/Api.js` 的 `wrap`）。它跑在 Mods Menu 上，用的是同一个 PuerTS VM。
  https://github.com/pepperdoesthings/PBZ-Pepper-Scripts
- 在 PBZModLoader 上：phantombladezero_fourweaponslots 引用 `UI/Widget/Character_V2`、`UI/Widget/Hud/WeaponUI` 等游戏模块，包装了 7 个 UI 类的 22 个方法；bossphasereset 包装 `Gameplay/BossCombatRecorder.js` 的 `start/stop/onBossEngaged/...`（各自 README）。
- 已知游戏 JS 树里有：`MainStart`、`Library/TsHelper`、`Library/UIHelper`、`Gameplay/RenewalPlayer`、`Gameplay/BossCombatRecorder`、`UI/...`、`TsMixinObject.js`。游戏脚本打在加密的 `ProjectPBZ-Windows.pak` 里（Pepper README）。本地确认 `ProjectPBZ/Content/` 下只有 `Paks/`，没有散装的 JavaScript 目录（已观察）。
- cppbypass README 提到 “218 listed `project/` scripts” 和 “241-entry table”。也就是说游戏 JS 大约两百多个模块，**数量不大**（推断：可以全部解包后用 REA 静态分析）。

### A6. 红妆鬼斩的花在反射里清楚可见，而且 Boss 的花继承自玩家的花【已证实（类结构）/ 推断（武器对应关系）】
从 SDK `type-index.json` + `types/generated/blueprints.d.ts`（Kintaro fork release 分支）grep 到的类：
- 武器：`/PBZCombatAsset/ActorData/Players/Hun/Weapon/GuiTouBlade/BP_Weapon_Hun_GuiTouBlade`；技能目录 `/PBZCombatAsset/ActorData/Players/Hun/Abilities/AHuaBlade/`。
  **“GuiTouBlade / AHuaBlade = 红妆鬼斩”是推断**，依据是：阿花 Boss 的武器叫 `BP_Weapon_AHua_GuiTouDao`，且这把玩家武器带花子弹。需要用游戏内文本（DataTable）确认。
- 花本体：`BP_Hun_GuiTouBlade_Flower_Base`（父类 `BP_PBZ_ProjectileEmitter`），子类 `_Small` / `_Big`。成员有 `"Explode Timer"`、`"Explode Bullet Data"`、`"Debuff GE"`、`"Passive Ability"`，函数有 `"Expire Explode"`、`"Get Lifetime"`、`"Trigger Explode"(Transform&, BulletDataBase&)`、`"On Overlap"`、`Received_PostStart/Deactivate`。
- 被动技能 `GA_Hun_GuiTouBlade_Passive`（`SGameLegoAbility`）：`"Current Flowers"`、`"Max Flowers Default"`、`"Max Flowers Can Manual Explode"`、`"Current Tick Explode Flowers"`、`"Current Tick Explode Timer"`、`"Register Flower"`、`"Trigger Flowers"`、`"Process Explosion"`、`"Process Current Tick Explode"`、`"Flower Self Explode"`、`"Remove Flowers"`。
- **Boss 侧**：`BP_AHua_Flower_Big/Small extends BP_Hun_GuiTouBlade_Flower_Base`，**只重写了 `"Get Lifetime"`**；`GA_AHua_GuiTouBlade_Passive extends GA_Hun_GuiTouBlade_Passive`，**没有新增任何成员**。由此推断：Boss 花“持续存在、定时爆”的差别主要在 Lifetime、类默认值，以及 Boss 自己的技能（`GA_AHua_Skill_05 / Special_03_B_Flower` 有 `SpawnFlowers(...)`），**不在新的代码结构里**。这对“运行时改数据 + 小范围 mixin”非常有利。
- 爆炸：`PBZ_GuiTouBlade_FlowerExplodeBulletData`、`PBZ_OverlapBullet_GuiTouBlade_Explosion`、`GE_Hun_GuiTouBlade_Explode(_Big)`、`GE_Weapon_GuiTouBlade_CanManualExplode`。
- 白花候选：`UpgradeData/BP_GuiTouBlade_Flower_Homing`（玩家）；Boss 有 `BP_Bullet_AHua_WhtieFlower(_Fast/_Slow)`、`GA_AHua_Homing_Flower`。**F 蓄力具体对应哪个 GA（`GA_Hun_GuiTouBlade_B_Hold*` / `_C` / 其他），未知。**
- 子弹系统原生 API【已证实存在，未在 PBZ 上调用测试】：`BulletDataBase.CreateBullet(Transform, WorldContext)`；`BulletSpawnBurst.SpawnBullets(OwnerAvatar, SourceAbility, ParentBullet, BulletData, Origin, out[])`；`BulletSpawnBurstTransform_LocationAndRotation.CountRange: Vector2D`；`LGAAction_BulletBurstBase { BulletData, SpawnBurst }`；`LegoAbility.Timelines[] → LGATimeline.Actions[] (LGAActionEvent.Action)`（`SGameCombatSystem.d.ts`、`LegoAbility.d.ts`）。

### A7. 战斗逻辑主要在 Blueprint/GAS，不在 JS 层【已证实（就花而言）】，这一点要诚实说
- 上面这些花和技能类都带 `UberGraphFrame`，是 Blueprint 字节码逻辑；资产在 `/PBZCombatAsset/`（`Players/Hun` 下有 2217 个类型）。目前没有看到“武器技能、Buff、杀气由游戏 JS 驱动”的证据。游戏 JS 已知的部分偏 UI、存档、复活、Boss 记录，以及启动时的 mixin（`MainStart.js` / `TsMixinObject.js`，见 fourweaponslots README）。
- 所以本路线改战斗**靠的不是“改游戏 JS”**，而是“从 JS 操作 UE 反射对象 + mixin Blueprint 函数”。这一点和 UE4SS 路线能力重叠（UE4SS 也能 RegisterHook BP 函数、改 CDO）。A 的差异化优势见 A8。

### A8. 相对另外两条路线的差异化优势【已证实/推断，逐项标注】
- **迭代速度**：Alt+F5 热重载，不用重启游戏【已证实，见 README】。改战斗手感时这是最大的效率差别；pak 路线每次都要重打包、重启。
- **不重打 IoStore、不碰 AES/签名、不覆盖游戏文件**：mod 只是 `mods/` 下的 JS 文本【已证实】。pak 路线在 11-04 之后，凡是“覆盖脚本”的 pak 都需要 bypass（cppbypass README）；纯资产 pak 是否受影响不在本文范围。
- **版本适配快**：11-04 游戏更新当天加载器失效，上游 v1.0.0 和 Kintaro v2.0.0 都在 **2026-11-05** 发布【已证实，release 时间】。
- **同一 build 上已有多个可抄作业的开源 mod**（MIT）：longerbuffs（GE/CDO）、easierparryanddodge（LGA 时间轴字段）、moredust（BP mixin）、bosses（生成 Actor、施加 GE）、fourweaponslots / bossphasereset（游戏 JS 原型包装）【已证实】。
- **带离线测试的工程化先例**：Kintaro 的每个 mod 都有 `tests/test_mod.js`，用 Node 替身跑（30–57 个检查）；上游提供 TS 模板、`npm run check` 和完整类型【已证实】。

---

## 2. 两个效果的实现草图

> 共同前提：先用 FModel（+ AES key + Kintaro 的 usmap，https://github.com/KintaroModding/phantombladezero_pbzusmap ）**只读**查看下面这些 Blueprint 的字节码和默认值，把结果记到 `docs/game-notes/`。本路线**不需要重打包**，但**要读懂 Blueprint 逻辑**，这一步和另外两条路线一样省不掉。

### 效果 1：普攻铺开的花持续存在、每隔几秒自动爆炸（持续削杀气）

**要先在解包内容里确认的事：**
1. 哪个 GA 生成普攻的花（`GA_Hun_GuiTouBlade_B_Hold` 有 `"Small Flower": BulletDataBase` 和 `"Flower Walk Tick"`，是候选；也可能在 A 系列的 LGA 时间轴里）。
2. `BP_Hun_GuiTouBlade_Flower_Base` 的 `"Get Lifetime"`、`"Expire Explode"`、`Received_PostStart` 字节码：到期后是“爆一次再 Deactivate”，还是直接消失。`"Trigger Explode"` 本身会不会 Deactivate。
3. Boss 版的 `BP_AHua_Flower_*."Get Lifetime"` 返回多少；阿花战里周期性爆炸由谁驱动（`GA_AHua_GuiTouBlade_Passive` 的默认值？`"Current Tick Explode Timer"`？还是 Boss 技能）。
4. 爆炸附带哪个 GE 削减杀气（`GE_Hun_GuiTouBlade_Explode` / `Debuff_Tick`），以及 Boss 和玩家用的 GE 有没有区别。

**方案（按侵入程度从低到高，能停在前面就停）：**
- **1a 纯数据**：如果 Boss 的行为只是不同的默认值，就在 `stop()` 能还原的前提下，把被动 GA 的 CDO 和已授予实例的字段（`"Max Flowers Default"` 等）、花 CDO 的相关字段改成 Boss 的值。写法同 longerbuffs / easierparryanddodge。
- **1b 小 mixin + JS 定时器**（主方案）：

```js
// mods/hongzhuang-guizhan-plus/main.js —— 草图，未运行
const UE = require("ue"), puerts = require("puerts");
const H = "/PBZCombatAsset/ActorData/Players/Hun/";
const FLOWER = H + "Weapon/GuiTouBlade/FlowerBullet/BP_Hun_GuiTouBlade_Flower_Base.BP_Hun_GuiTouBlade_Flower_Base_C";
const S = (globalThis.__hzgzPlus ??= { on: true, periodMs: 3000, stockLifetime: undefined, mixed: false, timer: 0 });

const flowerCls = UE.Class.Load(FLOWER);
if (S.stockLifetime === undefined) {                // mixin 之前先从 CDO 记下原值（假设 Get Lifetime 只依赖默认值，待验证）
  S.stockLifetime = UE.SGameAIFunctionLibrary.GetClassDefaultObject(flowerCls)["Get Lifetime"]();
}
if (!S.mixed) {                                     // 只覆盖父类的 Get Lifetime；Boss 子类自己重写了它，不受影响
  class FlowerMixin { ["Get Lifetime"]() { return S.on ? 1e5 : S.stockLifetime; } }
  puerts.blueprint.mixin(puerts.blueprint.tojs(flowerCls), FlowerMixin,
    { inherit: false, objectTakeByNative: true, noMixinedWarning: true });
  S.mixed = true;                                   // 参照 moredust：mixin 可能撤不掉，所以用开关退回原值
}

function pulse() {
  if (!S.on) return;
  const gi = puerts.argv.getByName("GameInstance");
  const pawn = UE.GameplayStatics.GetPlayerCharacter(gi, 0);
  const out = puerts.$ref(UE.NewArray(UE.Actor));
  UE.GameplayStatics.GetAllActorsOfClass(gi, flowerCls, out);
  const arr = puerts.$unref(out);
  for (let i = 0; i < arr.Num(); i++) {
    const f = arr.Get(i);
    if (!f || f.GetOwner() !== pawn) continue;      // 只处理玩家的花（Boss 花同属此类，必须过滤；判断字段待确认）
    f["Trigger Explode"](puerts.$ref(f.GetTransform()), puerts.$ref(f["Explode Bullet Data"]));
  }
}
S.timer = setInterval(pulse, S.periodMs);
exports.stop = () => { clearInterval(S.timer); S.on = false; };   // 下一次加载再把 on 置回 true
```

- 如果 `"Trigger Explode"` 内部会 Deactivate，就改用被动 GA 的 `"Process Explosion"`（传入花数组），或者直接 `Explode Bullet Data` + `BulletSpawnBurst.SpawnBullets(owner, sourceAbility, parent, data, origin, out)` 自己生成爆炸子弹，这样 owner 和 source ability 正确，伤害归属不会出错。
- 如果 Lifetime 由 `BP_PBZ_ProjectileEmitter` 的 `"Lifetime Timer"` / `"On Lifetimer Timer"` 驱动，就改为 mixin `"Expire Explode"`：爆一次，然后重新设置定时器，而不是 Deactivate。

### 效果 2：F 蓄力的白花从 1 朵变 5 朵

**要先确认的事：**
1. F 蓄力对应哪个 GA（候选：`GA_Hun_GuiTouBlade_B_Hold` / `_B_Hold_Start` / `_C`，或者升级技能 `GA_Weapon_GuiTouBlade_Evolution_*`）。
2. 白花是哪个子弹（候选：`BP_GuiTouBlade_Flower_Homing`），由哪个 LGA 动作发出：如果是 `LGAAction_BulletBurstBase` 的子类，就看它的 `SpawnBurst.TransformGenerator` 类型和 `CountRange`。
3. 白花有没有“全局只允许 1 朵”的检查（被动 GA 的 `"Current Big Flower"` 是单值，`GE_Hun_GuiTouBlade_HasBuff_*` 之类的标签互斥），有的话还要处理。

**方案：**
- **2a 改时间轴数据（首选，最贴近原生）**：

```js
// 草图：在玩家 ASC 的已授予技能里找到 F 蓄力 GA，改它时间轴上发白花动作的 CountRange
function patchWhiteFlowerCount(n) {
  const gi = puerts.argv.getByName("GameInstance");
  const pawn = UE.GameplayStatics.GetPlayerCharacter(gi, 0);
  const asc = UE.AbilitySystemBlueprintLibrary.GetAbilitySystemComponent(pawn);
  const items = asc.ActivatableAbilities.Items;                 // easierparryanddodge 用过同一路径
  for (let i = 0; i < items.Num(); i++) {
    const ga = items.Get(i).Ability;                            // 还要处理 instanced 实例（待确认）
    if (!ga || !isFChargeGA(ga)) continue;
    const tls = ga.Timelines;
    for (let t = 0; t < tls.Num(); t++) {
      const acts = tls.Get(t).Actions;
      for (let a = 0; a < acts.Num(); a++) {
        const act = acts.Get(a).Action;
        if (!act || !act.BulletData || !isWhiteFlower(act.BulletData)) continue;
        const gen = act.SpawnBurst && act.SpawnBurst.TransformGenerator;   // 期望是 LocationAndRotation
        if (gen && gen.CountRange) { remember(gen); gen.CountRange = new UE.Vector2D(n, n); }
        // 位置分布可以顺手改成 BulletSpawnBurstLocation_Circle（Radius/EvenRadialSpacing）
      }
    }
  }
}
```

- **2b 生成后补 4 朵**（2a 走不通时用）：轮询或 mixin 白花类的 `Received_PostStart`（用 inherit:false 就得重写原逻辑，所以优先轮询 `GetAllActorsOfClass` 发现新白花）；每发现一朵原版白花，就用它的 `BulletData` 和 `SourceAbility` 调 `BulletSpawnBurst.SpawnBullets(...)`，或 `BulletDataBase.CreateBullet(transform, ctx)`，在周围再生成 4 朵；给补出来的花打一个 `AddBulletTag` 标签，免得递归。
- **2c 换成 Boss 的生成函数**：Boss 的 `GA_AHua_Skill_05` / `GA_AHua_Special_03_B_Flower` 有 `SpawnFlowers(BaseLocation, Forward, Right, Distance, RandomRadius)`，可以看它的字节码来学分布方式。直接在玩家身上调用 Boss 的 GA 风险高（目标阵营、伤害归属），只作参考。

---

## 3. 上手成本

| 项 | 内容 |
|---|---|
| 玩家侧需要安装 | 只要加载器：Kintaro 2.1.0 是 3 个文件（`platform/steam/version.dll`、`ProjectPBZ/Content/JavaScript/PBZModLoader/bootstrap.js`、`ProjectPBZ/PBZModLoader/LICENSES.txt`），再加上我们的 `mods/<id>/` 文件夹。上游 1.0.4 有一键安装器。**都要改游戏目录，按 AGENTS.md 先征得同意、做备份、写 install-log。** |
| 开发侧 | Node.js（`node --check` / 离线测试）；TS 可选（上游模板 0.2.0 + SDK 0.3.3；Kintaro fork 只认 JS，TS 要自己编译）；FModel + AES key + usmap 用来只读查看 Blueprint（任何路线都要）。不需要 C++、UE 编辑器或打包工具。 |
| 学习曲线 | 中等。需要熟悉：PuerTS 的 `$ref/$unref`、UE 容器 `Num()/Get()`、Blueprint 带空格函数名的写法、CDO 和实例的区别、GAS（ASC / GE / GA）、本游戏的 Lego 时间轴和子弹系统。好在有 4–6 个同 build 的开源 mod 可以对照，SDK 有完整的类型补全，还有现成的 agent skill（上游 `templates/skills/pbz-mod-dev`）。 |
| 调试 | `console.log("[PBZMOD] ...")` 会写进 `ProjectPBZ/PBZModLoader/loader.log`；Alt+F5 热重载，前提是 `stop()` 写得干净。 |

## 4. 游戏更新后的维护成本

- **加载器层**：靠字节特征定位，大版本更新可能失效（11-04 已经发生过一次）。上次修复周期约 1 天（11-04 更新 → 11-05 发版）【已证实】。我们自己不维护这一层，等社区更新即可；风险是两个分支都停更（GPL 源码在，最坏情况可以自己重建）。
- **mod 层**：依赖的是资产路径（`/PBZCombatAsset/...`）、Blueprint 成员名（`"Trigger Explode"`、`"Max Flowers Default"`）、时间轴结构。命名函数和成员一般比较稳定；**带 GUID 后缀的事件**（如 `EventReceived_31B3...`）和**ubergraph 入口偏移**（bossphasereset 的做法）每个 build 都可能变，所以我们刻意不依赖它们。建议照 Kintaro 的做法：启动时检查 `KismetSystemLibrary.GetEngineVersion()` 或 changelist，找不到成员就记日志并跳过，不崩溃。
- **不用重新打包**：游戏更新只要重新跑一遍 FModel 核对；SDK 可以用 `scripts/reflection_export.py` 重新采集（Kintaro fork 写明这一点“untested on this layout”）。
- **校验风险**：如果以后官方把校验扩展到“未登记模块一律拒绝”，加载器就要再适配。这是本路线最大的外部依赖【推断】。

## 5. 开源发布的友好程度

- 加载器 GPL-3.0；**mod 是运行时加载的独立 JS**，社区同类 mod 都用 MIT 发布（Kintaro 的 PBZModLoader mod 全是 MIT）【已证实】。我们的仓库只放自己写的 JS/TS，不含任何游戏资产，符合 AGENTS.md 第 3 条。
- 发布产物就是一个文件夹（`main.js` + 设置文件），README 写清依赖的加载器版本和测试 build 即可；可以直接放到 GitHub Release，也能被 UE MM 之类的管理器识别（Kintaro README 提到 `docs/MOD-MANAGER.md`）。
- 注意：SDK 的 `.d.ts` 是从游戏反射生成的，模板会把它放进 `vendor/`。**我们不把 vendor SDK 提交进 MIT 仓库**，开发时作为 devDependency 或 gitignore 处理。生成物的版权和许可边界【未知】。
- 用户安装门槛低（不需要 Node，不用重打 pak），卸载就是删文件夹，可以说清楚、可回滚。

---

## 6. 证据缺口（诚实列出）

1. **F 蓄力对应哪个 GA、白花是哪个类**【未知】：只有候选名，要解包确认。效果 2 能不能用 2a“改 CountRange”实现，全看实际资产是不是 `LGAAction_BulletBurstBase` + `LocationAndRotation`。
2. **“红妆鬼斩 = GuiTouBlade / AHuaBlade”**【推断】：依据是命名和阿花的关联，还没核对游戏内文本。
3. **Boss 花“定时爆、不消失”的真实机制**【未知】：只知道 Boss 花类只重写了 `"Get Lifetime"`，Boss 被动 GA 没有新增成员。周期爆炸由谁驱动，要看字节码。
4. **`"Trigger Explode"` / `CreateBullet` / `SpawnBullets` 在 PBZ 上从 JS 调用是否可行**【未知】：SDK 明确标注 “not individually call-tested”。没找到任何 PBZ mod 用 JS 生成过子弹（GitHub 代码搜 `CreateBullet` 在 PBZ 仓库里 0 次实际使用）。
5. **mixin 能不能撤销 / 能不能调用原实现**【证据矛盾】：moredust 说撤不掉，bossphasereset 用 `blueprint.unmixin`；inherit:false 时调用原函数只有“ubergraph 入口偏移”这一种脆弱做法。所以草图里只 mixin 一个简单的 getter，并用开关退回原值。
6. **游戏脚本校验是不是 SHA-256**【未证实】：只证实了 cppbypass 用 SHA-256 校验 exe 和函数段，游戏表里有 64 字节 hash 字段。这一点对本路线影响很小，因为我们不改原版脚本。
7. **游戏 JS 里有没有战斗相关逻辑**【未知】：已知模块偏 UI、存档、Boss 记录。没有解包，无法排除个别 GA 有 TS mixin（`TsMixinObject.js` 存在）。如果有，路线 A 反而更直接，但目前不能拿来当论据。
8. **两个加载器分支怎么选**：上游 1.0.4 和 Kintaro 2.1.0 行为不同（TS 自动编译、文件复制、热重载实现）。Kintaro 的示例 mod 都基于 2.1.0。没有找到两者长期维护承诺的证据。
9. **单机安全性**：bosses mod 会断网并提到成就保护，说明社区对“联网 / 成就”有顾虑。官方对 mod 的态度和反作弊情况【未知】（AGENTS.md 已限定只做单机）。

---

## 来源汇总
- https://github.com/KintaroModding/phantombladezero_pbzmodloader （README、FORK.md、releases、sdk/、scripts/REFLECTION.md）
- https://github.com/zoneoflkf/PBZModLoader （README 中英、runtime/.../manager.js、sdk/README.md、templates/skills/pbz-mod-dev/）
- https://github.com/KintaroModding/phantombladezero_longerbuffs ，`src/phantombladezero_longerbuffs/main.js`
- https://github.com/KintaroModding/phantombladezero_easierparryanddodge
- https://github.com/KintaroModding/phantombladezero_moredustandmaterials ，`src/.../main.js`
- https://github.com/KintaroModding/phantombladezero_fourweaponslots
- https://github.com/KintaroModding/phantombladezero_bossphasereset
- https://github.com/KintaroModding/phantombladezero_cppbypass （README、`src/compatibility.cpp`、`src/policy.hpp`）
- https://github.com/KintaroModding/phantombladezero_pbzusmap
- https://github.com/kevinbarfleur/phantom-blade-zero-bosses ，`mod/Sources/inanis.js`
- https://github.com/pepperdoesthings/PBZ-Pepper-Scripts ，`EarnedProgression/.../EarnedProgression.js`、`lib/Api.js`
- https://puerts.github.io/en/docs/puerts/unreal/mixin
- 本地（只读）：`Z:\SteamLibrary\steamapps\appmanifest_4115450.acf`（buildid 26367565）、`Z:\SteamLibrary\steamapps\common\PBZ\ProjectPBZ\Content\`（只有 `Paks\`，共 97 个文件）、`platform\steam\`（PBZ.exe 498,913,272 字节，2026-11-04）
