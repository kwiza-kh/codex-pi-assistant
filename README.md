# Codex Assistant × Pi Agent

一个使用 **React + Tauri + shadcn/ui** 构建的桌面端 AI 助手前端，界面布局参考 Codex 大众版，后端由 **Pi Agent**（`pi --mode rpc`）完整驱动。视觉体系采用 [BeautifulUI](https://www.beautifului.dev/) 的 AI-native 设计语言（ink/page/canvas/surface 分层、hairline 描边、OKLCH 色彩、控制项圆角与阴影）。

## 架构

```
┌─────────────────────────┐   WebSocket    ┌──────────────────────┐   stdin/stdout    ┌─────────────────┐
│  React 前端 (Tauri)      │ ─────────────► │  pi-server/server.mjs │ ────────────────► │  pi --mode rpc  │
│  Codex 风格 UI           │ ◄───────────── │  (Node 桥接服务)       │ ◄──────────────── │  (Pi Agent)     │
└─────────────────────────┘                └──────────────────────┘                   └─────────────────┘
```

- `pi-server/server.mjs`：Node 桥接服务，负责启动/重启 `pi --mode rpc` 子进程，并把 RPC 命令与事件通过 WebSocket 转发给前端。
- 前端在 Tauri 桌面端会通过 Rust 命令 `spawn_pi_server` 自动启动桥接服务；在纯浏览器开发时，需手动运行 `npm run pi-server`。

## 功能

- **完整 Pi Agent 能力**：prompt / steer / follow_up / abort / bash / compact / new_session / switch_session / fork / clone / set_session_name 等 RPC 命令全部打通
- **流式输出**：文本 delta、思考过程（thinking）、工具调用（toolcall）实时渲染
- **工具可视化**：工具执行卡片（运行中 / 完成 / 失败、流式输出）
- **模型与命令**：可用模型列表、Pi 命令与 Skills（`/` 自动补全）、思考等级切换
- **会话管理**：扫描 `~/.pi/agent/sessions`，展示历史会话、切换会话、重命名
- **扩展 UI 协议**：支持 Pi 扩展弹出的 select / confirm / input / editor 对话框
- **Provider 配置中心**：独立「模型与接入商」窗口，主从式布局：左侧 40+ 接入商列表（搜索/状态/模型数），右侧全量模型目录（1267+ 模型，支持搜索、上下文窗口、成本、reasoning 标记），支持前端直接保存/移除 API Key、一键切换当前模型
- **完整 Pi 参数配置**：设置面板覆盖 Pi 全部 `settings.json` 参数（模型/思考、界面、网络、压缩、重试、消息投递、终端图片、Shell、工具、会话、Markdown、资源加载等）
- **连接管理**：自动重连、工作目录切换、队列状态、会话统计
- **Codex 风格布局**：深色侧边栏 + 主聊天区 + 底部输入卡片，shadcn/ui 设计体系

## 目录结构

```
codex-assistant/
├── pi-server/
│   └── server.mjs       # WebSocket → pi RPC 桥接
├── src/
│   ├── components/       # UI 组件（Sidebar / ChatView / Composer / ...）
│   ├── lib/
│   │   ├── pi-client.ts  # WebSocket 客户端
│   │   └── pi-types.ts   # Pi 数据类型与解析
│   ├── store/chat.ts     # Pi 状态管理（zustand）
│   └── ...
└── src-tauri/
    ├── src/lib.rs        # Tauri 命令：spawn_pi_server / stop_pi_server / ai_chat
    └── ...
```

## 快速开始

```bash
cd codex-assistant

# 安装前端依赖
npm install

# 安装桥接服务依赖
cd pi-server && npm install && cd ..

# 方式一：桌面端（Tauri 自动拉起 pi-server）
npm run desktop:dev

# 方式二：纯前端开发（手动启动桥接）
npm run pi-server          # 默认 ws://127.0.0.1:8787
npm run dev                # 浏览器预览
```

默认使用全局安装的 `pi` CLI（自动探测 `~/.pi/agent` 与 `pi --mode rpc`）。可通过环境变量覆盖：

| 环境变量 | 说明 | 默认值 |
|---------|------|--------|
| `PORT` | 桥接 WebSocket 端口 | `8787` |
| `PI_BIN` | pi 可执行文件 | 自动探测 |
| `PI_CWD` | pi 工作目录 | 当前目录 |
| `PI_SESSION_DIR` | 会话目录 | `~/.pi/agent/sessions` |
| `VITE_PI_SERVER_URL` | 前端连接地址 | `ws://127.0.0.1:8787` |

## 说明

- 浏览器开发时若未启动 `pi-server`，前端会显示未连接状态。
- Tauri 桌面端会自动调用 Rust 命令启动桥接服务，无需手动干预。
- Pi 的模型登录/切换仍由 `pi` 自身管理（`pi /login`、`pi /model` 或前端模型菜单）。
- 工作目录切换会重启 RPC 子进程，会话文件保存在 `~/.pi/agent/sessions` 中。
