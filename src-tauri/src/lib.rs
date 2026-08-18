use std::process::{Child, Command};
use std::sync::Mutex;

struct PiServerState {
    child: Mutex<Option<Child>>,
    port: Mutex<Option<u16>>,
}

impl Drop for PiServerState {
    fn drop(&mut self) {
        if let Ok(mut guard) = self.child.lock() {
            if let Some(mut child) = guard.take() {
                let _ = child.kill();
                let _ = child.wait();
            }
        }
    }
}

#[tauri::command]
fn app_version() -> String {
    env!("CARGO_PKG_VERSION").to_string()
}

#[tauri::command]
fn spawn_pi_server(state: tauri::State<'_, PiServerState>) -> Result<u16, String> {
    // 已启动且存活则直接返回端口
    {
        let port_guard = state.port.lock().map_err(|e| e.to_string())?;
        if let Some(port) = *port_guard {
            let mut child_guard = state.child.lock().map_err(|e| e.to_string())?;
            let alive = child_guard
                .as_mut()
                .and_then(|child| child.try_wait().ok().map(|r| r.is_none()))
                .unwrap_or(false);
            if alive {
                return Ok(port);
            }
            *child_guard = None;
        }
    }

    // 找一个可用端口
    let port = {
        let listener = std::net::TcpListener::bind("127.0.0.1:0").map_err(|e| e.to_string())?;
        listener.local_addr().map_err(|e| e.to_string())?.port()
    };

    // 定位 pi-server/server.mjs
    let candidates = [
        concat!(env!("CARGO_MANIFEST_DIR"), "/../pi-server/server.mjs"),
        concat!(env!("CARGO_MANIFEST_DIR"), "/pi-server/server.mjs"),
    ];
    let server_script = candidates
        .iter()
        .find(|p| std::path::Path::new(p).exists())
        .ok_or_else(|| "找不到 pi-server/server.mjs".to_string())?;

    let child = Command::new("node")
        .arg(server_script)
        .env("PORT", port.to_string())
        .spawn()
        .map_err(|e| format!("启动 pi-server 失败: {e}"))?;

    *state.child.lock().map_err(|e| e.to_string())? = Some(child);
    *state.port.lock().map_err(|e| e.to_string())? = Some(port);
    Ok(port)
}

#[tauri::command]
fn stop_pi_server(state: tauri::State<'_, PiServerState>) -> Result<(), String> {
    let mut child_guard = state.child.lock().map_err(|e| e.to_string())?;
    if let Some(mut child) = child_guard.take() {
        let _ = child.kill();
        let _ = child.wait();
    }
    *state.port.lock().map_err(|e| e.to_string())? = None;
    Ok(())
}

#[tauri::command]
fn ai_chat(prompt: String, model: String) -> String {
    let trimmed = prompt.trim();
    if trimmed.is_empty() {
        return "我在这里，随时可以开始。".to_string();
    }

    let lower = trimmed.to_lowercase();
    let is_code = ["代码", "code", "函数", "function", "组件", "component", "实现", "react", "rust", "python", "tauri", "bug", "报错", "错误"]
        .iter()
        .any(|k| lower.contains(k));

    if is_code {
        format!(
            "好的，针对「{}」，下面是一份来自 Rust 后端（Tauri 命令 `ai_chat`）的技术方案。\n\n## 思路\n\n1. **明确输入输出**：把需求拆成可验证的最小单元。\n2. **选择合适的数据结构**：优先使用语言内置类型。\n3. **分层实现**：核心逻辑、接口层、UI 层分离。\n4. **异常处理**：对网络、文件、非法输入做防御式处理。\n\n## 示例代码\n\n```ts\nexport function createSlug(text: string, maxLen = 40): string {{\n  const slug = text\n    .trim()\n    .toLowerCase()\n    .replace(/[^\\\\p{{L}}\\\\p{{N}}]+/gu, \"-\")\n    .replace(/^-+|-+$/g, \"\")\n    .slice(0, maxLen);\n  return slug || \"untitled\";\n}}\n```\n\n## 关键点\n\n- 注意 Unicode 边界。\n- 涉及 IO 时记得处理超时与重试。\n- 建议补上单元测试覆盖核心分支。\n\n需要我继续展开，或结合你的真实项目结构调整吗？",
            excerpt(trimmed, 36)
        )
    } else {
        format!(
            "收到。关于「{}」，我从几个角度帮你梳理：\n\n## 1. 背景与现状\n先明确目标：你希望达到什么结果？\n\n## 2. 可选路径\n- **路径 A**：快速验证 —— 用最小成本跑通闭环；\n- **路径 B**：稳健推进 —— 补齐边界条件后再扩展；\n- **路径 C**：深度优化 —— 在已有基础上做精细化打磨。\n\n## 3. 我的建议\n如果时间有限，优先选择路径 A；如果质量要求高，建议直接走路径 B。\n\n当前由 Tauri Rust 后端响应，模型参数：`{}`。",
            excerpt(trimmed, 40),
            model
        )
    }
}

fn excerpt(text: &str, max: usize) -> String {
    let t: String = text.split_whitespace().collect::<Vec<_>>().join(" ");
    if t.chars().count() > max {
        format!("{}…", t.chars().take(max).collect::<String>())
    } else {
        t
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .manage(PiServerState {
            child: Mutex::new(None),
            port: Mutex::new(None),
        })
        .invoke_handler(tauri::generate_handler![app_version, ai_chat, spawn_pi_server, stop_pi_server])
        .run(tauri::generate_context!())
        .expect("运行 Tauri 应用时出错");
}
