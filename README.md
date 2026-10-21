# oh-my-dsh

A seat-based multi-agent orchestration bundle for **DeepSeek Harness (DSH)**.

It ports the agent design of **[oh-my-opencode-slim](https://github.com/alvinunreal/oh-my-opencode-slim)** — the "omo-slim" pantheon of specialised agents — onto DSH's own seams: sessions, session projections, the tool runtime, and the subagent seam. Everything ships inside this bundle; **no official package is modified**.

> **Derived from**: this project is an adaptation of **oh-my-opencode-slim** (by *Boring Dystopia Development*, MIT licensed). The seat roster, personas, routing model and skill set are ported from that project; the DSH-side integration is original. See [Credits & License](#credits--license).

[English](#english) · [简体中文](#简体中文)

---

# English

## What it is

oh-my-opencode-slim's idea is simple: instead of forcing one model to do everything, route each part of the job to the agent best suited for it, balancing quality, speed and cost. This bundle implements that idea on DeepSeek Harness:

- **Eight specialised seats** — Orchestrator, Explorer, Fixer, Oracle, Designer, Council, Councillor, Observer — each with a persona and a real tool policy (read-only seats physically cannot write or spawn lanes).
- **A seat plane that lives beside DSH's official modes.** Seats are *not* agent presets: they are defined in the bundle's own seat table, dispatched as isolated lanes by the `omo_dispatch` tool, or applied to a session by the seat runtime. The official preset picker keeps showing only its own four modes.
- **Per-lane model routing** — each dispatch can name its own `provider`/`model`; when it does not, the seat's configured default applies; with neither, the lane inherits the parent session's *current* route.
- **A human-facing control surface** — the Agent chip in the composer row switches the session's seat and carries a per-seat "dispatch default model" editor.

## Features

### The seat table

| Seat | Role | Tool policy |
|---|---|---|
| `orchestrator` | Plans, delegates, reconciles and verifies | full (fs, search, shell, delegation) |
| `explorer` | Read-only codebase recon + external research | read-only (no write/edit/shell) |
| `fixer` | Bounded implementation of well-specified changes | fs + search + shell |
| `oracle` | Architecture, risk, debugging strategy, review | read-only |
| `designer` | UI/UX implementation and visual polish | fs + search + shell |
| `council` | Multi-model consensus synthesis | **zero tools** (allow-list `[]`) |
| `councillor` | One independent, read-only council vote | read-only, no delegation |
| `observer` | Visual analysis of images / PDFs / diagrams | read-only |

Tool policies are enforced at the **execution layer**, not just in the prompt: inherited tools are masked with `tools.restrict()`, and tools the session registered into its own scope are refused per call by a `tools.guard()` that reads the execution's tool name and re-checks the resolved definition. A tool registered after the seat landed is refused too.

### Dispatch, not prompts

The Orchestrator delegates through the `omo_dispatch` tool: one call = one isolated lane with the seat's persona, tool policy and model route. Independent lanes run in parallel, a lineage event records the relationship, and the parent receives the lane's final answer in a completion notice. The multi-model **Council** works the same way: councillor seats answer the same question on different models, then the zero-tool council seat synthesises the verdict.

### Seat model preferences

Each seat can carry a **dispatch-default model** — the model a lane uses when the dispatch does not name one. Configuration is layered and explicit:

1. dispatch call arguments (a full `provider` + `model` pair) — highest priority;
2. a user-level override file (`<DSH_HOME>/omo/seat-models.json`) with three states per seat: *use the seat default*, *force inherit the parent route*, or *this exact route*;
3. the seat definition's own default (in the shipped table or in `<DSH_HOME>/omo/presets.json` for user seats);
4. else the parent session's current route.

The override file is re-read on every dispatch (saving applies to the next dispatch, not to running lanes), written atomically under a cross-process lock with per-entry compare-and-swap, and never silently flattened when corrupt. The Agent chip's **Model** button edits it through a small typed Remote (`omoSeatModels`) — no JSON editing required.

### Skills

Twelve skills are ported from omo-slim (`deepwork`, `codemap`, `verification-planning`, `reflect`, `ai-estimates`, `deanchor`, `step-back`, `simplify`, `worktrees`, `clonedeps`, `loop-engineering`, and the `oh-my-dsh` meta-skill). Seats mount `skill-filesystem` + `tool-skill`, so every omo seat sees them in its skill catalog and loads them on demand.

### Commands

- `omo_dispatch` (tool) — dispatch one seat as a lane.
- `/preset [<seat-id>]` — list the omo seats and official modes, or switch this session's seat.

## Requirements

- **DeepSeek Harness** desktop `0.2.1-rc.2` or newer (CLI `0.2.0-rc.2` also works for the host side).
- The bundle declares these peers, resolved from the host: `@deepseek-ai/cordis`, `@deepseek-ai/dsh-llm`, `@deepseek-ai/dsh-tools`, `@deepseek-ai/dsh-subagent`, `@deepseek-ai/dsh-atomic-write`, `@deepseek-ai/dsh-typert-protocol`, `zod`.
- For per-lane model routing you need at least two registered provider routes, and the profile must allow them for the session that dispatches.
- The **Model** editor needs the bundle's client half (the Agent chip) to be mounted.

## Install

```text
plugin_manager → action: install_bundle → target: <absolute path to this directory>
```

or use the desktop GUI's **Plugins** page. The bundle's patch adds three rows:

- `command-preset` — the `/preset` command;
- `omo-dispatch` — the seat table, the `omo_dispatch` tool, the `omoSeats` session projection and the seat runtime;
- `omo-model-settings` — the `omoSeatModels` Remote that backs the model editor.

The patch also overrides the host's `subagent-model-selection-settings` row so the official `subagent` tool exposes routing parameters.

After installing, start a new session, open the Agent chip in the composer row, and pick a seat.

## Notes and limitations

- **Seats are not presets.** The official preset picker will never show them, and switching a seat does not change the session's model — that stays with the official model selector.
- Switching to an official mode from the picker lifts the omo layer for that session.
- The seat table is read from disk; user seats come from `<DSH_HOME>/omo/presets.json` and share the same `/preset` and chip surface.
- The model editor only affects **future lane dispatches**; already-running lanes keep their model.
- A council needs at least two distinct models in the profile; with fewer, it degrades to single-model consensus.
- The bundle needs a restart to pick up a new `presets.json` (user seats), while seat model preferences apply from the next dispatch without a restart.

## Credits & License

**MIT.** This project is a **derivative work adapted from [oh-my-opencode-slim](https://github.com/alvinunreal/oh-my-opencode-slim)**, an OpenCode agent-orchestration plugin by *Boring Dystopia Development* (author: [alvinunreal](https://github.com/alvinunreal)), released under the MIT License. The seat personas, routing philosophy and the twelve skills originate there. The DeepSeek Harness integration — seat runtime, tool-policy enforcement, session projections, the `omoSeatModels` Remote and the Agent chip — is written for this bundle.

The original MIT license notice is preserved in [LICENSE](LICENSE).

---

# 简体中文

## 这是什么

oh-my-opencode-slim（omo-slim）的核心想法很简单：不要逼一个模型干所有事，而是把工作拆给最适合的 agent，在质量、速度与成本之间取平衡。本 bundle 把这一设计移植到 **DeepSeek Harness（DSH）**：

- **八个专职席位**——总管（Orchestrator）、侦察（Explorer）、实现（Fixer）、顾问（Oracle）、设计（Designer）、议会（Council）、议员（Councillor）、观察（Observer），每个席位都有独立人格与**真实的工具策略**（只读席位在机制上无法写文件或派生子 agent）。
- **席位平面与 DSH 官方模式并存。** 席位不是 agent preset：它们定义在 bundle 自己的席位表里，由 `omo_dispatch` 工具派成隔离 lane，或由席位运行时叠加到当前会话。官方模式选择器始终只显示它自己的四个模式。
- **按 lane 指定模型**——每次派发可自带 `provider`/`model`；不传则用席位配置的默认模型；两者都没有时，lane 继承父会话**当前**的路由。
- **面向人的操作面**——输入框行的 Agent 芯片负责切换会话席位，并内置每个席位的「派工默认模型」编辑器。

## 特性

### 席位表

| 席位 | 职责 | 工具策略 |
|---|---|---|
| `orchestrator` | 规划、派发、整合、验证 | 全套（文件、搜索、shell、派发） |
| `explorer` | 只读侦察代码库 + 外部调研 | 只读（无 write/edit/shell） |
| `fixer` | 有界实现、规格明确的改动 | 文件 + 搜索 + shell |
| `oracle` | 架构、风险、调试策略、审查 | 只读 |
| `designer` | UI/UX 实现与视觉打磨 | 文件 + 搜索 + shell |
| `council` | 多模型共识综合 | **零工具**（allow-list `[]`） |
| `councillor` | 议会独立一票，只读 | 只读，禁派生 |
| `observer` | 图像 / PDF / 图表视觉分析 | 只读 |

工具策略在**执行层**落实，不只是写在 prompt 里：继承来的工具被 `tools.restrict()` 掩掉；会话自身作用域注册的工具由 `tools.guard()` 在执行时按工具名拒绝，并重新检查实际会执行的定义——席位装好之后才注册的工具同样拦得住。

### 派发而不是提示词

总管通过 `omo_dispatch` 工具派活：一次调用 = 一条隔离 lane，带席位人格、工具策略与模型路由。独立的 lane 并行跑，血缘事件记录归属，父会话会在 lane 结束时收到带正文的完成通知。多模型**议会**同理：议员席位用不同模型回答同一个问题，零工具的议会席位负责综合裁决。

### 席位默认模型

每个席位可以配置一个**派工默认模型**——派发时没指定模型就用它。优先级明确分层：

1. 派发调用参数（完整的 `provider` + `model` 对）——最高；
2. 用户级覆盖文件（`<DSH_HOME>/omo/seat-models.json`），每席位三态：用席位默认 / 强制跟随父会话 / 指定具体路由；
3. 席位定义里的默认（出厂席位表，或用户席位在 `<DSH_HOME>/omo/presets.json` 里的配置）；
4. 否则跟随父会话当前路由。

覆盖文件**每次派发都重读**（保存后对下一次派发生效，不影响正在跑的 lane），写入走跨进程锁 + 原子替换 + 按条目 CAS，文件损坏时绝不悄悄抹空。Agent 芯片的「模型」按钮通过一个类型化 Remote（`omoSeatModels`）读写它——不需要手改 JSON。

### 技能

从 omo-slim 移植了十二个技能（`deepwork`、`codemap`、`verification-planning`、`reflect`、`ai-estimates`、`deanchor`、`step-back`、`simplify`、`worktrees`、`clonedeps`、`loop-engineering`，以及改名后的 `oh-my-dsh` 元技能）。席位挂载 `skill-filesystem` + `tool-skill`，所以每个 omo 席位都能在技能目录里看到并按需加载。

### 命令

- `omo_dispatch`（工具）——把一个席位派成 lane。
- `/preset [<席位 id>]`——列出 omo 席位与官方模式，或切换当前会话的席位。

## 环境要求

- **DeepSeek Harness** 桌面版 `0.2.1-rc.2` 或更新（宿主半边在 CLI `0.2.0-rc.2` 上也可用）。
- bundle 声明以下 peer，由宿主解析：`@deepseek-ai/cordis`、`@deepseek-ai/dsh-llm`、`@deepseek-ai/dsh-tools`、`@deepseek-ai/dsh-subagent`、`@deepseek-ai/dsh-atomic-write`、`@deepseek-ai/dsh-typert-protocol`、`zod`。
- 要按 lane 指定模型，profile 里至少要有两条已注册的 provider 路由，且派发会话被允许使用它们。
- 「模型」编辑器需要 bundle 的客户端半边（Agent 芯片）已挂载。

## 安装

```text
plugin_manager → action: install_bundle → target: <本目录的绝对路径>
```

或使用桌面 GUI 的 **Plugins** 页面。bundle 的 patch 会加入三行：

- `command-preset`——`/preset` 命令；
- `omo-dispatch`——席位表、`omo_dispatch` 工具、`omoSeats` 会话投影与席位运行时；
- `omo-model-settings`——为模型编辑器提供数据的 `omoSeatModels` Remote。

patch 还会覆盖宿主的 `subagent-model-selection-settings` 行，让官方 `subagent` 工具暴露路由参数。

安装后新建会话，点输入框行的 Agent 芯片，选一个席位即可。

## 说明与限制

- **席位不是 preset。** 官方模式选择器里永远不会出现它们；切换席位也不改变会话模型——模型仍由官方模型选择器掌管。
- 从官方选择器切到官方模式时，该会话的 omo 层会被撤下。
- 席位表从磁盘读取；用户席位来自 `<DSH_HOME>/omo/presets.json`，与出厂席位共用 `/preset` 和芯片入口。
- 模型编辑器只影响**之后的派发**；正在跑的 lane 保持原模型。
- 议会需要 profile 里至少两个不同模型；更少时会退化为单模型共识。
- 用户席位（`presets.json`）改动需要重启宿主才生效；席位默认模型则在保存后的下一次派发生效，无需重启。

## 致谢与许可

**MIT。** 本项目是 **[oh-my-opencode-slim](https://github.com/alvinunreal/oh-my-opencode-slim)** 的**衍生改编**——那是一个由 *Boring Dystopia Development*（作者 [alvinunreal](https://github.com/alvinunreal)）以 MIT 协议发布的 OpenCode agent 编排插件。席位人格、路由理念与十二个技能源自该项目；DeepSeek Harness 侧的集成（席位运行时、工具策略执行、会话投影、`omoSeatModels` Remote 与 Agent 芯片）为本 bundle 原创。

原始 MIT 许可声明保留在 [LICENSE](LICENSE) 中。
