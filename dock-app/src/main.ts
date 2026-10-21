import { SeasonalEffectsEngine } from './particles';
import { DockPetController } from './pet';
import {
  escapeAttr,
  escapeHtml,
  safeEvaluateMath,
  sanitizeUrl,
} from './security';
import {
  cloneDefaultEnvironments,
  createInitialState,
  fetchLiveWeather,
  fetchRealGithubData,
  fetchSongMetadata,
  inferIconForWindow,
  PLAYLIST,
  savePersistentState,
  todayDateKey,
} from './state';
import {
  controlWindow,
  fetchDesktopSnapshot,
  fetchSystemMetrics,
  focusOrMinimizeWindow,
  isTauriRuntime,
  launchTarget,
  OpenWindowInfo,
  quitAndRestoreTaskbar,
  restoreWindowsTaskbar,
  sendNativeMediaControl,
  setDockScreenMode,
  setNativeTaskbarHidden,
  triggerWindowsQuickSettings,
  triggerWindowsScreenshot,
  triggerWindowsStartMenu,
  updateInteractiveHitbox,
} from './tauri-bridge';
import { THEMES } from './themes';
import {
  DockItem,
  DockScreenMode,
  DockState,
  PetType,
  ThemeId,
  WidgetType,
} from './types';
import {
  renderDockWidgetMarkup,
  renderWidgetPopoverContent,
} from './widgets';

interface ContextMenuTarget {
  anchorEl: HTMLElement;
  pinnedItem?: DockItem;
  openWin?: OpenWindowInfo;
}

interface CommandBarAction {
  id: string;
  title: string;
  subtitle: string;
  badge: string;
  iconHtml: string;
  run: () => void;
}

interface CachedDockItemCenter {
  el: HTMLElement;
  centerX: number;
  span: number;
}

type SettingsTab = 'appearance' | 'screen' | 'environments';

function escapeCssSelectorVal(val: string): string {
  if (typeof CSS !== 'undefined' && typeof CSS.escape === 'function') {
    return CSS.escape(val);
  }
  return val.replace(/[^a-zA-Z0-9_-]/g, '\\$&');
}

function bindAccessibleDockControl(
  el: HTMLElement,
  label: string,
  onActivate: (ev: MouseEvent | KeyboardEvent) => void
): void {
  el.tabIndex = 0;
  el.setAttribute('role', 'button');
  el.dataset.label = label;
  el.setAttribute('aria-label', label);
  el.addEventListener('click', (ev) => onActivate(ev));
  el.addEventListener('keydown', (ev) => {
    if (ev.key === 'Enter' || ev.key === ' ') {
      ev.preventDefault();
      onActivate(ev);
    }
  });
}

class PrimoDockApp {
  private state: DockState;
  private root: HTMLElement;
  private popoverEl!: HTMLElement;
  private contextMenuEl!: HTMLElement;
  private commandBarEl!: HTMLElement;
  private dockWrapperEl!: HTMLElement;
  private dockBarEl!: HTMLElement;
  private dockRowEl!: HTMLElement;
  private mirrorRowEl!: HTMLElement;

  private petController!: DockPetController;
  private seasonalEngine!: SeasonalEffectsEngine;
  private draggedItemId: string | null = null;
  private audioCtx: AudioContext | null = null;
  private synthTimer: number | null = null;
  private openWindows: OpenWindowInfo[] = [];
  private nativeTaskbarHidden = true;
  private isHoveringDock = false;
  private lastArtworkQuery = '';
  private commandBarOpen = false;
  private commandQuery = '';
  private commandSelectedIndex = 0;
  private currentCommandActions: CommandBarAction[] = [];
  private activeSettingsTab: SettingsTab = 'appearance';
  private readonly reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  // Cached centers for zero-layout-thrashing magnification
  private cachedItemCenters: CachedDockItemCenter[] = [];
  private magRafId: number | null = null;
  private pendingMouseX: number | null = null;

  constructor(root: HTMLElement) {
    this.root = root;
    this.state = createInitialState();
    this.state.isOverlayMode = isTauriRuntime();
    this.mountShell();
    this.applyThemeAndVariables();
    this.renderAll();
    this.bindGlobalShortcuts();
    this.startLiveLoops();

    // Apply initial Windows Screen WorkArea Reservation / Auto-hide mode
    window.setTimeout(() => this.syncScreenModeToWindows(), 250);

    // Refresh weather for the saved or default city (IP geolocation is strictly opt-in!)
    this.refreshWeather(this.state.weather.city, false);

    // Sync real GitHub profile if username is configured
    if (this.state.github.username) {
      this.refreshGithub(this.state.github.username);
    }
  }

  private getActiveEnv() {
    return (
      this.state.environments.find((e) => e.id === this.state.activeEnvId) ||
      this.state.environments[0]
    );
  }

  private mountShell(): void {
    this.root.innerHTML = '';

    // 1. Anchored Popover Panel (Positioned dynamically above the clicked widget/button)
    this.popoverEl = document.createElement('aside');
    this.popoverEl.className = 'dock-popover';
    this.popoverEl.style.display = 'none';
    this.root.appendChild(this.popoverEl);

    // 2. Right-Click Context Menu (Anchored above the right-clicked dock item)
    this.contextMenuEl = document.createElement('div');
    this.contextMenuEl.className = 'dock-context-menu';
    this.contextMenuEl.style.display = 'none';
    this.root.appendChild(this.contextMenuEl);

    // 3. Spotlight / Command Bar (Alt + Space)
    this.commandBarEl = document.createElement('div');
    this.commandBarEl.className = 'dock-command-bar';
    this.commandBarEl.style.display = 'none';
    this.root.appendChild(this.commandBarEl);

    // 4. Dock Wrapper (Particles + Pet + Main Bar + Mirror Reflection)
    this.dockWrapperEl = document.createElement('div');
    this.dockWrapperEl.className = 'dock-wrapper';

    this.seasonalEngine = new SeasonalEffectsEngine(this.dockWrapperEl);

    this.dockBarEl = document.createElement('div');
    this.dockBarEl.className = 'dock-bar';

    this.petController = new DockPetController(this.dockBarEl, () => {
      // Pet clicked
    });

    this.dockRowEl = document.createElement('div');
    this.dockRowEl.className = 'dock-row';
    this.dockBarEl.appendChild(this.dockRowEl);

    this.mirrorRowEl = document.createElement('div');
    this.mirrorRowEl.className = 'dock-row dock-mirror';
    this.mirrorRowEl.setAttribute('aria-hidden', 'true');

    this.dockWrapperEl.appendChild(this.dockBarEl);
    this.dockWrapperEl.appendChild(this.mirrorRowEl);
    this.root.appendChild(this.dockWrapperEl);

    // Magnification & hover tracking listeners on the dock wrapper
    this.dockWrapperEl.addEventListener('mouseenter', () => {
      this.isHoveringDock = true;
      this.cacheDockItemCenters();
      this.updateAutoHideVisibility();
    });
    this.dockWrapperEl.addEventListener('mousemove', (e) => {
      this.isHoveringDock = true;
      this.scheduleDockMagnification(e.clientX);
    });
    this.dockWrapperEl.addEventListener('mouseleave', () => {
      this.isHoveringDock = false;
      this.resetDockMagnification();
      this.updateAutoHideVisibility();
    });

    // Close popovers / context menu / command bar when clicking outside
    this.root.addEventListener('click', (e) => {
      const target = e.target as HTMLElement;
      if (!this.contextMenuEl.contains(target)) {
        this.closeContextMenu();
      }
      if (
        !this.dockWrapperEl.contains(target) &&
        !this.popoverEl.contains(target) &&
        !this.commandBarEl.contains(target)
      ) {
        this.closePanels();
      }
    });

    window.addEventListener('resize', () => {
      this.cacheDockItemCenters();
      this.repositionActivePopover();
      this.syncHitboxToRust();
      this.syncScreenModeToWindows();
    });
  }

  /**
   * Caches horizontal centers of all `.dock-item` elements once on render/resize/mouseenter
   * so `mousemove` never triggers `getBoundingClientRect()` layout thrashing!
   */
  private cacheDockItemCenters(): void {
    const items = this.dockRowEl.querySelectorAll<HTMLElement>('.dock-item');
    const list: CachedDockItemCenter[] = [];
    items.forEach((el) => {
      const rect = el.getBoundingClientRect();
      list.push({
        el,
        centerX: rect.left + rect.width / 2,
        span: Number(el.dataset.span || 1),
      });
    });
    this.cachedItemCenters = list;
  }

  private scheduleDockMagnification(mouseX: number): void {
    this.pendingMouseX = mouseX;
    if (this.magRafId !== null) return;
    this.magRafId = requestAnimationFrame(() => {
      this.magRafId = null;
      if (this.pendingMouseX === null || !this.isHoveringDock) return;
      if (this.cachedItemCenters.length === 0) {
        this.cacheDockItemCenters();
      }
      const x = this.pendingMouseX;
      const maxScale = Math.max(1.0, this.state.magnification);
      if (maxScale <= 1.02) return;
      const radius = 155;

      for (const item of this.cachedItemCenters) {
        const dist = Math.abs(x - item.centerX);
        if (dist < radius) {
          const norm = dist / radius;
          const boost = (Math.cos(norm * Math.PI) + 1) / 2;
          const factor =
            item.span > 1
              ? 1 + (maxScale - 1) * 0.34 * boost
              : 1 + (maxScale - 1) * boost;
          const liftY = (factor - 1) * -18;
          item.el.style.transform = `translate3d(0, ${liftY.toFixed(1)}px, 0) scale3d(${factor.toFixed(3)}, ${factor.toFixed(3)}, 1)`;
        } else {
          item.el.style.transform = 'translate3d(0, 0, 0) scale3d(1, 1, 1)';
        }
      }
    });
  }

  private resetDockMagnification(): void {
    this.pendingMouseX = null;
    if (this.magRafId !== null) {
      cancelAnimationFrame(this.magRafId);
      this.magRafId = null;
    }
    const items = this.dockRowEl.querySelectorAll<HTMLElement>('.dock-item');
    items.forEach((item) => {
      item.style.transform = 'translate3d(0, 0, 0) scale3d(1, 1, 1)';
    });
  }

  /**
   * Synchronizes the Dock's screen behavior with Windows (HiDPI-aware in Rust):
   * - 'reserve': Reserves the bottom WorkArea via SPI_SETWORKAREA so maximized windows stop above the Dock.
   * - 'autohide': Restores 100% of original WorkArea and hides the Dock until the mouse touches the bottom edge.
   * - 'float': Restores 100% of original WorkArea and keeps the Dock floating.
   */
  private syncScreenModeToWindows(): void {
    const mode = this.state.dockScreenMode || 'reserve';
    if (mode === 'reserve') {
      const barH = Math.round(this.dockBarEl.offsetHeight + 18) || 78;
      setDockScreenMode('reserve', barH);
    } else {
      setDockScreenMode(mode, 0);
    }
    this.updateAutoHideVisibility();
  }

  private updateAutoHideVisibility(): void {
    const isFullscreen = Boolean(this.state.metrics.fullscreenActive);
    this.dockWrapperEl.classList.toggle('fullscreen-hidden', isFullscreen);
    if (
      isFullscreen &&
      (this.state.activePanelItemId || this.state.settingsOpen || this.commandBarOpen)
    ) {
      this.closePanels();
    }

    const hasOpenPanel = Boolean(
      this.state.activePanelItemId ||
        this.state.settingsOpen ||
        this.commandBarOpen ||
        this.contextMenuEl.style.display !== 'none'
    );
    const shouldHide =
      !isFullscreen &&
      this.state.dockScreenMode === 'autohide' &&
      !this.isHoveringDock &&
      !this.state.metrics.cursorReveal &&
      !hasOpenPanel;

    const wasHidden = this.dockWrapperEl.classList.contains('autohidden');
    if (wasHidden !== shouldHide) {
      this.dockWrapperEl.classList.toggle('autohidden', shouldHide);
      window.setTimeout(() => this.syncHitboxToRust(), 60);
    }

    // Stop the pet/particle rAF loops while the dock is off-screen or a fullscreen app is in
    // front: they were burning a full 60 fps frame loop 24/7 for animations nobody could see.
    const shouldAnimate = !isFullscreen && !shouldHide && !this.reduceMotion;
    this.petController.setPaused(!shouldAnimate);
    this.seasonalEngine.setPaused(!shouldAnimate);
  }

  private syncHitboxToRust(): void {
    requestAnimationFrame(() => {
      const isHidden =
        this.dockWrapperEl.classList.contains('autohidden') ||
        this.dockWrapperEl.classList.contains('fullscreen-hidden');
      const dockRect = this.dockBarEl.getBoundingClientRect();

      let left = dockRect.left;
      let top = isHidden ? window.innerHeight - 8 : dockRect.top - 28;
      let right = dockRect.right;
      let bottom = window.innerHeight;

      for (const panel of [this.popoverEl, this.contextMenuEl, this.commandBarEl]) {
        if (panel && panel.style.display !== 'none') {
          const r = panel.getBoundingClientRect();
          left = Math.min(left, r.left - 8);
          top = Math.min(top, r.top - 8);
          right = Math.max(right, r.right + 8);
          bottom = Math.max(bottom, r.bottom + 8);
        }
      }

      updateInteractiveHitbox({ left, top, right, bottom });
    });
  }

  private applyThemeAndVariables(): void {
    const env = this.getActiveEnv();
    const activeThemeId = env.themeOverride || this.state.themeId;
    const theme = THEMES[activeThemeId] || THEMES.native;

    this.root.setAttribute('data-wallpaper', this.state.desktopSimulatorBg);
    this.root.setAttribute('data-overlay', String(this.state.isOverlayMode));
    this.popoverEl.setAttribute('data-light-theme', String(Boolean(theme.lightText)));
    this.contextMenuEl.setAttribute('data-light-theme', String(Boolean(theme.lightText)));

    const s = document.documentElement.style;
    s.setProperty('--ico', `${this.state.iconSize}px`);
    s.setProperty('--r', `calc(${theme.radiusFactor} * var(--ico))`);
    s.setProperty('--bg', theme.bg);
    s.setProperty('--bd', theme.bd);
    s.setProperty('--bw', theme.bw);
    s.setProperty('--ind', env.color || theme.ind);
    s.setProperty('--sep', theme.sep);
    s.setProperty('--glow', theme.glow);

    this.dockBarEl.classList.toggle('gloss', theme.gloss);
    this.dockBarEl.classList.toggle('shelf3d', theme.shelf3d);

    const showMirror = theme.reflect && this.state.showReflections;
    this.mirrorRowEl.style.display = showMirror ? 'flex' : 'none';

    requestAnimationFrame(() => {
      const barWidth = this.dockBarEl.offsetWidth || 760;
      this.seasonalEngine.setMode(theme.particleMode, barWidth);
      this.petController.updateConfig(
        this.state.petType,
        this.state.metrics.cpuUsage,
        barWidth
      );
      this.cacheDockItemCenters();
      this.repositionActivePopover();
      this.syncHitboxToRust();
    });
  }

  private renderAll(): void {
    this.renderDockItems();
    this.renderPopover();
    this.applyThemeAndVariables();
  }

  /**
   * Matches a pinned DockItem (`kind === 'app'`) with any currently open Windows OS windows
   * so pinned apps and open windows fuse seamlessly without duplicate icons!
   */
  private findMatchingWindowsForPinnedApp(item: DockItem): OpenWindowInfo[] {
    if (item.kind !== 'app' || item.target === '__START_MENU__') return [];
    const targetLower = (item.target || '').toLowerCase();
    const labelLower = (item.label || '').toLowerCase();
    const iconId = item.icon || '';

    return this.openWindows.filter((w) => {
      const exe = w.exe_name.toLowerCase();
      const path = w.exe_path.toLowerCase();

      if (targetLower && path && (path === targetLower || path.endsWith('\\' + targetLower))) {
        return true;
      }
      if (targetLower && exe && (exe === targetLower || exe === `${targetLower}.exe`)) {
        return true;
      }
      if (iconId === '#i-code' || labelLower.includes('vs code') || labelLower.includes('code')) {
        return exe === 'code.exe' || exe === 'cursor.exe';
      }
      if (iconId === '#i-terminal' || labelLower.includes('terminal') || labelLower.includes('powershell')) {
        return (
          exe === 'windowsterminal.exe' ||
          exe === 'wt.exe' ||
          exe === 'powershell.exe' ||
          exe === 'cmd.exe'
        );
      }
      if (iconId === '#i-folder' || targetLower === 'explorer.exe') {
        return exe === 'explorer.exe';
      }
      if (iconId === '#i-browser' && !targetLower.startsWith('http')) {
        return (
          exe === 'chrome.exe' ||
          exe === 'msedge.exe' ||
          exe === 'brave.exe' ||
          exe === 'firefox.exe'
        );
      }
      return false;
    });
  }

  private renderAppIconContent(
    item: DockItem,
    matchedWins: OpenWindowInfo[]
  ): string {
    const isRunning = matchedWins.length > 0 || Boolean(item.running);
    const isFocused = matchedWins.some((w) => w.is_focused);
    const multiCount = matchedWins.length;

    const rawIcon = item.icon || '#i-finder';
    const safeDataIcon = rawIcon.startsWith('data:image/png;base64,')
      ? sanitizeUrl(rawIcon)
      : '';
    const iconMarkup = safeDataIcon
      ? `<img src="${escapeAttr(safeDataIcon)}" class="native-app-ico" alt="${escapeAttr(item.label)}" draggable="false" />`
      : `<svg aria-hidden="true" focusable="false"><use href="${escapeAttr(rawIcon.startsWith('#') ? rawIcon : '#i-finder')}"></use></svg>`;

    const dotMarkup = isRunning
      ? `<i class="run-dot ${isFocused ? 'active-fg' : ''} ${multiCount > 1 ? 'multi-win' : ''}"></i>`
      : '';

    const badgeMarkup =
      multiCount > 1 ? `<span class="win-count-badge">${multiCount}</span>` : '';

    return `<span class="app-ico-wrap">${iconMarkup}${badgeMarkup}</span>${dotMarkup}`;
  }

  private renderDockItems(): void {
    const env = this.getActiveEnv();
    this.dockRowEl.innerHTML = '';
    const claimedHwnds = new Set<number>();

    // 1. Environment Switcher Dots Pill inside the Dock (left side)
    const envPill = document.createElement('div');
    envPill.className = 'env-switcher-pill';
    envPill.title = 'Trocar de Ambiente (Role o mouse ou clique)';

    for (const e of this.state.environments) {
      const dot = document.createElement('button');
      dot.type = 'button';
      dot.className = `env-dot-btn ${e.id === env.id ? 'active' : ''}`;
      dot.style.background = e.color;
      dot.style.color = e.color;
      dot.title = `Ambiente: ${e.name} (${e.shortcut})`;
      dot.addEventListener('click', (ev) => {
        ev.stopPropagation();
        this.switchEnvironment(e.id);
      });
      envPill.appendChild(dot);
    }

    envPill.addEventListener('wheel', (ev) => {
      ev.preventDefault();
      const idx = this.state.environments.findIndex((x) => x.id === this.state.activeEnvId);
      const nextIdx =
        ev.deltaY > 0
          ? (idx + 1) % this.state.environments.length
          : (idx - 1 + this.state.environments.length) % this.state.environments.length;
      this.switchEnvironment(this.state.environments[nextIdx].id);
    });

    this.dockRowEl.appendChild(envPill);

    // Pre-match pinned apps with open windows so we don't duplicate them
    const pinnedMatches = new Map<string, OpenWindowInfo[]>();
    for (const item of env.items) {
      if (item.kind === 'app') {
        const matches = this.findMatchingWindowsForPinnedApp(item);
        if (matches.length > 0) {
          pinnedMatches.set(item.id, matches);
          matches.forEach((m) => claimedHwnds.add(m.hwnd));
        }
      }
    }

    // 2. Render Pinned Apps & Widgets for the active Environment
    let renderedStartSection = false;
    for (const item of env.items) {
      if (item.kind === 'separator') {
        if (!renderedStartSection) {
          renderedStartSection = true;
          this.appendOpenWindowsSection(claimedHwnds);
        }
        const sep = document.createElement('span');
        sep.className = 'dock-sep';
        this.dockRowEl.appendChild(sep);
        continue;
      }

      const el = document.createElement('div');
      el.className = 'dock-item';
      el.dataset.id = item.id;
      el.dataset.span = String(item.span || 1);
      el.tabIndex = 0;
      el.setAttribute('role', 'button');
      el.draggable = true;

      const matchedWins = pinnedMatches.get(item.id) || [];
      const primaryWin = matchedWins.find((w) => w.is_focused) || matchedWins[0];

      if (item.kind === 'app') {
        const labelText = primaryWin
          ? `${item.label} • ${primaryWin.title.slice(0, 36)}`
          : item.label;
        el.dataset.label = labelText;
        el.setAttribute('aria-label', labelText);
        el.innerHTML = this.renderAppIconContent(item, matchedWins);
      } else if (item.kind === 'widget') {
        el.dataset.label = item.label;
        el.setAttribute('aria-label', item.label);
        el.dataset.widgetType = item.widgetType || 'clock';
        el.innerHTML = renderDockWidgetMarkup(item, this.state);
      }

      el.addEventListener('click', (ev) => {
        this.closeContextMenu();
        const target = ev.target as HTMLElement;
        const musicBtn = target.closest<HTMLElement>('[data-music-act]');
        if (musicBtn) {
          ev.stopPropagation();
          this.handleMusicControl(musicBtn.dataset.musicAct!);
          return;
        }

        if (item.kind === 'app') {
          if (primaryWin && !ev.shiftKey) {
            el.classList.remove('bouncing');
            void el.offsetWidth;
            el.classList.add('bouncing');
            focusOrMinimizeWindow(primaryWin.hwnd);
          } else {
            this.triggerAppLaunch(item, el);
          }
        } else {
          this.toggleWidgetPanel(item.id);
        }
      });

      el.addEventListener('keydown', (ev) => {
        if (ev.key === 'Enter' || ev.key === ' ') {
          ev.preventDefault();
          el.click();
        }
      });

      // Middle-click (mouse wheel click) closes the running window immediately
      el.addEventListener('auxclick', (ev) => {
        if (ev.button === 1 && primaryWin) {
          ev.preventDefault();
          controlWindow(primaryWin.hwnd, 'close');
        }
      });

      // Right-click opens our sleek Context Menu
      el.addEventListener('contextmenu', (ev) => {
        ev.preventDefault();
        ev.stopPropagation();
        this.openContextMenu({
          anchorEl: el,
          pinnedItem: item,
          openWin: primaryWin,
        });
      });

      el.addEventListener('dragstart', () => {
        this.draggedItemId = item.id;
        el.classList.add('dragging');
      });
      el.addEventListener('dragend', () => {
        this.draggedItemId = null;
        el.classList.remove('dragging');
      });
      el.addEventListener('dragover', (ev) => {
        ev.preventDefault();
      });
      el.addEventListener('drop', (ev) => {
        ev.preventDefault();
        if (!this.draggedItemId || this.draggedItemId === item.id) return;
        const fromIdx = env.items.findIndex((x) => x.id === this.draggedItemId);
        const toIdx = env.items.findIndex((x) => x.id === item.id);
        if (fromIdx === -1 || toIdx === -1) return;
        const [moved] = env.items.splice(fromIdx, 1);
        env.items.splice(toIdx, 0, moved);
        savePersistentState(this.state);
        this.renderAll();
      });

      this.dockRowEl.appendChild(el);
    }

    if (!renderedStartSection) {
      this.appendOpenWindowsSection(claimedHwnds);
    }

    // 3. Spotlight / Command Bar Button (Alt + Space) + System Tray + Settings Gear
    const sepTray = document.createElement('span');
    sepTray.className = 'dock-sep';
    this.dockRowEl.appendChild(sepTray);

    const searchEl = document.createElement('div');
    searchEl.className = 'dock-item cmd-trigger-item';
    searchEl.innerHTML = `
      <svg viewBox="0 0 64 64" class="tile-svg" aria-hidden="true">
        <rect x="6.3" y="6.3" width="51.5" height="51.5" rx="13" fill="url(#gShellClock)"/>
        <rect x="6.3" y="6.3" width="51.5" height="51.5" rx="13" fill="none" stroke="#fff" stroke-opacity=".18"/>
        <circle cx="29" cy="29" r="10.5" fill="none" stroke="#38bdf8" stroke-width="3.6"/>
        <line x1="36.8" y1="36.8" x2="46" y2="46" stroke="#38bdf8" stroke-width="3.8" stroke-linecap="round"/>
      </svg>
    `;
    bindAccessibleDockControl(
      searchEl,
      'Command Bar / Busca Rápida (Alt + Espaço)',
      (ev) => {
        ev.stopPropagation();
        this.toggleCommandBar();
      }
    );
    this.dockRowEl.appendChild(searchEl);

    const trayEl = document.createElement('div');
    trayEl.className = 'dock-item sys-tray-item';
    trayEl.dataset.span = '2';
    trayEl.innerHTML = this.renderSystemTrayMarkup();
    bindAccessibleDockControl(
      trayEl,
      'Central Windows (Clique: Wi-Fi/Som | Role: Volume)',
      () => {
        triggerWindowsQuickSettings();
      }
    );
    trayEl.addEventListener('wheel', (ev) => {
      ev.preventDefault();
      sendNativeMediaControl(ev.deltaY < 0 ? 'vol_up' : 'vol_down');
    });
    this.dockRowEl.appendChild(trayEl);

    const gearEl = document.createElement('div');
    gearEl.className = 'dock-item settings-gear-item';
    gearEl.innerHTML = `<svg aria-hidden="true"><use href="#i-settings"></use></svg>`;
    bindAccessibleDockControl(gearEl, 'Temas & Configurações do Dock', () => {
      this.closeContextMenu();
      this.commandBarOpen = false;
      this.commandBarEl.style.display = 'none';
      this.state.settingsOpen = !this.state.settingsOpen;
      this.state.activePanelItemId = null;
      this.renderPopover();
    });
    this.dockRowEl.appendChild(gearEl);

    this.syncMirrorReflection();
    this.cacheDockItemCenters();
    this.syncHitboxToRust();
  }

  /**
   * Renders unpinned open Windows applications with their REAL extracted `.exe` icons
   * and an overflow `+N` button when more than 6 unpinned windows are open!
   */
  private appendOpenWindowsSection(claimedHwnds: Set<number>): void {
    const unpinnedWindows = this.openWindows.filter((w) => !claimedHwnds.has(w.hwnd));
    if (unpinnedWindows.length === 0) return;

    const sepOpen = document.createElement('span');
    sepOpen.className = 'dock-sep';
    this.dockRowEl.appendChild(sepOpen);

    const maxVisible = 6;
    const visibleWindows = unpinnedWindows.slice(0, maxVisible);
    const overflowCount = unpinnedWindows.length - visibleWindows.length;

    for (const win of visibleWindows) {
      const el = document.createElement('div');
      el.className = `dock-item os-win-item ${win.is_focused ? 'focused' : ''} ${win.is_minimized ? 'minimized' : ''}`;
      const appName = win.exe_name.replace(/\.exe$/i, '');
      const shortTitle = win.title.length > 42 ? win.title.slice(0, 42) + '…' : win.title;
      const fullLabel = `${appName} — ${shortTitle}`;
      el.dataset.hwnd = String(win.hwnd);

      const safeIconUrl = sanitizeUrl(win.icon_data_url);
      const iconMarkup = safeIconUrl
        ? `<img src="${escapeAttr(safeIconUrl)}" class="native-app-ico" alt="${escapeAttr(shortTitle)}" draggable="false" />`
        : `<svg aria-hidden="true" focusable="false"><use href="${escapeAttr(inferIconForWindow(win.title, win.exe_name))}"></use></svg>`;

      el.innerHTML = `
        <span class="app-ico-wrap">${iconMarkup}</span>
        <i class="run-dot ${win.is_focused ? 'active-fg' : ''}"></i>
      `;

      bindAccessibleDockControl(el, fullLabel, () => {
        this.closeContextMenu();
        el.classList.remove('bouncing');
        void el.offsetWidth;
        el.classList.add('bouncing');
        focusOrMinimizeWindow(win.hwnd);
      });

      el.addEventListener('auxclick', (ev) => {
        if (ev.button === 1) {
          ev.preventDefault();
          el.style.transform = 'scale(0.2)';
          el.style.opacity = '0';
          controlWindow(win.hwnd, 'close');
        }
      });

      el.addEventListener('contextmenu', (ev) => {
        ev.preventDefault();
        ev.stopPropagation();
        this.openContextMenu({
          anchorEl: el,
          openWin: win,
        });
      });

      this.dockRowEl.appendChild(el);
    }

    if (overflowCount > 0) {
      const moreEl = document.createElement('div');
      moreEl.className = 'dock-item overflow-win-item';
      moreEl.innerHTML = `<span class="overflow-pill">+${overflowCount}</span>`;
      bindAccessibleDockControl(
        moreEl,
        `+${overflowCount} janelas abertas (Clique para listar todas)`,
        (ev) => {
          ev.stopPropagation();
          this.toggleCommandBar();
        }
      );
      this.dockRowEl.appendChild(moreEl);
    }
  }

  /**
   * Surgical in-place DOM patch when only window focus, minimize state, or title changed
   * (avoids full dock rebuild on Alt+Tab or browser tab title change!).
   */
  private patchWindowsStateInPlace(): void {
    const env = this.getActiveEnv();
    for (const item of env.items) {
      if (item.kind !== 'app') continue;
      const matches = this.findMatchingWindowsForPinnedApp(item);
      const primaryWin = matches.find((w) => w.is_focused) || matches[0];
      const isFocused = matches.some((w) => w.is_focused);
      const el = this.dockRowEl.querySelector<HTMLElement>(
        `.dock-item[data-id="${escapeCssSelectorVal(item.id)}"]`
      );
      if (!el) continue;

      const labelText = primaryWin
        ? `${item.label} • ${primaryWin.title.slice(0, 36)}`
        : item.label;
      el.dataset.label = labelText;
      el.setAttribute('aria-label', labelText);

      const dotEl = el.querySelector<HTMLElement>('.run-dot');
      if (dotEl) {
        dotEl.classList.toggle('active-fg', isFocused);
        dotEl.classList.toggle('multi-win', matches.length > 1);
      }
    }

    for (const win of this.openWindows) {
      const winEl = this.dockRowEl.querySelector<HTMLElement>(
        `.os-win-item[data-hwnd="${escapeCssSelectorVal(String(win.hwnd))}"]`
      );
      if (!winEl) continue;
      winEl.classList.toggle('focused', win.is_focused);
      winEl.classList.toggle('minimized', win.is_minimized);
      const appName = win.exe_name.replace(/\.exe$/i, '');
      const shortTitle = win.title.length > 42 ? win.title.slice(0, 42) + '…' : win.title;
      const fullLabel = `${appName} — ${shortTitle}`;
      winEl.dataset.label = fullLabel;
      winEl.setAttribute('aria-label', fullLabel);
      const dotEl = winEl.querySelector<HTMLElement>('.run-dot');
      if (dotEl) {
        dotEl.classList.toggle('active-fg', win.is_focused);
      }
    }

    this.syncMirrorReflection();
  }

  /**
   * Opens a sleek glassmorphic Context Menu directly above the right-clicked Dock item (XSS-safe).
   */
  private openContextMenu(ctx: ContextMenuTarget): void {
    this.closePanels();
    const env = this.getActiveEnv();
    const { anchorEl, pinnedItem, openWin } = ctx;

    const rows: string[] = [];
    const headerTitle = openWin
      ? openWin.title.slice(0, 34)
      : pinnedItem?.label || 'Item do Dock';
    const headerSub = openWin
      ? openWin.exe_name
      : pinnedItem?.kind === 'widget'
      ? 'Widget Interativo'
      : 'Atalho Fixado';

    if (openWin) {
      rows.push(`
        <button type="button" class="ctx-btn" data-ctx-act="focus">
          <span>${openWin.is_minimized ? '🗔 Restaurar Janela' : openWin.is_focused ? '🗕 Minimizar Janela' : '🗔 Trazer para Frente'}</span>
          <kbd>Clique</kbd>
        </button>
        <button type="button" class="ctx-btn" data-ctx-act="maximize">
          <span>🗖 Maximizar Janela</span>
        </button>
      `);
      if (openWin.exe_path) {
        rows.push(`
          <button type="button" class="ctx-btn" data-ctx-act="new-instance">
            <span>🚀 Abrir Nova Janela</span>
            <kbd>Shift+Clique</kbd>
          </button>
        `);
      }
    } else if (pinnedItem?.kind === 'app') {
      rows.push(`
        <button type="button" class="ctx-btn" data-ctx-act="launch">
          <span>🚀 Abrir ${escapeHtml(pinnedItem.label)}</span>
        </button>
      `);
    } else if (pinnedItem?.kind === 'widget') {
      rows.push(`
        <button type="button" class="ctx-btn" data-ctx-act="open-widget">
          <span>✨ Abrir Painel do Widget</span>
        </button>
      `);
    }

    if (!pinnedItem && openWin) {
      rows.push(`
        <button type="button" class="ctx-btn" data-ctx-act="pin-win">
          <span>📌 Fixar em "${escapeHtml(env.name)}"</span>
        </button>
      `);
    } else if (pinnedItem && env.items.length > 2) {
      rows.push(`
        <button type="button" class="ctx-btn" data-ctx-act="unpin-item">
          <span>📍 Desafixar de "${escapeHtml(env.name)}"</span>
        </button>
      `);
    }

    if (openWin) {
      rows.push(`
        <div class="ctx-sep"></div>
        <button type="button" class="ctx-btn danger" data-ctx-act="close-win">
          <span>✕ Fechar Janela</span>
          <kbd>Clique Meio</kbd>
        </button>
      `);
    }

    this.contextMenuEl.innerHTML = `
      <div class="ctx-head">
        <b>${escapeHtml(headerTitle)}</b>
        <small>${escapeHtml(headerSub)}</small>
      </div>
      <div class="ctx-list">${rows.join('')}</div>
    `;
    this.contextMenuEl.style.display = 'block';

    requestAnimationFrame(() => {
      const itemRect = anchorEl.getBoundingClientRect();
      const menuW = this.contextMenuEl.offsetWidth || 220;
      const centerX = itemRect.left + itemRect.width / 2;
      const clampedLeft = Math.max(
        12,
        Math.min(window.innerWidth - menuW - 12, centerX - menuW / 2)
      );
      this.contextMenuEl.style.left = `${Math.round(clampedLeft)}px`;
      this.syncHitboxToRust();
    });

    this.contextMenuEl.querySelectorAll<HTMLElement>('[data-ctx-act]').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const act = btn.dataset.ctxAct;
        this.closeContextMenu();

        if (act === 'focus' && openWin) {
          focusOrMinimizeWindow(openWin.hwnd);
        } else if (act === 'maximize' && openWin) {
          controlWindow(openWin.hwnd, 'maximize');
        } else if (act === 'new-instance' && openWin?.exe_path) {
          launchTarget(openWin.exe_path);
        } else if (act === 'launch' && pinnedItem) {
          this.triggerAppLaunch(pinnedItem, anchorEl);
        } else if (act === 'open-widget' && pinnedItem) {
          this.toggleWidgetPanel(pinnedItem.id);
        } else if (act === 'pin-win' && openWin) {
          const cleanName = openWin.exe_name.replace(/\.exe$/i, '');
          const label = cleanName.charAt(0).toUpperCase() + cleanName.slice(1);
          env.items.unshift({
            id: 'a_' + Date.now(),
            kind: 'app',
            label,
            icon: openWin.icon_data_url || inferIconForWindow(openWin.title, openWin.exe_name),
            target: openWin.exe_path || openWin.exe_name,
            running: true,
          });
          savePersistentState(this.state);
          this.renderAll();
        } else if (act === 'unpin-item' && pinnedItem) {
          env.items = env.items.filter((x) => x.id !== pinnedItem.id);
          if (this.state.activePanelItemId === pinnedItem.id) {
            this.state.activePanelItemId = null;
          }
          savePersistentState(this.state);
          this.renderAll();
        } else if (act === 'close-win' && openWin) {
          controlWindow(openWin.hwnd, 'close');
          window.setTimeout(() => {
            this.openWindows = this.openWindows.filter((w) => w.hwnd !== openWin.hwnd);
            this.renderDockItems();
          }, 180);
        }
      });
    });
  }

  private closeContextMenu(): void {
    if (this.contextMenuEl.style.display === 'none') return;
    this.contextMenuEl.style.display = 'none';
    this.syncHitboxToRust();
  }

  /**
   * Toggles the Spotlight / Command Bar (`Alt + Space` or Search button)
   */
  private toggleCommandBar(): void {
    this.closeContextMenu();
    this.commandBarOpen = !this.commandBarOpen;
    if (this.commandBarOpen) {
      this.state.activePanelItemId = null;
      this.state.settingsOpen = false;
      this.popoverEl.style.display = 'none';
      this.commandQuery = '';
      this.commandSelectedIndex = 0;
      this.renderCommandBar();
      this.commandBarEl.style.display = 'block';
      requestAnimationFrame(() => {
        const input = this.commandBarEl.querySelector<HTMLInputElement>('.cmd-input');
        input?.focus();
        this.syncHitboxToRust();
      });
    } else {
      this.commandBarEl.style.display = 'none';
      this.syncHitboxToRust();
    }
    this.updateAutoHideVisibility();
  }

  private buildCommandActions(query: string): CommandBarAction[] {
    const q = query.trim().toLowerCase();
    const actions: CommandBarAction[] = [];

    // 1. Instant CSP-Safe Math Calculator
    const mathVal = safeEvaluateMath(q);
    if (mathVal !== null) {
      const formatted = mathVal.toLocaleString('pt-BR', { maximumFractionDigits: 4 });
      actions.push({
        id: 'calc_res',
        title: `= ${formatted}`,
        subtitle: `Expressão: ${query.trim()} (Enter para copiar resultado)`,
        badge: 'Calculadora',
        iconHtml: '🧮',
        run: () => {
          navigator.clipboard?.writeText(String(mathVal));
        },
      });
    }

    // 2. Open Windows search
    for (const win of this.openWindows) {
      const matchText = `${win.title} ${win.exe_name}`.toLowerCase();
      if (!q || matchText.includes(q)) {
        const safeIco = sanitizeUrl(win.icon_data_url);
        const ico = safeIco
          ? `<img src="${escapeAttr(safeIco)}" class="cmd-win-ico" alt="" />`
          : '🗔';
        actions.push({
          id: `win_${win.hwnd}`,
          title: win.title,
          subtitle: `Janela aberta • ${win.exe_name}`,
          badge: win.is_focused ? 'Em Foco' : 'Alternar',
          iconHtml: ico,
          run: () => focusOrMinimizeWindow(win.hwnd),
        });
      }
    }

    // 3. Environments & System commands
    for (const env of this.state.environments) {
      if (!q || `ambiente ${env.name.toLowerCase()}`.includes(q)) {
        actions.push({
          id: `env_${env.id}`,
          title: `Ambiente: ${env.name}`,
          subtitle: env.description,
          badge: env.shortcut,
          iconHtml: '🎯',
          run: () => this.switchEnvironment(env.id),
        });
      }
    }

    const sysCommands: { keys: string; title: string; sub: string; ico: string; run: () => void }[] = [
      {
        keys: 'capturar tela print screenshot recorte',
        title: 'Capturar Tela do Windows (Win+Shift+S)',
        sub: 'Ferramenta nativa de captura do Windows',
        ico: '✂️',
        run: () => triggerWindowsScreenshot(),
      },
      {
        keys: 'spotify musica play pause tocar',
        title: this.state.music.playing
          ? 'Pausar Música (Spotify/Mídia)'
          : 'Tocar Música (Spotify/Mídia)',
        sub: `${this.state.music.title} — ${this.state.music.artist}`,
        ico: '🎵',
        run: () => this.handleMusicControl('toggle'),
      },
      {
        keys: 'gerenciador de tarefas taskmgr processos cpu ram',
        title: 'Abrir Gerenciador de Tarefas',
        sub: `CPU: ${this.state.metrics.cpuUsage}% • RAM: ${this.state.metrics.ramUsage}%`,
        ico: '📊',
        run: () => launchTarget('taskmgr.exe'),
      },
      {
        keys: 'modo ocultar automaticamente autohide reservar espaco tela',
        title:
          this.state.dockScreenMode === 'reserve'
            ? 'Ativar Modo Ocultar Automaticamente (Auto-Hide)'
            : 'Ativar Modo Reservar Espaço na Tela',
        sub: 'Alternar comportamento do Dock com janelas maximizadas',
        ico: '🪄',
        run: () => {
          this.state.dockScreenMode =
            this.state.dockScreenMode === 'reserve' ? 'autohide' : 'reserve';
          savePersistentState(this.state);
          this.syncScreenModeToWindows();
        },
      },
    ];

    for (const sc of sysCommands) {
      if (!q || sc.keys.includes(q) || sc.title.toLowerCase().includes(q)) {
        actions.push({
          id: `sys_${sc.title}`,
          title: sc.title,
          subtitle: sc.sub,
          badge: 'Sistema',
          iconHtml: sc.ico,
          run: sc.run,
        });
      }
    }

    // 4. Themes quick switch + Web Search
    if (q.length >= 2) {
      for (const t of Object.values(THEMES)) {
        if (`tema ${t.name.toLowerCase()} ${t.id}`.includes(q)) {
          actions.push({
            id: `theme_${t.id}`,
            title: `Tema: ${t.name}`,
            subtitle: t.description,
            badge: 'Tema',
            iconHtml: '🎨',
            run: () => {
              this.state.themeId = t.id;
              savePersistentState(this.state);
              this.renderAll();
            },
          });
        }
      }

      actions.push({
        id: 'web_search',
        title: `Pesquisar "${query.trim()}" na Web`,
        subtitle: 'Abrir busca no seu navegador padrão',
        badge: 'Web ↗',
        iconHtml: '🌐',
        run: () =>
          launchTarget(
            `https://www.google.com/search?q=${encodeURIComponent(query.trim())}`
          ),
      });
    }

    return actions.slice(0, 8);
  }

  private renderCommandRowsHtml(): string {
    return this.currentCommandActions
      .map(
        (act, idx) => `
        <button type="button" class="cmd-row ${idx === this.commandSelectedIndex ? 'selected' : ''}" data-cmd-idx="${idx}">
          <span class="cmd-ico">${act.iconHtml}</span>
          <span class="cmd-txt">
            <b>${escapeHtml(act.title)}</b>
            <small>${escapeHtml(act.subtitle)}</small>
          </span>
          <span class="cmd-badge">${escapeHtml(act.badge)}</span>
        </button>`
      )
      .join('');
  }

  private renderCommandBar(): void {
    this.currentCommandActions = this.buildCommandActions(this.commandQuery);
    if (this.commandSelectedIndex >= this.currentCommandActions.length) {
      this.commandSelectedIndex = 0;
    }

    this.commandBarEl.innerHTML = `
      <div class="cmd-input-wrap">
        <span class="cmd-search-glyph">🔍</span>
        <input type="text" class="cmd-input" value="${escapeAttr(this.commandQuery)}" placeholder="Buscar janela aberta, calcular (ex: 1250 * 5.8), trocar tema ou pesquisar..." />
        <kbd class="cmd-esc">ESC</kbd>
      </div>
      <div class="cmd-results">${this.renderCommandRowsHtml()}</div>
    `;

    const input = this.commandBarEl.querySelector<HTMLInputElement>('.cmd-input');
    if (input) {
      input.setSelectionRange(input.value.length, input.value.length);
      input.addEventListener('input', () => {
        this.commandQuery = input.value;
        this.commandSelectedIndex = 0;
        this.updateCommandResultsOnly();
      });
      input.addEventListener('keydown', (ev) => {
        if (ev.key === 'ArrowDown') {
          ev.preventDefault();
          this.commandSelectedIndex =
            (this.commandSelectedIndex + 1) % Math.max(1, this.currentCommandActions.length);
          this.updateCommandResultsOnly();
        } else if (ev.key === 'ArrowUp') {
          ev.preventDefault();
          this.commandSelectedIndex =
            (this.commandSelectedIndex - 1 + Math.max(1, this.currentCommandActions.length)) %
            Math.max(1, this.currentCommandActions.length);
          this.updateCommandResultsOnly();
        } else if (ev.key === 'Enter') {
          ev.preventDefault();
          const chosen = this.currentCommandActions[this.commandSelectedIndex];
          if (chosen) {
            this.toggleCommandBar();
            chosen.run();
          }
        }
      });
    }

    this.bindCommandResultClicks();
  }

  private updateCommandResultsOnly(): void {
    this.currentCommandActions = this.buildCommandActions(this.commandQuery);
    if (this.commandSelectedIndex >= this.currentCommandActions.length) {
      this.commandSelectedIndex = 0;
    }
    const container = this.commandBarEl.querySelector('.cmd-results');
    if (!container) return;
    container.innerHTML = this.renderCommandRowsHtml();
    this.bindCommandResultClicks();
    this.syncHitboxToRust();
  }

  private bindCommandResultClicks(): void {
    this.commandBarEl.querySelectorAll<HTMLElement>('[data-cmd-idx]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const idx = Number(btn.dataset.cmdIdx);
        const chosen = this.currentCommandActions[idx];
        if (chosen) {
          this.toggleCommandBar();
          chosen.run();
        }
      });
    });
  }

  private renderSystemTrayMarkup(): string {
    const now = new Date();
    const timeStr = now.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
    const dateStr = now.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
    const bat = this.state.metrics.batteryLevel;

    return `
      <div class="w-card systray">
        <div class="tray-icons" aria-hidden="true">
          <svg viewBox="0 0 16 16" width="13" height="13" fill="none" stroke="currentColor" stroke-width="1.5">
            <path d="M3 6.5h2.5L9 3.5v9l-3.5-3H3z" fill="currentColor"/>
            <path d="M11.5 5.5a3.5 3.5 0 0 1 0 5" stroke-linecap="round"/>
          </svg>
          <span class="tray-bat">${Number(bat)}%</span>
        </div>
        <div class="tray-clock">
          <b class="tray-time-txt">${escapeHtml(timeStr)}</b>
          <span class="tray-date-txt">${escapeHtml(dateStr)}</span>
        </div>
      </div>
    `;
  }

  private syncMirrorReflection(): void {
    if (!this.state.showReflections) return;
    // Strip duplicate IDs inside mirror clone so SVG defs never collide
    this.mirrorRowEl.innerHTML = this.dockRowEl.innerHTML.replace(/\sid="[^"]+"/g, '');
  }

  /**
   * High-frequency 1Hz update: ONLY patches timers, analog clock hands, local music progress, and system tray time text!
   * NEVER touches GitHub (182 cells), Weather, Reminders, Water, or Mirror innerHTML!
   */
  private updateTimersAndClockInPlace(): void {
    const env = this.getActiveEnv();
    const fmt = (sec: number) => {
      const m = Math.floor(sec / 60);
      const s = sec % 60;
      return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
    };

    for (const item of env.items) {
      if (item.kind !== 'widget') continue;
      const wType = item.widgetType || 'clock';
      if (wType !== 'pomodoro' && wType !== 'timer' && wType !== 'clock' && wType !== 'music') {
        continue;
      }

      const el = this.dockRowEl.querySelector<HTMLElement>(
        `.dock-item[data-id="${escapeCssSelectorVal(item.id)}"]`
      );
      if (!el) continue;

      if (wType === 'pomodoro') {
        const { remainingSec, totalSec, mode } = this.state.pomodoro;
        const pct = Math.max(0, Math.min(1, remainingSec / Math.max(1, totalSec)));
        const circles = el.querySelectorAll('circle');
        const txt = el.querySelector('text');
        if (circles.length >= 2 && txt) {
          circles[1].setAttribute('stroke-dasharray', `${(pct * 106.8).toFixed(1)} 106.8`);
          circles[1].setAttribute('stroke', mode === 'focus' ? '#ff9500' : '#22c55e');
          txt.textContent = fmt(remainingSec);
        }
      } else if (wType === 'timer') {
        const { remainingSec, totalSec } = this.state.timer;
        const pct = Math.max(0, Math.min(1, remainingSec / Math.max(1, totalSec)));
        const circles = el.querySelectorAll('circle');
        const txt = el.querySelector('text');
        if (circles.length >= 2 && txt) {
          circles[1].setAttribute('stroke-dasharray', `${(pct * 106.8).toFixed(1)} 106.8`);
          txt.textContent = fmt(remainingSec);
        }
      } else if (wType === 'clock') {
        const now = new Date();
        const sec = now.getSeconds();
        const min = now.getMinutes() + sec / 60;
        const hr = (now.getHours() % 12) + min / 60;
        const lines = el.querySelectorAll('line');
        if (lines.length >= 3) {
          lines[0].setAttribute('transform', `rotate(${(hr * 30).toFixed(1)} 32 32)`);
          lines[1].setAttribute('transform', `rotate(${(min * 6).toFixed(1)} 32 32)`);
          lines[2].setAttribute('transform', `rotate(${sec * 6} 32 32)`);
        }
      } else if (wType === 'music') {
        const fallbackTrack = PLAYLIST[this.state.music.trackIndex] || PLAYLIST[0];
        const totalDuration = Math.max(
          1,
          this.state.music.detected
            ? this.state.music.durationSec || 180
            : fallbackTrack.durationSec
        );
        const pct = Math.min(
          100,
          Math.round((this.state.music.progressSec / totalDuration) * 100)
        );
        const barEl = el.querySelector<HTMLElement>('.line > i');
        if (barEl) barEl.style.width = `${pct}%`;
      }
    }

    // Update System Tray clock text in place without recreating SVG
    const now = new Date();
    const timeEl = this.dockRowEl.querySelector('.tray-time-txt');
    const dateEl = this.dockRowEl.querySelector('.tray-date-txt');
    if (timeEl) {
      timeEl.textContent = now.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
    }
    if (dateEl) {
      dateEl.textContent = now.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
    }

    if (this.state.activePanelItemId && !this.state.settingsOpen) {
      const activeItem = env.items.find((i) => i.id === this.state.activePanelItemId);
      if (
        activeItem &&
        (activeItem.widgetType === 'pomodoro' || activeItem.widgetType === 'timer')
      ) {
        const bigTimer = this.popoverEl.querySelector('.big-timer');
        if (bigTimer) {
          const sec =
            activeItem.widgetType === 'pomodoro'
              ? this.state.pomodoro.remainingSec
              : this.state.timer.remainingSec;
          bigTimer.textContent = fmt(sec);
        }
      }
    }
  }

  /**
   * Targeted widget update: re-renders ONLY the specified widget types (e.g. ['music'], ['weather'], ['github'])
   * or all widgets when state data changes!
   */
  private updateLiveWidgetsInPlace(filterTypes?: WidgetType[]): void {
    const env = this.getActiveEnv();
    for (const item of env.items) {
      if (item.kind !== 'widget') continue;
      const wType = item.widgetType || 'clock';
      if (filterTypes && !filterTypes.includes(wType)) continue;

      const el = this.dockRowEl.querySelector<HTMLElement>(
        `.dock-item[data-id="${escapeCssSelectorVal(item.id)}"]`
      );
      if (!el) continue;

      // Special zero-flicker update for Music so the album cover <img> never reloads unless changed
      if (wType === 'music') {
        const card = el.querySelector('.w-card.music');
        if (card) {
          const fallbackTrack = PLAYLIST[this.state.music.trackIndex] || PLAYLIST[0];
          const title = this.state.music.detected ? this.state.music.title : fallbackTrack.title;
          const artist = this.state.music.detected ? this.state.music.artist : fallbackTrack.artist;
          const totalDuration = Math.max(
            1,
            this.state.music.detected
              ? this.state.music.durationSec || 180
              : fallbackTrack.durationSec
          );
          const pct = Math.min(
            100,
            Math.round((this.state.music.progressSec / totalDuration) * 100)
          );

          card.classList.toggle('is-playing', this.state.music.playing);
          const trackTxtEl = card.querySelector('.track-txt');
          if (trackTxtEl) {
            trackTxtEl.textContent = title;
          }
          const subEl = card.querySelector('.sub');
          if (subEl) subEl.textContent = artist;
          const barEl = card.querySelector<HTMLElement>('.line > i');
          if (barEl) barEl.style.width = `${Math.round(pct)}%`;

          const safeArt = sanitizeUrl(this.state.music.artworkUrl);
          const artSpan = card.querySelector('.art');
          const existingImg = artSpan?.querySelector<HTMLImageElement>('img.art-img');
          if (safeArt) {
            if (!existingImg || existingImg.getAttribute('src') !== safeArt) {
              if (artSpan) {
                artSpan.innerHTML = `<img src="${escapeAttr(safeArt)}" class="art-img" alt="Capa" />`;
              }
            }
          } else if (existingImg) {
            el.innerHTML = renderDockWidgetMarkup(item, this.state);
          }

          const toggleBtn = card.querySelector('[data-music-act="toggle"]');
          if (toggleBtn) {
            toggleBtn.innerHTML = this.state.music.playing
              ? '<svg viewBox="0 0 12 12"><rect x="2.5" y="1.8" width="2.4" height="8.4" rx=".8"/><rect x="7.1" y="1.8" width="2.4" height="8.4" rx=".8"/></svg>'
              : '<svg viewBox="0 0 12 12"><path d="M2.6 1.4 10 6l-7.4 4.6z"/></svg>';
          }
          continue;
        }
      }

      el.innerHTML = renderDockWidgetMarkup(item, this.state);
    }

    const batEl = this.dockRowEl.querySelector('.tray-bat');
    if (batEl) {
      batEl.textContent = `${this.state.metrics.batteryLevel}%`;
    }
  }

  private switchEnvironment(envId: string): void {
    if (this.state.activeEnvId === envId) return;
    this.state.activeEnvId = envId;
    this.state.activePanelItemId = null;
    savePersistentState(this.state);
    this.renderAll();
  }

  private triggerAppLaunch(item: DockItem, el: HTMLElement): void {
    el.classList.remove('bouncing');
    void el.offsetWidth;
    el.classList.add('bouncing');

    if (item.target === '__START_MENU__') {
      triggerWindowsStartMenu();
      return;
    }

    item.running = true;
    savePersistentState(this.state);

    if (item.target) {
      launchTarget(item.target);
    }
    window.setTimeout(() => {
      this.renderDockItems();
    }, 560);
  }

  private toggleWidgetPanel(itemId: string): void {
    this.closeContextMenu();
    this.commandBarOpen = false;
    this.commandBarEl.style.display = 'none';
    this.state.settingsOpen = false;
    this.state.activePanelItemId =
      this.state.activePanelItemId === itemId ? null : itemId;
    this.renderPopover();
    this.updateAutoHideVisibility();
    this.syncHitboxToRust();
  }

  private closePanels(): void {
    this.closeContextMenu();
    if (!this.state.activePanelItemId && !this.state.settingsOpen && !this.commandBarOpen) {
      return;
    }
    this.state.activePanelItemId = null;
    this.state.settingsOpen = false;
    this.commandBarOpen = false;
    this.commandBarEl.style.display = 'none';
    this.renderPopover();
    this.updateAutoHideVisibility();
    this.syncHitboxToRust();
  }

  private repositionActivePopover(): void {
    if (this.popoverEl.style.display === 'none') return;

    requestAnimationFrame(() => {
      let anchorEl: HTMLElement | null = null;
      if (this.state.settingsOpen) {
        anchorEl = this.dockRowEl.querySelector<HTMLElement>('.settings-gear-item');
      } else if (this.state.activePanelItemId) {
        anchorEl = this.dockRowEl.querySelector<HTMLElement>(
          `.dock-item[data-id="${escapeCssSelectorVal(this.state.activePanelItemId)}"]`
        );
      }

      const popW = this.popoverEl.offsetWidth || 380;
      const screenW = window.innerWidth;

      if (!anchorEl) {
        const centeredLeft = Math.round((screenW - popW) / 2);
        this.popoverEl.style.left = `${centeredLeft}px`;
        this.popoverEl.style.setProperty('--arrow-x', `${Math.round(popW / 2)}px`);
        return;
      }

      const rect = anchorEl.getBoundingClientRect();
      const anchorCenterX = rect.left + rect.width / 2;
      const idealLeft = anchorCenterX - popW / 2;
      const clampedLeft = Math.max(16, Math.min(screenW - popW - 16, idealLeft));
      const arrowX = Math.max(24, Math.min(popW - 24, anchorCenterX - clampedLeft));

      this.popoverEl.style.left = `${Math.round(clampedLeft)}px`;
      this.popoverEl.style.setProperty('--arrow-x', `${Math.round(arrowX)}px`);
      this.syncHitboxToRust();
    });
  }

  private renderPopover(): void {
    if (this.state.settingsOpen) {
      this.popoverEl.style.display = 'block';
      this.popoverEl.classList.add('wide-settings');
      this.renderSettingsPopover();
      this.repositionActivePopover();
      return;
    }

    this.popoverEl.classList.remove('wide-settings');
    if (!this.state.activePanelItemId) {
      this.popoverEl.style.display = 'none';
      this.syncHitboxToRust();
      return;
    }

    const env = this.getActiveEnv();
    const item = env.items.find((x) => x.id === this.state.activePanelItemId);
    if (!item || item.kind !== 'widget') {
      this.popoverEl.style.display = 'none';
      this.syncHitboxToRust();
      return;
    }

    this.popoverEl.style.display = 'block';
    this.popoverEl.innerHTML = renderWidgetPopoverContent(item, this.state);
    this.bindWidgetPopoverEvents();
    this.repositionActivePopover();
  }

  private bindWidgetPopoverEvents(): void {
    this.popoverEl.querySelectorAll<HTMLElement>('[data-pomo-mode]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const mode = btn.dataset.pomoMode as 'focus' | 'short' | 'long';
        const secs = mode === 'focus' ? 25 * 60 : mode === 'short' ? 5 * 60 : 15 * 60;
        this.state.pomodoro.mode = mode;
        this.state.pomodoro.totalSec = secs;
        this.state.pomodoro.remainingSec = secs;
        this.state.pomodoro.running = true;
        this.state.pomodoro.endsAt = Date.now() + secs * 1000;
        this.updateTimersAndClockInPlace();
        this.renderPopover();
      });
    });

    this.popoverEl.querySelectorAll<HTMLElement>('[data-pomo-act]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const act = btn.dataset.pomoAct;
        if (act === 'toggle') {
          this.state.pomodoro.running = !this.state.pomodoro.running;
          this.state.pomodoro.endsAt = this.state.pomodoro.running
            ? Date.now() + this.state.pomodoro.remainingSec * 1000
            : null;
        } else if (act === 'reset') {
          this.state.pomodoro.remainingSec = this.state.pomodoro.totalSec;
          this.state.pomodoro.running = false;
          this.state.pomodoro.endsAt = null;
        }
        this.updateTimersAndClockInPlace();
        this.renderPopover();
      });
    });

    this.popoverEl.querySelectorAll<HTMLElement>('[data-timer-set]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const secs = Number(btn.dataset.timerSet);
        this.state.timer.totalSec = secs;
        this.state.timer.remainingSec = secs;
        this.state.timer.running = true;
        this.state.timer.endsAt = Date.now() + secs * 1000;
        this.updateTimersAndClockInPlace();
        this.renderPopover();
      });
    });

    this.popoverEl.querySelectorAll<HTMLElement>('[data-timer-act]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const act = btn.dataset.timerAct;
        if (act === 'toggle') {
          this.state.timer.running = !this.state.timer.running;
          this.state.timer.endsAt = this.state.timer.running
            ? Date.now() + this.state.timer.remainingSec * 1000
            : null;
        } else if (act === 'reset') {
          this.state.timer.remainingSec = this.state.timer.totalSec;
          this.state.timer.running = false;
          this.state.timer.endsAt = null;
        }
        this.updateTimersAndClockInPlace();
        this.renderPopover();
      });
    });

    // Weather city chips, worldwide city search form & explicit IP opt-in
    this.popoverEl.querySelectorAll<HTMLElement>('[data-weather-city]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const city = btn.dataset.weatherCity!;
        this.refreshWeather(city, false);
      });
    });

    this.popoverEl.querySelector<HTMLElement>('[data-weather-auto]')?.addEventListener('click', () => {
      this.refreshWeather('Detectando...', true);
    });

    const weatherForm = this.popoverEl.querySelector<HTMLFormElement>('[data-weather-form]');
    weatherForm?.addEventListener('submit', (e) => {
      e.preventDefault();
      const fd = new FormData(weatherForm);
      const cityQuery = String(fd.get('cityQuery') || '').trim();
      if (!cityQuery) return;
      this.refreshWeather(cityQuery, false);
    });

    // Music controls inside popover
    this.popoverEl.querySelectorAll<HTMLElement>('[data-music-act]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const act = btn.dataset.musicAct!;
        if (act === 'synth') {
          this.state.music.soundSynthEnabled = !this.state.music.soundSynthEnabled;
          this.syncAmbientSynth();
          this.renderPopover();
        } else {
          this.handleMusicControl(act);
        }
      });
    });

    this.popoverEl.querySelectorAll<HTMLElement>('[data-music-pick]').forEach((btn) => {
      btn.addEventListener('click', () => {
        this.state.music.detected = false;
        this.state.music.trackIndex = Number(btn.dataset.musicPick);
        this.state.music.progressSec = 0;
        this.state.music.playing = true;
        this.syncAmbientSynth();
        this.updateLiveWidgetsInPlace(['music']);
        this.renderPopover();
      });
    });

    // Activity & System quick tools
    this.popoverEl.querySelectorAll<HTMLElement>('[data-sys-act]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const act = btn.dataset.sysAct;
        if (act === 'taskmgr') {
          launchTarget('taskmgr.exe');
        } else if (act === 'screenshot') {
          this.closePanels();
          window.setTimeout(() => triggerWindowsScreenshot(), 150);
        }
      });
    });

    // Calendar Agenda events
    const calForm = this.popoverEl.querySelector<HTMLFormElement>('[data-cal-form]');
    calForm?.addEventListener('submit', (e) => {
      e.preventDefault();
      const fd = new FormData(calForm);
      const time = String(fd.get('evTime') || '').trim();
      const title = String(fd.get('evTitle') || '').trim();
      const link = String(fd.get('evUrl') || '').trim();
      if (!time || !title) return;
      this.state.calendarEvents.push({
        id: 'ev_' + Date.now(),
        time,
        title,
        link: link || undefined,
      });
      this.state.calendarEvents.sort((a, b) => a.time.localeCompare(b.time));
      savePersistentState(this.state);
      this.renderPopover();
    });

    this.popoverEl.querySelectorAll<HTMLElement>('[data-cal-open]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const url = btn.dataset.calOpen!;
        const safe = sanitizeUrl(url.startsWith('http') ? url : `https://${url}`);
        if (safe) launchTarget(safe);
      });
    });

    this.popoverEl.querySelectorAll<HTMLElement>('[data-cal-del]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const id = btn.dataset.calDel!;
        this.state.calendarEvents = this.state.calendarEvents.filter((x) => x.id !== id);
        savePersistentState(this.state);
        this.renderPopover();
      });
    });

    const noteArea = this.popoverEl.querySelector<HTMLTextAreaElement>('[data-note-input]');
    if (noteArea) {
      noteArea.addEventListener('input', () => {
        this.state.noteText = noteArea.value;
        savePersistentState(this.state);
      });
    }

    this.popoverEl.querySelectorAll<HTMLInputElement>('[data-rem-toggle]').forEach((chk) => {
      chk.addEventListener('change', () => {
        const r = this.state.reminders.find((x) => x.id === chk.dataset.remToggle);
        if (r) {
          r.done = chk.checked;
          savePersistentState(this.state);
          this.updateLiveWidgetsInPlace(['reminders']);
          this.renderPopover();
        }
      });
    });

    const remForm = this.popoverEl.querySelector<HTMLFormElement>('[data-rem-form]');
    if (remForm) {
      remForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const fd = new FormData(remForm);
        const text = String(fd.get('remText') || '').trim();
        if (!text) return;
        const now = new Date();
        this.state.reminders.unshift({
          id: 'r_' + Date.now(),
          text,
          done: false,
          time: now.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
        });
        savePersistentState(this.state);
        this.updateLiveWidgetsInPlace(['reminders']);
        this.renderPopover();
      });
    }

    this.popoverEl.querySelectorAll<HTMLElement>('[data-water-act]').forEach((btn) => {
      btn.addEventListener('click', () => {
        this.state.lastWaterDate = todayDateKey();
        if (btn.dataset.waterAct === 'add') {
          this.state.waterGlasses += 1;
        } else {
          this.state.waterGlasses = 0;
        }
        savePersistentState(this.state);
        this.updateLiveWidgetsInPlace(['water']);
        this.renderPopover();
      });
    });

    // GitHub Real Account Connection Form
    const ghForm = this.popoverEl.querySelector<HTMLFormElement>('[data-gh-form]');
    ghForm?.addEventListener('submit', (e) => {
      e.preventDefault();
      const fd = new FormData(ghForm);
      const user = String(fd.get('ghUser') || '').trim();
      if (!user) return;
      this.refreshGithub(user);
    });

    this.popoverEl.querySelector<HTMLElement>('[data-gh-act="open-profile"]')?.addEventListener('click', () => {
      if (this.state.github.username) {
        const clean = encodeURIComponent(this.state.github.username);
        launchTarget(`https://github.com/${clean}`);
      }
    });
  }

  /**
   * Clean Tabbed Settings Drawer (P2 Redesign: Appearance, Screen & System, Environments & Add App)
   */
  private renderSettingsPopover(): void {
    const classicThemes = Object.values(THEMES).filter((t) => !t.seasonal);
    const seasonalThemes = Object.values(THEMES).filter((t) => t.seasonal);
    const currentTheme = THEMES[this.state.themeId] || THEMES.native;

    const renderThemeButtons = (list: typeof classicThemes) =>
      list
        .map(
          (t) => `
          <button type="button" class="chip theme-swatch-chip ${this.state.themeId === t.id ? 'active' : ''}" data-set-theme="${t.id}" title="${escapeAttr(t.description)}">
            <span class="swatch-dot" style="background:${t.ind}"></span>
            ${escapeHtml(t.name)}
          </button>`
        )
        .join('');

    const screenModes: { id: DockScreenMode; label: string; desc: string }[] = [
      {
        id: 'reserve',
        label: '📐 Reservar Espaço (Padrão Barra Windows)',
        desc: 'Janelas maximizadas param exatamente acima do Dock (compatível com escala HiDPI 100%-200%)',
      },
      {
        id: 'autohide',
        label: '🪄 Ocultar Automaticamente (Intellihide)',
        desc: 'O Dock esconde-se fora da tela e sobe quando o mouse encosta na borda inferior',
      },
      {
        id: 'float',
        label: '☁️ Sempre Flutuante',
        desc: 'Mantém o Dock sempre visível sobre a parte inferior da tela',
      },
    ];

    const screenModeButtons = screenModes
      .map(
        (m) => `
        <button type="button" class="chip ${this.state.dockScreenMode === m.id ? 'active' : ''}" data-set-screen-mode="${m.id}" title="${escapeAttr(m.desc)}">
          ${escapeHtml(m.label)}
        </button>`
      )
      .join('');

    const pets: { id: PetType; label: string }[] = [
      { id: 'cat', label: '🐱 Gato' },
      { id: 'dog', label: '🐶 Cachorro' },
      { id: 'dragon', label: '🐉 Dragão' },
      { id: 'ghost', label: '👻 Fantasma' },
      { id: 'none', label: '🚫 Sem Mascote' },
    ];

    const petButtons = pets
      .map(
        (p) => `
        <button type="button" class="chip ${this.state.petType === p.id ? 'active' : ''}" data-set-pet="${p.id}">
          ${p.label}
        </button>`
      )
      .join('');

    const envButtons = this.state.environments
      .map(
        (env) => `
        <button type="button" class="chip ${env.id === this.state.activeEnvId ? 'active' : ''}" data-set-env="${escapeAttr(env.id)}">
          <span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:${escapeAttr(env.color)};margin-right:4px"></span>
          ${escapeHtml(env.name)} (${escapeHtml(env.shortcut)})
        </button>`
      )
      .join('');

    let tabBodyHtml = '';
    if (this.activeSettingsTab === 'appearance') {
      tabBodyHtml = `
        <div class="settings-sec" style="margin-top:8px">
          <h5>8 Temas Clássicos (${escapeHtml(currentTheme.name)}: ${escapeHtml(currentTheme.description)})</h5>
          <div class="theme-grid">${renderThemeButtons(classicThemes)}</div>
        </div>
        <div class="settings-sec">
          <h5>6 Temas de Época (Com Partículas & Luzes)</h5>
          <div class="theme-grid">${renderThemeButtons(seasonalThemes)}</div>
        </div>
        <div class="settings-sec">
          <h5>Mascote na Barra (CPU Atual: ${this.state.metrics.cpuUsage}%)</h5>
          <div class="pomo-modes">${petButtons}</div>
        </div>
        <div class="settings-sec sliders-row">
          <div class="slider-box">
            <label><span>Tamanho dos Ícones</span><b>${this.state.iconSize}px</b></label>
            <input type="range" min="36" max="64" step="2" value="${this.state.iconSize}" data-slider="size" />
          </div>
          <div class="slider-box">
            <label><span>Magnificação (Zoom Hover)</span><b>${this.state.magnification.toFixed(2)}x</b></label>
            <input type="range" min="1.0" max="1.75" step="0.05" value="${this.state.magnification}" data-slider="mag" />
          </div>
        </div>
      `;
    } else if (this.activeSettingsTab === 'screen') {
      tabBodyHtml = `
        <div class="settings-sec" style="margin-top:8px">
          <h5>Comportamento com Janelas Maximizadas (HiDPI Nativo)</h5>
          <div class="pomo-modes" style="margin-bottom:6px">${screenModeButtons}</div>
          <p class="pop-sub" style="margin:4px 0 0">
            Atalho global de segurança: pressione <b>Ctrl + Alt + Shift + R</b> a qualquer momento para restaurar a barra original do Windows e a área de trabalho.
          </p>
        </div>
        <div class="settings-sec">
          <h5>Controle da Barra Original do Windows & Reset</h5>
          <div class="pomo-modes">
            <button type="button" class="chip" data-toggle-win-bar="true">
              ${this.nativeTaskbarHidden ? '🪟 Mostrar Barra Original do Windows' : '🙈 Ocultar Barra Original do Windows'}
            </button>
            <button type="button" class="chip" data-toggle-reflect="true">
              ${this.state.showReflections ? '✨ Reflexo Espelhado: ATIVO' : '✨ Reflexo Espelhado: INATIVO'}
            </button>
            <button type="button" class="chip" style="border-color:#22c55e;color:#bbf7d0" data-restore-windows="true" title="Devolve a barra original do Windows e a área de trabalho sem fechar o Dock">
              🛟 Restaurar Barra do Windows
            </button>
            <button type="button" class="chip" data-reset-defaults="true" style="border-color:#f59e0b;color:#fde68a">
              ↺ Restaurar Padrões de Fábrica
            </button>
          </div>
        </div>
      `;
    } else {
      tabBodyHtml = `
        <div class="settings-sec" style="margin-top:8px">
          <h5>Selecionar Ambiente Ativo</h5>
          <div class="pomo-modes" style="margin-bottom:4px">${envButtons}</div>
        </div>
        <div class="settings-sec">
          <h5>Adicionar Widget ao Ambiente "${escapeHtml(this.getActiveEnv().name)}"</h5>
          <form class="add-form" data-add-widget-form="true">
            <select name="widgetSpec">
              <option value="pomodoro:1:Pomodoro">Widget: Pomodoro (1x1)</option>
              <option value="timer:1:Timer">Widget: Timer Rápido (1x1)</option>
              <option value="calendar:1:Calendário">Widget: Calendário & Agenda (1x1)</option>
              <option value="clock:1:Relógio">Widget: Relógio Analógico (1x1)</option>
              <option value="notes:1:Notas">Widget: Nota Rápida (1x1)</option>
              <option value="weather:2:Clima">Widget: Clima ao Vivo (2x1)</option>
              <option value="activity:2:CPU & RAM">Widget: Atividade CPU/RAM (2x1)</option>
              <option value="battery:2:Energia">Widget: Bateria Nativa (2x1)</option>
              <option value="reminders:2:Lembretes">Widget: Lembretes (2x1)</option>
              <option value="water:2:Hidratação">Widget: Beber Água (2x1)</option>
              <option value="music:4:Spotify / Player">Widget: Spotify / Player (4x1)</option>
              <option value="github:4:Meu GitHub">Widget: GitHub Real-Time (4x1)</option>
            </select>
            <button type="submit" class="btn-pop primary" style="flex:0 0 auto">+ Adicionar Widget</button>
          </form>
        </div>
        <div class="settings-sec">
          <h5>Adicionar Aplicativo, Executável (.exe) ou Site</h5>
          <form class="add-form" data-add-app-form="true">
            <select name="iconId" style="max-width:140px">
              <option value="#i-code">Ícone: Código</option>
              <option value="#i-terminal">Ícone: Terminal</option>
              <option value="#i-browser">Ícone: Web</option>
              <option value="#i-folder">Ícone: Pasta</option>
              <option value="#i-music">Ícone: Música</option>
            </select>
            <input type="text" name="appLabel" placeholder="Nome (ex: Terminal)" style="max-width:145px" required />
            <input type="text" name="appTarget" placeholder="Executável ou URL (ex: wt.exe, code, https://...)" required />
            <button type="submit" class="btn-pop primary" style="flex:0 0 auto">+ Fixar App</button>
          </form>
          <p class="pop-sub" style="margin:6px 0 0">
            Dica: você também pode clicar com o <b>botão direito</b> em qualquer janela aberta no Dock e escolher <b>"📌 Fixar neste Ambiente"</b> para salvar com o ícone original do Windows!
          </p>
        </div>
      `;
    }

    this.popoverEl.innerHTML = `
      <div class="pop-head">
        <div>
          <span class="pop-kicker">PrimoDock · Substituto da Barra de Tarefas</span>
          <h4>Configurações & Personalização</h4>
        </div>
        <div style="display:flex;gap:6px">
          <button type="button" class="chip" style="border-color:#ef4444;color:#fca5a5" data-quit-dock="true">
            ⏻ Sair do Dock
          </button>
          <button type="button" class="chip" data-close-settings="true">✕</button>
        </div>
      </div>

      <div class="settings-tabs">
        <button type="button" class="chip ${this.activeSettingsTab === 'appearance' ? 'active' : ''}" data-settings-tab="appearance">
          ✨ Aparência & Temas
        </button>
        <button type="button" class="chip ${this.activeSettingsTab === 'screen' ? 'active' : ''}" data-settings-tab="screen">
          🖥️ Tela & Sistema
        </button>
        <button type="button" class="chip ${this.activeSettingsTab === 'environments' ? 'active' : ''}" data-settings-tab="environments">
          🚀 Ambientes & Apps
        </button>
      </div>

      ${tabBodyHtml}
    `;

    this.popoverEl.querySelectorAll<HTMLElement>('[data-settings-tab]').forEach((btn) => {
      btn.addEventListener('click', () => {
        this.activeSettingsTab = btn.dataset.settingsTab as SettingsTab;
        this.renderSettingsPopover();
        this.repositionActivePopover();
      });
    });

    this.popoverEl.querySelector('[data-close-settings]')?.addEventListener('click', () => {
      this.closePanels();
    });

    this.popoverEl.querySelector('[data-toggle-win-bar]')?.addEventListener('click', () => {
      this.nativeTaskbarHidden = !this.nativeTaskbarHidden;
      setNativeTaskbarHidden(this.nativeTaskbarHidden);
      this.renderSettingsPopover();
    });

    this.popoverEl.querySelector('[data-toggle-reflect]')?.addEventListener('click', () => {
      this.state.showReflections = !this.state.showReflections;
      savePersistentState(this.state);
      this.applyThemeAndVariables();
      this.renderSettingsPopover();
    });

    this.popoverEl.querySelector('[data-restore-windows]')?.addEventListener('click', () => {
      restoreWindowsTaskbar();
      this.nativeTaskbarHidden = false;
      // Leave "float" mode so the user keeps the restored taskbar/desktop until choosing
      // "reserve" or "autohide" again.
      this.state.dockScreenMode = 'float';
      savePersistentState(this.state);
      this.syncScreenModeToWindows();
      this.renderSettingsPopover();
    });

    this.popoverEl.querySelector('[data-reset-defaults]')?.addEventListener('click', () => {
      this.state.environments = cloneDefaultEnvironments();
      this.state.activeEnvId = 'work';
      this.state.themeId = 'native';
      this.state.iconSize = 48;
      this.state.magnification = 1.48;
      savePersistentState(this.state);
      this.renderAll();
    });

    this.popoverEl.querySelector('[data-quit-dock]')?.addEventListener('click', () => {
      quitAndRestoreTaskbar();
    });

    this.popoverEl.querySelectorAll<HTMLElement>('[data-set-screen-mode]').forEach((btn) => {
      btn.addEventListener('click', () => {
        this.state.dockScreenMode = btn.dataset.setScreenMode as DockScreenMode;
        savePersistentState(this.state);
        this.syncScreenModeToWindows();
        this.renderSettingsPopover();
      });
    });

    this.popoverEl.querySelectorAll<HTMLElement>('[data-set-env]').forEach((btn) => {
      btn.addEventListener('click', () => {
        this.switchEnvironment(btn.dataset.setEnv!);
        this.state.settingsOpen = true;
        this.renderAll();
      });
    });

    this.popoverEl.querySelectorAll<HTMLElement>('[data-set-theme]').forEach((btn) => {
      btn.addEventListener('click', () => {
        this.state.themeId = btn.dataset.setTheme as ThemeId;
        savePersistentState(this.state);
        this.renderAll();
      });
    });

    this.popoverEl.querySelectorAll<HTMLElement>('[data-set-pet]').forEach((btn) => {
      btn.addEventListener('click', () => {
        this.state.petType = btn.dataset.setPet as PetType;
        savePersistentState(this.state);
        this.renderAll();
      });
    });

    const sizeSlider = this.popoverEl.querySelector<HTMLInputElement>('[data-slider="size"]');
    sizeSlider?.addEventListener('input', () => {
      this.state.iconSize = Number(sizeSlider.value);
      savePersistentState(this.state);
      this.applyThemeAndVariables();
      this.syncScreenModeToWindows();
      const lbl = sizeSlider.previousElementSibling?.querySelector('b');
      if (lbl) lbl.textContent = `${this.state.iconSize}px`;
    });

    const magSlider = this.popoverEl.querySelector<HTMLInputElement>('[data-slider="mag"]');
    magSlider?.addEventListener('input', () => {
      this.state.magnification = Number(magSlider.value);
      savePersistentState(this.state);
      const lbl = magSlider.previousElementSibling?.querySelector('b');
      if (lbl) lbl.textContent = `${this.state.magnification.toFixed(2)}x`;
    });

    const addWidgetForm = this.popoverEl.querySelector<HTMLFormElement>('[data-add-widget-form]');
    addWidgetForm?.addEventListener('submit', (e) => {
      e.preventDefault();
      const fd = new FormData(addWidgetForm);
      const spec = String(fd.get('widgetSpec') || 'clock:1:Relógio');
      const [wType, spanStr, label] = spec.split(':');
      const env = this.getActiveEnv();
      env.items.push({
        id: 'w_' + Date.now(),
        kind: 'widget',
        label: label || wType.toUpperCase(),
        widgetType: wType as WidgetType,
        span: Number(spanStr) as 1 | 2 | 4,
      });
      savePersistentState(this.state);
      this.renderAll();
    });

    const addAppForm = this.popoverEl.querySelector<HTMLFormElement>('[data-add-app-form]');
    addAppForm?.addEventListener('submit', (e) => {
      e.preventDefault();
      const fd = new FormData(addAppForm);
      const iconId = String(fd.get('iconId') || '#i-code');
      const appLabel = String(fd.get('appLabel') || '').trim();
      const appTarget = String(fd.get('appTarget') || '').trim();
      if (!appLabel || !appTarget) return;

      const env = this.getActiveEnv();
      env.items.push({
        id: 'a_' + Date.now(),
        kind: 'app',
        label: appLabel,
        icon: iconId,
        target: appTarget,
        running: false,
      });
      savePersistentState(this.state);
      this.renderAll();
    });
  }

  private handleMusicControl(act: string): void {
    if (act === 'open-spotify') {
      const spotifyWin = this.openWindows.find((w) =>
        w.exe_name.toLowerCase().includes('spotify')
      );
      if (spotifyWin) {
        focusOrMinimizeWindow(spotifyWin.hwnd);
      } else {
        launchTarget('spotify:');
      }
      return;
    }

    if (act === 'toggle') {
      sendNativeMediaControl('play_pause');
      this.state.music.playing = !this.state.music.playing;
    } else if (act === 'next') {
      sendNativeMediaControl('next');
      if (!this.state.music.detected) {
        this.state.music.trackIndex = (this.state.music.trackIndex + 1) % PLAYLIST.length;
        this.state.music.progressSec = 0;
        this.state.music.playing = true;
      }
    } else if (act === 'prev') {
      sendNativeMediaControl('prev');
      if (!this.state.music.detected) {
        this.state.music.trackIndex =
          (this.state.music.trackIndex - 1 + PLAYLIST.length) % PLAYLIST.length;
        this.state.music.progressSec = 0;
        this.state.music.playing = true;
      }
    }

    this.syncAmbientSynth();
    this.updateLiveWidgetsInPlace(['music']);
    if (this.state.activePanelItemId) this.renderPopover();
  }

  /**
   * Plays a gentle WebAudio chime when a Pomodoro or Timer finishes!
   */
  private playTimerChime(): void {
    try {
      if (!this.audioCtx) {
        this.audioCtx = new AudioContext();
      }
      const ctx = this.audioCtx;
      const now = ctx.currentTime;
      [523.25, 659.25, 783.99].forEach((freq, idx) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, now + idx * 0.14);
        gain.gain.setValueAtTime(0.001, now + idx * 0.14);
        gain.gain.exponentialRampToValueAtTime(0.05, now + idx * 0.14 + 0.04);
        gain.gain.exponentialRampToValueAtTime(0.0001, now + idx * 0.14 + 0.65);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(now + idx * 0.14);
        osc.stop(now + idx * 0.14 + 0.7);
      });
    } catch {
      // Ignore audio errors
    }
  }

  private syncAmbientSynth(): void {
    if (this.synthTimer) {
      window.clearInterval(this.synthTimer);
      this.synthTimer = null;
    }
    if (!this.state.music.playing || !this.state.music.soundSynthEnabled) return;

    const playChord = () => {
      if (!this.state.music.playing || !this.state.music.soundSynthEnabled) return;
      if (!this.audioCtx) {
        this.audioCtx = new AudioContext();
      }
      const ctx = this.audioCtx;
      const track = PLAYLIST[this.state.music.trackIndex] || PLAYLIST[0];
      const base = track.freqBase;
      const ratios = [1, 1.25, 1.5, 1.875];
      const now = ctx.currentTime;

      ratios.forEach((r) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(base * r, now);
        gain.gain.setValueAtTime(0.001, now);
        gain.gain.exponentialRampToValueAtTime(0.018, now + 0.4);
        gain.gain.exponentialRampToValueAtTime(0.0001, now + 2.4);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(now);
        osc.stop(now + 2.5);
      });
    };

    playChord();
    this.synthTimer = window.setInterval(playChord, 2600);
  }

  private bindGlobalShortcuts(): void {
    window.addEventListener('keydown', (e) => {
      if (e.altKey && e.code === 'Space') {
        e.preventDefault();
        this.toggleCommandBar();
      } else if (e.altKey && ['1', '2', '3'].includes(e.key)) {
        e.preventDefault();
        const idx = Number(e.key) - 1;
        const env = this.state.environments[idx];
        if (env) this.switchEnvironment(env.id);
      } else if (e.key === 'Escape') {
        this.closePanels();
      }
    });
  }

  private startLiveLoops(): void {
    // 1. Epoch-accurate 1Hz loop for timers, clock hands, and local music progress (Zero unnecessary DOM rebuilds!)
    window.setInterval(() => {
      const nowMs = Date.now();

      if (this.state.pomodoro.running) {
        if (!this.state.pomodoro.endsAt) {
          this.state.pomodoro.endsAt = nowMs + this.state.pomodoro.remainingSec * 1000;
        }
        const rem = Math.max(0, Math.ceil((this.state.pomodoro.endsAt - nowMs) / 1000));
        this.state.pomodoro.remainingSec = rem;

        if (rem === 0) {
          this.playTimerChime();
          if (this.state.pomodoro.mode === 'focus') {
            this.state.pomodoro.cyclesCompleted += 1;
            const nextMode =
              this.state.pomodoro.cyclesCompleted % 4 === 0 ? 'long' : 'short';
            const nextSecs = nextMode === 'long' ? 15 * 60 : 5 * 60;
            this.state.pomodoro.mode = nextMode;
            this.state.pomodoro.totalSec = nextSecs;
            this.state.pomodoro.remainingSec = nextSecs;
            this.state.pomodoro.endsAt = nowMs + nextSecs * 1000;
          } else {
            const focusSecs = 25 * 60;
            this.state.pomodoro.mode = 'focus';
            this.state.pomodoro.totalSec = focusSecs;
            this.state.pomodoro.remainingSec = focusSecs;
            this.state.pomodoro.endsAt = nowMs + focusSecs * 1000;
          }
          if (this.state.activePanelItemId) this.renderPopover();
        }
      }

      if (this.state.timer.running) {
        if (!this.state.timer.endsAt) {
          this.state.timer.endsAt = nowMs + this.state.timer.remainingSec * 1000;
        }
        const rem = Math.max(0, Math.ceil((this.state.timer.endsAt - nowMs) / 1000));
        this.state.timer.remainingSec = rem;
        if (rem === 0) {
          this.state.timer.running = false;
          this.state.timer.endsAt = null;
          this.playTimerChime();
          if (this.state.activePanelItemId) this.renderPopover();
        }
      }

      if (this.state.music.playing) {
        if (!this.state.music.detected) {
          const track = PLAYLIST[this.state.music.trackIndex] || PLAYLIST[0];
          this.state.music.progressSec += 1;
          if (this.state.music.progressSec >= track.durationSec) {
            this.state.music.trackIndex = (this.state.music.trackIndex + 1) % PLAYLIST.length;
            this.state.music.progressSec = 0;
            this.updateLiveWidgetsInPlace(['music']);
          }
        } else {
          const maxDur = Math.max(30, this.state.music.durationSec || 180);
          if (this.state.music.progressSec < maxDur) {
            this.state.music.progressSec += 1;
          }
        }
      }

      // Check midnight rollover for daily water tracker
      const currentDayKey = todayDateKey();
      if (this.state.lastWaterDate !== currentDayKey) {
        this.state.lastWaterDate = currentDayKey;
        this.state.waterGlasses = 0;
        savePersistentState(this.state);
        this.updateLiveWidgetsInPlace(['water']);
      }

      this.updateTimersAndClockInPlace();
    }, 1000);

    // 2. Single-pass Desktop Snapshot (open Windows + Now Playing media in 1 EnumWindows pass!) every 1.5s
    const pollWindowsAndMedia = async () => {
      // The dock is invisible during fullscreen playback/gaming; skip the expensive EnumWindows
      // + media snapshot until the metrics poll reports that fullscreen ended.
      if (this.state.metrics.fullscreenActive) return;
      const { windows: wins, media } = await fetchDesktopSnapshot();

      const prevStructSig = this.openWindows
        .map((w) => `${w.hwnd}:${w.exe_name}:${w.icon_data_url ? 1 : 0}`)
        .join('|');
      const nextStructSig = wins
        .map((w) => `${w.hwnd}:${w.exe_name}:${w.icon_data_url ? 1 : 0}`)
        .join('|');

      const prevStateSig = this.openWindows
        .map((w) => `${w.hwnd}:${w.is_focused}:${w.is_minimized}:${w.title}`)
        .join('|');
      const nextStateSig = wins
        .map((w) => `${w.hwnd}:${w.is_focused}:${w.is_minimized}:${w.title}`)
        .join('|');

      this.openWindows = wins;

      if (prevStructSig !== nextStructSig) {
        this.renderDockItems();
      } else if (prevStateSig !== nextStateSig) {
        this.patchWindowsStateInPlace();
      }

      if (media && media.detected && media.title) {
        const songKey = `${media.artist} - ${media.title}`;
        const isNewSong =
          !this.state.music.detected ||
          this.state.music.title !== media.title ||
          this.state.music.artist !== media.artist;
        const changed = isNewSong || this.state.music.playing !== media.playing;

        this.state.music.detected = true;
        this.state.music.playing = media.playing;
        this.state.music.title = media.title;
        this.state.music.artist = media.artist || media.source_app;
        this.state.music.sourceApp = media.source_app;
        this.state.music.hwnd = media.hwnd;
        this.state.music.estimated = media.estimated !== false;

        if (typeof media.position_sec === 'number') {
          const reported = media.position_sec;
          // Some apps expose an SMTC session but keep Position at 0 (e.g. Chrome playing a local
          // file). Never rewind the local clock to 0 for a track that is already running.
          const canRewind = reported > 0 || isNewSong || this.state.music.progressSec <= 3;
          if (isNewSong || (canRewind && Math.abs(this.state.music.progressSec - reported) > 3)) {
            this.state.music.progressSec = reported;
          }
        }
        if (
          typeof media.duration_sec === 'number' &&
          media.duration_sec > 0 &&
          (isNewSong || this.state.music.durationSec <= 0)
        ) {
          this.state.music.durationSec = media.duration_sec;
        }

        const smtcArtwork =
          typeof media.artwork_data_url === 'string' ? sanitizeUrl(media.artwork_data_url) : '';
        if (smtcArtwork.startsWith('data:image/')) {
          // Windows SMTC gives the real artwork; skip the iTunes fallback for this track.
          const artworkChanged = this.state.music.artworkUrl !== smtcArtwork;
          this.state.music.artworkUrl = smtcArtwork;
          this.lastArtworkQuery = songKey;
          if (artworkChanged || changed) {
            this.updateLiveWidgetsInPlace(['music']);
            if (this.state.activePanelItemId) this.renderPopover();
          }
        } else if (songKey !== this.lastArtworkQuery) {
          this.lastArtworkQuery = songKey;
          fetchSongMetadata(media.artist, media.title).then((meta) => {
            this.state.music.artworkUrl = meta.artworkUrl;
            if (meta.durationSec > 0) {
              this.state.music.durationSec = meta.durationSec;
            }
            this.updateLiveWidgetsInPlace(['music']);
            if (this.state.activePanelItemId) this.renderPopover();
          });
        } else if (changed) {
          this.updateLiveWidgetsInPlace(['music']);
          if (this.state.activePanelItemId) this.renderPopover();
        }
      } else if (this.state.music.detected) {
        // Fix P0: Spotify / Media Player was closed — reset music state cleanly!
        this.state.music.detected = false;
        this.state.music.playing = this.state.music.soundSynthEnabled;
        this.state.music.title = 'Abra o Spotify ou dê Play';
        this.state.music.artist = 'Conectado ao controle de mídia do Windows';
        this.state.music.artworkUrl = '';
        this.state.music.hwnd = 0;
        this.state.music.progressSec = 0;
        this.state.music.durationSec = PLAYLIST[this.state.music.trackIndex]?.durationSec || 214;
        this.state.music.estimated = true;
        this.lastArtworkQuery = '';
        this.updateLiveWidgetsInPlace(['music']);
        if (this.state.activePanelItemId) this.renderPopover();
      }
    };
    pollWindowsAndMedia();
    window.setInterval(pollWindowsAndMedia, 1500);

    // 3. System metrics, native battery, fullscreen detection & auto-hide edge sensor poll every 900ms
    const pollMetrics = async () => {
      const prevCpu = this.state.metrics.cpuUsage;
      const prevRam = this.state.metrics.ramUsage;
      const prevBat = this.state.metrics.batteryLevel;

      this.state.metrics = await fetchSystemMetrics(this.state.metrics);
      this.updateAutoHideVisibility();

      const barWidth = this.dockBarEl.offsetWidth || 760;
      this.petController.updateConfig(
        this.state.petType,
        this.state.metrics.cpuUsage,
        barWidth
      );

      if (
        prevCpu !== this.state.metrics.cpuUsage ||
        prevRam !== this.state.metrics.ramUsage ||
        prevBat !== this.state.metrics.batteryLevel
      ) {
        this.updateLiveWidgetsInPlace(['activity', 'battery']);
      }
    };
    pollMetrics();
    window.setInterval(pollMetrics, 900);
  }

  private async refreshWeather(cityQuery?: string, allowIpLookup = false): Promise<void> {
    this.state.weather = await fetchLiveWeather(cityQuery || '', this.state.weather, {
      allowIpLookup,
    });
    savePersistentState(this.state);
    this.updateLiveWidgetsInPlace(['weather']);
    if (this.state.activePanelItemId) {
      this.renderPopover();
    }
  }

  private async refreshGithub(username: string): Promise<void> {
    this.state.github.loading = true;
    this.renderPopover();
    this.state.github = await fetchRealGithubData(username, this.state.github);
    savePersistentState(this.state);
    this.updateLiveWidgetsInPlace(['github']);
    if (this.state.activePanelItemId) {
      this.renderPopover();
    }
  }
}

const appRoot = document.getElementById('app');
if (appRoot) {
  new PrimoDockApp(appRoot);
}
