# Custom Fork 路线图

状态定义：`done-on-main` 表示已验证并进入 Fork `main`；`done` 表示已验证但没有发布含义；`planned` 表示只有设计边界；`deferred` 表示本轮明确延期。

## P0 安全基线与上游 PR

| 项目 | 状态 | 证据/下一步 |
| --- | --- | --- |
| 检查分支、工作区、origin/upstream、HEAD | done | 基线 `fac2291`；开始时三者 `main` 一致，工作区干净 |
| 记录 Node/pnpm/Codex 版本 | done | Node 22.16.0；pnpm 10.18.3 用于验证；Codex CLI 0.144.6 |
| 单元测试与 frontend/CLI build 基线 | done | 见 `TEST_PLAN.md` |
| PR #203 Windows CLI 解析 | done-on-main | Fork 提交 `bcd9524`；经 PR #1 合并 |
| PR #209 GPT-5.6 max/ultra | done-on-main | Fork 提交 `90c5ae2`；经 PR #1 合并 |
| PR #212 Windows browse path | done-on-main | Fork 提交 `e73599c`；经 PR #1 合并 |
| PR #211 Goal mode | deferred | 用户明确排除 |
| PR #187/#199/#206 | deferred | 本轮不做复杂前端/渲染改动；后续逐项深审 |

## P0 长期维护文档

| 项目 | 状态 | 说明 |
| --- | --- | --- |
| 维护入口、架构、部署、安全 | done-on-main | `docs/custom-fork/` |
| 上游同步与 PR 审计 | done-on-main | 记录选择性 cherry-pick 和复查条件 |
| 需求与测试计划 | done-on-main | 所有后续阶段必须更新 |
| Desktop parity 工作流 | done-on-main | 仅定义合法观察/实现流程，未进行大型 UI 对齐 |

## P1 后端优先能力

| 项目 | 状态 | 第一闭环 |
| --- | --- | --- |
| App Server 手动重载 | planned | 先实现 bridge generation、状态 API、单飞 restart promise、活动 turn/approval 阻断；前端按钮后置 |
| Runtime diagnostics | planned | 只返回脱敏状态、PID、generation、pending 数、最后退出/重启原因 |
| 配置变化检测 | planned | 评审 `config.toml`、`auth.json`、Provider/base_url 的安全签名，不返回原文或 Token |
| Desktop 项目状态读取 | planned | 后端只读解析已知项目字段；容忍缺失/损坏/版本漂移 |
| 全量 thread/list 项目发现 | planned | 完整分页、默认排除 archived、路径规范化与最长父路径匹配 |
| Project Sync 预览/merge | planned | 先提供只读 preview 和 merge；mirror 默认禁用且需二次确认 |

## P2 延期前端与消息流

| 项目 | 状态 | 说明 |
| --- | --- | --- |
| Settings 中 Reload Codex Engine | deferred | 等后端状态机和 API 稳定后再做 |
| Projects 中 Sync Projects | deferred | 等 preview/merge 后端协议稳定后再做 |
| `Thread -> Turn -> Item` Timeline | deferred | 保留旧 `ThreadConversation.vue`，先建 reducer/适配层，再渐进迁移 |
| 断线恢复与多客户端可见性 | planned | 先建立可重复诊断，再改行为 |
| 大型历史窗口化、移动端、明暗主题 | deferred | 与 Timeline 迁移一起做性能与视觉验证 |

## 下一实施顺序

1. 单独修复或约束 Windows dev wrapper，并确认 Codex CLI 0.144.6 app-server 退出原因。
2. 为 Runtime Reload 写状态机单测，再实现只读 status API。
3. 实现 restart 单飞、活动 turn/approval 保护、旧 RPC 失败收敛和 diagnostics。
4. 实现 Project Sync 的 Desktop reader、thread/list 全分页和 preview API。
5. 最后开始 Reload/Sync UI 与 Timeline/Parity 工作。
