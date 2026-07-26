# Upstream PR 审计

审计基线：`fac2291`。选定上游提交已通过 Fork PR #1 合并到 `CYZice/codex-mobile` 的 `main`，merge commit 为 `5b9d584`。这不表示上游 `friuns2` 的原 PR 已由其维护者合并或关闭。

## 已集成

| PR | 功能 | 上游提交 | Fork 提交 | 方式/本地调整 | 测试 | 风险与结论 |
| --- | --- | --- | --- | --- | --- | --- |
| #203 | Windows Codex CLI 解析 | `82085cd` | `bcd9524` | cherry-pick；补裸 `codex` 的 `cmd.exe` wrapper 与 bundled `vendor/.../bin/codex.exe` 测试 | targeted 4/4；build/CLI smoke 通过；全量 149 pass + 2 基线失败 | 无认证/网络/遥测变更；同步 probe 次数不变。接受 |
| #209 | GPT-5.6 `max/ultra` | `66bf322`, `52e208e` | `90c5ae2` | cherry-pick；无元数据模型保守回退到 `none..xhigh`；补 `max/ultra` 发送和未知模型拒绝测试 | targeted 52/52；build 通过；全量 155 pass + 2 基线失败；亮/暗 UI 通过 | 原补丁会给未知模型展示新等级，已修正。拒绝跨 Provider 合并元数据缓存建议，避免同名模型串能力。接受 |
| #212 | Windows `/C:/...` 本地浏览 | `ef41deb` | `e73599c` | cherry-pick；补反斜杠 drive、编码 drive、编码 UNC 测试 | targeted 3/3；实际 GET 200；TestChat 三断言通过；build 通过；全量 158 pass + 2 基线失败 | 单次有界正则；Unix/UNC/已规范化路径保持。接受 |

三个 PR 均以 `fac2291` 为 base，审查时 GitHub 为 OPEN/CLEAN/MERGEABLE；没有修改认证、Token、遥测或外部网络出口逻辑，也没有相互冲突。

## 本轮延期或排除

| PR | 状态 | 原因 | 重新检查条件 |
| --- | --- | --- | --- |
| #187 Remote thread archive notifications | deferred | 本轮只处理三个 P0 PR；涉及实时 thread 状态，需要和后续断线/多客户端 reducer 一起深审 | 建立 event 去重与断线测试后 |
| #199 Attachment-only fallback titles | deferred | 涉及 thread title 持久化和侧栏刷新，不在本轮核心后端范围 | Project Sync/thread persistence 基线稳定后 |
| #206 Timer leaks + HTML sanitizer | deferred | sanitizer 可能破坏 Markdown、代码高亮、Diff、文件链接；必须单独做安全与渲染矩阵 | 可运行完整 TestChat、明暗主题和大型历史性能验证后 |
| #211 Goal mode | excluded | 用户明确表示不需要 goal mode | 只有用户重新提出需求时 |
| #207 Sentinel/sidebar/memory 重构 | rejected for current scope | 变更范围过大，混合架构、UI 与内存修复，违反选择性引入原则 | 单独架构评审并拆成可验证主题后 |

## 测试环境限制

- Windows 11；Node 22.16.0；pnpm 10.18.3；Codex CLI 0.144.6。
- 两项全量 unit 失败在 PR 前已存在：Windows symlink 权限、Windows mode 位不等于 POSIX `0600`。
- 标准 `pnpm run dev --host 127.0.0.1 --port 4173` 在 Node 22 下因 `spawnSync(vite.cmd)` 报 `EINVAL`；UI 验证使用 Vite JS 入口。
- 真实 app-server 在本次验证中退出并使 RPC 返回 502；#209 UI 使用 method-aware stubs。#212 的本地 browse GET 是真实 Vite middleware 请求并通过。

## 后续动作

1. 上游若更新 PR head，先比较新旧 head；不自动覆盖本地调整。
2. 在 Windows dev wrapper 和 Codex app-server 兼容性问题解决后，重跑真实 RPC/模型菜单验证。
3. 到达各自复查条件后，再深审 #187、#199、#206。
