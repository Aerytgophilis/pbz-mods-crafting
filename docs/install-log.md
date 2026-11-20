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
