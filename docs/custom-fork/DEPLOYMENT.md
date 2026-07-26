# Windows 11 与 Ubuntu 24.04 部署

本文只记录可审计的部署形态。任何 `auth.json`、Token、API Key、FRP authentication token 或完整 `config.toml` 都不得写入仓库、命令输出或日志。

## 共同前置条件

- 从本 Fork 的固定 commit 构建，不直接信任来源不明的 npm 构建产物。
- Node.js 18+；当前 Windows 验证版本为 22.16.0。
- 当前仓库没有 lockfile。增加 lockfile 前，依赖安装不能声称完全可复现；生产更新必须保留上一个 build 和 commit 作为回滚点。
- 使用已经登录的全局 Codex CLI；除非明确要求隔离，不复制认证文件到临时项目。
- 对外访问通过 FRP/反向代理，`codexapp` 本身只监听预期接口和端口。

## 构建

当前可验证命令：

```powershell
$env:COREPACK_ENABLE_PROJECT_SPEC = '0'
corepack pnpm@10.18.3 install --lockfile=false
corepack pnpm@10.18.3 run test:unit
corepack pnpm@10.18.3 run build
node dist-cli/index.js --help
```

`test:unit` 在 Windows 的两项平台限制见 `TEST_PLAN.md`，不能把非零退出码简单忽略；必须确认失败集合没有扩大。

## Windows 11

### 建议目录与环境

| 项目 | 建议值 |
| --- | --- |
| 运行用户 | 登录并持有 Codex CLI 认证的普通用户，不使用 SYSTEM 启动 codexapp |
| `CODEX_HOME` | `%USERPROFILE%\.codex`，或明确配置的用户级目录 |
| 工作目录 | 本 Fork 固定 commit 的 checkout 或只读 release 目录 |
| 监听端口 | 例如 `5900`，与 FRP `local_port` 一致 |
| 日志 | 用户可写的独立日志目录；定期轮转，不记录环境变量全文 |

### 启动命令

```powershell
$env:CODEX_HOME = "$env:USERPROFILE\.codex"
node D:\path\to\codex-mobile\dist-cli\index.js `
  --port 5900 `
  --no-open `
  --no-tunnel `
  --no-login
```

计划任务建议：

- 触发器：目标用户登录时。
- 用户：持有认证的普通用户。
- `Start in`：固定 checkout/release 目录。
- 失败重试：有限次数并写事件/文本日志，避免无限重启循环。
- 不把 Token 放在任务参数中；敏感配置使用既有用户级安全存储。

FRP 建议作为独立服务/任务运行，配置只包含本地地址、端口和服务端分配信息；仓库只记录脱敏模板：

```toml
[[proxies]]
name = "codexapp-windows"
type = "tcp"
localIP = "127.0.0.1"
localPort = 5900
remotePort = 0 # 由部署环境填写
```

完整 codexapp 重启会影响 bridge 和 app-server。未来的 `Reload Codex Engine` 只重启 app-server，不能替代进程级升级重启。

## Ubuntu 24.04

建议使用 `systemd --user`，让服务以持有 Codex 认证的登录用户运行。

```ini
[Unit]
Description=CodexApp custom fork
After=network-online.target
Wants=network-online.target

[Service]
Type=simple
WorkingDirectory=/opt/codex-mobile
Environment=CODEX_HOME=%h/.codex
ExecStart=/usr/bin/node /opt/codex-mobile/dist-cli/index.js --port 5900 --no-open --no-tunnel --no-login
Restart=on-failure
RestartSec=5

[Install]
WantedBy=default.target
```

启用与日志：

```bash
systemctl --user daemon-reload
systemctl --user enable --now codexapp.service
journalctl --user -u codexapp.service -n 200 --no-pager
```

需要无交互登录后继续运行时，单独评审 `loginctl enable-linger <user>` 的安全影响。FRP 使用独立 user/system service，不能把 Codex 认证写入 FRP unit。

## 升级流程

1. 记录生产 commit、Node/Codex CLI 版本和当前健康状态。
2. 在非生产目录构建并运行单测、build、CLI smoke。
3. 备份可恢复的部署配置与当前 build；不复制或打印认证内容。
4. 选择维护窗口，确认没有活动 turn 或明确接受中断。
5. 切换到新 build，重启 codexapp 服务。
6. 验证 HTTP、WebSocket、thread/list、模型列表和一个只读项目路径。
7. 失败时恢复旧 build/commit 并重启，不对 `CODEX_HOME` 做破坏性清理。

## 当前待补实测

- Windows 计划任务的最终名称、启动脚本和日志路径需要在部署主机确认后填写。
- Ubuntu unit 尚未在目标 24.04 主机执行。
- FRP TLS/auth、服务端端口和防火墙策略属于部署私密配置，不进入仓库。
