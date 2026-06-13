use std::{
    path::PathBuf,
    process::{Child, Command, Stdio},
    sync::Mutex,
};

use tauri::Manager;

#[cfg(target_os = "windows")]
use std::os::windows::process::CommandExt;

#[cfg(target_os = "windows")]
const CREATE_NO_WINDOW: u32 = 0x0800_0000;

struct ServerProcess(Mutex<Option<Child>>);

impl Drop for ServerProcess {
    fn drop(&mut self) {
        if let Ok(mut guard) = self.0.lock() {
            if let Some(mut child) = guard.take() {
                let _ = child.kill();
                let _ = child.wait();
            }
        }
    }
}

fn node_binary_name() -> &'static str {
    if cfg!(target_os = "windows") {
        "node.exe"
    } else {
        "node"
    }
}

fn start_next_server(resource_dir: PathBuf) -> std::io::Result<Child> {
    let server_dir = resource_dir.join("next-server");
    let server_js = server_dir.join("server.js");
    let node_binary = resource_dir
        .join("node-runtime")
        .join(node_binary_name());

    let mut command = if node_binary.exists() {
        Command::new(node_binary)
    } else {
        Command::new("node")
    };

    #[cfg(target_os = "windows")]
    command.creation_flags(CREATE_NO_WINDOW);

    command
        .arg(server_js)
        .env("HOSTNAME", "127.0.0.1")
        .env("PORT", "3000")
        .env("NODE_ENV", "production")
        .stdin(Stdio::null())
        // .stdout(Stdio::null())
        // .stderr(Stdio::null());
        .stdout(Stdio::inherit())
        .stderr(Stdio::inherit());

    command.spawn()
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .setup(|app| {
            let resource_dir = app
                .path()
                .resource_dir()
                .map_err(|err| format!("Failed to resolve resource directory: {err}"))?;

            let server = start_next_server(resource_dir)
                .map_err(|err| format!("Failed to start Next server: {err}"))?;

            app.manage(ServerProcess(Mutex::new(Some(server))));

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
