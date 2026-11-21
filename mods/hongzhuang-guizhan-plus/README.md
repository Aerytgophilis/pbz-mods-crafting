# 红妆鬼斩增强（hongzhuang-guizhan-plus）

武器：红妆鬼斩（Scarlet Wraithblade，内部名 `GuiTouBlade`）。技术路线见 `docs/decisions/0001-hongzhuang-route.md`。
资产依据：`docs/game-notes/scarlet-wraithblade-flowers-assets.md`（build 26367565）。

## 原版行为（第 0 步解包核实）

- 重击连段、冲刺/拔刀/闪避反击类重击、第 4 段轻攻击 `AAAA` 都会铺**一圈 6～14 朵小花**；部分终结技另铺 1 朵大花。
- 敌人站在花里：减速，每 0.3 s 掉一次杀气（`Debuff_Tick`）。玩家站在花里：获得 `GE_Hun_GuiTouBlade_InFlower`（铸魂“此恨绵绵”：杀气消耗降低、受治疗增加）。
- 花存在 3 s（Lv5 起 15 s），到期爆炸一次后消失。花的爆炸本身**没有杀气伤害项**。
- Lv5 起可以按 **E** 引爆全部花，花爆炸后消失；E 原版冷却 0.4 s。
- 同时存在的花上限：Lv5 前 6 朵，Lv5 起 25 朵。超上限时**最旧的花立即爆炸并消失**（玩家看到的“旧花被新花覆盖”就是这个）。
- Lv25 火照黄泉：处于“杀气强化”状态时按住重击，放出 1 朵白花追踪敌人，命中爆炸，结束时留下 1 朵大花。

## 目标行为（设计规格 v3.1，2026-11-20，用户已确认）

> v3 相对 v2 的改动（用户在协调会话里确认）：删掉“前期等级补偿”；前期（Lv5 前，花只存在 3 s）也会自动爆炸，杀气系数再打折；自动爆炸的杀气系数减半；白花及其大花的爆炸伤害保持原版；新增待定项“花丛内攻击吸血”（先调查）。

### 效果 1：场地彼岸花

| 项 | 原版 | 本 mod |
|---|---|---|
| 存在时间 | 3 s / 15 s（Lv5+） | **不变** |
| 自动周期爆炸 | 无 | Lv5 起每 **4 s** 爆炸一次，**花不消失**；Lv5 前（花只存在 3 s）每 **1.5 s** 爆炸一次，保证到期前至少爆一次 |
| 自动爆炸的杀气削减 | 花爆炸没有杀气伤害 | **增加杀气伤害**，取 Boss 阿花花爆炸系数的一半：小花 **0.25**、大花 **0.5**；Lv5 前再乘 **0.5**。默认 `tickCantBreak`：杀气只削到 0.1、不破防（见设置一节） |
| 自动爆炸的血量伤害 | — | 正常爆炸的 **40%**（只对自动爆炸打折；E 引爆、到期爆炸、白花及其留下的大花都保持原版）。**实现（2026-11-21 实测后定）**：原版一次爆炸 = 直击（约 150）+ 爆炸后的灼烧（`GE_Hun_GuiTouBlade_Explode`，67.4 + 91 + 91），合计约 399。自动爆炸只保留灼烧的第一跳（与直击同帧），随后移除灼烧；直击 ×(`tickDamageScale` − 0.169) ÷ 0.375，总量是原版的 `tickDamageScale` 倍（盛放：直击 ×0.616 ≈ 92 + 首跳 67 ≈ 160） |
| 到期 | 爆炸一次并消失 | **不变** |
| 按 E 引爆 | 全部爆炸，花消失，冷却 0.4 s | 全部爆炸，**花不消失**，冷却 **5 s** |
| 超上限 | 最旧的花爆炸并消失 | **不变**（原版行为） |
| 花数量上限 | 6 / 25 | **不变** |

### 可选档位（规格 v3.1，2026-11-20 用户确认）

| 项 | 档位 | 默认 | 说明 |
|---|---|---|---|
| 花丛面积 | 不增大 / +25% / +40% / +80% / +200% | **+25%** | **按面积计算**，同时作用于 **A 每朵花的大小**（花的判定范围、爆炸半径、特效）和 **B 一圈花的铺开半径**。两者的半径都乘 √(1+p)，所以整片花丛覆盖的地面正好是原来的 (1+p) 倍。例如 +25% 时半径 ×1.118，+200% 时半径 ×1.732 |
| 花的存在时间（Lv5 起） | 15 s / 25 s / 60 s | **15 s**（原版） | 改的是花自己的寿命；阿花 Boss 的花有自己的寿命，不受影响。数量上限仍是 25 朵，超出时最旧的先被淘汰，所以 60 s 档在密集铺花时多半活不满 |

### 设置方案（规格 v3.3，2026-11-20 用户采纳双路评审的合并方案）

依据：`docs/design/2026-11-20-settings-ui-review.md`（Opus + Gemini Neon 双路评审）。

**预设**（`preset`，默认“盛放”）：

| | 含苞（接近原版，★） | **盛放（默认，★★）** | 花海（爽快，★★★） |
|---|---|---|---|
| 花丛面积 | 0 | +25% | +80% |
| 存在时间 | 15 s | 15 s | 25 s |
| 自动爆炸间隔 | 6 s | 4 s | 3 s |
| 自动爆炸伤害倍率 | 0.25 | 0.4 | 0.5 |
| 生生不息 | 关 | 开 | 开 |
| 彼岸·极 | 关 | 开 | 开 |

自动爆炸音量独立于预设（默认 25%）。+200% 面积和 60 s 寿命不进任何预设，只能手动选（README 标“高强度”）。

**玩家可见项**（`config.json` 上半部分）：`enabled`（总开关）、`preset`、`flowerAreaScale`、`flowerLifetime`、`tickVolume`、`lingerEnabled`、`ultraEnabled`。
**高级项**（`config.json` 下半部分）：`tickInterval`、`tickDamageScale`、`manualCooldown`、`manualKeepsFlower`、`tickShake`、`extraWhiteFlowersLv25`、`extraWhiteFlowersLv30`、`whiteFlowerTargeting`、`lingerMaxLv15/Lv20`、`lingerSafetyCap`、`ultraAfterTicks`、`tickCantBreak`、`ultraCantBreak`、`areaSpreadRings`、`debugLog`（效果 2 的三项在 v0.1.0 里还不生效）。
**预设与单项共存**：`preset` 决定基础值，`config.json` 里写了的单项覆盖预设值；加载时在 `loader.log` 打印“盛放 + 自定义 N 项（列出项名）”。
**写死的常量**（实测后定，不暴露）：`tickCoalesce`、`tickIntervalEarly`、`earlyShachiScale`、`tickShachiSmall/Big`、`ultimateTickFactor`。

**护栏**：
- 加载时把数值钳在合法范围内（例如间隔 ≥ 1.5 s、伤害倍率 ≤ 1.0），超出时写日志。
- 面积 ≥ +80% 且寿命 ≥ 25 s 时在日志里警告。
- 同一帧的自动爆炸特效、音效数量设上限。
- **`lingerSafetyCap` = 120 s**：每朵花的安全寿命上限，防止敌人卡在地形里让花永远不消失（Lv30 生生不息“无上限”在这个上限之内生效）。设为 0 表示真正无上限。

**设置界面**：v0.1 只用 `config.json`（改完按 Alt+F5 生效）。不做自研游戏内面板，不做游戏外配置工具。v0.2 再评估接入社区 Mods Menu：它更像“配置文件编辑器 + 自带加载器”，用 .txt 配置，占用 `hid.dll`，接入前要实测入口能否共存，成本可能比预想高。
**已实现**：mod 自己读 `config.json` 并去掉注释（JSONC），不依赖加载器。

**已砍掉**：花数量上限滑块、`extraBigFlowers`（已定全部留大花）、自动爆炸特效强度、白花轨迹样式。**推迟**：Boss 单独倍率（等 Boss 实测）。

实现顺序：效果 1、2 → 设置方案与 v3.2 新增功能 → 吸血调查。

### 规格 v3.2 新增（2026-11-20 用户确认）

| 功能 | 规则 | 解锁 |
|---|---|---|
| **自动爆炸音量** | 自动爆炸的音效音量为原版爆炸的 **25%**（可调）；E 引爆和到期爆炸保持原版音量 | 始终 |
| **生生不息**（默认开启） | 花丛里有敌人时，花的寿命延长。Lv15：最多延长 **10 s**（有敌人时最长活 25 s，没有敌人仍是 15 s）；Lv20：最多延长 **20 s**；Lv30：**无上限**，等于敌人在花丛里时花的寿命暂停流逝。延长量加在“花的存在时间”档位之上 | Lv15 / Lv20 / Lv30 三级 |
| **彼岸·极**（强力特效） | 复用资产里存在、但原版找不到施加者的 `GE_Hun_GuiTouBlade_Debuff_Effect_UltraFlower`（每 0.4 s 物理 0.3、杀气 0.3）。同一朵花**自动爆炸满 N 次**（默认 2）后升级为“极”：花内敌人额外承受 UltraFlower 效果，花换上更醒目的特效 | **铸魂后 Lv30**（`Evolution` 标签） |
| **断情增幅** | Lv15 的“断情”状态期间，自动爆炸间隔缩短为一半 | Lv15（断情期间） |
| ~~连锁绽放~~ | 不做（用户决定） | — |

**路线图（v0.2 以后）**：**聚花**（长按 E 把场上所有花收拢成 Boss 的聚花 `BD_AHua_GatheringFlower`：每 2 s 判定一次，8 s 后半径 800 的大爆炸，然后花全部消失；短按 E 不变）。

**原版平衡说明**：普通小怪站进花丛约 0.3 s 就被打空杀气，这是**原版数值**（第 1 步实测时验证 mod 没有改花丛减益），不削弱。注意本 mod 的花丛面积档位和生生不息都会让敌人在花里待得更久，平衡测试时要一起看。

**等级判断（已解决，2026-11-21）**：mod 直接读红妆鬼斩的数字等级 `GetWeaponLevel("GuiTouBlade", true)`，Lv5 / Lv15 / Lv20 / Lv30 分档不依赖标签；升级表已导出（Lv5 CanManualExplode、Lv15 CanBuff、Lv25 CanCharge，game-notes §13）。

### 效果 2：F 蓄力白花

| 项 | 原版 | 本 mod |
|---|---|---|
| 白花数量 | 1 | **按武器等级分档**：Lv25–29 共 **3** 朵（原版 1 + 额外 2）；Lv30 共 **5** 朵（原版 1 + 额外 4） |
| 结束时留下的大花 | 每朵白花 1 朵 | **每朵白花都留 1 朵大花**（Lv25–29 共 3 朵，Lv30 共 5 朵）。2026-11-20 用户更正：原先“只有部分白花留大花”作废 |
| 额外白花的目标 | — | **多个敌人**：分别锁定威胁最高的敌人（Boss / 精英优先，其次等级、剩余血量）。**只有一个敌人**：以不同轨迹（左右弧线、绕后）飞向它，落点分散，尽量铺开更大的地面 |

白花命中的爆炸、以及白花留下的大花，伤害都**保持原版**，不打折。

**等级判断的依据**（第 1 步调查，build 26367565）：武器升级会给玩家加 GE，GE 授予标签 `CharacterState.WeaponUpgrade.GuiTouBlade.*`，共 4 个：`CanManualExplode`、`CanBuff`、`CanCharge`、`Evolution`（`UpgradeData/GE_Weapon_GuiTouBlade_*`）。
- **Lv25 = `CanCharge`**：【已证实】蓄力重击的输入映射 `AIM_GuiTouBlade_HeavyAttack_Hold` 要求这个标签，而火照黄泉就是 Lv25 解锁的蓄力。
- **`Evolution` 不是等级授予的标签，来自铸魂**（升级表已导出，game-notes §13）。彼岸·极要求 Lv30 且带 `Evolution`。【已证实】

> 更正记录（2026-11-20）：最初理解为“5 朵里 3 朵留大花”，用户更正为另外 2 朵也要留，即全部 5 朵都留大花。这正好是原版白花 BD 自带的行为（`BulletEvent_SubBullet(BD_Hun_GuiTouBlade_Flower_Big)`），额外 4 朵用同一个 BD 生成即可，不需要压掉 SubBullet。注意：一次最多多出 5 朵大花，都计入 25 朵上限，超限时最旧的花会被淘汰（原版规则）。

### 待定（用户未确认前不实现）

- **花丛内攻击吸血**（取代 v2 的“站在花里回复生命”）：玩家站在花里时，攻击命中敌人会吸血。方向是复用另一把双手武器 Outlaw's Warblade（第二章 Jing Ye 掉落）的吸血效果。社区资料说它标准连招每次命中都吸血，对傀儡、金身、幻身无效（phantombladezerodb.com、maxroll、pushsquare，**未核实**）。先用 FModel 找到它的吸血实现（GE / GA / 伤害事件），评估能否在玩家站在花里时复用（例如扩展 `GE_Hun_GuiTouBlade_InFlower`，或在 `On Overlap` 时额外施加），说明是只限轻攻击还是所有命中。结论写进 `docs/game-notes/`，向用户汇报方案，用户确认后才实现。排在效果 1、2 之后。
- ~~前期等级补偿~~：v3 删除，不做（用户：“太纯数值了，没有机制的美”）。前期由“Lv5 前也自动爆炸”代替。

## 可配置参数（config.json）

文件里可以写 `//` 和 `/* */` 注释；没写的项用预设的值；超出范围的值会被钳制并在 `loader.log` 写一行说明。改完按 Alt+F5 生效。

**常用项**

| 参数 | 默认（盛放） | 说明 |
|---|---|---|
| `enabled` | true | 总开关；false 时 mod 什么都不做 |
| `preset` | `"盛放"` | `含苞` / `盛放` / `花海`（也可写 `bud` / `bloom` / `sea`），见“设置方案” |
| `flowerAreaScale` | 0.25 | 花丛面积增量：0 / 0.25 / 0.4 / 0.8 / 2.0（2.0 为高强度） |
| `flowerLifetime` | 15 | Lv5 起花的存在时间：15 / 25 / 60 秒（60 为高强度） |
| `tickVolume` | 0.25 | 自动爆炸音量（相对原版爆炸，0～1） |
| `lingerEnabled` | true | 生生不息 |
| `ultraEnabled` | true | 彼岸·极（铸魂后 Lv30） |

**高级项**

| 参数 | 默认 | 范围 | 说明 |
|---|---|---|---|
| `tickInterval` | 4（花海 3、含苞 6） | 1.5～30 | Lv5 起的自动爆炸间隔（秒，游戏时间） |
| `tickDamageScale` | 0.4（花海 0.5、含苞 0.25） | 0～1 | 自动爆炸伤害占原版一次爆炸（直击 + 灼烧）的比例。灼烧首跳（约 17%）总会保留，所以低于 0.17 时实际仍约 17% |
| `manualCooldown` | 5 | 0.4～60 | E 引爆冷却 |
| `manualKeepsFlower` | true | | false 时回到原版“引爆即消失” |
| `tickShake` | false | | 自动爆炸是否震屏、震手柄（E 引爆和到期爆炸始终原版） |
| `lingerMaxLv15` / `lingerMaxLv20` | 10 / 20 | 0～120 | 生生不息在 Lv15 / Lv20 的最大延长秒数；Lv30 无上限 |
| `lingerSafetyCap` | 120 | 0 或 30～600 | 每朵花的安全寿命上限（秒），0 = 无上限 |
| `ultraAfterTicks` | 2 | 1～10 | 同一朵花自动爆炸几次后变成“极” |
| `tickCantBreak` | true | | 自动爆炸的杀气只削到 0.1（用原版花丛减益的“不破防”伤害计算器 `DamageCalculator_CantBreakTarget`）。false 时自动爆炸能把敌人打破防 |
| `ultraCantBreak` | true | | 彼岸·极（UltraFlower）命中后杀气停在 0.1，和花丛减益一致。false 时用原版计算器 `PBZPlayerNonLethal`：命中后出现破防迹象（杀气从 0.1 回升、随后伤害 ×1.5），但实测没有接着触发自动处决。两种计算器都能把敌人打空血，用时差不多（2026-11-21 对照实测） |
| `areaSpreadRings` | true | | 面积档位同时把一圈花铺开（×√(1+p)）；Lv5 前的 3 s 花不铺开 |
| `debugLog` | false | | 在 `loader.log` 写详细日志 |

为什么默认不让花破防（用户 2026-11-21 决定）：自动爆炸的杀气项把**离角色较近**的小怪真正打破防（杀气 0 后），游戏会让角色自己发动红妆鬼斩的简易处决 `GA_SimpleExecution_GuiTouBlade`，角色在没有任何输入的情况下冲出去出刀（game-notes §13 归因日志：250 cm 出现，600 cm 未出现）。原版的花只削到 0.1，不会这样。所以破防这一下留给玩家自己的攻击；想让自动爆炸也能破防，把 `tickCantBreak` 改成 false。铸魂计数溢出（每 5 次命中一次，自动爆炸也计数）仍是原版计算器，也有破防迹象，见 game-notes §13。

效果 2 的 `extraWhiteFlowersLv25`、`extraWhiteFlowersLv30`、`whiteFlowerTargeting` 在 v0.1.0 里还不生效（写了会在日志里提示忽略）。

**写死的常量**（`main.js` 的 `K`，2026-11-21 实测后定）

| 常量 | 值 | 说明 |
|---|---|---|
| `tickCoalesce` | 0.4 | 同一圈花在 0.4 s 内到点的合成一次爆炸 |
| `tickIntervalEarly` | 1.5 | Lv5 前（花寿命 3 s）的自动爆炸间隔 |
| `earlyShachiScale` | 0.5 | Lv5 前自动爆炸的杀气系数再乘这个数 |
| `tickShachiSmall` / `tickShachiBig` | 0.25 / 0.5 | 自动爆炸加的杀气伤害（`AngerDamage`），实测 0.25 让小怪木桩掉 40 杀气 |
| `ultimateTickFactor` | 0.5 | 断情期间自动爆炸间隔的倍数 |
| `remainGuard` | 0.3 | 离到期不到 0.3 s 时不自动爆炸 |
| `tickBurn` / `hitShare` / `firstBurnShare` | false / 0.375 / 0.169 | 自动爆炸只保留灼烧首跳；直击、灼烧首跳占原版一次爆炸的比例（实测） |
| `maxTickSounds` / `maxTickParticles` | 4 / 16 | 一批自动爆炸最多播几个音效 / 特效 |

## 实现注意（来自审计，实现层面）

来源：Gemini Neon 跨厂商审计（`docs/research/audits/2026-11-20-neon-design-workflow.md`），以及第 1 步的补查。

- **不改共享 BD 的伤害。** 自动爆炸的伤害改在这一颗子弹的攻击模块上（`FindModulesByClass(BulletAttackModule)` → `AddModifier`），E 引爆和到期爆炸不受影响。震屏、手柄震动、音效只在 `Start()` 前后临时置空共享 BD 的字段。灼烧不改 BD：命中 0.1 s 后从被命中的敌人身上移除一层灼烧 GE（早先“置空 BD 上的灼烧 GE”的做法已弃用）。（2026-11-21 实测，game-notes §13）
- **按每朵花自己的寿命计时**，不用全局时钟：第一次看到花时用 `Explode Timer` 已过的时间倒推出生时间，之后用游戏时间（`GetTimeSeconds`）。
- **寿命档位和生生不息靠暂停花自己的计时器**：`Explode Timer` 和父类的 `Lifetime Timer`（约 30 s，到时静默 `Deactivate`）一起暂停，到期仍走原版路径；停用 mod 时全部恢复。
- **“花里有敌人”按距离判断**（花的碰撞半径 + 敌人胶囊半径），不用花自己的 `Overlapping Actors`，后者会漏掉仍站在花里的敌人。
- **前期剩余寿命保护。** 剩余寿命小于约 0.3 s 时不做自动爆炸，避免和到期爆炸重复。
- **判伤次数（已实测）**：一个合批子弹即使多个位置都覆盖同一个敌人，这个敌人也只吃一次伤害（game-notes §12）。
- **还原存档前先关 Steam 云同步。** 否则本地还原的旧档会被云端覆盖。

## 安装 / 卸载

需要：PBZModLoader（Kintaro 分支）2.1.0。发布包（`HongzhuangGuizhanPlus-v<版本>.zip`）的目录按游戏目录展开：

```
ProjectPBZ/PBZModLoader/mods/hongzhuang-guizhan-plus/
├─ main.js
├─ config.json
└─ README.txt
```

1. 先备份存档 `ProjectPBZ\Saved\SaveGames\`（存档有 Steam 云同步，坏档会被同步上去）。
2. 把 zip 解压到游戏根目录（有 `ProjectPBZ` 文件夹的那一层）。
3. 进游戏，`ProjectPBZ\PBZModLoader\loader.log` 里出现 `[hongzhuang-guizhan-plus] 0.1.0 started` 即生效。没有 `loader.log` 时换加载器入口（hid / winmm / dsound / dxgi，见加载器说明）。
4. 设置：改 `config.json`，游戏里按 Alt+F5。
5. 卸载：删除 `ProjectPBZ\PBZModLoader\mods\hongzhuang-guizhan-plus\`。mod 不写存档，删除后即回到原版。

## 状态

- 第 0 步（只读解包）已完成。
- 第 1 步：最小可行性验证已完成（ADR-0001：效果 1 定稿为路线 A）。
- 第 2 步（2026-11-21）：效果 1 v0.1.0 实现中，数值由 agent 用 pbz-testbench 自测完成（见 game-notes §13）；待用户最终试玩（手感、音量、画面）。效果 2 未开始。
