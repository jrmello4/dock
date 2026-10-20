#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use serde::{Deserialize, Serialize};
use std::sync::{
    atomic::{AtomicBool, Ordering},
    Arc, Mutex,
};
use std::time::Duration;
use sysinfo::System;
use tauri::{
    Manager, PhysicalPosition, PhysicalSize, Position, Size, State, WebviewWindow, WindowEvent,
};

#[derive(Clone, Copy, Debug)]
struct InteractiveRect {
    left: f64,
    top: f64,
    right: f64,
    bottom: f64,
}

struct AppState {
    sys: Mutex<System>,
    interactive_rect: Arc<Mutex<InteractiveRect>>,
    taskbar_hidden: AtomicBool,
    reserve_work_area: AtomicBool,
    auto_hide_dock: Arc<AtomicBool>,
    cursor_at_bottom: Arc<AtomicBool>,
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
pub struct OpenWindowInfo {
    pub hwnd: isize,
    pub title: String,
    pub exe_name: String,
    pub exe_path: String,
    pub icon_data_url: String,
    pub is_minimized: bool,
    pub is_focused: bool,
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
}

#[derive(Serialize)]
pub struct DesktopSnapshot {
    pub windows: Vec<OpenWindowInfo>,
    pub media: NowPlayingInfo,
}

#[derive(Deserialize)]
struct HitBoxPayload {
    left: f64,
    top: f64,
    right: f64,
    bottom: f64,
}

#[cfg(target_os = "windows")]
#[allow(non_snake_case, clippy::upper_case_acronyms)]
mod win32 {
    use super::{NowPlayingInfo, OpenWindowInfo};
    use std::collections::HashMap;
    use std::ffi::c_void;
    use std::sync::{
        atomic::{AtomicBool, AtomicI32, AtomicIsize, Ordering},
        Mutex, OnceLock,
    };
    use std::time::Instant;

    #[repr(C)]
    pub struct POINT {
        pub x: i32,
        pub y: i32,
    }

    #[repr(C)]
    #[derive(Clone, Copy, Debug)]
    pub struct RECT {
        pub left: i32,
        pub top: i32,
        pub right: i32,
        pub bottom: i32,
    }

    #[repr(C)]
    pub struct MONITORINFO {
        pub cbSize: u32,
        pub rcMonitor: RECT,
        pub rcWork: RECT,
        pub dwFlags: u32,
    }

    #[repr(C)]
    pub struct APPBARDATA {
        pub cbSize: u32,
        pub hWnd: isize,
        pub uCallbackMessage: u32,
        pub uEdge: u32,
        pub rc: RECT,
        pub lParam: isize,
    }

    #[repr(C)]
    pub struct ICONINFO {
        pub fIcon: i32,
        pub xHotspot: u32,
        pub yHotspot: u32,
        pub hbmMask: isize,
        pub hbmColor: isize,
    }

    #[repr(C)]
    #[derive(Default)]
    pub struct BITMAP {
        pub bmType: i32,
        pub bmWidth: i32,
        pub bmHeight: i32,
        pub bmWidthBytes: i32,
        pub bmPlanes: u16,
        pub bmBitsPixel: u16,
        pub bmBits: *mut c_void,
    }

    #[repr(C)]
    pub struct BITMAPINFOHEADER {
        pub biSize: u32,
        pub biWidth: i32,
        pub biHeight: i32,
        pub biPlanes: u16,
        pub biBitCount: u16,
        pub biCompression: u32,
        pub biSizeImage: u32,
        pub biXPelsPerMeter: i32,
        pub biYPelsPerMeter: i32,
        pub biClrUsed: u32,
        pub biClrImportant: u32,
    }

    #[repr(C)]
    pub struct SHFILEINFOW {
        pub hIcon: isize,
        pub iIcon: i32,
        pub dwAttributes: u32,
        pub szDisplayName: [u16; 260],
        pub szTypeName: [u16; 80],
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
        pub fn FindWindowW(lpClassName: *const u16, lpWindowName: *const u16) -> isize;
        pub fn ShowWindow(hWnd: isize, nCmdShow: i32) -> i32;
        pub fn EnumWindows(
            lpEnumFunc: unsafe extern "system" fn(isize, isize) -> i32,
            lParam: isize,
        ) -> i32;
        pub fn IsWindowVisible(hWnd: isize) -> i32;
        pub fn IsIconic(hWnd: isize) -> i32;
        pub fn GetWindowTextLengthW(hWnd: isize) -> i32;
        pub fn GetWindowTextW(hWnd: isize, lpString: *mut u16, nMaxCount: i32) -> i32;
        pub fn GetClassNameW(hWnd: isize, lpClassName: *mut u16, nMaxCount: i32) -> i32;
        pub fn GetWindowLongW(hWnd: isize, nIndex: i32) -> i32;
        pub fn GetWindow(hWnd: isize, uCmd: u32) -> isize;
        pub fn GetWindowRect(hWnd: isize, lpRect: *mut RECT) -> i32;
        pub fn GetForegroundWindow() -> isize;
        pub fn SetForegroundWindow(hWnd: isize) -> i32;
        pub fn PostMessageW(hWnd: isize, Msg: u32, wParam: usize, lParam: isize) -> i32;
        pub fn GetCursorPos(lpPoint: *mut POINT) -> i32;
        pub fn keybd_event(bVk: u8, bScan: u8, dwFlags: u32, dwExtraInfo: usize);
        pub fn GetAsyncKeyState(vKey: i32) -> i16;
        pub fn GetWindowThreadProcessId(hWnd: isize, lpdwProcessId: *mut u32) -> u32;
        pub fn SystemParametersInfoW(
            uiAction: u32,
            uiParam: u32,
            pvParam: *mut c_void,
            fWinIni: u32,
        ) -> i32;
        pub fn GetSystemMetrics(nIndex: i32) -> i32;
        pub fn GetIconInfo(hIcon: isize, piconinfo: *mut ICONINFO) -> i32;
        pub fn DestroyIcon(hIcon: isize) -> i32;
        pub fn MonitorFromWindow(hwnd: isize, dwFlags: u32) -> isize;
        pub fn GetMonitorInfoW(hMonitor: isize, lpmi: *mut MONITORINFO) -> i32;
        pub fn RegisterWindowMessageW(lpString: *const u16) -> u32;
    }

    #[link(name = "gdi32")]
    extern "system" {
        pub fn CreateCompatibleDC(hdc: isize) -> isize;
        pub fn DeleteDC(hdc: isize) -> i32;
        pub fn DeleteObject(ho: isize) -> i32;
        pub fn GetObjectW(h: isize, c: i32, pv: *mut c_void) -> i32;
        pub fn GetDIBits(
            hdc: isize,
            hbm: isize,
            start: u32,
            cLines: u32,
            lpvBits: *mut c_void,
            lpbmi: *mut BITMAPINFOHEADER,
            usage: u32,
        ) -> i32;
    }

    #[link(name = "comctl32")]
    extern "system" {
        pub fn SetWindowSubclass(
            hWnd: isize,
            pfnSubclass: Option<
                unsafe extern "system" fn(isize, u32, usize, isize, usize, usize) -> isize,
            >,
            uIdSubclass: usize,
            dwRefData: usize,
        ) -> i32;
        pub fn DefSubclassProc(hWnd: isize, uMsg: u32, wParam: usize, lParam: isize) -> isize;
    }

    #[link(name = "shell32")]
    extern "system" {
        pub fn SHGetFileInfoW(
            pszPath: *const u16,
            dwFileAttributes: u32,
            psfi: *mut SHFILEINFOW,
            cbFileInfo: u32,
            uFlags: u32,
        ) -> usize;
        pub fn ShellExecuteW(
            hwnd: isize,
            lpOperation: *const u16,
            lpFile: *const u16,
            lpParameters: *const u16,
            lpDirectory: *const u16,
            nShowCmd: i32,
        ) -> isize;
        pub fn SHAppBarMessage(dwMessage: u32, pData: *mut APPBARDATA) -> usize;
    }

    #[link(name = "kernel32")]
    extern "system" {
        pub fn OpenProcess(dwDesiredAccess: u32, bInheritHandle: i32, dwProcessId: u32) -> isize;
        pub fn CloseHandle(hObject: isize) -> i32;
        pub fn QueryFullProcessImageNameW(
            hProcess: isize,
            dwFlags: u32,
            lpExeName: *mut u16,
            lpdwSize: *mut u32,
        ) -> i32;
        pub fn GetSystemPowerStatus(lpSystemPowerStatus: *mut SYSTEM_POWER_STATUS) -> i32;
        pub fn CreateMutexW(
            lpMutexAttributes: *const c_void,
            bInitialOwner: i32,
            lpName: *const u16,
        ) -> isize;
        pub fn OpenMutexW(dwDesiredAccess: u32, bInheritHandle: i32, lpName: *const u16) -> isize;
        pub fn GetLastError() -> u32;
        pub fn WaitForSingleObject(hHandle: isize, dwMilliseconds: u32) -> u32;
    }

    #[link(name = "dwmapi")]
    extern "system" {
        pub fn DwmGetWindowAttribute(
            hwnd: isize,
            dwAttribute: u32,
            pvAttribute: *mut c_void,
            cbAttribute: u32,
        ) -> i32;
    }

    pub const SW_HIDE: i32 = 0;
    pub const SW_SHOWNORMAL: i32 = 1;
    pub const SW_MAXIMIZE: i32 = 3;
    pub const SW_SHOW: i32 = 5;
    pub const SW_MINIMIZE: i32 = 6;
    pub const SW_RESTORE: i32 = 9;
    pub const WM_CLOSE: u32 = 0x0010;

    const GWL_EXSTYLE: i32 = -20;
    const WS_EX_TOOLWINDOW: i32 = 0x00000080;
    const WS_EX_APPWINDOW: i32 = 0x00040000;
    const GW_OWNER: u32 = 4;
    const DWMWA_CLOAKED: u32 = 14;
    const PROCESS_QUERY_LIMITED_INFORMATION: u32 = 0x1000;
    const SYNCHRONIZE: u32 = 0x0010_0000;
    const INFINITE: u32 = 0xFFFF_FFFF;
    const ERROR_ALREADY_EXISTS: u32 = 183;
    const MONITOR_DEFAULTTONEAREST: u32 = 2;

    const ABM_NEW: u32 = 0x0000_0000;
    const ABM_REMOVE: u32 = 0x0000_0001;
    const ABM_QUERYPOS: u32 = 0x0000_0002;
    const ABM_SETPOS: u32 = 0x0000_0003;
    const ABE_BOTTOM: u32 = 3;
    const ABN_POSCHANGED: u32 = 0x0000_0001;

    const SHGFI_ICON: u32 = 0x000000100;
    const SHGFI_LARGEICON: u32 = 0x000000000;
    const DIB_RGB_COLORS: u32 = 0;
    const BI_RGB: u32 = 0;

    const SPI_SETWORKAREA: u32 = 0x002F;
    const SPI_GETWORKAREA: u32 = 0x0030;
    const SPIF_SENDCHANGE: u32 = 0x0002;
    const SM_CXSCREEN: i32 = 0;
    const SM_CYSCREEN: i32 = 1;

    const VK_SHIFT: u8 = 0x10;
    const VK_CONTROL: i32 = 0x11;
    const VK_MENU: i32 = 0x12; // Alt
    const VK_R: i32 = 0x52;
    const VK_LWIN: u8 = 0x5B;
    const VK_A: u8 = 0x41;
    const VK_S: u8 = 0x53;
    const VK_VOLUME_MUTE: u8 = 0xAD;
    const VK_VOLUME_DOWN: u8 = 0xAE;
    const VK_VOLUME_UP: u8 = 0xAF;
    const VK_MEDIA_NEXT_TRACK: u8 = 0xB0;
    const VK_MEDIA_PREV_TRACK: u8 = 0xB1;
    const VK_MEDIA_PLAY_PAUSE: u8 = 0xB3;
    const KEYEVENTF_KEYUP: u32 = 0x0002;

    static ICON_CACHE: OnceLock<Mutex<HashMap<String, String>>> = OnceLock::new();
    static ORIGINAL_WORK_AREA: OnceLock<RECT> = OnceLock::new();
    static APPBAR_REGISTERED: AtomicBool = AtomicBool::new(false);
    static MAIN_APPBAR_HWND: AtomicIsize = AtomicIsize::new(0);
    static APPBAR_CALLBACK_MSG: OnceLock<u32> = OnceLock::new();
    static APPBAR_RESERVED_PX: AtomicI32 = AtomicI32::new(0);
    static APPBAR_SUBCLASS_HWND: AtomicIsize = AtomicIsize::new(0);
    static WATCHDOG_CHILD: OnceLock<Mutex<Option<std::process::Child>>> = OnceLock::new();
    static WATCHDOG_HELPER: OnceLock<Mutex<Option<std::path::PathBuf>>> = OnceLock::new();

    const SINGLE_INSTANCE_MUTEX_NAME: &str = "Local\\PrimoDockSingleInstanceMutex_v1";

    struct MediaTrackerState {
        track_key: String,
        accumulated_sec: u32,
        last_resume: Option<Instant>,
    }

    static MEDIA_TRACKER: OnceLock<Mutex<MediaTrackerState>> = OnceLock::new();

    fn get_media_tracker() -> &'static Mutex<MediaTrackerState> {
        MEDIA_TRACKER.get_or_init(|| {
            Mutex::new(MediaTrackerState {
                track_key: String::new(),
                accumulated_sec: 0,
                last_resume: None,
            })
        })
    }

    fn get_watchdog_slot() -> &'static Mutex<Option<std::process::Child>> {
        WATCHDOG_CHILD.get_or_init(|| Mutex::new(None))
    }

    fn get_watchdog_helper_slot() -> &'static Mutex<Option<std::path::PathBuf>> {
        WATCHDOG_HELPER.get_or_init(|| Mutex::new(None))
    }

    fn get_appbar_callback_msg() -> u32 {
        *APPBAR_CALLBACK_MSG.get_or_init(|| unsafe {
            let name = to_wide("PrimoDockAppBarCallbackMsg_v1");
            RegisterWindowMessageW(name.as_ptr())
        })
    }

    /// Forces the cached HWND, bypassing the title lookup (used with `WebviewWindow::hwnd()`).
    pub fn cache_main_window_hwnd(hwnd: isize) {
        if hwnd != 0 {
            MAIN_APPBAR_HWND.store(hwnd, Ordering::SeqCst);
        }
    }

    /// Resolves and caches the real Win32 `HWND` of PrimoDock's main window.
    /// Tauri supplies it directly via `cache_main_window_hwnd`; the `FindWindowW` lookup is only
    /// a fallback for code paths that run before the window handle has been pushed (e.g. watchdog).
    pub fn resolve_main_window_hwnd() -> isize {
        let cached = MAIN_APPBAR_HWND.load(Ordering::SeqCst);
        if cached != 0 {
            return cached;
        }
        unsafe {
            let title = to_wide("PrimoDock");
            let hwnd = FindWindowW(std::ptr::null(), title.as_ptr());
            if hwnd != 0 {
                let mut pid: u32 = 0;
                GetWindowThreadProcessId(hwnd, &mut pid);
                if pid == std::process::id() {
                    MAIN_APPBAR_HWND.store(hwnd, Ordering::SeqCst);
                    return hwnd;
                }
            }
        }
        0
    }

    /// Keeps the shell's bottom reservation while respecting a per-monitor maximum of 50% of its height.
    fn appbar_top_for(mon_rect: RECT, reserved_physical_px: i32) -> i32 {
        let mon_height = (mon_rect.bottom - mon_rect.top).max(1);
        let effective = reserved_physical_px.clamp(0, (mon_height / 2).max(1));
        mon_rect.bottom - effective
    }

    fn make_appbar_data(hwnd: isize, mon_rect: RECT, reserved_physical_px: i32) -> APPBARDATA {
        APPBARDATA {
            cbSize: std::mem::size_of::<APPBARDATA>() as u32,
            hWnd: hwnd,
            uCallbackMessage: get_appbar_callback_msg(),
            uEdge: ABE_BOTTOM,
            rc: RECT {
                left: mon_rect.left,
                top: appbar_top_for(mon_rect, reserved_physical_px),
                right: mon_rect.right,
                bottom: mon_rect.bottom,
            },
            lParam: 0,
        }
    }

    /// Re-applies `ABM_SETPOS` when the shell notifies `ABN_POSCHANGED`.
    fn reapply_appbar_position(hwnd: isize) {
        let reserved = APPBAR_RESERVED_PX.load(Ordering::SeqCst);
        if reserved <= 0 || hwnd == 0 {
            return;
        }
        let mon_rect = get_window_monitor_rect(hwnd);
        let mut abd = make_appbar_data(hwnd, mon_rect, reserved);
        unsafe {
            let _ = SHAppBarMessage(ABM_QUERYPOS, &mut abd);
            abd.rc.top = appbar_top_for(mon_rect, reserved);
            abd.rc.bottom = mon_rect.bottom;
            let _ = SHAppBarMessage(ABM_SETPOS, &mut abd);
        }
    }

    /// Subclasses the Tauri window so the registered AppBar callback message is actually consumed.
    unsafe extern "system" fn appbar_subclass_proc(
        hwnd: isize,
        msg: u32,
        wparam: usize,
        lparam: isize,
        _u_id_subclass: usize,
        _dw_ref_data: usize,
    ) -> isize {
        let callback_msg = get_appbar_callback_msg();
        if callback_msg != 0 && msg == callback_msg {
            if wparam as u32 == ABN_POSCHANGED {
                reapply_appbar_position(hwnd);
            }
            return 0;
        }
        DefSubclassProc(hwnd, msg, wparam, lparam)
    }

    fn ensure_appbar_subclass(hwnd: isize) {
        if hwnd == 0 || APPBAR_SUBCLASS_HWND.load(Ordering::SeqCst) == hwnd {
            return;
        }
        unsafe {
            if SetWindowSubclass(hwnd, Some(appbar_subclass_proc), 0x5052_4D44, 0) != 0 {
                APPBAR_SUBCLASS_HWND.store(hwnd, Ordering::SeqCst);
            }
        }
    }

    /// Ensures only a single instance of PrimoDock runs at any time (`CreateMutexW`).
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

    /// Checks whether a live PrimoDock instance currently holds the single-instance mutex.
    fn is_another_instance_running() -> bool {
        unsafe {
            let name = to_wide(SINGLE_INSTANCE_MUTEX_NAME);
            let h = OpenMutexW(SYNCHRONIZE, 0, name.as_ptr());
            if h != 0 {
                let _ = CloseHandle(h);
                true
            } else {
                false
            }
        }
    }

    /// Out-of-process kernel watchdog (`WaitForSingleObject`):
    /// Runs under a separate image name (`primodock-watchdog-helper.exe`) so `taskkill /F /IM primodock-tauri.exe`
    /// does not kill it. When the parent process dies, checks if a new instance has already started before restoring!
    pub fn run_crash_watchdog(parent_pid: u32, orig_rect: RECT, appbar_hwnd: isize) {
        unsafe {
            let handle = OpenProcess(SYNCHRONIZE, 0, parent_pid);
            if handle != 0 {
                let _ = WaitForSingleObject(handle, INFINITE);
                let _ = CloseHandle(handle);
            }
            // Brief grace window so a fast dev-reload / relaunch can acquire the mutex first.
            // The relaunched instance re-applies its own reservation, so a short wait is enough.
            std::thread::sleep(std::time::Duration::from_millis(250));
            if is_another_instance_running() {
                return;
            }
            if appbar_hwnd != 0 {
                // Best-effort: the HWND usually dies together with the parent process, so the
                // shell may reject this. The SPI_SETWORKAREA restore below is the authoritative
                // cleanup and is what actually frees the screen area.
                let mut abd = APPBARDATA {
                    cbSize: std::mem::size_of::<APPBARDATA>() as u32,
                    hWnd: appbar_hwnd,
                    uCallbackMessage: 0,
                    uEdge: ABE_BOTTOM,
                    rc: orig_rect,
                    lParam: 0,
                };
                let _ = SHAppBarMessage(ABM_REMOVE, &mut abd);
            }
            set_windows_taskbar_visible(true);
            let mut rect = orig_rect;
            let _ = SystemParametersInfoW(
                SPI_SETWORKAREA,
                0,
                &mut rect as *mut RECT as *mut c_void,
                SPIF_SENDCHANGE,
            );
        }
    }

    /// Spawns a detached background watchdog process under a separate image name in `%TEMP%`
    /// so `taskkill /F /IM primodock-tauri.exe` and `taskkill /T` do not leave the taskbar hidden.
    pub fn spawn_crash_watchdog(orig_rect: RECT, appbar_hwnd: isize) {
        use std::os::windows::process::CommandExt;
        const DETACHED_PROCESS: u32 = 0x0000_0008;
        const CREATE_NEW_PROCESS_GROUP: u32 = 0x0000_0200;
        const CREATE_NO_WINDOW: u32 = 0x0800_0000;
        const CREATE_BREAKAWAY_FROM_JOB: u32 = 0x0100_0000;

        // Kill any previous watchdog child first
        if let Ok(mut slot) = get_watchdog_slot().lock() {
            if let Some(mut old_child) = slot.take() {
                let _ = old_child.kill();
                let _ = old_child.wait();
            }
        }

        if let Ok(current_exe) = std::env::current_exe() {
            // Best-effort: drop helpers left behind by earlier sessions (deleting a still-running
            // helper simply fails with a sharing violation and is ignored).
            if let Ok(entries) = std::fs::read_dir(std::env::temp_dir()) {
                for entry in entries.flatten() {
                    let name = entry.file_name();
                    let name = name.to_string_lossy();
                    if name.starts_with("primodock-watchdog-helper") && name.ends_with(".exe") {
                        let _ = std::fs::remove_file(entry.path());
                    }
                }
            }

            // Unique per-process name: a leftover helper from a crashed/restarted session would
            // otherwise make the copy fail with a sharing violation and silently run a stale image.
            let stamp = std::time::SystemTime::now()
                .duration_since(std::time::UNIX_EPOCH)
                .map(|d| d.as_millis())
                .unwrap_or(0);
            let helper_path = std::env::temp_dir().join(format!(
                "primodock-watchdog-helper-{}-{}.exe",
                std::process::id(),
                stamp
            ));

            // Only trust the temp copy when it was actually written now.
            let exe_to_run = match std::fs::copy(&current_exe, &helper_path) {
                Ok(_) => {
                    if let Ok(mut slot) = get_watchdog_helper_slot().lock() {
                        *slot = Some(helper_path.clone());
                    }
                    helper_path
                }
                Err(_) => current_exe.clone(),
            };

            let pid = std::process::id();
            let args = vec![
                "--watchdog".to_string(),
                pid.to_string(),
                orig_rect.left.to_string(),
                orig_rect.top.to_string(),
                orig_rect.right.to_string(),
                orig_rect.bottom.to_string(),
                appbar_hwnd.to_string(),
            ];

            let spawn_with = |breakaway: bool| {
                std::process::Command::new(&exe_to_run)
                    .args(&args)
                    .creation_flags(
                        DETACHED_PROCESS
                            | CREATE_NEW_PROCESS_GROUP
                            | CREATE_NO_WINDOW
                            | if breakaway {
                                CREATE_BREAKAWAY_FROM_JOB
                            } else {
                                0
                            },
                    )
                    .spawn()
            };

            // CREATE_BREAKAWAY_FROM_JOB keeps the watchdog alive when the app runs inside a Job
            // Object (some launchers/dev tooling). It fails if the job forbids breakaway, so fall
            // back to a plain detached spawn.
            if let Ok(child) = spawn_with(true).or_else(|_| spawn_with(false)) {
                if let Ok(mut slot) = get_watchdog_slot().lock() {
                    *slot = Some(child);
                }
            }
        }
    }

    /// Terminates the watchdog child on graceful exit and synchronously restores the Windows Taskbar & WorkArea.
    pub fn stop_crash_watchdog_and_restore() {
        if let Ok(mut slot) = get_watchdog_slot().lock() {
            if let Some(mut child) = slot.take() {
                let _ = child.kill();
                let _ = child.wait();
            }
        }
        if let Ok(mut slot) = get_watchdog_helper_slot().lock() {
            if let Some(path) = slot.take() {
                let _ = std::fs::remove_file(path);
            }
        }
        set_reserved_bottom_work_area(0);
        set_windows_taskbar_visible(true);
    }

    fn get_icon_cache() -> &'static Mutex<HashMap<String, String>> {
        ICON_CACHE.get_or_init(|| Mutex::new(HashMap::new()))
    }

    /// Captures and caches the user's original Windows WorkArea BEFORE PrimoDock modifies it
    pub fn get_original_work_area() -> RECT {
        *ORIGINAL_WORK_AREA.get_or_init(|| unsafe {
            let mut rect = RECT {
                left: 0,
                top: 0,
                right: GetSystemMetrics(SM_CXSCREEN),
                bottom: GetSystemMetrics(SM_CYSCREEN),
            };
            let _ =
                SystemParametersInfoW(SPI_GETWORKAREA, 0, &mut rect as *mut RECT as *mut c_void, 0);
            rect
        })
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

    /// Checks if the user pressed the emergency restore hotkey `Ctrl + Alt + Shift + R`
    pub fn is_emergency_restore_hotkey_pressed() -> bool {
        unsafe {
            let ctrl = (GetAsyncKeyState(VK_CONTROL) as u16 & 0x8000) != 0;
            let alt = (GetAsyncKeyState(VK_MENU) as u16 & 0x8000) != 0;
            let shift = (GetAsyncKeyState(VK_SHIFT as i32) as u16 & 0x8000) != 0;
            let r_key = (GetAsyncKeyState(VK_R) as u16 & 0x8000) != 0;
            ctrl && alt && shift && r_key
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

    /// Minimal, zero-dependency RGBA to PNG + Base64 encoder for extracted Win32 HICONs
    fn encode_rgba_to_png_data_url(width: u32, height: u32, rgba: &[u8]) -> String {
        fn crc32(data: &[u8]) -> u32 {
            let mut crc = 0xFFFF_FFFFu32;
            for &b in data {
                crc ^= b as u32;
                for _ in 0..8 {
                    if crc & 1 != 0 {
                        crc = (crc >> 1) ^ 0xEDB8_8320;
                    } else {
                        crc >>= 1;
                    }
                }
            }
            !crc
        }

        fn adler32(data: &[u8]) -> u32 {
            let mut a: u32 = 1;
            let mut b: u32 = 0;
            for &byte in data {
                a = (a + byte as u32) % 65521;
                b = (b + a) % 65521;
            }
            (b << 16) | a
        }

        fn write_chunk(out: &mut Vec<u8>, chunk_type: &[u8; 4], data: &[u8]) {
            out.extend_from_slice(&(data.len() as u32).to_be_bytes());
            let start = out.len();
            out.extend_from_slice(chunk_type);
            out.extend_from_slice(data);
            let crc = crc32(&out[start..]);
            out.extend_from_slice(&crc.to_be_bytes());
        }

        let row_bytes = (width * 4) as usize;
        let mut raw = Vec::with_capacity((row_bytes + 1) * height as usize);
        for y in 0..height as usize {
            raw.push(0);
            let start = y * row_bytes;
            raw.extend_from_slice(&rgba[start..start + row_bytes]);
        }

        let mut zlib = Vec::with_capacity(raw.len() + 32);
        zlib.push(0x78);
        zlib.push(0x01);
        let chunks: Vec<&[u8]> = raw.chunks(65535).collect();
        for (i, chunk) in chunks.iter().enumerate() {
            let is_last = i + 1 == chunks.len();
            zlib.push(if is_last { 0x01 } else { 0x00 });
            let len = chunk.len() as u16;
            zlib.extend_from_slice(&len.to_le_bytes());
            zlib.extend_from_slice(&(!len).to_le_bytes());
            zlib.extend_from_slice(chunk);
        }
        zlib.extend_from_slice(&adler32(&raw).to_be_bytes());

        let mut png = Vec::with_capacity(zlib.len() + 64);
        png.extend_from_slice(&[137, 80, 78, 71, 13, 10, 26, 10]);

        let mut ihdr = [0u8; 13];
        ihdr[0..4].copy_from_slice(&width.to_be_bytes());
        ihdr[4..8].copy_from_slice(&height.to_be_bytes());
        ihdr[8] = 8;
        ihdr[9] = 6;
        write_chunk(&mut png, b"IHDR", &ihdr);
        write_chunk(&mut png, b"IDAT", &zlib);
        write_chunk(&mut png, b"IEND", &[]);

        const B64: &[u8; 64] = b"ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
        let mut b64 = String::with_capacity(32 + (png.len() * 4) / 3);
        b64.push_str("data:image/png;base64,");
        for chunk in png.chunks(3) {
            let b0 = chunk[0] as u32;
            let b1 = if chunk.len() > 1 { chunk[1] as u32 } else { 0 };
            let b2 = if chunk.len() > 2 { chunk[2] as u32 } else { 0 };
            let n = (b0 << 16) | (b1 << 8) | b2;
            b64.push(B64[((n >> 18) & 63) as usize] as char);
            b64.push(B64[((n >> 12) & 63) as usize] as char);
            b64.push(if chunk.len() > 1 {
                B64[((n >> 6) & 63) as usize] as char
            } else {
                '='
            });
            b64.push(if chunk.len() > 2 {
                B64[(n & 63) as usize] as char
            } else {
                '='
            });
        }
        b64
    }

    /// Extracts the real Windows application icon from an `.exe` path and caches it as a PNG Data URL!
    pub fn extract_exe_icon_data_url(exe_path: &str) -> String {
        if exe_path.is_empty() {
            return String::new();
        }
        if let Ok(cache) = get_icon_cache().lock() {
            if let Some(cached) = cache.get(exe_path) {
                return cached.clone();
            }
        }

        let result = unsafe {
            let wide_path = to_wide(exe_path);
            let mut shfi: SHFILEINFOW = std::mem::zeroed();
            let res = SHGetFileInfoW(
                wide_path.as_ptr(),
                0,
                &mut shfi,
                std::mem::size_of::<SHFILEINFOW>() as u32,
                SHGFI_ICON | SHGFI_LARGEICON,
            );
            if res == 0 || shfi.hIcon == 0 {
                String::new()
            } else {
                let hicon = shfi.hIcon;
                let mut icon_info: ICONINFO = std::mem::zeroed();
                let mut data_url = String::new();

                if GetIconInfo(hicon, &mut icon_info) != 0 {
                    let hbm = if icon_info.hbmColor != 0 {
                        icon_info.hbmColor
                    } else {
                        icon_info.hbmMask
                    };
                    let mut bm = BITMAP::default();
                    if hbm != 0
                        && GetObjectW(
                            hbm,
                            std::mem::size_of::<BITMAP>() as i32,
                            &mut bm as *mut BITMAP as *mut c_void,
                        ) != 0
                        && bm.bmWidth > 0
                        && bm.bmHeight > 0
                    {
                        let w = bm.bmWidth as u32;
                        let h = bm.bmHeight as u32;
                        let mut bmi = BITMAPINFOHEADER {
                            biSize: std::mem::size_of::<BITMAPINFOHEADER>() as u32,
                            biWidth: w as i32,
                            biHeight: -(h as i32),
                            biPlanes: 1,
                            biBitCount: 32,
                            biCompression: BI_RGB,
                            biSizeImage: 0,
                            biXPelsPerMeter: 0,
                            biYPelsPerMeter: 0,
                            biClrUsed: 0,
                            biClrImportant: 0,
                        };
                        let mut pixels = vec![0u8; (w * h * 4) as usize];
                        let hdc = CreateCompatibleDC(0);
                        if hdc != 0 {
                            let lines = GetDIBits(
                                hdc,
                                hbm,
                                0,
                                h,
                                pixels.as_mut_ptr() as *mut c_void,
                                &mut bmi,
                                DIB_RGB_COLORS,
                            );
                            DeleteDC(hdc);
                            if lines > 0 {
                                let mut any_alpha = false;
                                for px in pixels.chunks_exact_mut(4) {
                                    px.swap(0, 2);
                                    if px[3] != 0 {
                                        any_alpha = true;
                                    }
                                }
                                if !any_alpha {
                                    for px in pixels.chunks_exact_mut(4) {
                                        px[3] = 255;
                                    }
                                }
                                data_url = encode_rgba_to_png_data_url(w, h, &pixels);
                            }
                        }
                    }
                    if icon_info.hbmColor != 0 {
                        DeleteObject(icon_info.hbmColor);
                    }
                    if icon_info.hbmMask != 0 {
                        DeleteObject(icon_info.hbmMask);
                    }
                }
                DestroyIcon(hicon);
                data_url
            }
        };

        if let Ok(mut cache) = get_icon_cache().lock() {
            cache.insert(exe_path.to_string(), result.clone());
        }
        result
    }

    unsafe extern "system" fn show_or_hide_taskbar_window(hwnd: isize, lparam: isize) -> i32 {
        let mut buf = [0u16; 64];
        let len = GetClassNameW(hwnd, buf.as_mut_ptr(), buf.len() as i32);
        if len > 0 {
            let class = String::from_utf16_lossy(&buf[..len as usize]);
            if class == "Shell_TrayWnd" || class == "Shell_SecondaryTrayWnd" {
                ShowWindow(hwnd, if lparam != 0 { SW_SHOW } else { SW_HIDE });
            }
        }
        1 // keep enumerating
    }

    pub fn set_windows_taskbar_visible(visible: bool) {
        unsafe {
            // Enumerate every top-level window: `FindWindowW` only returns the first match, which
            // left the second/third `Shell_SecondaryTrayWnd` visible on multi-monitor setups.
            let _ = EnumWindows(show_or_hide_taskbar_window, if visible { 1 } else { 0 });
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
                        rcMonitor: RECT {
                            left: 0,
                            top: 0,
                            right: 0,
                            bottom: 0,
                        },
                        rcWork: RECT {
                            left: 0,
                            top: 0,
                            right: 0,
                            bottom: 0,
                        },
                        dwFlags: 0,
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

    /// Registers/updates or removes a Windows AppBar (`SHAppBarMessage`) for the dock's monitor and
    /// reserves the primary WorkArea. The AppBar is bound to one HWND, so `ABM_NEW` happens once and
    /// later monitor changes only move the same registration through `ABM_SETPOS`.
    pub fn sync_monitor_appbar_reservation(
        appbar_hwnd: isize,
        mon_rect: RECT,
        reserved_physical_px: i32,
    ) {
        unsafe {
            let effective_hwnd = if appbar_hwnd != 0 {
                cache_main_window_hwnd(appbar_hwnd);
                appbar_hwnd
            } else {
                resolve_main_window_hwnd()
            };

            let mon_height = (mon_rect.bottom - mon_rect.top).max(1);
            let reserved = reserved_physical_px.clamp(0, mon_height);
            APPBAR_RESERVED_PX.store(reserved, Ordering::SeqCst);

            if effective_hwnd != 0 {
                ensure_appbar_subclass(effective_hwnd);
                let mut abd = make_appbar_data(effective_hwnd, mon_rect, reserved);

                if reserved <= 0 {
                    if APPBAR_REGISTERED.swap(false, Ordering::SeqCst) {
                        let _ = SHAppBarMessage(ABM_REMOVE, &mut abd);
                    }
                } else {
                    if !APPBAR_REGISTERED.swap(true, Ordering::SeqCst) {
                        let _ = SHAppBarMessage(ABM_NEW, &mut abd);
                    }
                    let _ = SHAppBarMessage(ABM_QUERYPOS, &mut abd);
                    abd.rc.top = appbar_top_for(mon_rect, reserved);
                    abd.rc.bottom = mon_rect.bottom;
                    let _ = SHAppBarMessage(ABM_SETPOS, &mut abd);
                }
            }

            // SPI_SETWORKAREA applies to the primary monitor ((0, 0) origin).
            // Never pass a secondary monitor's rect to SPI_SETWORKAREA!
            let is_primary_monitor = mon_rect.left == 0 && mon_rect.top == 0;
            if reserved <= 0 || is_primary_monitor {
                let orig = get_original_work_area();
                let mut rect = if reserved <= 0 {
                    orig
                } else {
                    RECT {
                        left: orig.left,
                        top: orig.top,
                        right: orig.right,
                        bottom: appbar_top_for(mon_rect, reserved).max(orig.top),
                    }
                };
                SystemParametersInfoW(
                    SPI_SETWORKAREA,
                    0,
                    &mut rect as *mut RECT as *mut c_void,
                    SPIF_SENDCHANGE,
                );
            }
        }
    }

    /// Reserves or restores the bottom screen Work Area on Windows
    pub fn set_reserved_bottom_work_area(reserved_physical_px: i32) {
        let hwnd = resolve_main_window_hwnd();
        let mon_rect = get_window_monitor_rect(hwnd);
        sync_monitor_appbar_reservation(hwnd, mon_rect, reserved_physical_px);
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

            let mut rect = RECT {
                left: 0,
                top: 0,
                right: 0,
                bottom: 0,
            };
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

    pub fn trigger_start_menu() {
        unsafe {
            keybd_event(VK_LWIN, 0, 0, 0);
            keybd_event(VK_LWIN, 0, KEYEVENTF_KEYUP, 0);
        }
    }

    pub fn trigger_quick_settings() {
        unsafe {
            keybd_event(VK_LWIN, 0, 0, 0);
            keybd_event(VK_A, 0, 0, 0);
            keybd_event(VK_A, 0, KEYEVENTF_KEYUP, 0);
            keybd_event(VK_LWIN, 0, KEYEVENTF_KEYUP, 0);
        }
    }

    pub fn trigger_screenshot() {
        unsafe {
            keybd_event(VK_LWIN, 0, 0, 0);
            keybd_event(VK_SHIFT, 0, 0, 0);
            keybd_event(VK_S, 0, 0, 0);
            keybd_event(VK_S, 0, KEYEVENTF_KEYUP, 0);
            keybd_event(VK_SHIFT, 0, KEYEVENTF_KEYUP, 0);
            keybd_event(VK_LWIN, 0, KEYEVENTF_KEYUP, 0);
        }
    }

    pub fn send_media_or_volume_key(action: &str) {
        let vk = match action {
            "play_pause" | "toggle" => VK_MEDIA_PLAY_PAUSE,
            "next" => VK_MEDIA_NEXT_TRACK,
            "prev" => VK_MEDIA_PREV_TRACK,
            "vol_up" => VK_VOLUME_UP,
            "vol_down" => VK_VOLUME_DOWN,
            "vol_mute" => VK_VOLUME_MUTE,
            _ => return,
        };
        unsafe {
            keybd_event(vk, 0, 0, 0);
            keybd_event(vk, 0, KEYEVENTF_KEYUP, 0);
        }
    }

    pub fn get_cursor_pos() -> Option<(i32, i32)> {
        unsafe {
            let mut pt = POINT { x: 0, y: 0 };
            if GetCursorPos(&mut pt) != 0 {
                Some((pt.x, pt.y))
            } else {
                None
            }
        }
    }

    fn get_process_exe_info(pid: u32) -> (String, String) {
        unsafe {
            let handle = OpenProcess(PROCESS_QUERY_LIMITED_INFORMATION, 0, pid);
            if handle == 0 {
                return (String::new(), String::new());
            }
            let mut buf = vec![0u16; 512];
            let mut size = buf.len() as u32;
            let ok = QueryFullProcessImageNameW(handle, 0, buf.as_mut_ptr(), &mut size);
            CloseHandle(handle);
            if ok != 0 && size > 0 {
                let full = String::from_utf16_lossy(&buf[..size as usize]);
                let name = full.rsplit('\\').next().unwrap_or("").to_string();
                (name, full)
            } else {
                (String::new(), String::new())
            }
        }
    }

    struct EnumContext {
        fg_hwnd: isize,
        self_pid: u32,
        list: Vec<OpenWindowInfo>,
    }

    unsafe extern "system" fn enum_windows_proc(hwnd: isize, lparam: isize) -> i32 {
        let ctx = &mut *(lparam as *mut EnumContext);

        if IsWindowVisible(hwnd) == 0 {
            return 1;
        }

        let len = GetWindowTextLengthW(hwnd);
        if len <= 0 {
            return 1;
        }

        let ex_style = GetWindowLongW(hwnd, GWL_EXSTYLE);
        let owner = GetWindow(hwnd, GW_OWNER);
        if (ex_style & WS_EX_TOOLWINDOW) != 0 && (ex_style & WS_EX_APPWINDOW) == 0 {
            return 1;
        }
        if owner != 0 && (ex_style & WS_EX_APPWINDOW) == 0 {
            return 1;
        }

        let mut cloaked: u32 = 0;
        let _ = DwmGetWindowAttribute(
            hwnd,
            DWMWA_CLOAKED,
            &mut cloaked as *mut u32 as *mut c_void,
            std::mem::size_of::<u32>() as u32,
        );
        if cloaked != 0 {
            return 1;
        }

        let mut pid: u32 = 0;
        GetWindowThreadProcessId(hwnd, &mut pid);
        if pid == ctx.self_pid {
            return 1;
        }

        let mut buf = vec![0u16; (len + 1) as usize];
        let read_len = GetWindowTextW(hwnd, buf.as_mut_ptr(), len + 1);
        if read_len <= 0 {
            return 1;
        }
        let title = String::from_utf16_lossy(&buf[..read_len as usize])
            .trim()
            .to_string();

        if title.is_empty()
            || title == "Program Manager"
            || title == "Windows Input Experience"
            || title == "PrimoDock"
        {
            return 1;
        }

        let (exe_name, exe_path) = get_process_exe_info(pid);
        let icon_data_url = extract_exe_icon_data_url(&exe_path);
        let is_minimized = IsIconic(hwnd) != 0;
        let is_focused = hwnd == ctx.fg_hwnd;

        ctx.list.push(OpenWindowInfo {
            hwnd,
            title,
            exe_name,
            exe_path,
            icon_data_url,
            is_minimized,
            is_focused,
        });

        1
    }

    pub fn list_taskbar_windows() -> Vec<OpenWindowInfo> {
        unsafe {
            let mut ctx = EnumContext {
                fg_hwnd: GetForegroundWindow(),
                self_pid: std::process::id(),
                list: Vec::new(),
            };
            EnumWindows(enum_windows_proc, &mut ctx as *mut EnumContext as isize);
            ctx.list
        }
    }

    fn compute_media_timeline(artist: &str, title: &str, playing: bool) -> (u32, u32) {
        let key = format!("{} - {}", artist, title);
        let duration_sec = 210u32;
        if let Ok(mut tracker) = get_media_tracker().lock() {
            if tracker.track_key != key {
                tracker.track_key = key;
                tracker.accumulated_sec = 0;
                tracker.last_resume = if playing { Some(Instant::now()) } else { None };
                return (0, duration_sec);
            }
            if playing {
                let extra = if let Some(since) = tracker.last_resume {
                    since.elapsed().as_secs() as u32
                } else {
                    tracker.last_resume = Some(Instant::now());
                    0
                };
                let pos = (tracker.accumulated_sec + extra).min(duration_sec);
                return (pos, duration_sec);
            } else {
                if let Some(since) = tracker.last_resume.take() {
                    tracker.accumulated_sec = (tracker.accumulated_sec
                        + since.elapsed().as_secs() as u32)
                        .min(duration_sec);
                }
                return (tracker.accumulated_sec, duration_sec);
            }
        }
        (0, duration_sec)
    }

    /// Detects real music playing across Spotify, Apple Music, Tidal, Deezer, VLC, and Browsers
    pub fn detect_now_playing(windows: &[OpenWindowInfo]) -> NowPlayingInfo {
        for w in windows {
            let exe_lower = w.exe_name.to_lowercase();
            if exe_lower == "spotify.exe"
                || exe_lower == "tidal.exe"
                || exe_lower == "deezer.exe"
                || exe_lower == "applemusic.exe"
            {
                let app_label = if exe_lower.contains("tidal") {
                    "TIDAL"
                } else if exe_lower.contains("deezer") {
                    "Deezer"
                } else if exe_lower.contains("apple") {
                    "Apple Music"
                } else {
                    "Spotify"
                };
                let t = w.title.trim();
                if t.eq_ignore_ascii_case("Spotify")
                    || t.eq_ignore_ascii_case("Spotify Free")
                    || t.eq_ignore_ascii_case("Spotify Premium")
                    || t.eq_ignore_ascii_case("TIDAL")
                    || t.eq_ignore_ascii_case("Apple Music")
                {
                    let (position_sec, duration_sec) =
                        compute_media_timeline(app_label, "Pausado", false);
                    return NowPlayingInfo {
                        detected: true,
                        source_app: app_label.to_string(),
                        playing: false,
                        title: format!("{} Pausado", app_label),
                        artist: "Toque no Play para retomar".to_string(),
                        hwnd: w.hwnd,
                        position_sec,
                        duration_sec,
                    };
                }
                if let Some((artist, song)) = t.split_once(" - ") {
                    let clean_song = song.trim().to_string();
                    let clean_artist = artist.trim().to_string();
                    let (position_sec, duration_sec) =
                        compute_media_timeline(&clean_artist, &clean_song, true);
                    return NowPlayingInfo {
                        detected: true,
                        source_app: app_label.to_string(),
                        playing: true,
                        title: clean_song,
                        artist: clean_artist,
                        hwnd: w.hwnd,
                        position_sec,
                        duration_sec,
                    };
                }
                let (position_sec, duration_sec) = compute_media_timeline(app_label, t, true);
                return NowPlayingInfo {
                    detected: true,
                    source_app: app_label.to_string(),
                    playing: true,
                    title: t.to_string(),
                    artist: app_label.to_string(),
                    hwnd: w.hwnd,
                    position_sec,
                    duration_sec,
                };
            }
        }

        // Check YouTube Music / YouTube / SoundCloud / Spotify Web in browsers or VLC
        for w in windows {
            let t = w.title.trim();
            if t.contains("YouTube Music")
                || t.contains(" - YouTube")
                || t.contains("SoundCloud")
                || w.exe_name.eq_ignore_ascii_case("vlc.exe")
            {
                let clean = t
                    .replace(" - YouTube Music", "")
                    .replace(" - YouTube", "")
                    .replace(" - VLC media player", "")
                    .replace(" - Google Chrome", "")
                    .replace(" - Microsoft\u{200B} Edge", "")
                    .replace(" - Microsoft Edge", "")
                    .replace(" - Brave", "")
                    .replace(" - Mozilla Firefox", "")
                    .trim()
                    .to_string();
                let source = if t.contains("YouTube Music") {
                    "YouTube Music"
                } else if w.exe_name.eq_ignore_ascii_case("vlc.exe") {
                    "VLC"
                } else {
                    "YouTube"
                };
                if let Some((artist, song)) = clean.split_once(" - ") {
                    let clean_song = song.trim().to_string();
                    let clean_artist = artist.trim().to_string();
                    let (position_sec, duration_sec) =
                        compute_media_timeline(&clean_artist, &clean_song, true);
                    return NowPlayingInfo {
                        detected: true,
                        source_app: source.to_string(),
                        playing: true,
                        title: clean_song,
                        artist: clean_artist,
                        hwnd: w.hwnd,
                        position_sec,
                        duration_sec,
                    };
                }
                let (position_sec, duration_sec) = compute_media_timeline(source, &clean, true);
                return NowPlayingInfo {
                    detected: true,
                    source_app: source.to_string(),
                    playing: true,
                    title: clean,
                    artist: source.to_string(),
                    hwnd: w.hwnd,
                    position_sec,
                    duration_sec,
                };
            }
        }

        NowPlayingInfo {
            detected: false,
            source_app: String::new(),
            playing: false,
            title: String::new(),
            artist: String::new(),
            hwnd: 0,
            position_sec: 0,
            duration_sec: 180,
        }
    }

    pub fn activate_or_toggle_window(hwnd: isize) {
        unsafe {
            let fg = GetForegroundWindow();
            if IsIconic(hwnd) != 0 {
                ShowWindow(hwnd, SW_RESTORE);
                SetForegroundWindow(hwnd);
            } else if fg == hwnd {
                ShowWindow(hwnd, SW_MINIMIZE);
            } else {
                SetForegroundWindow(hwnd);
            }
        }
    }

    pub fn perform_window_action(hwnd: isize, action: &str) {
        unsafe {
            match action {
                "close" => {
                    PostMessageW(hwnd, WM_CLOSE, 0, 0);
                }
                "minimize" => {
                    ShowWindow(hwnd, SW_MINIMIZE);
                }
                "maximize" => {
                    ShowWindow(hwnd, SW_MAXIMIZE);
                    SetForegroundWindow(hwnd);
                }
                "restore" => {
                    ShowWindow(hwnd, SW_RESTORE);
                    SetForegroundWindow(hwnd);
                }
                _ => {
                    activate_or_toggle_window(hwnd);
                }
            }
        }
    }

    #[cfg(test)]
    mod tests {
        use super::*;

        #[test]
        fn reservation_never_exceeds_half_the_monitor() {
            let mon = RECT {
                left: 0,
                top: 0,
                right: 1920,
                bottom: 1080,
            };
            assert_eq!(appbar_top_for(mon, 82), 998);
            assert_eq!(appbar_top_for(mon, 5000), 540);
            assert_eq!(appbar_top_for(mon, 0), 1080);
            assert_eq!(appbar_top_for(mon, -42), 1080);
        }

        #[test]
        fn reservation_respects_secondary_monitor_origin() {
            let mon = RECT {
                left: 1920,
                top: -200,
                right: 3840,
                bottom: 880,
            };
            assert_eq!(appbar_top_for(mon, 80), 800);
            assert_eq!(appbar_top_for(mon, 9000), 340);
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
        cursor_reveal: state.cursor_at_bottom.load(Ordering::SeqCst),
        fullscreen_active: state.fullscreen_active.load(Ordering::SeqCst),
    }
}

/// Unified single-pass snapshot of open Windows and Now Playing media (avoids double EnumWindows!)
#[tauri::command]
fn get_desktop_snapshot() -> DesktopSnapshot {
    #[cfg(target_os = "windows")]
    {
        let windows = win32::list_taskbar_windows();
        let media = win32::detect_now_playing(&windows);
        DesktopSnapshot { windows, media }
    }
    #[cfg(not(target_os = "windows"))]
    {
        DesktopSnapshot {
            windows: Vec::new(),
            media: NowPlayingInfo {
                detected: false,
                source_app: String::new(),
                playing: false,
                title: String::new(),
                artist: String::new(),
                hwnd: 0,
                position_sec: 0,
                duration_sec: 180,
            },
        }
    }
}

#[tauri::command]
fn get_open_windows() -> Vec<OpenWindowInfo> {
    get_desktop_snapshot().windows
}

#[tauri::command]
fn get_now_playing_media() -> NowPlayingInfo {
    get_desktop_snapshot().media
}

#[tauri::command]
fn send_media_control(action: String) {
    #[cfg(target_os = "windows")]
    {
        win32::send_media_or_volume_key(&action);
    }
}

#[tauri::command]
fn focus_or_minimize_window(hwnd: isize) {
    #[cfg(target_os = "windows")]
    {
        win32::activate_or_toggle_window(hwnd);
    }
}

#[tauri::command]
fn control_window(hwnd: isize, action: String) {
    #[cfg(target_os = "windows")]
    {
        win32::perform_window_action(hwnd, &action);
    }
}

#[tauri::command]
fn open_windows_start_menu() {
    #[cfg(target_os = "windows")]
    {
        win32::trigger_start_menu();
    }
}

#[tauri::command]
fn open_windows_quick_settings() {
    #[cfg(target_os = "windows")]
    {
        win32::trigger_quick_settings();
    }
}

#[tauri::command]
fn trigger_windows_screenshot() {
    #[cfg(target_os = "windows")]
    {
        win32::trigger_screenshot();
    }
}

#[tauri::command]
fn set_native_taskbar_hidden(state: State<'_, AppState>, hidden: bool) -> bool {
    state.taskbar_hidden.store(hidden, Ordering::SeqCst);
    #[cfg(target_os = "windows")]
    {
        win32::set_windows_taskbar_visible(!hidden);
    }
    hidden
}

#[tauri::command]
fn set_dock_screen_mode(
    window: WebviewWindow,
    state: State<'_, AppState>,
    mode: String,
    reserved_px: i32,
) {
    let is_reserve = mode == "reserve";
    let is_autohide = mode == "autohide";
    state.reserve_work_area.store(is_reserve, Ordering::SeqCst);
    state.auto_hide_dock.store(is_autohide, Ordering::SeqCst);

    #[cfg(target_os = "windows")]
    {
        let native_hwnd = window.hwnd().map(|h| h.0 as isize).unwrap_or(0);
        win32::cache_main_window_hwnd(native_hwnd);
        let hwnd = if native_hwnd != 0 {
            native_hwnd
        } else {
            win32::resolve_main_window_hwnd()
        };
        let mon_rect = if let Ok(Some(mon)) = window.current_monitor() {
            let pos = mon.position();
            let sz = mon.size();
            win32::RECT {
                left: pos.x,
                top: pos.y,
                right: pos.x + sz.width as i32,
                bottom: pos.y + sz.height as i32,
            }
        } else {
            win32::get_window_monitor_rect(hwnd)
        };
        if is_reserve {
            // Convert CSS logical pixels from JS into physical monitor pixels for HiDPI (125%, 150%, 200%)!
            let scale = window.scale_factor().unwrap_or(1.0);
            let physical_px = ((reserved_px.max(68) as f64) * scale).round() as i32;
            win32::sync_monitor_appbar_reservation(hwnd, mon_rect, physical_px);
        } else {
            win32::sync_monitor_appbar_reservation(hwnd, mon_rect, 0);
        }
    }
}

#[tauri::command]
fn update_interactive_hitbox(state: State<'_, AppState>, hitbox: HitBoxPayload) {
    if let Ok(mut rect) = state.interactive_rect.lock() {
        *rect = InteractiveRect {
            left: hitbox.left,
            top: hitbox.top,
            right: hitbox.right,
            bottom: hitbox.bottom,
        };
    }
}

#[tauri::command]
fn quit_and_restore_taskbar(app: tauri::AppHandle) {
    #[cfg(target_os = "windows")]
    {
        win32::stop_crash_watchdog_and_restore();
    }
    app.exit(0);
}

#[tauri::command]
fn launch_target(target: String) -> Result<(), String> {
    if target == "__START_MENU__" {
        #[cfg(target_os = "windows")]
        win32::trigger_start_menu();
        return Ok(());
    }
    if target == "__QUICK_SETTINGS__" {
        #[cfg(target_os = "windows")]
        win32::trigger_quick_settings();
        return Ok(());
    }
    if target == "__SCREENSHOT__" {
        #[cfg(target_os = "windows")]
        win32::trigger_screenshot();
        return Ok(());
    }

    #[cfg(target_os = "windows")]
    {
        win32::shell_execute_safe(&target)
    }
    #[cfg(target_os = "macos")]
    {
        Command::new("open")
            .arg(&target)
            .spawn()
            .map_err(|e| e.to_string())?;
        Ok(())
    }
    #[cfg(target_os = "linux")]
    {
        Command::new("xdg-open")
            .arg(&target)
            .spawn()
            .map_err(|e| e.to_string())?;
        Ok(())
    }
}

fn position_window_at_bottom(window: &WebviewWindow) {
    let _ = window.set_shadow(false);
    let _ = window.set_always_on_top(true);

    if let Ok(Some(monitor)) = window.current_monitor() {
        let mon_size = monitor.size();
        let mon_pos = monitor.position();
        let win_w = mon_size.width;
        let win_h = (620.0 * monitor.scale_factor()) as u32;

        let x = mon_pos.x;
        let y = mon_pos.y + (mon_size.height as i32) - (win_h as i32);

        let _ = window.set_size(Size::Physical(PhysicalSize {
            width: win_w,
            height: win_h,
        }));
        let _ = window.set_position(Position::Physical(PhysicalPosition { x, y }));
    }
}

fn main() {
    // 1. Out-of-process Crash Watchdog mode (`--watchdog <pid> <left> <top> <right> <bottom> [appbar_hwnd]`)
    // Runs from an isolated temp executable name (`primodock-watchdog-helper.exe`) so `taskkill /F /IM primodock-tauri.exe`
    // does not kill it, and verifies the single-instance mutex before restoring so dev-reload/relaunch never races.
    #[cfg(target_os = "windows")]
    {
        let args: Vec<String> = std::env::args().collect();
        if args.len() >= 7 && args[1] == "--watchdog" {
            let appbar_hwnd = args
                .get(7)
                .and_then(|s| s.parse::<isize>().ok())
                .unwrap_or(0);
            if let (Ok(pid), Ok(left), Ok(top), Ok(right), Ok(bottom)) = (
                args[2].parse::<u32>(),
                args[3].parse::<i32>(),
                args[4].parse::<i32>(),
                args[5].parse::<i32>(),
                args[6].parse::<i32>(),
            ) {
                win32::run_crash_watchdog(
                    pid,
                    win32::RECT {
                        left,
                        top,
                        right,
                        bottom,
                    },
                    appbar_hwnd,
                );
            }
            return;
        }

        // 2. Single-Instance enforcement (`CreateMutexW`)
        if !win32::acquire_single_instance_mutex() {
            return;
        }
    }

    let mut sys = System::new_all();
    sys.refresh_all();

    let interactive_rect = Arc::new(Mutex::new(InteractiveRect {
        left: 0.0,
        top: 460.0,
        right: 1920.0,
        bottom: 620.0,
    }));
    let auto_hide_dock = Arc::new(AtomicBool::new(false));
    let cursor_at_bottom = Arc::new(AtomicBool::new(true));
    let fullscreen_active = Arc::new(AtomicBool::new(false));

    // Capture the user's original Windows WorkArea BEFORE modifying anything
    #[cfg(target_os = "windows")]
    {
        let _ = win32::get_original_work_area();
    }

    // Ensure native taskbar and original WorkArea are ALWAYS restored if the app ever panics
    std::panic::set_hook(Box::new(|_| {
        #[cfg(target_os = "windows")]
        {
            win32::stop_crash_watchdog_and_restore();
        }
    }));

    let rect_for_setup = Arc::clone(&interactive_rect);
    let autohide_for_setup = Arc::clone(&auto_hide_dock);
    let reveal_for_setup = Arc::clone(&cursor_at_bottom);
    let fullscreen_for_setup = Arc::clone(&fullscreen_active);

    tauri::Builder::default()
        .manage(AppState {
            sys: Mutex::new(sys),
            interactive_rect,
            taskbar_hidden: AtomicBool::new(true),
            reserve_work_area: AtomicBool::new(true),
            auto_hide_dock,
            cursor_at_bottom,
            fullscreen_active,
        })
        .setup(move |app| {
            if let Some(window) = app.get_webview_window("main") {
                position_window_at_bottom(&window);

                #[cfg(target_os = "windows")]
                {
                    // Ask Tauri for the real native handle instead of matching the window title.
                    let native_hwnd = window.hwnd().map(|h| h.0 as isize).unwrap_or(0);
                    win32::cache_main_window_hwnd(native_hwnd);
                    let hwnd = if native_hwnd != 0 {
                        native_hwnd
                    } else {
                        win32::resolve_main_window_hwnd()
                    };
                    let orig = win32::get_original_work_area();
                    win32::spawn_crash_watchdog(orig, hwnd);

                    let scale = window.scale_factor().unwrap_or(1.0);
                    let initial_physical_reserve = (82.0 * scale).round() as i32;
                    let mon_rect = if let Ok(Some(mon)) = window.current_monitor() {
                        let pos = mon.position();
                        let sz = mon.size();
                        win32::RECT {
                            left: pos.x,
                            top: pos.y,
                            right: pos.x + sz.width as i32,
                            bottom: pos.y + sz.height as i32,
                        }
                    } else {
                        win32::get_window_monitor_rect(hwnd)
                    };
                    win32::set_windows_taskbar_visible(false);
                    win32::sync_monitor_appbar_reservation(
                        hwnd,
                        mon_rect,
                        initial_physical_reserve,
                    );

                    let win_clone = window.clone();
                    let rect_clone = Arc::clone(&rect_for_setup);
                    let autohide_clone = Arc::clone(&autohide_for_setup);
                    let reveal_clone = Arc::clone(&reveal_for_setup);
                    let fullscreen_clone = Arc::clone(&fullscreen_for_setup);
                    let self_pid = std::process::id();

                    std::thread::spawn(move || {
                        let mut currently_ignoring = false;
                        let mut tick_count: u32 = 0;
                        let mut sleep_ms: u64 = 28;
                        loop {
                            std::thread::sleep(Duration::from_millis(sleep_ms));
                            tick_count = tick_count.wrapping_add(1);

                            // Emergency global hotkey: Ctrl + Alt + Shift + R restores Windows Taskbar & WorkArea
                            if tick_count.is_multiple_of(5)
                                && win32::is_emergency_restore_hotkey_pressed()
                            {
                                win32::set_reserved_bottom_work_area(0);
                                win32::set_windows_taskbar_visible(true);
                            }

                            // Check fullscreen state every ~250ms
                            if tick_count.is_multiple_of(8) {
                                let is_fs = win32::is_foreground_fullscreen(self_pid);
                                fullscreen_clone.store(is_fs, Ordering::SeqCst);
                            }

                            let is_fullscreen = fullscreen_clone.load(Ordering::SeqCst);
                            if is_fullscreen {
                                sleep_ms = 180;
                                if !currently_ignoring {
                                    currently_ignoring = true;
                                    let _ = win_clone.set_ignore_cursor_events(true);
                                }
                                continue;
                            }

                            let Some((cx, cy)) = win32::get_cursor_pos() else {
                                sleep_ms = 65;
                                continue;
                            };
                            let Ok(win_pos) = win_clone.outer_position() else {
                                sleep_ms = 65;
                                continue;
                            };
                            let Ok(win_size) = win_clone.outer_size() else {
                                sleep_ms = 65;
                                continue;
                            };
                            let mon_bottom = win_pos.y + (win_size.height as i32);
                            let scale = win_clone.scale_factor().unwrap_or(1.0);
                            let rel_x = (cx - win_pos.x) as f64 / scale;
                            let rel_y = (cy - win_pos.y) as f64 / scale;

                            let inside_hitbox = if let Ok(r) = rect_clone.lock() {
                                rel_x >= (r.left - 18.0)
                                    && rel_x <= (r.right + 18.0)
                                    && rel_y >= (r.top - 32.0)
                                    && rel_y <= (r.bottom + 24.0)
                            } else {
                                true
                            };

                            let is_autohide = autohide_clone.load(Ordering::SeqCst);
                            if is_autohide {
                                let was_revealed = reveal_clone.load(Ordering::SeqCst);
                                if cy >= mon_bottom - 12 {
                                    reveal_clone.store(true, Ordering::SeqCst);
                                } else if was_revealed && !inside_hitbox {
                                    reveal_clone.store(false, Ordering::SeqCst);
                                }
                            } else {
                                reveal_clone.store(true, Ordering::SeqCst);
                            }

                            let is_visible_now = reveal_clone.load(Ordering::SeqCst);
                            let should_ignore = !(inside_hitbox && is_visible_now);

                            if should_ignore != currently_ignoring {
                                currently_ignoring = should_ignore;
                                let _ = win_clone.set_ignore_cursor_events(should_ignore);
                            }

                            // Adaptive polling rate: 28ms when near/inside dock, 65ms when cursor is far above dock
                            sleep_ms = if inside_hitbox || cy >= mon_bottom - 220 {
                                28
                            } else {
                                65
                            };
                        }
                    });
                }
            }
            Ok(())
        })
        .on_window_event(|_window, event| {
            if let WindowEvent::Destroyed | WindowEvent::CloseRequested { .. } = event {
                #[cfg(target_os = "windows")]
                {
                    win32::stop_crash_watchdog_and_restore();
                }
            }
        })
        .invoke_handler(tauri::generate_handler![
            get_system_metrics,
            get_desktop_snapshot,
            get_open_windows,
            get_now_playing_media,
            send_media_control,
            focus_or_minimize_window,
            control_window,
            open_windows_start_menu,
            open_windows_quick_settings,
            trigger_windows_screenshot,
            set_native_taskbar_hidden,
            set_dock_screen_mode,
            update_interactive_hitbox,
            quit_and_restore_taskbar,
            launch_target
        ])
        .run(tauri::generate_context!())
        .expect("Erro ao iniciar o PrimoDock Tauri");
}
