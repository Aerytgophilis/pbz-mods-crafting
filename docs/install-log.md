# 游戏目录改动记录

> 还原存档：先在 Steam 里关掉本游戏的云同步（库 → 右键游戏 → 属性 → 常规 → Steam 云），再把 `backups/<日期>/saves/` 复制回 `ProjectPBZ\Saved\SaveGames\`。不关的话，云端的存档可能把还原的旧档覆盖掉。

| 日期 | 改动 | 备份位置 | 操作人 |
|---|---|---|---|
| 2026-11-20 20:38 | 安装 PBZModLoader 2.1.0（Kintaro 分支）：新增 `platform\steam\version.dll`、`ProjectPBZ\Content\JavaScript\PBZModLoader\bootstrap.js`、`ProjectPBZ\PBZModLoader\LICENSES.txt`，新建 `ProjectPBZ\PBZModLoader\mods\`。都是新增，没有覆盖任何文件。哈希与官方 manifest 一致。脚本：`tools/scripts/install-loader.ps1`（卸载用 `-Uninstall`：2026-11-20 起会按哈希删掉我们放的所有入口 DLL） | 没有被覆盖的文件；存档在 `backups/2026-11-20/saves/`（27 个文件，sha256 已核对），`Saved\*.sav` 设置在 `backups/2026-11-20/saved-settings/` | agent（用户批准，用户终端执行） |
| 2026-11-20 20:38 | 部署 `mods\hongzhuang-guizhan-plus\` 0.0.1-verify（`main.js`、`config.json`），脚本 `tools/scripts/deploy-mod.ps1`。用户已批准：以后往这一个文件夹重复部署不再逐次询问，但每次都记在这里 | 无需备份（新目录） | agent |
| 2026-11-20 20:49 | 重新部署 `mods\hongzhuang-guizhan-plus\` 0.0.2-verify：新增日志，记录玩家身上的武器升级标签，用来确认 Lv25 / Lv30 分别对应哪个标签。按已批准的范围部署 | 无需备份（只改本 mod 的文件夹） | agent |
| 2026-11-20 20:57 | 换加载器入口：用 version.dll 时游戏加载的是 `C:\WINDOWS\SYSTEM32\VERSION.dll`，没生成 `loader.log`，加载器没有运行。按安装说明的 ANOTHER ENTRY 一节，删掉我们放的 `platform\steam\version.dll`，换成 `platform\steam\hid.dll`（2.1.0 的备用入口，sha256 a741d9f8…516c）。脚本 `tools/scripts/switch-loader-entry.ps1 -Entry hid`。没有覆盖游戏文件 | 不需要备份（删掉的是我们自己放的文件） | agent（用户批准） |
| 2026-11-20 21:03 | 重新部署 0.0.3-verify：自动爆炸默认不震屏、不震手柄（`tickShake=false`）；同一圈花合成一次爆炸（`tickCoalesce=0.4`）；修好读升级标签的日志。按已批准的范围部署 | 不需要备份 | agent |
| 2026-11-20 21:07 | 重新部署 0.0.3-verify：修好合批（只有某朵花严格到点时才触发，0.4 s 内到点的花一起爆）；每次加载都清空一次性日志 | 不需要备份 | agent |
| 2026-11-20 21:22 | 新建并部署本地测试工具 `mods\pbz-testbench\` 0.1.0（不发布）：在附近 NPC 掉血或杀气变化时写日志；每次加载在面前刷 1 个不动的木桩小怪（`BP_Monster_MaleThug_Sword_Blue`），血量低于 25% 时移除再补一个，不让它死；Alt+F5 时清掉刷出来的敌人。用户已批准，以后部署这个文件夹不再逐次询问 | 存档另备份到 `backups/2026-11-20/saves-before-testbench/`（27 个文件，已核对） | agent |
| 2026-11-20 21:29 | 重新部署 `pbz-testbench` 0.1.1：修掉 0.1.0 的刷怪循环。木桩血量过低时只移除，不再自动补；补刷要按 Alt+F5。按已批准的范围部署 | 不需要备份 | agent |
| 2026-11-20 21:57 | 重新部署 `pbz-testbench` 0.2.0：新增只读“武器升级表转储”（每次加载在 loader.log 写出已装备主武器每一级的 GE、铸魂 GE 和 UI 数值）；本轮默认关掉刷木桩（`spawn.enabled=false`），改 config 可再开。按已批准的范围部署 | 不需要备份 | agent |
| 2026-11-20 22:05 | 重新部署 `hongzhuang-guizhan-plus` 0.1.0-dev.1（第 1 轮探针：每朵花自己的游戏时钟；自动爆炸按子弹实例加伤害修正 ×0.4 和杀气项；自动爆炸音效限 4 个、音量 25%；自己读 config.json（带注释）与预设；生生不息 / 彼岸·极 / 面积本轮在配置里关掉）和 `pbz-testbench` 0.2.0（重新打开刷木桩，保留升级表转储）。按已批准的范围部署 | 不需要备份 | agent |
| 2026-11-21 12:54 | 重新部署 `pbz-testbench` 0.3.0：新增自测模式（每次加载在木桩周围用代码生成一圈 6 朵小花，第 10 s 调用一次 E，第 20 s 汇总木桩掉血；停止时清掉这些花）；木桩换成高血量的 `BP_Monster_FemaleDoll_QinNv`（AI 关闭）。用户已授权 agent 用 computer use 自己按 Alt+F5 跑数值测试 | 存档另备份到 `backups/2026-11-21/saves-before-selftest/`（27 个文件，哈希已核对） | agent |
| 2026-11-21 12:55–13:38 | agent 用 computer use 反复部署 `hongzhuang-guizhan-plus` 0.1.0-dev.1 → dev.2 和 `pbz-testbench` 0.3.0 并按 Alt+F5 自测（约 25 轮，只写这两个已批准的 mod 文件夹）。最后部署的是发布用 `config.json`（盛放预设，`debugLog` 关）和 `README.txt`；testbench 保留自测模式 | 存档在 `backups/2026-11-21/saves-before-selftest/` | agent（用户授权 computer use） |
| 2026-11-21 14:59 | 重新部署 `hongzhuang-guizhan-plus` 0.1.0-dev.4：自动爆炸和彼岸·极默认杀气只削到 0.1（`tickCantBreak` / `ultraCantBreak`）；本轮 `debugLog` 开着做自测。按已批准的范围部署 | 不需要备份 | agent |
| 2026-11-21 15:01–15:04 | agent 用 computer use 自测“花只削到 0.1”：重新部署 `pbz-testbench`（临时改木桩种类和距离）和 `hongzhuang-guizhan-plus`（临时改 `tickDamageScale` / `ultraAfterTicks`）3 轮。最后部署的是 0.1.0 的发布配置（盛放，`debugLog` 关），testbench 恢复原配置 | 不需要备份 | agent（用户授权 computer use） |
| 2026-11-21 15:05 | 自测铸魂计数溢出：临时部署 `hongzhuang-guizhan-plus`（彼岸·极关、间隔 1.5 s、`tickDamageScale` 0.17）和 `pbz-testbench`（250 cm、`dummyMinHealth` 0）。重载后角色自己移动并在花出现前一击打死木桩（疑似有人在操作），测试中止，两个配置都恢复成发布版并重新部署 | 不需要备份 | agent（用户授权 computer use） |
| 2026-11-21 15:07–15:14 | agent 用 computer use 补测铸魂溢出、彼岸·极计算器对照、E 不受影响：重新部署 `pbz-testbench`（木桩换 TwinAxe、250 cm、`pinDummy`、`dummyMinHealth` 0、`eAt` 6）和 `hongzhuang-guizhan-plus`（临时测试配置）6 轮。最后两个都恢复成发布配置并重新部署 | 不需要备份 | agent（用户授权 computer use） |
