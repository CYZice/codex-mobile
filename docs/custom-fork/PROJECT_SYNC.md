# 项目状态同步

## 问题结论

Codex Desktop 的项目状态不是单一 roots 数组：

- `electron-saved-workspace-roots` 保存本机绝对路径。
- `local-projects` 以项目 ID 为 key，每项包含 `id`、`name`、`rootPaths` 和时间戳。
- `project-order` 保存项目 ID，不是路径。
- `thread-project-assignments`、workspace hints 和 `thread/list` 提供线程归属信息，但不应由网页直接覆盖。

旧后端只读取 saved roots，并把 `project-order` 当路径读写，因此有两个确定问题：Desktop 已登记但未进入 saved roots 的项目不会显示；网页新增项目只进入 saved roots，没有写入 `local-projects`，Desktop 项目模型与网页项目模型持续分叉。前端 API 还永久缓存 roots state，使已经打开的页面不能及时观察其他客户端或 Desktop 的修改。

## 当前修复

后端 API 仍向网页暴露路径型 `WorkspaceRootsState`，磁盘适配层负责翻译 Desktop 数据：

1. 读取时只解析 `local-projects` 的项目 ID、名称和 `rootPaths`，与 saved roots 去重合并。
2. 将磁盘 `project-order` 的项目 ID 翻译为网页使用的 root path；远程项目 ID 保持不变。
3. 写入时把网页路径顺序翻译回项目 ID。网页新增路径会获得独立项目 ID，并写入 `local-projects`。
4. 重命名保留项目未知字段，只更新明确的名称、roots 和 `updatedAt`；网页明确移除 root 时同步注销对应本地项目。
5. 其他 `.codex-global-state.json` 顶层字段原样保留，不读取或返回认证、窗口、实验开关等无关内容。
6. roots API 缓存改为 2 秒 TTL，并继续合并并发 GET；重新聚焦、刷新线程或重新打开页面时会重新读取。
7. bridge 启动时执行一次幂等迁移；只有 saved roots、local project roots 或 ID 顺序不一致时才写文件，首次 roots GET 会等待迁移结束。

## 设备边界

- 同一 CodexApp Remote 主机：Desktop、手机浏览器和其他电脑浏览器共享该主机的 `CODEX_HOME`，项目增删改会落到同一个持久状态文件。
- 不同后端主机：Windows 与 Ubuntu 的绝对路径和文件系统不同，不能复制本地项目记录来伪装同步。应分别发现本机项目，并通过 `remote-projects`/host ID 在一个界面中表示远端项目。
- 当前修复不包含跨主机中心数据库、自动镜像删除或复杂 Sync Projects 前端；preview/mirror 仍按路线图后置。

## 发布前检查

1. 备份目标主机的 `.codex-global-state.json`，不得备份 `auth.json` 到仓库。
2. 启动任何开发/测试服务器前显式设置隔离 `CODEX_HOME`；启动迁移具备写能力，不能让测试实例默认指向用户状态。
3. 在隔离 `CODEX_HOME` 验证 Desktop-only、web-only、同名多路径和删除往返。
4. 发布新包后从另一浏览器打开相同远程地址，确认新增项目存在。
5. 打开 Codex Desktop，确认项目出现且 `project-order` 仍是项目 ID。
6. 若需回滚，恢复上一版本程序；只有状态结构验证失败时才使用发布前备份恢复全局状态。

## 性能边界

每次 roots GET 对 `local-projects` 做一次有界线性扫描和现有路径的 `realpath`。没有目录递归、thread fanout 或新增轮询；前端最多每 2 秒重新发起一次 roots GET，且同一时刻的调用共享一个 Promise。
