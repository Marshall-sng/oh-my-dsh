# oh-my-dsh-agent-button

omo-dsh 多智能体套件的**独立 Agent 按钮**——一个专属前端控件，列出 omo
智能体名册并切换会话的 Agent，不借用官方预设选择器。

## 形态

- **chip**：显示当前 Agent（omo 预设时显示其名，standard/cordis 时显示中性
  「Agent」）；点击弹出名册
- **名册弹层**：七个专家（orchestrator / explorer / fixer / oracle /
  designer / council / observer），各带图标、名称、中文/英文职责；当前项
  高亮带「当前」徽标；Host 拒绝时 inline 报错
- **双曲面注册**：
  - 新会话行 `conversation.hero.options`（workspace/预设控件之后，右对齐弹出）
  - composer 工具行 `conversation.input.left`（左对齐弹出）
- **弹层宿主**：`shell.overlay`——行容器会裁剪绝对定位的子元素（7 项曾被裁到
  2 项），框架级浮动层不受其影响；chip 测量自身锚点，弹层据此定位，空间
  不足时向上翻转
- 官方预设选择器保持原位，继续服务 standard / cordis / ptc / minimal

## 实现（薄层）

客户端 UI 插件 over 现有 Remote API，官方机制零修改：

| 调用 | 用途 |
|---|---|
| `ctx.remote.agentPresets.list()` | 拉取预设名册，按 omo id 白名单过滤 |
| `ctx.remote.agentPresets.select(sessionId, id)` | 切换会话 seat |
| `session.projectionValues.agentPreset` | 当前 Agent 显示 |
| `ctx.locale.register/bind` | 中英文案 |
| `styles.insert` + `--dsw-alias-*` 令牌 | 主题继承样式 |

会话解析沿用官方预设选择器的 main-view 保留启发式。chip 与弹层分处两个
slot，通过模块内共享 store（open / anchor / current）通信。

**注意**：`ctx.slots.register({name, id, order, label})` 的 `name` 是 slot 名，
缺失会导致整个插件 entry 激活失败（页面报 "Failed to load plugins"）。

## 已知限制（v1）

- 官方 `select` 只对**空白/新会话**生效（`session.blank` 门控）——活跃会话
  切换是否放行由 Host 决定，实测结果记录在 `docs/p0-verify.md`
- 只切会话身份；lane 状态显示与派发控制推迟到 P2
- 白名单为插件内常量，新增专家需同步 `OMO_AGENTS`

## 安装 / 回滚

```text
plugin_manager install_bundle <此目录>     # 装入 desktop profile
plugin_manager set_bundle oh-my-dsh-agent-button enabled=false   # 禁用
```

新 client 模块代可能需要重启桌面应用加载（会话状态会保留）。
禁用/移除后官方 UI 原样恢复。
