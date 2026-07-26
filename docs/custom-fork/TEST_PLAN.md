# 测试计划与当前基线

## 环境

| 项目 | 当前值 |
| --- | --- |
| OS | Windows 11 |
| Node | 22.16.0 |
| pnpm | 10.18.3 via Corepack |
| Codex CLI | 0.144.6 |
| 基线 commit | `fac2291` |
| 合并结果 | Fork PR #1，merge commit `5b9d584` |
| lockfile | 不存在 |

依赖安装使用 `COREPACK_ENABLE_PROJECT_SPEC=0` 和 `--lockfile=false`，避免 Corepack 自动改写 `package.json`。这只适合当前开发验证，不能替代生产可复现依赖策略。

GitHub 已确认 PR #1 为 `MERGED`，`mergedAt` 非空，`origin/main` 包含 `bcd9524`、`90c5ae2`、`e73599c` 和文档提交 `a0fab0b`。

## 自动化结果

| 阶段 | Targeted | 全量 unit | Frontend/typecheck | CLI build/smoke |
| --- | --- | --- | --- | --- |
| `main` 基线 | - | 145 pass, 2 fail | pass | pass |
| PR #203 | 4 pass | 149 pass, 2 fail | pass | pass |
| PR #209 | 52 pass | 155 pass, 2 fail | pass | pass |
| PR #212 | 3 pass | 158 pass, 2 fail | pass | pass |

固定的两项 Windows 失败：

1. `writeWorkspaceRootsState > persists workspace roots in canonical form`：创建 symlink 返回 `EPERM`，需要 Developer Mode/管理员权限或平台条件测试。
2. `ensureDefaultFreeModeStateForMissingAuthSync > creates CODEX_HOME before writing free-mode state`：Windows 报告 mode `0666`，不能按 POSIX `0600` 断言。

若后续出现第三项失败，不能以“基线失败”为由忽略。

## Build 与性能证据

- 基线 frontend main chunk：511.57 kB，gzip 157.88 kB。
- PR #209/#212 后：513.22 kB，gzip 158.36 kB。
- PR #203 只改变已有同步命令 probe 的执行封装，probe 数量不变。
- PR #209 使用已有 `model/list` 响应做有界数组/Map 查找，没有新增请求、轮询或 fanout。
- PR #212 每次 decode 增加一个有界正则，没有新增 I/O 或缓存失效。
- Vite 始终提示主 chunk 超过 500 kB；这是既有性能债务，Timeline/大型 UI 变更前必须重新测量。

## 浏览器证据

PR #209，URL `http://127.0.0.1:4173/#/`：

- 375x812 light：`output/playwright/pr209-reasoning-light-375x812.png`
- 768x1024 dark：`output/playwright/pr209-reasoning-dark-768x1024.png`
- GPT-5.6：8 档，含 `Max/Ultra`。
- GPT-5.5：`Low/Medium/High/Extra high`。
- 无元数据模型：旧 6 档，不含 `Max/Ultra`。

PR #212 TestChat：

- screenshot：`output/playwright/testchat-pr212-cjs.png`
- `hrefOk=true`、`titleOk=true`、`textOk=true`。
- 实际 `GET /codex-local-browse/D:/Microsoft%20VS%20Code/codex-mobile/package.json` 返回 200，内容匹配 package name。

UI 断言使用隔离浏览器与 method-aware RPC stubs，因为真实 app-server 在本次会话退出；stub 不构成真实 Provider/App Server 兼容性证明。

## 当前已知运行限制

- `pnpm run dev --host 127.0.0.1 --port 4173` 在 Windows/Node 22 报 `spawnSync ... vite.cmd EINVAL`。
- UI 验证改用 `node node_modules/vite/bin/vite.js --host 127.0.0.1 --port 4173`。
- Codex app-server 退出使 `/codex-api/rpc` 返回 502 `codex app-server exited unexpectedly`；需要单独定位 CLI/schema/config 兼容性。
- 没有 Ubuntu 24.04 实机结果。

## 后续阶段测试矩阵

### Runtime Reload

- status 字段 allowlist；无 Token/完整 env。
- 无活动 turn 的普通 restart。
- 活动 turn 时 `force=false` 返回 409 和准确计数。
- `force=true` 中断提示、旧 RPC 快速失败、旧 approval 失效。
- 10 个并发 restart 只创建一个新 generation。
- app-server 启动失败、超时、连续失败与恢复。
- CC Switch 修改 config/provider/base_url/auth 后手动重载读取新状态，但日志不泄密。
- Windows child termination 与 Ubuntu signal 行为。

### Project Sync

- Desktop state 缺失、损坏、字段漂移。
- thread/list 超过 50/100 条的完整分页；archived 开关。
- Windows drive 大小写、分隔符、`\\?\`、UNC、junction/symlink、不存在路径。
- Linux realpath、symlink、大小写敏感。
- Git worktree、子目录 cwd、同名不同路径、多 rootPaths、projectless threads。
- preview 的 add/existing/merge/missing；merge 不删手动项目；mirror 二次确认。

### Timeline/Disconnect

- `thread/read` 与实时 event 使用同一 reducer。
- threadId/turnId/itemId 去重；乐观 user message 不重复。
- command/fileChange/plan/approval/error 顺序和折叠。
- WebSocket 断开不 interrupt，重连后 re-read/reconcile。
- 多客户端观察同一活动 turn。
- 大型历史 DOM/内存/长任务，明暗主题，375x812 与 768x1024。

## 手动测试条目要求

每个功能在 `tests/<domain>/` 新增或更新一份文件，包含：前置条件、精确步骤、期望结果、清理/回滚。`tests.md` 只维护索引，不把详细步骤堆回根文件。

## 回滚验证

对每个集成提交使用 `git revert` 创建反向提交；重新跑该 PR targeted tests、全量 unit 和 build。生产环境切回上一个已验证 build，不删除或重置 `CODEX_HOME`。
