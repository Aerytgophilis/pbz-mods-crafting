# pbz-testbench（本地测试工具，不发布）

只在开发时用，不进任何 mod 的发布包。部署：`tools/scripts/deploy-mod.ps1 -Id pbz-testbench`；卸载：加 `-Remove`。

- **测量**：附近（`measure.radius`，cm）的 NPC 掉血或杀气变化时，在 `loader.log` 写一行 `hit <名字>: HP a -> b, Shachi c -> d`，带游戏时间。和其他 mod 的日志写在一起，可以直接对出一次爆炸打了几下。
- **刷怪**：每次加载（启动游戏或按 Alt+F5），在玩家面前生成 `spawn.count` 个 `spawn.class` 敌人。`dummy: true` 时关闭 AI，当木桩用。木桩血量低于 `dummyMinHealth` 时直接移除，不让它死，避免掉落物品、写存档或计入成就，然后在原地补一个。Alt+F5 和卸载时会清掉所有刷出来的敌人。
- 想换敌人：把 `spawn.class` 改成 `/PBZCombatAsset/ActorData/Mobs/...` 下的 `BP_Monster_*_C` 类路径（从 SDK 的 `paths.d.ts` 查），改完按 Alt+F5。

致谢：生成敌人的做法（`BP_SGameAIFunctionLibrary.SpawnAI`，生成后切回行走模式）参考了 [Cringe Blade Zero](https://github.com/Jersyi/cringe-blade-zero)（Jersyi，MIT）的 `src/boss/boss_assist.cpp`。没有复制代码。
