# Custom Fork 需求基线

优先级：P0 阻塞安全/可用性；P1 核心维护能力；P2 大型体验与架构迁移。状态：`done-in-branch`、`planned`、`deferred`、`excluded`。

## 基线与上游维护

| 编号 | 用户场景 | 功能需求 | 非功能需求 | 验收标准 | 优先级 | 状态 |
| --- | --- | --- | --- | --- | --- | --- |
| BASE-001 | Windows 与 Ubuntu 双机远程使用 | 两台主机各自运行 codexapp + app-server，并可经 FRP 访问 | Windows 优先，Ubuntu 24.04 兼容 | 两平台构建、启动、RPC、WS 和核心流程通过 | P0 | planned |
| BASE-002 | 安全开始维护 | 检查分支、工作区、remote、HEAD、工具版本和测试基线 | 不覆盖本地修改，不在 main 实验 | 审计文档含真实 commit/version/result | P0 | done-on-main |
| BASE-003 | 可持续同步上游 | 配置 `upstream=friuns2/codex-mobile`，逐 PR 选择性集成 | 不盲合并，不使用自动 ours/theirs | 每 PR 独立 diff、commit、测试、风险与回滚 | P0 | done-on-main |
| BASE-004 | 可复现构建 | 固定包管理器和依赖解析 | 供应链可审计 | lockfile 与双平台 clean install/build 通过 | P0 | planned |
| PR-203 | PowerShell 可运行 codex 但 Node 找不到 | 统一 Windows Codex 命令探测、登录、临时/主 app-server 启动 | 不增加 probe/网络，不读取认证 | shim 走 cmd.exe，bundled bin path 正确，测试/build 通过 | P0 | done-on-main |
| PR-209 | GPT-5.6 选择 max/ultra | 从 `model/list` 读取每模型 supported/default reasoning | 未声明能力不显示新档；切模有确定 fallback | Sol/Terra/Luna/5.5 与未知模型菜单和 payload 正确 | P0 | done-on-main |
| PR-212 | Windows 文件链接 404 | `/C:/...` 还原为 `C:/...` | Unix、UNC、已规范化、坏编码不回归 | unit、真实 GET、TestChat 三断言通过 | P0 | done-on-main |
| PR-211 | 不需要 Goal mode | 不集成 Goal mode PR | 不引入无关 UI/状态 | 分支与文档无 Goal mode 代码 | P0 | excluded |

## Runtime Reload 与诊断

| 编号 | 用户场景 | 功能需求 | 非功能需求 | 验收标准 | 优先级 | 状态 |
| --- | --- | --- | --- | --- | --- | --- |
| RUN-001 | 查看引擎状态 | `GET /codex-api/runtime/status` 返回 status、PID、startedAt、generation、活动 turn/approval 数和 restart 状态 | 现有认证；字段 allowlist；无 Token/env | schema 单测和未认证拒绝测试通过 | P1 | planned |
| RUN-002 | 手动读取 CC Switch 新配置 | `POST /codex-api/runtime/restart-app-server` 仅重启 bridge 自己的 app-server | Web/FRP 端口不变；不控制任意 PID | generation +1，账户/模型/Provider/thread/roots 可刷新 | P1 | planned |
| RUN-003 | 活动任务保护 | `force=false` 时有活动 turn 返回 409 和准确数量 | 不误中断，不泄露 prompt | 并发与多 turn 单测通过 | P1 | planned |
| RUN-004 | 明确强制中断 | 二次确认后允许 `force=true` | 文案明确会中断；旧状态不可复用 | 活动 turn 中断、旧 RPC/approval 确定失败 | P1 | planned |
| RUN-005 | 多次点击重载 | 并发请求合并为同一 restart promise | 单飞；无重复 child；按钮禁用 | 10 并发请求只产生一个新 PID/generation | P1 | planned |
| RUN-006 | app-server 启动失败 | 状态机进入 failed 并保留可重试诊断 | pending RPC 有超时/拒绝；不永久挂起 | 失败、超时、恢复测试通过 | P1 | planned |
| RUN-007 | 配置自动变化 | 明确签名覆盖的参数、Provider/base_url 和安全文件摘要 | 不哈希/记录敏感原文；跨平台稳定 | config/auth/provider 变化矩阵有测试 | P1 | planned |
| RUN-008 | 远程排障 | `/runtime/diagnostics` 返回 bridge/WS/PID/generation/脱敏 turn/pending/最后退出重启信息 | 认证；无路径/Token/prompt | 响应快照与泄密测试通过 | P1 | planned |
| RUN-UI-001 | Settings 中手动重载 | 增加 Reload Codex Engine/重新加载 Codex 引擎，展示阻断、确认、进度和结果 | 保留当前 route；移动端/明暗主题 | 后端稳定后完成 Desktop parity 和浏览器验证 | P2 | deferred |

## Project Sync

| 编号 | 用户场景 | 功能需求 | 非功能需求 | 验收标准 | 优先级 | 状态 |
| --- | --- | --- | --- | --- | --- | --- |
| PROJ-001 | 网页项目与 Desktop 不一致 | 支持 Manual、Codex Desktop、Smart 三种来源，Smart 推荐 | Desktop 文件只读；启动不依赖其存在 | 缺失/损坏/字段漂移均安全回退 | P1 | planned |
| PROJ-002 | 读取 Desktop 项目 | allowlist 提取 local-projects、order、roots、assignments、hints、projectless 等已知字段 | 不返回完整 state，不读取无关敏感字段 | fixture 版本矩阵通过 | P1 | planned |
| PROJ-003 | 旧 thread 超过首页 | 完整分页 `thread/list`，默认排除 archived，可选包含 | 有上限/取消/错误处理；不只读前 50 条 | 150+ thread fixture 无遗漏/重复 | P1 | planned |
| PROJ-004 | Windows/Linux 路径漂移 | drive 大小写、分隔符、尾斜杠、`\\?\`、realpath、symlink/junction 安全规范化 | Windows 大小写不敏感；Linux 敏感；不存在安全回退 | 双平台 path table 全通过 | P1 | planned |
| PROJ-005 | cwd 是子目录/worktree | assignment > hint > 最长父路径 > Git root > cwd candidate 匹配 | 同名不同路径不误合并 | worktree/多 root/子目录 fixture 通过 | P1 | planned |
| PROJ-006 | 同步前评估影响 | preview 分类 add/existing/merge/missing | 只读、可重复、确定排序 | 同输入生成相同 preview | P1 | planned |
| PROJ-007 | 安全合并 | merge 添加/改名/排序并保留手动项目，不自动删除 | 幂等；写入失败可回滚 | 两次 apply 结果一致，手动项目保留 | P1 | planned |
| PROJ-008 | 严格镜像 | mirror 与来源一致，删除前二次确认，默认不可用 | 精确删除列表；防误触 | 无确认 token 不能执行 | P2 | planned |
| PROJ-UI-001 | 一键同步 | Projects 标题旁增加 Sync Projects/同步项目与预览 | 自定义 menu，非 native select；移动端/明暗主题 | 后端 preview/apply 稳定后做 parity 验证 | P2 | deferred |

## Timeline 与断线行为

| 编号 | 用户场景 | 功能需求 | 非功能需求 | 验收标准 | 优先级 | 状态 |
| --- | --- | --- | --- | --- | --- | --- |
| TIME-001 | 历史与实时显示不一致 | 建立 Thread -> Turn -> TimelineEntry 模型 | 类型可扩展，不长期压成扁平 UiMessage | history/live 使用同一 reducer | P2 | deferred |
| TIME-002 | 重连后重复/丢事件 | `applyTimelineEvent` 处理 read/resume/turn/item/delta/completed/diff/approval/断线 | threadId/turnId/itemId 幂等去重 | 重放事件结果一致，无重复乐观消息 | P2 | deferred |
| TIME-003 | 文件修改来源混乱 | 优先 fileChange item、item completed、turn diff、persisted read，文本只做兜底 | 不猜测最终文本 | 文件卡片 fixture 顺序和内容正确 | P2 | deferred |
| TIME-004 | Worked 区域可读 | 命令、reasoning、file change 放入 Turn Worked；最终答复独立 | 命令输出可折叠；Plan/approval/error 完整 | Desktop 对照清单与浏览器截图通过 | P2 | deferred |
| TIME-005 | 大型历史卡顿 | 保留窗口化/懒加载，避免一次渲染全部 DOM | 测量 DOM、long task、内存、API payload | 目标阈值在实现前单独定义并测量 | P2 | deferred |
| DISC-001 | 关闭浏览器继续运行 | WS close 只取消订阅，不调用 interrupt | 不依赖浏览器存活 | 关闭/重开后 turn 继续并可 read 恢复 | P1 | planned |
| DISC-002 | 多客户端观察 | Desktop/另一浏览器可观察同一活动 turn | 对账不重复、不丢最终状态 | 两客户端手测和事件日志通过 | P1 | planned |
| DISC-003 | 区分进程退出 | 明确浏览器断开、app-server 重启、codexapp 重启 | 诊断只记录脱敏原因 | 三种场景状态和日志可区分 | P1 | planned |

## 安全、测试与 Parity

| 编号 | 用户场景 | 功能需求 | 非功能需求 | 验收标准 | 优先级 | 状态 |
| --- | --- | --- | --- | --- | --- | --- |
| SEC-001 | 保护认证 | 禁止读取/上传/记录敏感认证与完整配置 | 默认最小数据；无遥测 | 代码审查和日志/响应泄密测试通过 | P0 | planned |
| SEC-002 | 限制进程控制 | 只能重启当前 bridge child，不接受任意 PID/命令 | 现有认证覆盖 | 恶意 PID/命令字段被拒绝 | P0 | planned |
| TEST-001 | 每阶段可验证 | 提供修改文件、设计、单测、build、手测、限制、回滚 | 真实结果，不因耗时跳过 | `ROADMAP/AUDIT/TEST_PLAN` 同步更新 | P0 | done-on-main |
| TEST-002 | UI 不回归 | 亮/暗、375x812、768x1024，文件链接使用 TestChat 三断言 | 截图可追溯；无重叠/溢出 | assertion + screenshot 路径入测试报告 | P0 | done-on-main |
| PERF-001 | 功能不拖慢应用 | 每行为变更审计 duplicate requests、阻塞、fanout、payload、cache 和 bundle | 以测量或具体路径为证 | 每提交有性能记录 | P0 | done-on-main |
| PARITY-001 | 对齐 Desktop | 先观察、截图、列差异，再自行实现 | 不复制私有源码/资源 | 每项标 fixed/deviation/follow-up | P2 | planned |

## 状态更新规则

进入 `main` 只表示代码已合并，生产部署验证后才能改为 `deployed`。任何 stub UI 测试必须标明 stub 范围，不能替代真实 app-server/Provider 验证。
