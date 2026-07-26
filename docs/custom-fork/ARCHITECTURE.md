# 架构与进程边界

## 目标拓扑

```text
手机或电脑浏览器
        |
        | HTTPS/HTTP + WebSocket
        v
       FRP
        |
        v
codexapp Node/Express/Vite 后端
        |
        | stdin/stdout JSON-RPC
        v
Codex App Server 子进程
        |
        +--> Codex CLI 安装/命令解析
        +--> 项目目录与 Git worktree
        +--> CODEX_HOME 中的会话、配置与认证状态
```

Windows 11 与 Ubuntu 24.04 各自运行这一整套链路。两台主机不能共享 PID、内存状态或本地项目路径；需要共享的会话信息只能通过各自主机可访问的 `CODEX_HOME`/项目存储机制协调。

## 当前实现

- `src/server/codexAppServerBridge.ts` 中的 `AppServerProcess` 负责解析 Codex 命令、启动 app-server、初始化 JSON-RPC、维护 pending RPC、server request、通知订阅和部分 thread 缓存。
- 主 app-server、登录流程和临时 app-server 在 PR #203 后统一使用 `resolveCodexCommand()` 与 `getSpawnInvocation()`。
- 浏览器通过 `/codex-api/rpc` 和 `/codex-api/ws` 访问 bridge。WebSocket `close` 只取消通知 listener；当前代码不会因浏览器断开自动调用 `turn/interrupt`。
- app-server 退出时，当前 pending RPC 会被 reject，pending approval/request map 会清空。
- `dispose()` 会结束 stdin、发送 `SIGTERM`，并在 1.5 秒后尝试 `SIGKILL`。Windows 上 signal 的最终语义必须通过集成测试确认。

## 生命周期结论

### 浏览器关闭

- 应只影响浏览器连接和 WebSocket notification subscription。
- 不应停止 `codexapp`，不应停止 app-server，不应中断活动 turn。
- 重新打开后应依赖 `thread/read`/`thread/list` 与持久状态重新对账，而不是依赖旧浏览器内存。

### codexapp 退出

- HTTP/WS 服务消失，bridge 内存状态丢失。
- 由该 bridge 创建的 app-server 不再可被可靠控制；部署和退出处理必须确保子进程被回收。
- 这与单纯关闭浏览器不同。

### app-server 重启

- 活动 turn 可能被中断。
- 所有旧 generation 的 pending RPC、approval 和 notification 不能继续被视为有效。
- Web 端口、FRP 地址和 Node/Express 进程可以保持不变。这是未来 Runtime Reload 的边界。

## 配置签名现状

当前 `getAppServerConfigSignature()` 只序列化最终 app-server `args` 和 bridge 额外注入的 `env`。它不直接哈希 `config.toml`、`auth.json` 或这些文件的 mtime/content，因此不能声称 CC Switch 对任意配置/认证变化都一定触发自动重启。

未来实现必须：

- 只对允许的文件元数据或脱敏摘要做签名；绝不记录原文或 Token。
- 手动重载始终重新解析 Codex 命令、Provider、模型和当前环境。
- 为每次 app-server 实例分配单调递增 generation。
- 所有旧 generation 的 RPC 和审批必须快速失败，不得永久挂起。

## Codex Desktop 边界

- Codex Desktop 与 `codexapp` 通常各自启动 app-server；重载其中一个不等于重启另一个。
- 两者可读取相同 `CODEX_HOME`，但内存缓存、项目白名单、workspace roots、选中 thread 和流式状态仍可能不同。
- Desktop 状态文件只能只读解析已确认的项目字段；不得修改或把完整 JSON 返回浏览器。

## 未来模块边界

- Runtime lifecycle 应集中在 bridge/runtime 模块，不把 restart 逻辑散落到路由和 Vue 组件。
- Project discovery 应拆成 Desktop state reader、thread pagination、path canonicalization、matching 和 preview/apply 五个可测试边界。
- Timeline 先建立纯 reducer 和旧 `UiMessage[]` 适配器，再迁移组件；不得一次性删除 `ThreadConversation.vue`。
