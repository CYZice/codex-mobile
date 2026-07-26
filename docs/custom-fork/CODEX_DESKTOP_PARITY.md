# Codex Desktop Parity 工作流

Parity 的目标是对齐可观察行为和数据语义，不是复制 Desktop 私有源码、解包资源或内部实现。

## 每个可见改动的顺序

1. 在同一任务、同类 thread 和接近的窗口尺寸下观察 Codex Desktop。
2. 记录布局、间距、字体层级、状态文案、事件顺序、展开/折叠、滚动与断线恢复。
3. 保存 `codex-desktop-reference`、`web-before`、`web-after` 截图。
4. 建立差异清单，并给每项标记 `fixed`、`intentional deviation` 或 `needs follow-up`。
5. 基于 Codex App Server 的公开 Thread/Turn/Item 数据自行实现。
6. 在 light/dark、375x812、768x1024 和桌面视口复测。

## 数据模型目标

```text
Thread
  Turn
    TimelineEntry
```

`TimelineEntry` 至少覆盖 user/assistant、reasoning、commandExecution、fileChange、plan、approval、mcpTool、error、image、attachment。持久历史与实时事件必须进入同一 reducer，并按 threadId/turnId/itemId 去重。

## 渐进迁移

1. 新建纯数据结构和 `applyTimelineEvent(state, event)` 单测。
2. 建立从现有 `UiMessage[]` 到 Timeline 的适配层。
3. 先让新 reducer 在影子模式对账，不改变 UI。
4. 逐类迁移 Worked、command、fileChange、plan、approval。
5. 最后替换主 conversation 容器；在此之前保留 `ThreadConversation.vue` 回退。

## 当前差异与状态

| 项目 | 状态 | 说明 |
| --- | --- | --- |
| 模型能力菜单 | fixed in integration | PR #209 按真实 metadata 限定 reasoning levels |
| Windows 本地链接 | fixed in integration | PR #212 修复 `/C:/...` 后端解析 |
| Turn 分组与统一 reducer | needs follow-up | 当前仍主要使用扁平 `UiMessage[]` |
| Worked/文件修改主数据源 | needs follow-up | 需要统一 fileChange/item/diff/persisted 优先级 |
| 断线恢复 | needs follow-up | 先做诊断与 reducer 对账 |
| Desktop 项目同步 | needs follow-up | 当前 workspace roots 与 Desktop 状态独立 |

## 禁止事项

- 不提交 Desktop 解包代码、私有资源、字体或图标。
- 不只凭颜色/像素模仿而忽略 event/data model。
- 不为一次截图删除窗口化、懒加载或错误恢复。
- 不一次性删除旧 conversation 实现。
