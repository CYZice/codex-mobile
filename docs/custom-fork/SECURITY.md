# 安全基线

## 敏感信息

- 禁止读取、上传、提交、记录或打印 `auth.json`、API Key、Access Token、Refresh Token、session cookie 和 FRP authentication token。
- 禁止把完整 `config.toml`、完整环境变量或 Desktop global-state 文件返回前端。
- 日志只允许记录脱敏状态、枚举值、时间、generation、计数和非敏感错误分类。
- 测试 fixture 必须使用虚构值，不复制真实账户、邮件、用户 ID 或本机认证内容。

## Runtime API

- 所有 status/restart/diagnostics 接口必须经过现有 HTTP 认证。
- 浏览器不得提交任意 PID、命令、可执行路径或 signal。
- 只允许控制当前 bridge 创建并持有句柄的 app-server 子进程。
- `force=false` 遇到活动 turn 返回 409；`force=true` 必须经过前端明确二次确认。
- 并发 restart 必须合并到同一个 promise；restart 期间拒绝或复用后续请求。
- restart 后旧 generation 的 RPC、approval 和 notification 必须失效并得到确定错误。

## Project Sync

- Desktop 状态文件只读；不修改 Codex Desktop 的 userData 或 `.codex-global-state.json`。
- 只提取允许列表中的项目字段，不返回源文件全文或无关字段。
- `thread/list` 只保留项目匹配需要的 id、cwd、title、updatedAt、archived 等字段。
- 路径不存在、JSON 损坏、字段漂移必须降级，不影响服务启动。
- `merge` 不删除手动项目；`mirror` 默认禁用，删除前必须显示精确预览并二次确认。

## 本地文件与远程访问

- 该服务面向单用户本地主机，但 FRP 会扩大可达范围；必须保留现有认证并限制公开入口。
- 文件浏览/编辑路由不得演变为任意远程用户接口。任何远程部署必须先验证认证覆盖范围。
- 不接受网页指定任意进程终止，不把本地绝对路径、认证路径或完整诊断数据暴露给未认证调用者。

## 依赖与供应链

- 推荐从本 Fork 的固定 commit 自行构建。
- 当前无 lockfile 是已知风险；添加 lockfile 需要单独依赖审计和双平台 build 验证。
- 不使用来源不明的 npm tarball、预构建二进制或远程脚本替换固定构建。
- 不新增遥测，除非功能、数据字段、目的和关闭方式经过明确评审；默认必须关闭。

## 日志允许列表

允许：HTTP status、RPC method 名、耗时、payload 字节数、app-server PID/generation、活动 turn 数、pending request 数、最后退出分类和时间。

禁止：请求正文全文、prompt 正文、文件内容、认证 header、cookie、Token、完整环境变量、完整 Desktop state、`auth.json`/`config.toml` 原文。

## 安全回归检查

每个 Runtime/Project Sync 变更至少检查：认证覆盖；响应字段 allowlist；日志脱敏；旧 generation 失败收敛；并发/重放；任意 PID/路径注入；Desktop 文件只读；无新增遥测。
