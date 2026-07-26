# 上游同步流程

## Remote 约定

```text
origin   https://github.com/CYZice/codex-mobile.git
upstream https://github.com/friuns2/codex-mobile.git
```

初始化：

```powershell
git remote add upstream https://github.com/friuns2/codex-mobile.git
git fetch origin --tags --prune
git fetch upstream --tags --prune
```

## 每次同步前

1. 检查功能 worktree 的 `git status --short` 和当前分支。
2. 检查 main worktree 是否干净。
3. 检查 `.git/MERGE_HEAD`、`.git/rebase-merge`、`.git/rebase-apply`。
4. `git fetch origin` 与 `git fetch upstream`。
5. 若存在 PR，读取 PR state、head/base、merge state、checks、完整 diff 和 commits。
6. 比较 `main...HEAD` 的 diff stat 与提交列表。

main 有本地改动时，先按仓库规则提交精确 checkpoint；不得覆盖未提交修改。

## 选择性 PR 集成

每个 PR 单独完成：

1. 确认 PR head SHA 与 base SHA，检查是否仍基于当前 upstream main。
2. 阅读完整 diff；检查认证、网络、遥测、凭据、文件系统和跨平台修改。
3. 检查与 Fork 自定义功能和其他候选 PR 的重叠。
4. 优先 cherry-pick 必需 commit；不带入无关重构。
5. 冲突逐段理解，禁止 `-X ours/theirs` 或整树选择一侧。
6. 增加/修正回归测试和对应 `tests/<domain>/` 手测文档。
7. 每个 PR 后分别运行 targeted tests、全量 unit、production build 和必要 UI/CLI smoke。
8. 做性能审计，记录请求数、阻塞工作、fanout、payload、bundle 或具体代码路径。
9. 使用独立提交，提交信息包含原 PR、集成方式、本地调整、测试和性能结果。
10. 更新 `UPSTREAM_PR_AUDIT.md`、`ROADMAP.md`、`TEST_PLAN.md`。

## 分支与 GitHub 路径

- 不在 `main` 上做合并实验。
- 使用短期集成分支，例如 `integration/upstream-prs`。
- 集成完成后 re-check live state，并 rebase/更新到最新 `main`。
- 优先把集成分支推到 `origin`，创建 fork 内 PR，经 checks/审查后在 GitHub 合并。
- 上游 `friuns2` PR 可能仍保持 OPEN；Fork 集成不等于有权限替上游维护者关闭 PR。
- 合并后验证 `origin/main` 确实包含目标提交或文件 diff。

## Fork 扩展边界

- 维护与需求文档集中在 `docs/custom-fork/`。
- Runtime lifecycle、Project Sync 和 Timeline 新代码应按功能集中，不把个性化条件散落在 `App.vue`、bridge 和多个组件中。
- 旧公共 API 的兼容层只能有明确迁移期限和测试，不能无限保留双实现。
- 上游同步时优先保留已经验证的 Fork 行为；若上游提供更完整实现，先做行为对照再替换。

## 高风险冲突

- `package.json`、`tests.md`、`tests/`：从 Fork 当前版本出发，再逐项吸收上游必要内容。
- `src/server/codexAppServerBridge.ts`：检查 child lifecycle、pending RPC、配置签名、Provider/Auth 和通知事件。
- `src/composables/useDesktopState.ts`：检查启动请求去重、Provider/model context、workspace roots 和持久化键。
- `ThreadConversation.vue`/Markdown 渲染：检查代码高亮、Diff、文件链接、HTML 安全和窗口化性能。

## 回滚

- 未推送集成分支：使用新的反向提交或放弃该分支，不破坏 main。
- 已进入 fork main：对单个集成提交执行 `git revert <commit>`，重新跑对应 tests/build，再通过 GitHub PR 合入回滚。
- 已部署：切回上一个已验证 build/commit；不清理 `CODEX_HOME`，不删除认证或项目状态。
