# Custom Fork 维护入口

本目录记录 `CYZice/codex-mobile` 相对 `friuns2/codex-mobile` 的维护边界、运行架构、需求、测试证据和后续路线。目标环境是 Windows 11 主机与 Ubuntu 24.04 主机，各自运行独立的 `codexapp`，通过 FRP 提供受控的远程浏览器访问。

## 核心关系

```text
浏览器
  -> FRP
  -> codexapp HTTP/WebSocket
  -> codex app-server JSON-RPC
  -> Codex CLI + 项目目录 + CODEX_HOME
```

- Codex Desktop 不需要保持开启，`codexapp` 自己创建并持有 app-server。
- 浏览器关闭只应断开 UI/通知订阅，不应自动调用 `turn/interrupt`。
- `codexapp` 后端必须持续运行；其退出或 app-server 重载会影响活动 turn。
- Codex Desktop 与 `codexapp` 通常拥有不同的 app-server 进程。两者可读取同一个 `CODEX_HOME`，但项目白名单、缓存和 UI 状态不保证一致。
- 不在仓库、日志、文档或浏览器响应中保存 `auth.json`、API Key、Access Token、Refresh Token。

## 当前状态

截至 2026-07-27，Fork PR #1 已合并到 `main`，merge commit 为 `5b9d584`：

- 已选择性合并 PR #203：Windows Codex CLI 解析。
- 已选择性合并 PR #209：按模型能力显示 `max/ultra` 推理等级，并增加无元数据模型的保守回退。
- 已选择性合并 PR #212：Windows `/C:/...` 本地浏览路径修复。
- 已建立本目录的维护、架构、部署、安全、同步、需求、测试和 Desktop parity 文档。
- PR #211 Goal mode 按用户要求排除。
- Runtime Reload、Project Sync、Timeline 重构和断线诊断仍为规划项，未实现。

## 已知限制

- 仓库当前没有 lockfile，也没有固定 `packageManager`，依赖安装不能视为完全可复现。
- Windows 11 / Node 22.16.0 下，`pnpm run dev --host 127.0.0.1 --port 4173` 会因 `scripts/dev.cjs` 直接启动 `vite.cmd` 而报 `EINVAL`；本轮 UI 验证使用 Vite JS 入口。
- 全量单元测试存在两项基线 Windows 限制：非管理员 symlink 创建失败，以及 POSIX `0600` mode 断言在 Windows 上不成立。
- 本次真实 RPC 验证中 Codex CLI 0.144.6 的 app-server 启动后退出；涉及模型菜单的 UI 验证使用按 JSON-RPC method 的隔离 stub，不能替代真实 app-server 兼容性验证。

## 文档导航

- [路线图](ROADMAP.md)
- [架构](ARCHITECTURE.md)
- [部署](DEPLOYMENT.md)
- [安全](SECURITY.md)
- [上游同步](UPSTREAM_SYNC.md)
- [需求](REQUIREMENTS.md)
- [测试计划](TEST_PLAN.md)
- [上游 PR 审计](UPSTREAM_PR_AUDIT.md)
- [Codex Desktop Parity](CODEX_DESKTOP_PARITY.md)

## 完成定义

一个阶段只有同时满足以下条件才可标记为完成：代码已提交；相关单测和 build 有真实结果；手动测试步骤已更新；性能风险已审计；已知限制与回滚方式已记录；需要发布时，目标 GitHub 分支和部署环境均已验证。
