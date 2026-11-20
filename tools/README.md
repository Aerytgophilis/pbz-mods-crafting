# 工具清单

下载的第三方工具放在 `tools/bin/<名称>-<版本>/`（不进仓库）。每装一个，在下表登记。

| 工具 | 版本 | 来源 URL | SHA-256 | 位置 | 用途 |
|---|---|---|---|---|---|
| Ghidra | 12.1.4 | 已有 | - | Z:\Tools\Ghidra | REA 原生逆向后端 |
| JDK | 21.0.12.1 | 已有 | - | Z:\Tools\jdk21 | Ghidra 依赖 |
| FModel | nov-2026 (2026-10-31) | https://github.com/4sval/FModel/releases/tag/nov-2026 | 209bef15402dd58010cdb6bad03a799471f2100d671f8d5a52c1e613549b7de1（FModel.zip） | tools/bin/FModel-nov-2026/ | 浏览/导出 IoStore 资产；GPL-3.0；尚未解压 |
| AESDumpster | 1.2.5 | https://github.com/GHFear/AESDumpster/releases/tag/1.2.5 | 2c0c0de4853eb4988c4739c9714f6960a928b61527b9c98a7badca7291c917bb | tools/bin/AESDumpster-1.2.5/ | 从 PBZ.exe 读 AES key；无许可证；key 只存本地，不进仓库 |
| PBZ usmap | v1.1 (2026-11-04) | https://github.com/KintaroModding/phantombladezero_pbzusmap/releases/tag/v1.1 | 77a983a7f9df632a3e133487b1eafc2483185f9f98548303386b69dbc9701d78（与官方 SHA256SUMS 一致） | tools/bin/pbzusmap-v1.1/ | `ProjectPBZ-5.7.4-302256-full.usmap`，对应 build 26367565；MIT |
| Antigravity CLI (agy) | 1.5.13 | https://antigravity.google/docs/install/ | - | %LOCALAPPDATA%\agy\bin | Gemini 无头调用；**目前被地区资格检查拒绝**，见 AGENTS.md §8 |
| REA (rea-agents) | 6.7.0 | npm | - | npx 按需拉取 | 升级手段：只在 grep 追不动 JS 时跑 CLI，见 AGENTS.md §4 |
