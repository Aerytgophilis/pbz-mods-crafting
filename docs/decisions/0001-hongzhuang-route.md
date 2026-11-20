# ADR-0001：红妆鬼斩增强 mod 的技术路线

- 状态：**暂定**（待第 0 步核实后转为“已接受”或重议）
- 日期：2026-11-20
- 依据：`docs/research/routes/` 下 A、B、C 三份辩护，D 主持人反驳；Fable advisor 意见；Opus 对抗审计（见文末）
- 游戏版本：Steam build 26367565（CL-302256_JKS-17280）

## 背景

两个目标效果：
1. 普攻铺开的彼岸花像 Boss 阿花战时一样，每隔几秒自动爆炸、爆后不消失，持续削杀气。
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
   3. 如果 FModel 看不懂 ubergraph 字节码，再评估 UAssetGUI；不提前装。
2. **主路线：A（PBZModLoader + JS），B 为同等候选**。选 A 的理由：Alt+F5 热重载；同 build 有多个开源先例；不分发游戏资产。B（UE4SS）同样能改写 BP 函数返回值，在效果 1 上的差距**要实测**；如果 A 的关键调用不可用，转 B。
3. **效果 1 必须同时处理花的上限**：常驻的花会撞上 `Max Flowers Default`，被 `Remove Flowers` 移除。定时爆用游戏时间，不用真实时间的 `setInterval`。
4. **效果 2**：先试运行时改时间轴 `CountRange`；如果运行时修改无效、而数量是纯资产数据，局部退到 C（C 的 `-UserDir` 方案可以不碰游戏目录）。
5. **AES key 的来源待定**：AESDumpster 没有许可证、二进制未经审计，网页版要上传 exe，不能用。优先用社区公开且可核对的 key；没有的话，运行 AESDumpster 前单独征得用户同意。

## 后果

- 需要往游戏目录装 PBZModLoader（`version.dll` 代理 + 引导脚本）。这属于 AGENTS.md 规则 1 和 §8.4 的关键节点：要用户同意、先备份、记 install-log、先咨询 advisor。
- 加载器靠字节特征 hook 游戏的脚本校验函数，游戏更新可能让它失效（11-04 已发生过一次，社区约 1 天修复；仅此一个样本）。
- 改动前备份存档（Steam 云同步也要考虑），见 AGENTS.md 规则 8。
- 未调查：反作弊、成就、Steam“验证文件完整性”对 mod 文件的影响。第一次安装前查清。
- 加载器是 GPL-3.0；我们的 mod 独立运行时加载，用 MIT 发布。SDK 生成的 `.d.ts` 不提交。

## 审计记录

- Fable advisor：Lifetime 只解释“不消失”，不解释“定时爆”，因此本 ADR 定为暂定，并点名决定性问题。
- Opus 对抗审计：UE4SS 也能改写 BP 函数返回值（B 不是明显劣势）；花的数量上限与“不消失”冲突；A 草图的热重载和计时 bug；存档备份、反作弊和 Steam 文件校验未调查。详见 `docs/research/routes/D-rebuttal-draft.md` §3.5。

## 重议条件

- 第 0 步结论为情况 2 或情况 3。
- PBZModLoader 两个分支都停更，且游戏更新使其失效。
