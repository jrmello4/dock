import { isSafeLaunchTarget, sanitizeUrl } from './security';
import { DockScreenMode, SystemMetrics } from './types';

declare global {
  interface Window {
    __TAURI_INTERNALS__?: unknown;
  }
}

export interface OpenWindowInfo {
  hwnd: number;
  title: string;
  exe_name: string;
  exe_path: string;
  icon_data_url: string;
  is_minimized: boolean;
  is_focused: boolean;
}

export interface NowPlayingPayload {
  detected: boolean;
  source_app: string;
  playing: boolean;
  title: string;
  artist: string;
  hwnd: number;
  position_sec: number;
  duration_sec: number;
  /** Present since the SMTC integration; absent means heuristic (estimated). */
  estimated?: boolean;
  /** Data URL of the album art reported by Windows SMTC, when available. */
  artwork_data_url?: string;
}

export interface DesktopSnapshotPayload {
  windows: OpenWindowInfo[];
  media: NowPlayingPayload;
}

export function isTauriRuntime(): boolean {
  return typeof window !== 'undefined' && Boolean(window.__TAURI_INTERNALS__);
}

export async function updateInteractiveHitbox(rect: {
  left: number;
  top: number;
  right: number;
  bottom: number;
}): Promise<void> {
  if (!isTauriRuntime()) return;
  try {
    const { invoke } = await import('@tauri-apps/api/core');
    await invoke('update_interactive_hitbox', { hitbox: rect });
  } catch {
    // Ignore
  }
}

export async function setDockScreenMode(mode: DockScreenMode, reservedPx = 82): Promise<void> {
  if (!isTauriRuntime()) return;
  try {
    const { invoke } = await import('@tauri-apps/api/core');
    await invoke('set_dock_screen_mode', { mode, reservedPx });
  } catch {
    // Ignore
  }
}

/**
 * Single-pass IPC call that fetches both open Windows and Now Playing media in one EnumWindows pass!
 */
export async function fetchDesktopSnapshot(): Promise<DesktopSnapshotPayload> {
  const empty: DesktopSnapshotPayload = {
    windows: [],
    media: {
      detected: false,
      source_app: '',
      playing: false,
      title: '',
      artist: '',
      hwnd: 0,
      position_sec: 0,
      duration_sec: 180,
      estimated: true,
      artwork_data_url: '',
    },
  };
  if (!isTauriRuntime()) return empty;
  try {
    const { invoke } = await import('@tauri-apps/api/core');
    return await invoke<DesktopSnapshotPayload>('get_desktop_snapshot');
  } catch {
    return empty;
  }
}

export async function fetchOpenWindows(): Promise<OpenWindowInfo[]> {
  const snap = await fetchDesktopSnapshot();
  return snap.windows;
}

export async function fetchNowPlayingMedia(): Promise<NowPlayingPayload> {
  const snap = await fetchDesktopSnapshot();
  return snap.media;
}

export async function sendNativeMediaControl(
  action: 'play_pause' | 'next' | 'prev' | 'vol_up' | 'vol_down' | 'vol_mute'
): Promise<void> {
  if (!isTauriRuntime()) return;
  try {
    const { invoke } = await import('@tauri-apps/api/core');
    await invoke('send_media_control', { action });
  } catch {
    // Ignore
  }
}

export async function focusOrMinimizeWindow(hwnd: number): Promise<void> {
  if (!isTauriRuntime()) return;
  try {
    const { invoke } = await import('@tauri-apps/api/core');
    await invoke('focus_or_minimize_window', { hwnd });
  } catch {
    // Ignore
  }
}

export async function controlWindow(
  hwnd: number,
  action: 'close' | 'minimize' | 'maximize' | 'restore' | 'focus'
): Promise<void> {
  if (!isTauriRuntime()) return;
  try {
    const { invoke } = await import('@tauri-apps/api/core');
    await invoke('control_window', { hwnd, action });
  } catch {
    // Ignore
  }
}

export async function triggerWindowsStartMenu(): Promise<void> {
  if (!isTauriRuntime()) return;
  try {
    const { invoke } = await import('@tauri-apps/api/core');
    await invoke('open_windows_start_menu');
  } catch {
    // Ignore
  }
}

export async function triggerWindowsQuickSettings(): Promise<void> {
  if (!isTauriRuntime()) return;
  try {
    const { invoke } = await import('@tauri-apps/api/core');
    await invoke('open_windows_quick_settings');
  } catch {
    // Ignore
  }
}

export async function triggerWindowsScreenshot(): Promise<void> {
  if (!isTauriRuntime()) return;
  try {
    const { invoke } = await import('@tauri-apps/api/core');
    await invoke('trigger_windows_screenshot');
  } catch {
    // Ignore
  }
}

export async function setNativeTaskbarHidden(hidden: boolean): Promise<void> {
  if (!isTauriRuntime()) return;
  try {
    const { invoke } = await import('@tauri-apps/api/core');
    await invoke('set_native_taskbar_hidden', { hidden });
  } catch {
    // Ignore
  }
}

export async function restoreWindowsTaskbar(): Promise<void> {
  if (!isTauriRuntime()) return;
  try {
    const { invoke } = await import('@tauri-apps/api/core');
    await invoke('restore_windows_taskbar');
  } catch {
    // Ignore
  }
}

export async function quitAndRestoreTaskbar(): Promise<void> {
  if (!isTauriRuntime()) return;
  try {
    const { invoke } = await import('@tauri-apps/api/core');
    await invoke('quit_and_restore_taskbar');
  } catch {
    // Ignore
  }
}

export async function fetchSystemMetrics(current: SystemMetrics): Promise<SystemMetrics> {
  if (isTauriRuntime()) {
    try {
      const { invoke } = await import('@tauri-apps/api/core');
      const res = await invoke<{
        cpu_usage: number;
        ram_usage: number;
        ram_used_gb: number;
        ram_total_gb: number;
        battery_level: number;
        battery_charging: boolean;
        has_battery: boolean;
        battery_time_remaining: string;
        cursor_reveal: boolean;
        fullscreen_active: boolean;
      }>('get_system_metrics');
      return {
        cpuUsage: Math.max(1, Math.round(res.cpu_usage)),
        ramUsage: Math.round(res.ram_usage),
        ramUsedGb: Number(res.ram_used_gb.toFixed(1)),
        ramTotalGb: Number(res.ram_total_gb.toFixed(1)),
        batteryLevel: res.battery_level,
        batteryCharging: res.battery_charging,
        batteryTimeRemaining: res.battery_time_remaining,
        cursorReveal: res.cursor_reveal,
        fullscreenActive: Boolean(res.fullscreen_active),
      };
    } catch {
      // Fallback below if not running in Tauri
    }
  }

  return {
    ...current,
    cursorReveal: true,
    fullscreenActive: false,
  };
}

export async function launchTarget(target: string): Promise<boolean> {
  if (!target || !isSafeLaunchTarget(target)) return false;
  if (isTauriRuntime()) {
    try {
      const { invoke } = await import('@tauri-apps/api/core');
      await invoke('launch_target', { target: target.trim() });
      return true;
    } catch (err) {
      console.warn('Falha ao abrir via Tauri:', err);
    }
  }
  const safeHttp = sanitizeUrl(target);
  if (safeHttp.startsWith('http://') || safeHttp.startsWith('https://')) {
    window.open(safeHttp, '_blank', 'noopener,noreferrer');
    return true;
  }
  return false;
}
