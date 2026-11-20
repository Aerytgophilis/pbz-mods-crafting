# 主持人反驳与初步裁决（已经 Fable advisor 与 Opus 对抗审计修订；正式结论见 docs/decisions/0001）

日期：2026-11-20。依据：A-pbzmodloader-ts.md、B-ue4ss.md、C-pak-replace.md。

## 0. 三方都没有吵、但最关键的一条事实

路线 A 从 SDK 反射查到：Boss 阿花的 `BP_AHua_Flower_Big/Small` **继承**玩家的 `BP_Hun_GuiTouBlade_Flower_Base`，**只重写了 `"Get Lifetime"`**；Boss 被动 `GA_AHua_GuiTouBlade_Passive` 继承玩家的 `GA_Hun_GuiTouBlade_Passive`，**没有新增成员**。玩家被动里已经有 `"Current Tick Explode Timer"`、`"Process Current Tick Explode"`、`"Flower Self Explode"`、`"Max Flowers Default"`。

含义：Boss 花“不消失、定时爆”的差别，很可能就在一个 **Blueprint 函数的返回值**（Get Lifetime）加上一些默认值。这条事实与路线无关，但它决定了哪条路线最顺手：**能覆盖 BP 函数返回值的路线占优**。

另外，英文名确认为 **Scarlet Wraithblade**（B、C 独立得出），内部代号候选 `GuiTouBlade` / `AHuaBlade`（A），渲染图文件名 `t_weapon_hongzhuangguizhan`（C）。三者需要用 DataTable 统一核实。

## 1. 对路线 A（PBZModLoader）的反驳

| A 的论点 | 反驳 | 结论 |
|---|---|---|
| A2：脚本校验影响小 | 加载器本身就是 `version.dll` 代理 + 按字节特征 hook 校验函数，本质上和 cppbypass 是同一类依赖；11-04 已经失效过一次。"我们不改原版脚本"成立，但"不依赖绕过"不成立。而且 `version.dll` 必须写进游戏目录（C 的 `-UserDir` 方案可以完全不碰游戏目录）。 | 风险真实；"约 1 天修复"只有 11-04 一个样本 |
| A4：mixin 可覆盖 BP 函数 | `inherit:false` 时调不到原实现，`unmixin` 是否可靠有矛盾证据。只适合覆盖**简单的纯函数**（如 Get Lifetime）。复杂函数要照字节码重写，脆弱。 | 对效果 1 恰好够用 |
| A6：子弹 API 可调用 | `CreateBullet` / `SpawnBullets` / `"Trigger Explode"` 从 JS 调用**零先例**，SDK 自称"未逐个调用测试"。 | 效果 1 的"定时爆"若依赖这些调用，风险高；优先找数据/返回值层面的解法 |
| A8：热重载、不打包 | 成立，且是三条路线里唯一能快速调手感的。 | 实打实的优势 |
| 许可 | 加载器 GPL-3.0，但 mod 独立运行时加载，社区 mod 都是 MIT。 | 无冲突 |

## 2. 对路线 B（UE4SS）的反驳

| B 的论点 | 反驳 | 结论 |
|---|---|---|
| B17：dump/usmap 是公共基础设施，所以先装 UE4SS | Kintaro 已发布 PBZ 的 usmap（phantombladezero_pbzusmap）和 SDK 反射导出（34,593 个类型）。读资产**不需要**先装 UE4SS。 | 论据不成立 |
| B14：Live View 便于探索 | 成立，是 B 的独有优势，但属于"调试工具"而不是"实现路线"。 | 作为可选探索工具 |
| 效果 1 方案 1B："伪爆炸"（自己施加 GE + 放特效） | 这是重写游戏逻辑：伤害归属、杀气计算、特效与原版不一致。~~BP 函数 hook 只有执行后回调，难以改 Get Lifetime 的返回值~~ **【审计更正】** UE4SS 文档写明回调的返回值会覆盖原返回值，BP 函数也有 post-hook，所以 B 同样可能改写 Get Lifetime。 | 方案 1B 不如改返回值；B 与 A 在效果 1 上的差距**要实测**，不能断言 A 占优 |
| 效果 2 方案 2B：时间轴注入（ChiRenBlade 先例） | 先例扎实，但 A 同样能改时间轴上的 CountRange 字段（easierparryanddodge 先例）。 | 打平 |
| 迭代 | Ctrl+R 会崩，基本要重启游戏。 | 劣势 |

## 3. 对路线 C（Pak 替换）的反驳

| C 的论点 | 反驳 | 结论 |
|---|---|---|
| C1/C2：纯资产 pak 不需要绕过 | 有 cringe-blade-zero 的反例（`~mods` 不自动挂载），要先实测。 | 可能成立 |
| C5：子弹字段（BulletNum 等）覆盖两个目标 | exe 里有字段名，不代表红妆鬼斩的花用到了它们。Boss 差异在 **BP 函数重写**（Get Lifetime），纯数据改不了 BP 字节码。 | 效果 1 大概率做不到；效果 2 若是 CountRange 等数据，则可以 |
| C9：配方化开源 | 成立但要自建"读本机资产 → 改字段 → retoc 打包"的流水线，对爱好项目偏重。 | 有过度工程风险 |
| 迭代 | 每次改动都要重打包、重启游戏。 | 劣势 |

## 3.5 三方都漏掉的问题（Opus 审计补充）

- **花的上限**：花常驻后会撞上 `Max Flowers Default`，旧花会被 `Remove Flowers` 移除，和"不消失"直接冲突。上限要一起改，或者接受"最多 N 朵常驻"。
- **A 草图的 bug**：`globalThis.__hzgzPlus ??= {...}` 会把 `on=false` 带过热重载，Alt+F5 之后 mod 失效；`setInterval` 按真实时间计时，暂停、慢动作、读图时也会触发。实现时改用游戏时间（GameplayStatics 的世界时间或游戏内 Timer）。
- **存档安全**：所有路线都可能损坏存档；存档还有 Steam 云同步。要有存档备份规则。
- **未调查**：反作弊、成就、Steam"验证文件完整性"会不会删掉 mod 文件（B 的说法只来自搜索摘要）。
- **前提未核实**："Boss 战里花定时爆、不消失"只来自用户的记忆，第 0 步先找一段阿花战录像确认。

## 4. 初步裁决

1. **第 0 步（与路线无关，必须先做）**：FModel + AES key + Kintaro usmap，只读查看 `BP_Hun_GuiTouBlade_Flower_Base`、`BP_AHua_Flower_*`、`GA_Hun_GuiTouBlade_Passive`、F 蓄力 GA 的字节码和默认值；用 DataTable 确认武器内部代号。**不装任何 mod 框架。** 结论写进 `docs/game-notes/`。
2. **主路线：A（PBZModLoader + JS）**。理由：效果 1 的核心很可能是覆盖 Get Lifetime 的返回值，A 用 mixin 原生支持；热重载；同 build 有多个开源先例；不分发游戏资产。
3. **效果 2** 先尝试 A 的"运行时改时间轴 CountRange"；如果第 0 步发现白花数量是纯资产数据且运行时修改无效，才局部退到 C。
4. **B 不作为实现路线**；只有第 0 步读字节码不够用、必须在运行时观察对象时，才装 UE4SS 用 Live View（需单独批准）。
5. 停止条件：如果第 0 步发现关键逻辑在 native C++（不可 hook 的函数）里，三条路线都要重估。
