# Nexus 说明页模板（BBCode，中英双语）

复制下面代码块的内容到 Nexus 的 Description 栏。`{{...}}` 是待填项。Nexus 说明栏支持 `[b] [i] [size] [color] [url] [img] [youtube] [list] [spoiler] [line]` 等 BBCode。

```bbcode
[center][size=6][b]Scarlet Wraithblade Plus — Everblooming Lilies[/b][/size]
[size=4]红妆鬼斩增强 · 彼岸花常驻[/size][/center]

[line]
[size=5][b]What it does / 功能[/b][/size]
[list]
[*][b]Lilies keep blooming.[/b] Ground spider lilies explode every {{tickInterval}} s without disappearing, and still explode once when they expire.
场地彼岸花在存在期间每 {{tickInterval}} 秒自动爆炸一次且不消失，到期时仍会爆炸一次。
[*][b]E detonation keeps the lilies.[/b] Pressing E detonates all lilies without removing them (5 s cooldown).
按 E 引爆全部彼岸花，花不消失（冷却 5 秒）。
[*][b]Five white lilies.[/b] The charged heavy (Lv25) releases 5 white lilies instead of 1.
蓄力重击（Lv25）放出的白色彼岸花从 1 朵变为 5 朵。
[/list]

[youtube]{{YouTube 视频 ID}}[/youtube]

[line]
[size=5][b]Balance / 平衡[/b][/size]
Periodic explosions deal {{tickDamageScale×100}}% damage but full Killing Intent (Shachi) reduction. Lifetime and the flower cap are unchanged. All values are configurable in [i]config.json[/i].
自动爆炸只造成 {{tickDamageScale×100}}% 伤害，但杀气削减不打折；存在时间和花的数量上限不变。所有数值都可以在 config.json 里修改。

[line]
[size=5][b]Requirements / 前置[/b][/size]
[list]
[*][url={{PBZModLoader 的 Nexus 链接}}]PBZModLoader[/url] {{版本}}+
[*]Game build {{26367565}} / 游戏版本 {{26367565}}
[/list]

[size=5][b]Install / 安装[/b][/size]
[list=1]
[*][b]Back up your saves first[/b] ([i]ProjectPBZ\Saved\SaveGames[/i]). 先备份存档。
[*]Install PBZModLoader. 安装 PBZModLoader。
[*]Extract this archive into the game folder (the one containing [i]ProjectPBZ[/i]). 把压缩包解压到游戏根目录。
[/list]
[b]Uninstall / 卸载:[/b] delete [i]ProjectPBZ\PBZModLoader\mods\hongzhuang-guizhan-plus[/i]. 删除该文件夹即可。

[line]
[size=5][b]Compatibility & known issues / 兼容性与已知问题[/b][/size]
[list]
[*]Single-player only. Does not touch online features, achievements or anti-cheat. 只影响单机体验，不涉及联网、成就或反作弊。
[*]May conflict with other mods that change the Scarlet Wraithblade. 可能与其他修改红妆鬼斩的 mod 冲突。
[*]Game updates may break the loader or this mod; check the page header for the current status. 游戏更新可能导致失效，以页面顶部的状态为准。
[*]{{已知问题}}
[/list]

[line]
[size=5][b]AI disclosure / AI 披露[/b][/size]
This mod was built with generative AI assistance. Most of the code was written by AI coding agents ({{工具列表，例如 Claude Code (Claude Opus 5.5, Fable 5.2), DeepSeek V4.1 Flash via DeepSeek Harness}}) under human design and review. The full development history is public on GitHub. Screenshots and videos are real in-game footage.
本 mod 在生成式 AI 协助下开发：大部分代码由 AI 编程代理在人工设计与审查下编写，完整开发历史公开在 GitHub。截图和视频均为真实游戏画面。

[size=5][b]Credits & license / 致谢与许可[/b][/size]
[list]
[*]{{PBZModLoader 作者}} — PBZModLoader
[*]{{参考过的开源 mod 及作者}}
[*]Phantom Blade Zero © S-GAME. This is an unofficial fan mod, not affiliated with or endorsed by S-GAME. 非官方粉丝作品，与 S-GAME 无关。
[*]Code: MIT — [url=https://github.com/Aerytgophilis/pbz-mods-crafting]GitHub[/url]. Screenshots/game content are not covered by MIT. 代码以 MIT 开源，游戏截图与游戏内容不在 MIT 范围内。
[/list]

[size=5][b]Bug reports / 反馈[/b][/size]
Please use the Bugs tab or GitHub Issues and include: game build, PBZModLoader version, and [i]ProjectPBZ\PBZModLoader\loader.log[/i].
请在 Bugs 标签页或 GitHub Issues 反馈，并附上游戏版本、加载器版本和 loader.log。
```

## 填写提示

- 英文名是暂定的，发布前可以再改。备选：`Scarlet Wraithblade Plus`、`Everblooming Spider Lilies`、`Wraithblade — Endless Bloom`。
- “杀气”在英文版里的译名请以游戏英文界面为准（暂写 Killing Intent / Shachi）。
- `[youtube]` 只填视频 ID，不是完整链接。
- 说明页不要主动索要点赞、捐赠（Nexus 规则禁止主动索取，礼貌致谢可以）。
