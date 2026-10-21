#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use serde::Serialize;
use std::sync::{
    atomic::{AtomicBool, AtomicI32, Ordering},
    Arc, Mutex, OnceLock,
};
use sysinfo::System;
use tauri::{
    Emitter, Manager, PhysicalPosition, PhysicalSize, Position, Size, State, WebviewWindow,
    WindowEvent,
};

struct AppState {
    sys: Mutex<System>,
    fullscreen_active: Arc<AtomicBool>,
}

#[derive(Serialize)]
struct MetricsPayload {
    cpu_usage: f32,
    ram_usage: f32,
    ram_used_gb: f32,
    ram_total_gb: f32,
    battery_level: u8,
    battery_charging: bool,
    has_battery: bool,
    battery_time_remaining: String,
    cursor_reveal: bool,
    fullscreen_active: bool,
}

#[derive(Serialize, Clone)]
pub struct NowPlayingInfo {
    pub detected: bool,
    pub source_app: String,
    pub playing: bool,
    pub title: String,
    pub artist: String,
    pub hwnd: isize,
    pub position_sec: u32,
    pub duration_sec: u32,
    /// `true` when SMTC did not report a full timeline for the current session.
    pub estimated: bool,
    /// Data URL of the album artwork exposed by SMTC, when available.
    pub artwork_data_url: String,
}

#[cfg(target_os = "windows")]
#[allow(non_snake_case, clippy::upper_case_acronyms)]
mod win32 {
    use super::NowPlayingInfo;
    use std::ffi::c_void;
    use std::sync::{
        atomic::{AtomicBool, Ordering},
        Mutex, OnceLock,
    };
    use std::time::Instant;
    use windows::Media::Control::{
        GlobalSystemMediaTransportControlsSession,
        GlobalSystemMediaTransportControlsSessionManager,
        GlobalSystemMediaTransportControlsSessionMediaProperties,
        GlobalSystemMediaTransportControlsSessionPlaybackStatus,
    };
    use windows::Storage::Streams::DataReader;

    #[repr(C)]
    #[derive(Clone, Copy, Default, Debug)]
    pub struct RECT {
        pub left: i32,
        pub top: i32,
        pub right: i32,
        pub bottom: i32,
    }

    #[repr(C)]
    #[derive(Default)]
    pub struct MONITORINFO {
        pub cbSize: u32,
        pub rcMonitor: RECT,
        pub rcWork: RECT,
        pub dwFlags: u32,
    }

    #[repr(C)]
    #[derive(Default)]
    pub struct SYSTEM_POWER_STATUS {
        pub ACLineStatus: u8,
        pub BatteryFlag: u8,
        pub BatteryLifePercent: u8,
        pub SystemStatusFlag: u8,
        pub BatteryLifeTime: u32,
        pub BatteryFullLifeTime: u32,
    }

    #[link(name = "user32")]
    extern "system" {
        fn GetForegroundWindow() -> isize;
        fn IsIconic(hWnd: isize) -> i32;
        fn IsZoomed(hWnd: isize) -> i32;
        fn GetClassNameW(hWnd: isize, lpClassName: *mut u16, nMaxCount: i32) -> i32;
        fn GetWindowRect(hWnd: isize, lpRect: *mut RECT) -> i32;
        fn GetWindowThreadProcessId(hWnd: isize, lpdwProcessId: *mut u32) -> u32;
        fn SystemParametersInfoW(
            uiAction: u32,
            uiParam: u32,
            pvParam: *mut c_void,
            fWinIni: u32,
        ) -> i32;
        fn GetSystemMetrics(nIndex: i32) -> i32;
        fn MonitorFromWindow(hwnd: isize, dwFlags: u32) -> isize;
        fn GetMonitorInfoW(hMonitor: isize, lpmi: *mut MONITORINFO) -> i32;
    }

    #[link(name = "runtimeobject")]
    extern "system" {
        fn RoInitialize(initType: u32) -> i32;
    }

    #[link(name = "shell32")]
    extern "system" {
        fn ShellExecuteW(
            hwnd: isize,
            lpOperation: *const u16,
            lpFile: *const u16,
            lpParameters: *const u16,
            lpDirectory: *const u16,
            nShowCmd: i32,
        ) -> isize;
    }

    #[link(name = "kernel32")]
    extern "system" {
        fn GetSystemPowerStatus(lpSystemPowerStatus: *mut SYSTEM_POWER_STATUS) -> i32;
        fn CreateMutexW(
            lpMutexAttributes: *const c_void,
            bInitialOwner: i32,
            lpName: *const u16,
        ) -> isize;
        fn GetLastError() -> u32;
    }

    const SW_SHOWNORMAL: i32 = 1;
    const ERROR_ALREADY_EXISTS: u32 = 183;
    const MONITOR_DEFAULTTONEAREST: u32 = 2;
    const SPI_GETWORKAREA: u32 = 0x0030;
    const SM_CXSCREEN: i32 = 0;
    const SM_CYSCREEN: i32 = 1;

    const SINGLE_INSTANCE_MUTEX_NAME: &str = "Local\\LemeSingleInstanceMutex_v1";

    // ---------------------------------------------------------------------------------------------
    // System Media Transport Controls (SMTC): the authoritative Windows "now playing" source.
    // Queried on a dedicated thread with COM/WinRT initialized once, then cached, so the UI thread
    // never blocks on a WinRT async call.
    // ---------------------------------------------------------------------------------------------

    #[derive(Clone)]
    pub struct SmtcNowPlaying {
        pub title: String,
        pub artist: String,
        pub source_app: String,
        pub playing: bool,
        pub position_sec: u32,
        pub duration_sec: u32,
        pub artwork_data_url: String,
    }

    pub struct SmtcCache {
        updated: Option<Instant>,
        data: Option<SmtcNowPlaying>,
    }

    static SMTC_CACHE: OnceLock<Mutex<SmtcCache>> = OnceLock::new();
    static SMTC_PROBE_STARTED: AtomicBool = AtomicBool::new(false);

    const RO_INIT_MULTITHREADED: u32 = 1;

    thread_local! {
        static WINRT_INITIALIZED: std::cell::Cell<bool> = const { std::cell::Cell::new(false) };
    }

    fn ensure_winrt_initialized() -> bool {
        WINRT_INITIALIZED.with(|initialized| {
            if initialized.get() {
                return true;
            }
            let hr = unsafe { RoInitialize(RO_INIT_MULTITHREADED) };
            // S_OK (0), S_FALSE (already initialized) and RPC_E_CHANGED_MODE (already an STA) are
            // all usable; anything else means WinRT is unavailable on this thread.
            let ok = matches!(hr, 0 | 1) || hr as u32 == 0x8001_0106;
            if ok {
                initialized.set(true);
            }
            ok
        })
    }

    fn friendly_source_app(aumid: &str) -> String {
        let lower = aumid.to_lowercase();
        let label = if lower.contains("spotify") {
            "Spotify"
        } else if lower.contains("msedge") {
            "Microsoft Edge"
        } else if lower.contains("chrome") {
            "Google Chrome"
        } else if lower.contains("firefox") {
            "Firefox"
        } else if lower.contains("brave") {
            "Brave"
        } else if lower.contains("vlc") {
            "VLC"
        } else if lower.contains("applemusic")
            || (lower.contains("apple") && lower.contains("music"))
        {
            "Apple Music"
        } else if lower.contains("tidal") {
            "TIDAL"
        } else if lower.contains("deezer") {
            "Deezer"
        } else {
            return aumid.split('!').next().unwrap_or(aumid).trim().to_string();
        };
        label.to_string()
    }

    fn smtc_timeline_secs(session: &GlobalSystemMediaTransportControlsSession) -> (u32, u32) {
        let Ok(timeline) = session.GetTimelineProperties() else {
            return (0, 0);
        };
        let to_sec = |ticks: i64| (ticks.max(0) / 10_000_000) as u32;
        let start = timeline.StartTime().map(|t| t.Duration).unwrap_or(0);
        let end = timeline.EndTime().map(|t| t.Duration).unwrap_or(0);
        let position = timeline.Position().map(|t| t.Duration).unwrap_or(0);
        let duration = to_sec(end.saturating_sub(start));
        let position = to_sec(position.saturating_sub(start));
        (
            if duration > 0 {
                position.min(duration)
            } else {
                position
            },
            duration,
        )
    }

    fn read_thumbnail_data_url(
        properties: &GlobalSystemMediaTransportControlsSessionMediaProperties,
    ) -> Option<String> {
        let stream = properties
            .Thumbnail()
            .ok()?
            .OpenReadAsync()
            .ok()?
            .join()
            .ok()?;
        let size = stream.Size().ok()?;
        if size == 0 || size > 2_000_000 {
            return None;
        }
        let content_type = stream
            .ContentType()
            .map(|c| c.to_string())
            .unwrap_or_default();
        let input = stream.GetInputStreamAt(0).ok()?;
        let reader = DataReader::CreateDataReader(&input).ok()?;
        reader.LoadAsync(size as u32).ok()?.join().ok()?;
        let available = reader
            .UnconsumedBufferLength()
            .unwrap_or(size as u32)
            .min(size as u32) as usize;
        if available == 0 {
            return None;
        }
        let mut bytes = vec![0u8; available];
        reader.ReadBytes(&mut bytes).ok()?;
        let mime = if content_type.starts_with("image/") {
            content_type
        } else {
            "image/png".to_string()
        };
        use base64::Engine;
        let encoded = base64::engine::general_purpose::STANDARD.encode(&bytes);
        Some(format!("data:{mime};base64,{encoded}"))
    }

    /// Blocking WinRT query. Must only be called from a dedicated probe thread (or `--probe-media`).
    pub fn query_smtc_now_playing() -> Option<SmtcNowPlaying> {
        if !ensure_winrt_initialized() {
            return None;
        }
        let manager = GlobalSystemMediaTransportControlsSessionManager::RequestAsync()
            .ok()?
            .join()
            .ok()?;
        let session = manager.GetCurrentSession().ok()?;
        let properties = session.TryGetMediaPropertiesAsync().ok()?.join().ok()?;

        let title = properties
            .Title()
            .map(|t| t.to_string())
            .unwrap_or_default();
        if title.trim().is_empty() {
            return None;
        }
        let artist = properties
            .Artist()
            .map(|t| t.to_string())
            .unwrap_or_default();
        let aumid = session
            .SourceAppUserModelId()
            .map(|a| a.to_string())
            .unwrap_or_default();
        let source_app = friendly_source_app(&aumid);
        let playing = session
            .GetPlaybackInfo()
            .ok()
            .and_then(|info| info.PlaybackStatus().ok())
            .is_some_and(|status| {
                status == GlobalSystemMediaTransportControlsSessionPlaybackStatus::Playing
            });
        let (position_sec, duration_sec) = smtc_timeline_secs(&session);
        let artwork_data_url = read_thumbnail_data_url(&properties).unwrap_or_default();

        Some(SmtcNowPlaying {
            title: title.trim().to_string(),
            artist: if artist.trim().is_empty() {
                source_app.clone()
            } else {
                artist.trim().to_string()
            },
            source_app,
            playing,
            position_sec,
            duration_sec,
            artwork_data_url,
        })
    }

    fn smtc_cache() -> &'static Mutex<SmtcCache> {
        SMTC_CACHE.get_or_init(|| {
            Mutex::new(SmtcCache {
                updated: None,
                data: None,
            })
        })
    }

    fn ensure_smtc_probe() {
        if SMTC_PROBE_STARTED.swap(true, Ordering::SeqCst) {
            return;
        }
        std::thread::spawn(|| loop {
            let data = query_smtc_now_playing();
            if let Ok(mut cache) = smtc_cache().lock() {
                cache.data = data;
                cache.updated = Some(Instant::now());
            }
            std::thread::sleep(std::time::Duration::from_millis(1000));
        });
    }

    /// Cached SMTC snapshot; `None` when there is no session or the probe went stale (5 s).
    fn cached_smtc_now_playing() -> Option<SmtcNowPlaying> {
        ensure_smtc_probe();
        let cache = smtc_cache().lock().ok()?;
        let fresh = cache
            .updated
            .is_some_and(|t| t.elapsed() < std::time::Duration::from_secs(5));
        if fresh {
            cache.data.clone()
        } else {
            None
        }
    }

    /// Starts the background probe thread (idempotent).
    pub fn start_smtc_probe() {
        ensure_smtc_probe();
    }

    /// Reads the cached snapshot exactly like the UI does (used by `--probe-media`).
    pub fn cached_smtc_snapshot() -> Option<SmtcNowPlaying> {
        cached_smtc_now_playing()
    }

    /// Sends a transport command to the current SMTC session on a dedicated COM/WinRT thread.
    pub fn smtc_control(action: &str) {
        let action = action.to_string();
        std::thread::spawn(move || {
            if !ensure_winrt_initialized() {
                return;
            }
            let Ok(manager) = GlobalSystemMediaTransportControlsSessionManager::RequestAsync()
                .and_then(|operation| operation.join())
            else {
                return;
            };
            let Ok(session) = manager.GetCurrentSession() else {
                return;
            };
            let _ = match action.as_str() {
                "toggle" => session.TryTogglePlayPauseAsync().and_then(|op| op.join()),
                "next" => session.TrySkipNextAsync().and_then(|op| op.join()),
                "prev" => session.TrySkipPreviousAsync().and_then(|op| op.join()),
                "play" => session.TryPlayAsync().and_then(|op| op.join()),
                "pause" => session.TryPauseAsync().and_then(|op| op.join()),
                _ => Ok(false),
            };
        });
    }

    /// SMTC-only now playing snapshot for the hub (no window enumeration).
    pub fn get_now_playing() -> NowPlayingInfo {
        match cached_smtc_now_playing() {
            Some(smtc) => NowPlayingInfo {
                detected: true,
                source_app: smtc.source_app,
                playing: smtc.playing,
                title: smtc.title,
                artist: smtc.artist,
                hwnd: 0,
                position_sec: smtc.position_sec,
                duration_sec: smtc.duration_sec,
                estimated: smtc.position_sec == 0 || smtc.duration_sec == 0,
                artwork_data_url: smtc.artwork_data_url,
            },
            None => NowPlayingInfo {
                detected: false,
                source_app: String::new(),
                playing: false,
                title: String::new(),
                artist: String::new(),
                hwnd: 0,
                position_sec: 0,
                duration_sec: 180,
                estimated: true,
                artwork_data_url: String::new(),
            },
        }
    }

    /// Ensures only a single instance of Leme runs at any time (`CreateMutexW`).
    pub fn acquire_single_instance_mutex() -> bool {
        unsafe {
            let name = to_wide(SINGLE_INSTANCE_MUTEX_NAME);
            let handle = CreateMutexW(std::ptr::null(), 1, name.as_ptr());
            if handle == 0 {
                return true;
            }
            GetLastError() != ERROR_ALREADY_EXISTS
        }
    }

    fn to_wide(s: &str) -> Vec<u16> {
        s.encode_utf16().chain(std::iter::once(0)).collect()
    }

    /// Reads real battery and AC power state from Windows kernel (`GetSystemPowerStatus`)
    pub fn read_native_power_status() -> (u8, bool, bool, String) {
        unsafe {
            let mut sps = SYSTEM_POWER_STATUS::default();
            if GetSystemPowerStatus(&mut sps) == 0 {
                return (100, true, false, "AC (Desktop)".to_string());
            }
            let ac_online = sps.ACLineStatus == 1;
            let no_system_battery = (sps.BatteryFlag & 128) != 0 || sps.BatteryFlag == 255;
            if no_system_battery {
                return (100, true, false, "Na tomada (AC)".to_string());
            }
            let level = if sps.BatteryLifePercent <= 100 {
                sps.BatteryLifePercent
            } else {
                100
            };
            let charging = ac_online || (sps.BatteryFlag & 8) != 0;
            let status_text = if charging {
                "Carregando ⚡".to_string()
            } else if sps.BatteryLifeTime != 0xFFFF_FFFF && sps.BatteryLifeTime > 60 {
                let hrs = sps.BatteryLifeTime / 3600;
                let mins = (sps.BatteryLifeTime % 3600) / 60;
                format!("{}h {:02}m", hrs, mins)
            } else {
                format!("{}% restante", level)
            };
            (level, charging, true, status_text)
        }
    }

    /// Safe target launcher using Win32 `ShellExecuteW` without spawning `cmd.exe` (prevents command injection!).
    /// Allows query string parameters (`&`, `=`, `?`, `#`) in `http://` and `https://` URLs while blocking shell metacharacters in commands.
    pub fn shell_execute_safe(target: &str) -> Result<(), String> {
        let trimmed = target.trim();
        if trimmed.is_empty() {
            return Err("Alvo vazio".to_string());
        }
        if trimmed
            .chars()
            .any(|c| matches!(c, '\r' | '\n' | '\0' | '"'))
        {
            return Err("Caracteres de controle bloqueados por segurança".to_string());
        }
        let lower = trimmed.to_lowercase();
        if lower.starts_with("javascript:")
            || lower.starts_with("vbscript:")
            || lower.starts_with("data:")
        {
            return Err("Protocolo bloqueado por segurança".to_string());
        }

        let is_http_url = lower.starts_with("https://") || lower.starts_with("http://");
        if is_http_url {
            if trimmed.chars().any(|c| c.is_whitespace()) {
                return Err("URL inválida com espaços".to_string());
            }
        } else if trimmed
            .chars()
            .any(|c| matches!(c, '&' | '|' | ';' | '>' | '<' | '`' | '$'))
        {
            return Err("Caracteres inválidos bloqueados por segurança".to_string());
        }

        // Split optional arguments for known executables if needed, or pass directly to ShellExecuteW
        let (file_part, params_part) =
            if !is_http_url && !trimmed.contains(":\\") && trimmed.contains(' ') {
                trimmed.split_once(' ').unwrap_or((trimmed, ""))
            } else {
                (trimmed, "")
            };

        unsafe {
            let op = to_wide("open");
            let file_w = to_wide(file_part);
            let params_w = if params_part.is_empty() {
                Vec::new()
            } else {
                to_wide(params_part)
            };
            let res = ShellExecuteW(
                0,
                op.as_ptr(),
                file_w.as_ptr(),
                if params_w.is_empty() {
                    std::ptr::null()
                } else {
                    params_w.as_ptr()
                },
                std::ptr::null(),
                SW_SHOWNORMAL,
            );
            if res <= 32 {
                Err(format!(
                    "Falha ao abrir '{}' (código Win32 {})",
                    file_part, res
                ))
            } else {
                Ok(())
            }
        }
    }

    /// Returns the physical monitor bounds (`rcMonitor`) for the monitor containing `hwnd` (multi-monitor aware!)
    pub fn get_window_monitor_rect(hwnd: isize) -> RECT {
        unsafe {
            if hwnd != 0 {
                let hmon = MonitorFromWindow(hwnd, MONITOR_DEFAULTTONEAREST);
                if hmon != 0 {
                    let mut mi = MONITORINFO {
                        cbSize: std::mem::size_of::<MONITORINFO>() as u32,
                        ..Default::default()
                    };
                    if GetMonitorInfoW(hmon, &mut mi) != 0 {
                        return mi.rcMonitor;
                    }
                }
            }
            let (w, h) = get_screen_size();
            RECT {
                left: 0,
                top: 0,
                right: w,
                bottom: h,
            }
        }
    }

    /// Returns the work area (`rcWork`) of the monitor containing `hwnd`, excluding the taskbar.
    pub fn get_window_work_area(hwnd: isize) -> RECT {
        unsafe {
            if hwnd != 0 {
                let hmon = MonitorFromWindow(hwnd, MONITOR_DEFAULTTONEAREST);
                if hmon != 0 {
                    let mut mi = MONITORINFO {
                        cbSize: std::mem::size_of::<MONITORINFO>() as u32,
                        ..Default::default()
                    };
                    if GetMonitorInfoW(hmon, &mut mi) != 0 {
                        return mi.rcWork;
                    }
                }
            }
            let mut rect = RECT::default();
            SystemParametersInfoW(SPI_GETWORKAREA, 0, &mut rect as *mut RECT as *mut c_void, 0);
            if rect.right <= rect.left || rect.bottom <= rect.top {
                let (w, h) = get_screen_size();
                rect = RECT {
                    left: 0,
                    top: 0,
                    right: w,
                    bottom: h,
                };
            }
            rect
        }
    }

    pub fn get_screen_size() -> (i32, i32) {
        unsafe { (GetSystemMetrics(SM_CXSCREEN), GetSystemMetrics(SM_CYSCREEN)) }
    }

    /// Detects if the user is watching a fullscreen video (YouTube F11) or playing a fullscreen game on ANY monitor!
    pub fn is_foreground_fullscreen(self_pid: u32) -> bool {
        unsafe {
            let fg = GetForegroundWindow();
            if fg == 0 || IsIconic(fg) != 0 {
                return false;
            }
            // A maximized window also covers the monitor bounds (especially with the taskbar
            // hidden), but it is not fullscreen: treating it as such hid the hub for any
            // maximized app.
            if IsZoomed(fg) != 0 {
                return false;
            }
            let mut pid: u32 = 0;
            GetWindowThreadProcessId(fg, &mut pid);
            if pid == self_pid {
                return false;
            }

            let mut class_buf = [0u16; 128];
            let class_len = GetClassNameW(fg, class_buf.as_mut_ptr(), 128);
            if class_len > 0 {
                let class_name = String::from_utf16_lossy(&class_buf[..class_len as usize]);
                if class_name == "Progman"
                    || class_name == "WorkerW"
                    || class_name == "Shell_TrayWnd"
                    || class_name == "Shell_SecondaryTrayWnd"
                {
                    return false;
                }
            }

            let mut rect = RECT::default();
            if GetWindowRect(fg, &mut rect) == 0 {
                return false;
            }
            let mon = get_window_monitor_rect(fg);
            let mon_w = mon.right - mon.left;
            let mon_h = mon.bottom - mon.top;
            mon_w > 0
                && mon_h > 0
                && rect.left <= mon.left
                && rect.top <= mon.top
                && rect.right >= mon.right
                && rect.bottom >= mon.bottom
        }
    }

    #[cfg(test)]
    mod tests {
        use super::*;

        #[test]
        fn friendly_source_app_labels_known_players() {
            assert_eq!(
                friendly_source_app("SpotifyAB.SpotifyMusic_zpdnekdrzrea0!Spotify"),
                "Spotify"
            );
            assert_eq!(friendly_source_app("MSEdge"), "Microsoft Edge");
            assert_eq!(friendly_source_app("TIDAL"), "TIDAL");
            assert_eq!(friendly_source_app("SomeApp!App"), "SomeApp");
        }
    }
}

#[tauri::command]
fn get_system_metrics(state: State<'_, AppState>) -> MetricsPayload {
    let mut sys = state.sys.lock().unwrap();
    sys.refresh_cpu_usage();
    sys.refresh_memory();

    let cpu_usage = sys.global_cpu_usage();
    let total_mem = sys.total_memory() as f64;
    let used_mem = sys.used_memory() as f64;

    let ram_total_gb = (total_mem / 1_073_741_824.0) as f32;
    let ram_used_gb = (used_mem / 1_073_741_824.0) as f32;
    let ram_usage = if total_mem > 0.0 {
        ((used_mem / total_mem) * 100.0) as f32
    } else {
        0.0
    };

    #[cfg(target_os = "windows")]
    let (battery_level, battery_charging, has_battery, battery_time_remaining) =
        win32::read_native_power_status();
    #[cfg(not(target_os = "windows"))]
    let (battery_level, battery_charging, has_battery, battery_time_remaining) =
        (100u8, true, false, "AC".to_string());

    MetricsPayload {
        cpu_usage,
        ram_usage,
        ram_used_gb,
        ram_total_gb,
        battery_level,
        battery_charging,
        has_battery,
        battery_time_remaining,
        cursor_reveal: true,
        fullscreen_active: state.fullscreen_active.load(Ordering::SeqCst),
    }
}

/// Hub media snapshot: SMTC + artwork only, without window enumeration.
#[tauri::command]
fn get_now_playing_light() -> NowPlayingInfo {
    #[cfg(target_os = "windows")]
    {
        win32::get_now_playing()
    }
    #[cfg(not(target_os = "windows"))]
    {
        NowPlayingInfo {
            detected: false,
            source_app: String::new(),
            playing: false,
            title: String::new(),
            artist: String::new(),
            hwnd: 0,
            position_sec: 0,
            duration_sec: 180,
            estimated: true,
            artwork_data_url: String::new(),
        }
    }
}

#[tauri::command]
fn smtc_control(action: String) {
    #[cfg(target_os = "windows")]
    {
        win32::smtc_control(&action);
    }
    #[cfg(not(target_os = "windows"))]
    {
        let _ = action;
    }
}

#[tauri::command]
fn set_hub_height(window: tauri::Window, height: f64) -> Result<(), String> {
    position_hub(&window, height).map_err(|error| error.to_string())
}

#[tauri::command]
fn set_hub_anchor(window: WebviewWindow, x: i32, bottom: i32) -> Result<(), String> {
    if let Ok(mut slot) = hub_anchor().lock() {
        *slot = Some((x, bottom));
    }
    let height = HUB_HEIGHT_X100.load(Ordering::SeqCst) as f64 / 100.0;
    position_hub(&window, height).map_err(|error| error.to_string())
}

#[tauri::command]
fn clear_hub_anchor(window: WebviewWindow) -> Result<(), String> {
    if let Ok(mut slot) = hub_anchor().lock() {
        *slot = None;
    }
    let height = HUB_HEIGHT_X100.load(Ordering::SeqCst) as f64 / 100.0;
    position_hub(&window, height).map_err(|error| error.to_string())
}

/// Re-applies the current anchor/size (used when the taskbar appears/disappears).
#[tauri::command]
fn reanchor_hub(window: WebviewWindow) -> Result<(), String> {
    let height = HUB_HEIGHT_X100.load(Ordering::SeqCst) as f64 / 100.0;
    position_hub(&window, height).map_err(|error| error.to_string())
}

#[tauri::command]
async fn check_update(app: tauri::AppHandle, install: bool) -> Result<String, String> {
    use tauri_plugin_updater::UpdaterExt;

    let updater = app.updater().map_err(|error| error.to_string())?;
    let update = updater.check().await.map_err(|error| error.to_string())?;

    let Some(update) = update else {
        return Ok("up-to-date".to_string());
    };

    if !install {
        return Ok(format!("available:{}", update.version));
    }

    let version = update.version.clone();
    update
        .download_and_install(|_, _| {}, || {})
        .await
        .map_err(|error| error.to_string())?;

    // On Windows the installer exits the app automatically; elsewhere restart explicitly.
    #[cfg(not(target_os = "windows"))]
    app.restart();

    Ok(format!("installed:{version}"))
}

#[tauri::command]
fn set_autostart(enabled: bool) -> Result<(), String> {
    set_autostart_registry(enabled)
}

#[tauri::command]
fn is_autostart_enabled() -> bool {
    autostart_registry_enabled()
}

const SECRET_SERVICE: &str = "leme";

fn secret_entry(key: &str) -> Result<keyring::Entry, String> {
    if key.is_empty()
        || key.len() > 64
        || !key
            .chars()
            .all(|c| c.is_ascii_alphanumeric() || c == '-' || c == '_')
    {
        return Err("Chave de segredo inválida".to_string());
    }
    keyring::Entry::new(SECRET_SERVICE, key).map_err(|error| error.to_string())
}

#[tauri::command]
fn set_secret(key: String, value: String) -> Result<(), String> {
    let entry = secret_entry(&key)?;
    let value = value.trim();
    if value.is_empty() {
        let _ = entry.delete_credential();
        Ok(())
    } else {
        entry.set_password(value).map_err(|error| error.to_string())
    }
}

#[tauri::command]
fn get_secret(key: String) -> Result<String, String> {
    secret_entry(&key)?
        .get_password()
        .map_err(|error| error.to_string())
}

#[tauri::command]
fn delete_secret(key: String) -> Result<(), String> {
    secret_entry(&key)?
        .delete_credential()
        .map_err(|error| error.to_string())
}

#[tauri::command]
fn has_secret(key: String) -> bool {
    secret_entry(&key)
        .and_then(|entry| entry.get_password().map_err(|error| error.to_string()))
        .is_ok()
}

/// Fetches JSON from a user-configured endpoint through Rust (no browser CORS restrictions).
#[tauri::command]
fn fetch_api_json(url: String, token: String) -> Result<String, String> {
    let url = url.trim();
    if !(url.starts_with("https://") || url.starts_with("http://")) {
        return Err("URL inválida: use http:// ou https://".to_string());
    }

    let mut request = ureq::get(url)
        .timeout(std::time::Duration::from_secs(10))
        .set("Accept", "application/json");
    let token = token.trim();
    if !token.is_empty() {
        request = request.set("Authorization", &format!("Bearer {token}"));
    }

    let response = request.call().map_err(|error| error.to_string())?;
    response.into_string().map_err(|error| error.to_string())
}

#[tauri::command]
fn quit_and_restore_taskbar(app: tauri::AppHandle) {
    app.exit(0);
}

#[tauri::command]
fn launch_target(target: String) -> Result<(), String> {
    #[cfg(target_os = "windows")]
    {
        win32::shell_execute_safe(&target)
    }
    #[cfg(target_os = "macos")]
    {
        std::process::Command::new("open")
            .arg(&target)
            .spawn()
            .map_err(|error| error.to_string())?;
        Ok(())
    }
    #[cfg(target_os = "linux")]
    {
        std::process::Command::new("xdg-open")
            .arg(&target)
            .spawn()
            .map_err(|error| error.to_string())?;
        Ok(())
    }
}

const HUB_WIDTH_LOGICAL: f64 = 620.0;
const HUB_COLLAPSED_HEIGHT: f64 = 76.0;
static HUB_HEIGHT_X100: AtomicI32 = AtomicI32::new(7600);
static HUB_ANCHOR: OnceLock<Mutex<Option<(i32, i32)>>> = OnceLock::new();
static TRAY_ICON: OnceLock<tauri::tray::TrayIcon> = OnceLock::new();

fn hub_anchor() -> &'static Mutex<Option<(i32, i32)>> {
    HUB_ANCHOR.get_or_init(|| Mutex::new(None))
}

/// Minimal window surface shared by `Window` (event callbacks) and `WebviewWindow` (commands/setup).
trait HubWindowOps {
    fn hub_scale(&self) -> f64;
    fn hub_resize(&self, width: u32, height: u32) -> tauri::Result<()>;
    fn hub_move(&self, x: i32, y: i32) -> tauri::Result<()>;
    fn hub_hwnd(&self) -> isize;
}

impl HubWindowOps for WebviewWindow {
    fn hub_scale(&self) -> f64 {
        self.scale_factor().unwrap_or(1.0)
    }
    fn hub_resize(&self, width: u32, height: u32) -> tauri::Result<()> {
        self.set_size(Size::Physical(PhysicalSize { width, height }))
    }
    fn hub_move(&self, x: i32, y: i32) -> tauri::Result<()> {
        self.set_position(Position::Physical(PhysicalPosition { x, y }))
    }
    fn hub_hwnd(&self) -> isize {
        #[cfg(target_os = "windows")]
        {
            self.hwnd().map(|h| h.0 as isize).unwrap_or(0)
        }
        #[cfg(not(target_os = "windows"))]
        {
            0
        }
    }
}

impl HubWindowOps for tauri::Window {
    fn hub_scale(&self) -> f64 {
        self.scale_factor().unwrap_or(1.0)
    }
    fn hub_resize(&self, width: u32, height: u32) -> tauri::Result<()> {
        self.set_size(Size::Physical(PhysicalSize { width, height }))
    }
    fn hub_move(&self, x: i32, y: i32) -> tauri::Result<()> {
        self.set_position(Position::Physical(PhysicalPosition { x, y }))
    }
    fn hub_hwnd(&self) -> isize {
        #[cfg(target_os = "windows")]
        {
            self.hwnd().map(|h| h.0 as isize).unwrap_or(0)
        }
        #[cfg(not(target_os = "windows"))]
        {
            0
        }
    }
}

/// Sizes the hub and anchors it to the bottom-right of the monitor work area (above the taskbar).
fn position_hub<W: HubWindowOps + ?Sized>(window: &W, height_logical: f64) -> tauri::Result<()> {
    let height_logical = height_logical.clamp(HUB_COLLAPSED_HEIGHT, 640.0);
    HUB_HEIGHT_X100.store((height_logical * 100.0).round() as i32, Ordering::SeqCst);

    let scale = window.hub_scale();
    let width_px = (HUB_WIDTH_LOGICAL * scale).round() as u32;
    let height_px = (height_logical * scale).round() as u32;
    window.hub_resize(width_px, height_px)?;

    #[cfg(target_os = "windows")]
    {
        let anchor = hub_anchor().lock().ok().and_then(|slot| *slot);
        if let Some((x, bottom)) = anchor {
            let y = (bottom - height_px as i32).max(0);
            window.hub_move(x.max(0), y)?;
        } else {
            let work = win32::get_window_work_area(window.hub_hwnd());
            let margin = (10.0 * scale).round() as i32;
            let x = (work.right - width_px as i32 - margin).max(work.left + margin);
            let y = (work.bottom - height_px as i32 - margin).max(work.top + margin);
            window.hub_move(x, y)?;
        }
    }
    Ok(())
}

/// Creates the tray icon: left click toggles the hub, right click opens the menu.
fn setup_tray(app: &tauri::App) -> tauri::Result<()> {
    use tauri::menu::{Menu, MenuItem, PredefinedMenuItem};
    use tauri::tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent};

    let toggle = MenuItem::with_id(app, "toggle", "Mostrar/ocultar Leme", true, None::<&str>)?;
    let settings = MenuItem::with_id(app, "settings", "Configurações", true, None::<&str>)?;
    let quit = MenuItem::with_id(app, "quit", "Sair do Leme", true, None::<&str>)?;
    let separator = PredefinedMenuItem::separator(app)?;
    let menu = Menu::with_items(app, &[&toggle, &settings, &separator, &quit])?;

    let mut builder = TrayIconBuilder::new()
        .tooltip("Leme")
        .menu(&menu)
        .show_menu_on_left_click(false)
        .on_menu_event(|app, event| match event.id.as_ref() {
            "toggle" => toggle_hub_window(app),
            "settings" => {
                show_hub_window(app);
                let _ = app.emit("leme:open-settings", ());
            }
            "quit" => app.exit(0),
            _ => {}
        })
        .on_tray_icon_event(|tray, event| {
            if let TrayIconEvent::Click {
                button: MouseButton::Left,
                button_state: MouseButtonState::Up,
                ..
            } = event
            {
                toggle_hub_window(tray.app_handle());
            }
        });

    if let Some(icon) = app.default_window_icon() {
        builder = builder.icon(icon.clone());
    }

    let tray = builder.build(app)?;
    let _ = TRAY_ICON.set(tray);
    Ok(())
}

fn show_hub_window(app: &tauri::AppHandle) {
    if let Some(window) = app.get_webview_window("main") {
        let _ = window.show();
        let _ = window.set_focus();
    }
}

fn toggle_hub_window(app: &tauri::AppHandle) {
    if let Some(window) = app.get_webview_window("main") {
        match window.is_visible() {
            Ok(true) => {
                let _ = window.hide();
            }
            _ => show_hub_window(app),
        }
    }
}

const AUTOSTART_KEY: &str = r"HKCU\Software\Microsoft\Windows\CurrentVersion\Run";
const AUTOSTART_NAME: &str = "Leme";

fn set_autostart_registry(enabled: bool) -> Result<(), String> {
    #[cfg(target_os = "windows")]
    {
        use std::os::windows::process::CommandExt;
        const CREATE_NO_WINDOW: u32 = 0x0800_0000;

        if enabled {
            let exe = std::env::current_exe().map_err(|error| error.to_string())?;
            let value = format!("\"{}\"", exe.display());
            let status = std::process::Command::new("reg")
                .args([
                    "add",
                    AUTOSTART_KEY,
                    "/v",
                    AUTOSTART_NAME,
                    "/t",
                    "REG_SZ",
                    "/d",
                    &value,
                    "/f",
                ])
                .creation_flags(CREATE_NO_WINDOW)
                .status()
                .map_err(|error| error.to_string())?;
            if status.success() {
                Ok(())
            } else {
                Err(format!("reg add falhou (código {status})"))
            }
        } else {
            // Best effort: removing a value that does not exist is not an error for the UI.
            let _ = std::process::Command::new("reg")
                .args(["delete", AUTOSTART_KEY, "/v", AUTOSTART_NAME, "/f"])
                .creation_flags(CREATE_NO_WINDOW)
                .status();
            Ok(())
        }
    }
    #[cfg(not(target_os = "windows"))]
    {
        let _ = enabled;
        Err("Autostart é suportado apenas no Windows".to_string())
    }
}

fn autostart_registry_enabled() -> bool {
    #[cfg(target_os = "windows")]
    {
        use std::os::windows::process::CommandExt;
        const CREATE_NO_WINDOW: u32 = 0x0800_0000;
        std::process::Command::new("reg")
            .args(["query", AUTOSTART_KEY, "/v", AUTOSTART_NAME])
            .creation_flags(CREATE_NO_WINDOW)
            .output()
            .map(|output| output.status.success())
            .unwrap_or(false)
    }
    #[cfg(not(target_os = "windows"))]
    {
        false
    }
}

fn main() {
    #[cfg(target_os = "windows")]
    {
        let args: Vec<String> = std::env::args().collect();

        // Diagnostic entry points: `--probe-media` exercises the same cached probe path the hub
        // uses; `--probe-media-direct` does a single blocking WinRT query. Both dump the result to
        // %TEMP%\leme-smtc-probe.json without touching the shell.
        let probe_arg = args.get(1).map(String::as_str);
        if probe_arg == Some("--probe-media") || probe_arg == Some("--probe-media-direct") {
            let snapshot = if probe_arg == Some("--probe-media-direct") {
                win32::query_smtc_now_playing()
            } else {
                win32::start_smtc_probe();
                std::thread::sleep(std::time::Duration::from_millis(1600));
                win32::cached_smtc_snapshot()
            };
            let payload = match snapshot {
                Some(m) => format!(
                    "{{\"detected\":true,\"title\":{:?},\"artist\":{:?},\"source_app\":{:?},\"playing\":{},\"position_sec\":{},\"duration_sec\":{},\"artwork_len\":{},\"artwork_prefix\":{:?}}}",
                    m.title,
                    m.artist,
                    m.source_app,
                    m.playing,
                    m.position_sec,
                    m.duration_sec,
                    m.artwork_data_url.len(),
                    m.artwork_data_url.chars().take(24).collect::<String>()
                ),
                None => "{\"detected\":false}".to_string(),
            };
            let path = std::env::temp_dir().join("leme-smtc-probe.json");
            let _ = std::fs::write(&path, &payload);
            return;
        }

        // Single-instance enforcement (`CreateMutexW`)
        if !win32::acquire_single_instance_mutex() {
            return;
        }
    }

    let mut sys = System::new_all();
    sys.refresh_all();

    let fullscreen_active = Arc::new(AtomicBool::new(false));
    #[cfg(target_os = "windows")]
    let fullscreen_for_setup = Arc::clone(&fullscreen_active);

    tauri::Builder::default()
        .plugin(tauri_plugin_updater::Builder::new().build())
        .manage(AppState {
            sys: Mutex::new(sys),
            fullscreen_active,
        })
        .setup(move |app| {
            if let Some(window) = app.get_webview_window("main") {
                position_hub(&window, HUB_COLLAPSED_HEIGHT)?;

                #[cfg(target_os = "windows")]
                {
                    // The hub has no shell state to maintain; it only needs to hide itself while
                    // a fullscreen app is in front.
                    let fullscreen_clone = Arc::clone(&fullscreen_for_setup);
                    let self_pid = std::process::id();
                    std::thread::spawn(move || loop {
                        std::thread::sleep(std::time::Duration::from_millis(600));
                        let is_fs = win32::is_foreground_fullscreen(self_pid);
                        fullscreen_clone.store(is_fs, Ordering::SeqCst);
                    });
                }
            }
            setup_tray(app)?;
            Ok(())
        })
        .on_window_event(|window, event| {
            // Re-anchor on DPI changes so the hub keeps hugging the taskbar corner.
            #[cfg(target_os = "windows")]
            if let WindowEvent::ScaleFactorChanged { .. } = event {
                let height = HUB_HEIGHT_X100.load(Ordering::SeqCst) as f64 / 100.0;
                let _ = position_hub(window, height);
            }
            let _ = event;
        })
        .invoke_handler(tauri::generate_handler![
            get_system_metrics,
            get_now_playing_light,
            smtc_control,
            set_hub_height,
            set_hub_anchor,
            clear_hub_anchor,
            reanchor_hub,
            set_autostart,
            is_autostart_enabled,
            set_secret,
            get_secret,
            delete_secret,
            has_secret,
            fetch_api_json,
            check_update,
            quit_and_restore_taskbar,
            launch_target
        ])
        .run(tauri::generate_context!())
        .expect("Erro ao iniciar o Leme Tauri");
}
