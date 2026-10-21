import './hub.css';
import { escapeHtml, sanitizeUrl } from '../security';
import {
  createInitialState,
  fetchRealGithubData,
  fetchSongMetadata,
  fetchWithTimeout,
  resetDailyIfNeeded,
  savePersistentState,
} from '../state';
import {
  checkForUpdates,
  clearHubAnchor,
  deleteSecret,
  fetchApiJson,
  fetchNowPlayingLight,
  fetchSystemMetrics,
  getSecret,
  hasSecret,
  isAutostartEnabled,
  launchTarget,
  quitAndRestoreTaskbar,
  reanchorHub,
  setAutostart,
  setHubAnchor,
  setHubHeight,
  setSecret,
  smtcControl,
} from '../tauri-bridge';
import { DockState } from '../types';

type PanelId = 'music' | 'github' | 'daily' | 'api' | 'settings';
type SmtcAction = 'toggle' | 'next' | 'prev' | 'play' | 'pause';

interface GithubItem {
  id: string;
  title: string;
  repo: string;
  reason: string;
  url: string;
}

interface GithubDashboard {
  unread: number;
  notifications: GithubItem[];
  assigned: GithubItem[];
  reviews: GithubItem[];
  error: string;
  loading: boolean;
}

function emptyGithubDashboard(): GithubDashboard {
  return {
    unread: 0,
    notifications: [],
    assigned: [],
    reviews: [],
    error: '',
    loading: false,
  };
}

function readPath(data: unknown, path: string): unknown {
  if (!path) return data;
  return path.split('.').reduce<unknown>((acc, key) => {
    if (acc && typeof acc === 'object' && key in (acc as Record<string, unknown>)) {
      return (acc as Record<string, unknown>)[key];
    }
    return undefined;
  }, data);
}

function formatApiValue(value: unknown): string {
  if (value === undefined || value === null) return '—';
  if (typeof value === 'object') {
    try {
      return JSON.stringify(value).slice(0, 48);
    } catch {
      return '—';
    }
  }
  return String(value).slice(0, 48);
}

const COLLAPSED_HEIGHT = 76;
const MAX_PANEL_HEIGHT = 360;

const GITHUB_ICON = `<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27s1.36.09 2 .27c1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.01 8.01 0 0 0 16 8c0-4.42-3.58-8-8-8Z" fill="currentColor"/></svg>`;

function formatTime(totalSeconds: number): string {
  const safe = Math.max(0, Math.floor(totalSeconds || 0));
  const minutes = Math.floor(safe / 60);
  const seconds = safe % 60;
  return `${minutes}:${String(seconds).padStart(2, '0')}`;
}

function todayLabel(): string {
  return new Date().toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' });
}

function makeId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID();
  }
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

class LemeHub {
  private readonly root: HTMLElement;
  private readonly state: DockState;
  private hubEl!: HTMLElement;
  private panelEl!: HTMLElement;
  private openPanel: PanelId | null = null;
  private lastArtworkQuery = '';
  private mediaBusy = false;
  private forceVisible = false;
  private lastFullscreen = false;
  private githubTokenConfigured = false;
  private githubDash: GithubDashboard = emptyGithubDashboard();
  private apiValue = '—';
  private apiLabel = '';
  private apiError = '';
  private apiLoading = false;
  private apiTokenConfigured = false;
  private updateStatus = '';
  private updateAvailable = '';
  private updateBusy = false;

  constructor(root: HTMLElement) {
    this.root = root;
    this.state = createInitialState();
    if (resetDailyIfNeeded(this.state)) {
      savePersistentState(this.state);
    }

    this.mount();
    this.bind();
    this.applyAppearance();
    this.renderPill();
    this.startLoops();
    this.listenTrayEvents();

    const anchor = this.state.hub.anchor;
    if (anchor) {
      void setHubAnchor(anchor.x, anchor.bottom);
    }

    if (this.state.github.username) {
      void this.refreshGithub(false);
    }

    void hasSecret('github-token').then((configured) => {
      this.githubTokenConfigured = configured;
      if (configured) void this.refreshGithubDashboard();
    });

    void hasSecret('api-token').then((configured) => {
      this.apiTokenConfigured = configured;
    });

    if (this.state.hub.showApi && this.state.hub.api.url) {
      void this.pollApi();
    }

    window.setTimeout(() => {
      if (this.state.hub.autoUpdate) void this.autoUpdate();
    }, 15_000);
  }

  private mount(): void {
    this.root.innerHTML = `
      <div class="hub" data-hub>
        <section class="panel" data-panel hidden></section>
        <div class="pill">
          <div class="grip" data-drag title="Arrastar o Leme">⠿</div>
          <div class="card music" data-open="music" role="button" tabindex="0" aria-label="Música">
            <div class="art-wrap" data-art-wrap>
              <img data-art alt="" hidden />
              <span class="art-fallback">♪</span>
            </div>
            <div class="meta">
              <strong data-title>Nada tocando</strong>
              <span data-artist>Dê play no Spotify ou no navegador</span>
            </div>
            <div class="mini-controls">
              <button type="button" data-smtc="prev" title="Anterior">⏮</button>
              <button type="button" class="play" data-smtc="toggle" title="Play/Pause"><span data-play-icon>▶</span></button>
              <button type="button" data-smtc="next" title="Próxima">⏭</button>
            </div>
            <div class="mini-progress"><i data-progress></i></div>
          </div>

          <div class="divider" data-div="1"></div>

          <div class="card github" data-open="github" role="button" tabindex="0" aria-label="GitHub">
            <span class="glyph">${GITHUB_ICON}</span>
            <div class="stat">
              <b data-gh-total>—</b>
              <span data-gh-label>GitHub</span>
            </div>
            <span class="gh-badge" data-gh-badge hidden>0</span>
          </div>

          <div class="divider" data-div="2"></div>

          <div class="card daily" data-open="daily" role="button" tabindex="0" aria-label="Tarefas do dia">
            <span class="ring" data-ring><b data-daily-count>0/0</b></span>
            <div class="stat">
              <b>Hoje</b>
            </div>
          </div>

          <div class="divider" data-div="3"></div>

          <div class="card api" data-open="api" role="button" tabindex="0" aria-label="API">
            <span class="glyph api-glyph">{ }</span>
            <div class="stat">
              <b data-api-value>—</b>
              <span data-api-name>API</span>
            </div>
          </div>

          <button type="button" class="gear" data-open="settings" title="Configurações" aria-label="Configurações">⚙</button>
        </div>
      </div>
    `;
    this.hubEl = this.root.querySelector<HTMLElement>('[data-hub]')!;
    this.panelEl = this.root.querySelector<HTMLElement>('[data-panel]')!;
  }

  private bind(): void {
    this.root.addEventListener('click', (event) => {
      const target = event.target as HTMLElement;

      const smtc = target.closest<HTMLElement>('[data-smtc]');
      if (smtc) {
        event.stopPropagation();
        void this.onSmtc(smtc.dataset.smtc as SmtcAction);
        return;
      }

      const openUrl = target.closest<HTMLElement>('[data-open-url]');
      if (openUrl) {
        const url = sanitizeUrl(openUrl.dataset.openUrl || '');
        if (url) void launchTarget(url);
        return;
      }

      if (target.closest('[data-gh-token-clear]')) {
        void this.clearGithubToken();
        return;
      }

      if (target.closest('[data-refresh-api]')) {
        void this.pollApi();
        return;
      }

      if (target.closest('[data-check-update]')) {
        void this.checkUpdates(false);
        return;
      }

      if (target.closest('[data-install-update]')) {
        void this.checkUpdates(true);
        return;
      }

      if (target.closest('[data-api-token-clear]')) {
        void this.clearApiToken();
        return;
      }

      if (target.closest('[data-close-panel]')) {
        void this.togglePanel(null);
        return;
      }

      const open = target.closest<HTMLElement>('[data-open]');
      if (open) {
        void this.togglePanel(open.dataset.open as PanelId);
        return;
      }

      const remove = target.closest<HTMLElement>('[data-task-del]');
      if (remove) {
        this.deleteTask(remove.dataset.taskDel || '');
        return;
      }

      const theme = target.closest<HTMLElement>('[data-theme-set]');
      if (theme) {
        this.setTheme(theme.dataset.themeSet === 'light' ? 'light' : 'dark');
        return;
      }

      if (target.closest('[data-refresh-gh]')) {
        void this.refreshGithub(true);
        void this.refreshGithubDashboard();
        return;
      }

      if (target.closest('[data-reset-position]')) {
        void this.resetPosition();
        return;
      }

      if (target.closest('[data-quit]')) {
        void quitAndRestoreTaskbar();
      }
    });

    this.root.addEventListener('pointerdown', (event) => {
      if ((event.target as HTMLElement).closest('[data-drag]')) {
        event.preventDefault();
        void this.beginDrag();
      }
    });

    this.root.addEventListener('change', (event) => {
      const target = event.target as HTMLInputElement;

      const taskToggle = target.closest<HTMLInputElement>('[data-task-toggle]');
      if (taskToggle) {
        this.toggleTask(taskToggle.dataset.taskToggle || '', taskToggle.checked);
        return;
      }

      const autostart = target.closest<HTMLInputElement>('[data-autostart]');
      if (autostart) {
        void this.onAutostartToggle(autostart.checked);
        return;
      }

      const hubToggle = target.closest<HTMLInputElement>('[data-hub-toggle]');
      if (hubToggle) {
        const key = hubToggle.dataset.hubToggle;
        if (key === 'showMusic' || key === 'showGithub' || key === 'showDaily' || key === 'showApi') {
          this.state.hub[key] = hubToggle.checked;
          savePersistentState(this.state);
          this.renderPill();
          this.renderPanel();
          if (key === 'showApi' && hubToggle.checked) {
            void this.pollApi();
          }
        } else if (key === 'showOverFullscreen') {
          this.state.hub.showOverFullscreen = hubToggle.checked;
          savePersistentState(this.state);
          this.applyFullscreenVisibility(this.state.metrics.fullscreenActive);
          this.renderPanel();
        } else if (key === 'autoUpdate') {
          this.state.hub.autoUpdate = hubToggle.checked;
          savePersistentState(this.state);
        }
      }
    });

    this.root.addEventListener('input', (event) => {
      const target = event.target as HTMLInputElement;
      const opacity = target.closest<HTMLInputElement>('[data-opacity]');
      if (opacity) {
        this.state.hub.opacity = Math.max(0.6, Math.min(1, Number(opacity.value) / 100));
        savePersistentState(this.state);
        this.applyAppearance();
      }
    });

    this.root.addEventListener('submit', (event) => {
      const form = (event.target as HTMLElement).closest('form');
      if (!form) return;

      if (form.matches('[data-daily-form]')) {
        event.preventDefault();
        const input = form.querySelector<HTMLInputElement>('input[name="task"]');
        this.addTask(input?.value || '');
        return;
      }

      if (form.matches('[data-gh-form]')) {
        event.preventDefault();
        const input = form.querySelector<HTMLInputElement>('input[name="username"]');
        const username = (input?.value || '').trim().replace(/^@/, '').slice(0, 40);
        this.state.github.username = username;
        savePersistentState(this.state);
        this.renderPill();
        void this.refreshGithub(true);
        return;
      }

      if (form.matches('[data-gh-token-form]')) {
        event.preventDefault();
        const input = form.querySelector<HTMLInputElement>('input[name="token"]');
        void this.saveGithubToken(input?.value || '');
        return;
      }

      if (form.matches('[data-api-form]')) {
        event.preventDefault();
        void this.saveApiConfig(form);
      }
    });

    this.root.addEventListener('keydown', (event) => {
      if (event.key === 'Escape' && this.openPanel) {
        event.preventDefault();
        void this.togglePanel(null);
        return;
      }
      if ((event.key === 'Enter' || event.key === ' ') && !this.openPanel) {
        const card = (event.target as HTMLElement).closest<HTMLElement>('[data-open]');
        if (card) {
          event.preventDefault();
          void this.togglePanel(card.dataset.open as PanelId);
        }
      }
    });
  }

  private startLoops(): void {
    void this.pollMedia();
    window.setInterval(() => void this.pollMedia(), 1500);
    window.setInterval(() => this.tickProgress(), 1000);
    window.setInterval(() => void this.pollMetrics(), 2000);
    window.setInterval(() => this.checkDay(), 60_000);
    window.setInterval(() => {
      if (this.githubTokenConfigured) void this.refreshGithubDashboard();
    }, 300_000);
    window.setInterval(() => {
      if (this.state.hub.showApi && this.state.hub.api.url) void this.pollApi();
    }, 60_000);
    window.setInterval(() => {
      if (this.state.hub.autoUpdate) void this.autoUpdate();
    }, 6 * 60 * 60 * 1000);
  }

  private applyAppearance(): void {
    document.documentElement.dataset.theme = this.state.hub.theme;
    document.documentElement.style.setProperty('--hub-alpha', this.state.hub.opacity.toFixed(2));
  }

  private renderPill(): void {
    const hub = this.state.hub;
    const musicCard = this.root.querySelector<HTMLElement>('[data-open="music"]');
    const githubCard = this.root.querySelector<HTMLElement>('[data-open="github"]');
    const dailyCard = this.root.querySelector<HTMLElement>('[data-open="daily"]');
    const apiCard = this.root.querySelector<HTMLElement>('[data-open="api"]');
    const div1 = this.root.querySelector<HTMLElement>('[data-div="1"]');
    const div2 = this.root.querySelector<HTMLElement>('[data-div="2"]');
    const div3 = this.root.querySelector<HTMLElement>('[data-div="3"]');

    if (musicCard) musicCard.style.display = hub.showMusic ? '' : 'none';
    if (githubCard) githubCard.style.display = hub.showGithub ? '' : 'none';
    if (dailyCard) dailyCard.style.display = hub.showDaily ? '' : 'none';
    if (apiCard) apiCard.style.display = hub.showApi ? '' : 'none';
    if (div1) {
      div1.style.display =
        hub.showMusic && (hub.showGithub || hub.showDaily || hub.showApi) ? '' : 'none';
    }
    if (div2) {
      div2.style.display = hub.showGithub && (hub.showDaily || hub.showApi) ? '' : 'none';
    }
    if (div3) {
      div3.style.display = hub.showDaily && hub.showApi ? '' : 'none';
    }

    if (
      this.openPanel &&
      ((this.openPanel === 'music' && !hub.showMusic) ||
        (this.openPanel === 'github' && !hub.showGithub) ||
        (this.openPanel === 'daily' && !hub.showDaily) ||
        (this.openPanel === 'api' && !hub.showApi))
    ) {
      void this.togglePanel(null);
    }

    const github = this.state.github;
    this.setAll('[data-gh-total]', github.username ? String(github.totalYear) : '—');
    this.setAll('[data-gh-label]', github.username ? 'ano' : 'Conectar GitHub');

    const ghBadge = this.root.querySelector<HTMLElement>('[data-gh-badge]');
    if (ghBadge) {
      const unread = this.githubDash.unread;
      ghBadge.hidden = unread <= 0;
      ghBadge.textContent = unread > 99 ? '99+' : String(unread);
    }

    this.setAll('[data-api-value]', this.apiValue || '—');
    this.setAll('[data-api-name]', this.state.hub.api.name || 'API');

    const tasks = this.state.daily.tasks;
    const done = tasks.filter((task) => task.done).length;
    const pct = tasks.length ? (done / tasks.length) * 100 : 0;
    this.setAll('[data-daily-count]', `${done}/${tasks.length}`);
    const ring = this.root.querySelector<HTMLElement>('[data-ring]');
    if (ring) ring.style.setProperty('--pct', String(pct));

    this.updateMusicVisuals();
  }

  private updateMusicVisuals(): void {
    const music = this.state.music;
    const title = music.detected ? music.title : 'Nada tocando';
    const artist = music.detected
      ? music.artist || music.sourceApp
      : 'Dê play no Spotify ou no navegador';
    this.root.querySelectorAll<HTMLElement>('[data-title]').forEach((el) => {
      el.textContent = title;
      el.title = title;
    });
    this.root.querySelectorAll<HTMLElement>('[data-artist]').forEach((el) => {
      el.textContent = artist;
      el.title = artist;
    });
    this.setAll('[data-source]', music.detected ? music.sourceApp || 'Windows SMTC' : 'Windows SMTC');
    this.setAll('[data-play-icon]', music.playing ? '⏸' : '▶');

    this.root.querySelectorAll<HTMLElement>('[data-estimated]').forEach((el) => {
      el.hidden = !music.detected || !music.estimated;
    });

    const art = sanitizeUrl(music.artworkUrl);
    this.root.querySelectorAll<HTMLImageElement>('img[data-art]').forEach((img) => {
      if (art) {
        if (img.getAttribute('src') !== art) img.src = art;
        img.hidden = false;
        img.parentElement?.classList.add('has-art');
      } else {
        img.hidden = true;
        img.removeAttribute('src');
        img.parentElement?.classList.remove('has-art');
      }
    });

    this.updateProgress();
  }

  private updateProgress(): void {
    const music = this.state.music;
    const total = Math.max(1, music.durationSec || 1);
    const current = Math.min(music.progressSec, total);
    const pct = Math.max(0, Math.min(100, (current / total) * 100));
    this.root.querySelectorAll<HTMLElement>('[data-progress]').forEach((el) => {
      el.style.width = `${pct}%`;
    });
    this.setAll('[data-time-current]', formatTime(current));
    this.setAll('[data-time-total]', formatTime(music.durationSec));
  }

  private setAll(selector: string, text: string): void {
    this.root.querySelectorAll<HTMLElement>(selector).forEach((el) => {
      el.textContent = text;
    });
  }

  private async togglePanel(panel: PanelId | null): Promise<void> {
    const next = this.openPanel === panel ? null : panel;
    this.openPanel = next;

    if (!next) {
      this.forceVisible = false;
      this.panelEl.hidden = true;
      this.panelEl.innerHTML = '';
      await setHubHeight(COLLAPSED_HEIGHT);
      this.applyFullscreenVisibility(this.state.metrics.fullscreenActive);
      return;
    }

    this.panelEl.hidden = false;
    this.panelEl.scrollTop = 0;
    this.renderPanel();
    // Snug window: panel content + pill + margins, so no invisible strip captures clicks.
    const panelHeight = Math.min(MAX_PANEL_HEIGHT, this.panelEl.scrollHeight);
    await setHubHeight(COLLAPSED_HEIGHT + panelHeight + 6);
    this.panelEl.querySelector<HTMLInputElement>('input')?.focus();
    if (next === 'github') {
      void this.refreshGithubDashboard();
    }
  }

  private renderPanel(): void {
    if (!this.openPanel) return;

    if (this.openPanel === 'music') {
      this.panelEl.innerHTML = `
        <div class="panel-head">
          <span>Reproduzindo agora</span>
          <div class="head-actions">
            <button type="button" data-close-panel aria-label="Fechar">✕</button>
          </div>
        </div>
        <div class="music-hero">
          <div class="art-wrap big" data-art-wrap>
            <img data-art alt="" hidden />
            <span class="art-fallback">♪</span>
          </div>
          <div class="music-meta">
            <span class="kicker" data-source>Windows SMTC</span>
            <h3 data-title>Nada tocando</h3>
            <p data-artist>Dê play no Spotify ou no navegador</p>
            <span class="estimated" data-estimated hidden>posição estimada</span>
          </div>
        </div>
        <div class="progress"><i data-progress></i></div>
        <div class="times"><span data-time-current>0:00</span><span data-time-total>0:00</span></div>
        <div class="controls">
          <button type="button" data-smtc="prev" title="Anterior">⏮</button>
          <button type="button" class="primary" data-smtc="toggle" title="Play/Pause"><span data-play-icon>▶</span></button>
          <button type="button" data-smtc="next" title="Próxima">⏭</button>
        </div>
        <p class="hint">Controles via Windows SMTC, na sessão ativa do player.</p>
      `;
      this.updateMusicVisuals();
      return;
    }

    if (this.openPanel === 'github') {
      const github = this.state.github;
      const avatar = sanitizeUrl(github.avatarUrl);
      const heatmap = this.heatmapHtml(github.contributions);
      this.panelEl.innerHTML = `
        <div class="panel-head">
          <span>GitHub</span>
          <div class="head-actions">
            <button type="button" data-refresh-gh>Atualizar</button>
            <button type="button" data-close-panel aria-label="Fechar">✕</button>
          </div>
        </div>
        <form class="gh-form" data-gh-form>
          <input type="text" name="username" placeholder="@seu-usuario" value="${escapeHtml(github.username)}" maxlength="40" autocomplete="off" />
          <button type="submit" class="btn-solid">${github.username ? 'Atualizar' : 'Conectar'}</button>
        </form>
        ${
          github.username
            ? `
              <div class="gh-profile">
                ${avatar ? `<img class="gh-avatar" src="${escapeHtml(avatar)}" alt="" />` : ''}
                <div>
                  <h3>@${escapeHtml(github.username)}</h3>
                  <p>${escapeHtml(github.latestEventText || 'Sem atividade recente')}</p>
                </div>
              </div>
              <div class="gh-stats">
                <div><b>${github.totalYear}</b><span>contribuições/ano</span></div>
                <div><b>${github.publicRepos}</b><span>repos públicos</span></div>
              </div>
              <div class="heatmap">${heatmap}</div>
            `
            : `<p class="hint">Conecte seu usuário para ver contribuições, repositórios e a última atividade.</p>`
        }
        <div class="gh-token-block">
          <div class="gh-list-block"><h5>Token pessoal</h5></div>
          <form class="gh-form" data-gh-token-form>
            <input type="password" name="token" placeholder="${this.githubTokenConfigured ? 'Token configurado — cole outro para substituir' : 'ghp_... (para notificações e PRs)'}" autocomplete="off" />
            <button type="submit" class="btn-ghost">Salvar</button>
          </form>
          ${this.githubTokenConfigured ? `<button type="button" class="btn-ghost" data-gh-token-clear>Remover token</button>` : ''}
          <p class="hint">Guardado no Windows Credential Manager; usado para ler notificações, itens atribuídos e revisões.</p>
        </div>
        ${this.renderGithubLists()}
        ${github.loading ? `<p class="hint">Carregando…</p>` : ''}
        ${github.error ? `<p class="error">${escapeHtml(github.error)}</p>` : ''}
      `;
      return;
    }

    if (this.openPanel === 'daily') {
      const tasks = this.state.daily.tasks;
      const done = tasks.filter((task) => task.done).length;
      const pct = tasks.length ? Math.round((done / tasks.length) * 100) : 0;
      const list = tasks.length
        ? tasks
            .map(
              (task) => `
                <li class="${task.done ? 'done' : ''}">
                  <label>
                    <input type="checkbox" data-task-toggle="${escapeHtml(task.id)}" ${task.done ? 'checked' : ''} />
                    <span>${escapeHtml(task.text)}</span>
                  </label>
                  <button type="button" data-task-del="${escapeHtml(task.id)}" title="Remover">×</button>
                </li>`
            )
            .join('')
        : `<li><span class="hint">Nenhuma tarefa ainda. Adicione a primeira acima.</span></li>`;

      this.panelEl.innerHTML = `
        <div class="panel-head">
          <span>Tarefas de hoje</span>
          <div class="head-actions">
            <span class="date">${escapeHtml(todayLabel())}</span>
            <button type="button" data-close-panel aria-label="Fechar">✕</button>
          </div>
        </div>
        <div class="daily-bar"><i style="width:${pct}%"></i></div>
        <form class="daily-form" data-daily-form>
          <input type="text" name="task" placeholder="Adicionar tarefa de hoje…" maxlength="160" autocomplete="off" />
          <button type="submit" class="btn-solid" aria-label="Adicionar">+</button>
        </form>
        <ul class="tasks">${list}</ul>
        <p class="hint">As tarefas recorrentes voltam desmarcadas amanhã.</p>
      `;
      return;
    }

    if (this.openPanel === 'api') {
      const cfg = this.state.hub.api;
      this.panelEl.innerHTML = `
        <div class="panel-head">
          <span>${escapeHtml(cfg.name || 'Widget de API')}</span>
          <div class="head-actions">
            <button type="button" data-refresh-api>Atualizar</button>
            <button type="button" data-close-panel aria-label="Fechar">✕</button>
          </div>
        </div>
        <div class="api-hero">
          <b data-api-hero>${escapeHtml(this.apiValue || '—')}</b>
          <span data-api-label>${escapeHtml(this.apiLabel)}</span>
        </div>
        <p class="error" data-api-error ${this.apiError ? '' : 'hidden'}>${escapeHtml(this.apiError)}</p>
        <form class="api-form" data-api-form>
          <input name="name" placeholder="Nome do widget" value="${escapeHtml(cfg.name)}" maxlength="40" />
          <input name="url" placeholder="https://api.exemplo.com/status" value="${escapeHtml(cfg.url)}" maxlength="500" />
          <input name="valuePath" placeholder="Caminho do valor (ex.: data.count)" value="${escapeHtml(cfg.valuePath)}" maxlength="120" />
          <input name="labelPath" placeholder="Caminho do rótulo (opcional)" value="${escapeHtml(cfg.labelPath)}" maxlength="120" />
          <input type="password" name="token" placeholder="${this.apiTokenConfigured ? 'Token configurado — cole outro para substituir' : 'Token (opcional)'}" autocomplete="off" />
          <button type="submit" class="btn-solid">Salvar e atualizar</button>
        </form>
        ${this.apiTokenConfigured ? '<button type="button" class="btn-ghost" data-api-token-clear>Remover token</button>' : ''}
        <p class="hint">Busca feita pelo Rust (sem CORS). O token fica no Windows Credential Manager.</p>
      `;
      return;
    }

    const hub = this.state.hub;
    this.panelEl.innerHTML = `
      <div class="panel-head">
        <span>Configurações</span>
        <button type="button" data-close-panel aria-label="Fechar">✕</button>
      </div>
      <div class="setting-row">
        <label>Tema</label>
        <div class="seg">
          <button type="button" data-theme-set="dark" class="${hub.theme === 'dark' ? 'active' : ''}">Escuro</button>
          <button type="button" data-theme-set="light" class="${hub.theme === 'light' ? 'active' : ''}">Claro</button>
        </div>
      </div>
      <div class="setting-row">
        <label>Opacidade</label>
        <input type="range" min="60" max="100" step="1" value="${Math.round(hub.opacity * 100)}" data-opacity />
      </div>
      ${this.toggleRow('showMusic', 'Música', hub.showMusic)}
      ${this.toggleRow('showGithub', 'GitHub', hub.showGithub)}
      ${this.toggleRow('showDaily', 'Tarefas', hub.showDaily)}
      ${this.toggleRow('showApi', 'Widget de API', hub.showApi)}
      ${this.toggleRow('showOverFullscreen', 'Mostrar sobre tela cheia', hub.showOverFullscreen)}
      <div class="setting-row">
        <label>Iniciar com o Windows</label>
        <input type="checkbox" data-autostart />
      </div>
      <div class="setting-row">
        <label>Posição</label>
        <button type="button" class="btn-ghost" data-reset-position>Reposicionar no canto</button>
      </div>
      <p class="hint">Arraste pela alça ⠿ à esquerda da pílula para mover o Leme.</p>
      <div class="setting-row">
        <label>Atualizações automáticas</label>
        <input type="checkbox" data-hub-toggle="autoUpdate" ${hub.autoUpdate ? 'checked' : ''} />
      </div>
      <div class="pomo-modes" style="margin-top:8px">
        <button type="button" class="btn-ghost" data-check-update ${this.updateBusy ? 'disabled' : ''}>Verificar atualizações</button>
        ${
          this.updateAvailable
            ? `<button type="button" class="btn-solid" data-install-update>Instalar ${escapeHtml(this.updateAvailable)}</button>`
            : ''
        }
      </div>
      <p class="hint" data-update-status>${escapeHtml(this.updateStatus)}</p>
      <button type="button" class="danger" data-quit>Sair do Leme</button>
      <p class="version">Leme 0.1.0 · a barra do Windows fica intacta</p>
    `;

    void isAutostartEnabled().then((enabled) => {
      const input = this.panelEl.querySelector<HTMLInputElement>('[data-autostart]');
      if (input) input.checked = enabled;
    });
  }

  private toggleRow(key: string, label: string, checked: boolean): string {
    return `
      <div class="setting-row">
        <label>${label}</label>
        <input type="checkbox" data-hub-toggle="${key}" ${checked ? 'checked' : ''} />
      </div>`;
  }

  private heatmapHtml(contributions: number[]): string {
    if (!contributions.length) return '';
    const max = Math.max(1, ...contributions);
    return contributions
      .map((value) => {
        const ratio = value / max;
        const level = value === 0 ? 0 : ratio < 0.25 ? 1 : ratio < 0.5 ? 2 : ratio < 0.75 ? 3 : 4;
        return `<i data-level="${level}" title="${value} contribuições"></i>`;
      })
      .join('');
  }

  private renderGithubLists(): string {
    if (!this.githubTokenConfigured) {
      return `<p class="hint">Conecte um token para ver notificações, itens atribuídos e revisões pendentes.</p>`;
    }
    if (this.githubDash.loading) return `<p class="hint">Carregando notificações…</p>`;
    if (this.githubDash.error) return `<p class="error">${escapeHtml(this.githubDash.error)}</p>`;

    const block = (title: string, items: GithubItem[]): string => {
      if (!items.length) return '';
      const rows = items
        .map(
          (item) => `
            <button type="button" class="gh-item" data-open-url="${escapeHtml(item.url)}" title="${escapeHtml(item.title)}">
              <b>${escapeHtml(item.title)}</b>
              <span>${escapeHtml(item.repo)}${item.reason ? ` · ${escapeHtml(item.reason)}` : ''}</span>
            </button>`
        )
        .join('');
      return `<div class="gh-list-block"><h5>${escapeHtml(title)}</h5>${rows}</div>`;
    };

    const html = [
      block(`Notificações (${this.githubDash.unread})`, this.githubDash.notifications),
      block(`Atribuídos (${this.githubDash.assigned.length})`, this.githubDash.assigned),
      block(`Revisões (${this.githubDash.reviews.length})`, this.githubDash.reviews),
    ].join('');

    return html || `<p class="hint">Nada pendente por aqui. 🎉</p>`;
  }

  private apiUrlToHtml(url: string): string {
    if (!url) return '';
    return sanitizeUrl(url.replace('https://api.github.com/', 'https://github.com/'));
  }

  private async refreshGithubDashboard(): Promise<void> {
    if (!this.githubTokenConfigured) {
      this.githubTokenConfigured = await hasSecret('github-token');
      if (!this.githubTokenConfigured) return;
    }

    this.githubDash.loading = true;
    this.githubDash.error = '';
    if (this.openPanel === 'github') this.renderPanel();

    try {
      const token = await getSecret('github-token');
      if (!token) throw new Error('Token não encontrado.');

      const headers: Record<string, string> = {
        Authorization: `Bearer ${token}`,
        Accept: 'application/vnd.github+json',
        'X-GitHub-Api-Version': '2022-11-28',
      };

      const results = await Promise.allSettled([
        fetchWithTimeout('https://api.github.com/notifications?all=false&per_page=20', 9000, {
          headers,
        }),
        fetchWithTimeout('https://api.github.com/issues?filter=assigned&state=open&per_page=10', 9000, {
          headers,
        }),
        fetchWithTimeout(
          'https://api.github.com/search/issues?q=is%3Aopen+is%3Apr+review-requested%3A%40me&per_page=10',
          9000,
          { headers }
        ),
      ]);

      const notificationsRes = results[0];
      if (notificationsRes.status === 'rejected') throw notificationsRes.reason;
      if (!notificationsRes.value.ok) {
        if (notificationsRes.value.status === 401) throw new Error('Token inválido ou expirado.');
        if (notificationsRes.value.status === 403) {
          throw new Error('Limite da API do GitHub atingido. Tente novamente em alguns minutos.');
        }
        throw new Error(`GitHub respondeu HTTP ${notificationsRes.value.status}.`);
      }

      const text = (value: unknown): string => (typeof value === 'string' ? value : '');

      const notificationsJson = (await notificationsRes.value.json()) as Array<
        Record<string, unknown>
      >;
      const notifications: GithubItem[] = notificationsJson.map((item) => {
        const subject = (item.subject ?? {}) as Record<string, unknown>;
        const repository = (item.repository ?? {}) as Record<string, unknown>;
        return {
          id: String(item.id ?? ''),
          title: text(subject.title) || '(sem título)',
          repo: text(repository.full_name),
          reason: text(item.reason),
          url: this.apiUrlToHtml(text(subject.url) || text(repository.html_url)),
        };
      });

      const assignedRes = results[1];
      const assignedJson =
        assignedRes.status === 'fulfilled' && assignedRes.value.ok
          ? ((await assignedRes.value.json()) as Array<Record<string, unknown>>)
          : [];
      const assigned: GithubItem[] = assignedJson.map((issue) => ({
        id: String(issue.id ?? ''),
        title: text(issue.title) || '(sem título)',
        repo: text(issue.repository_url).replace('https://api.github.com/repos/', ''),
        reason: issue.pull_request ? 'pull request' : 'issue',
        url: this.apiUrlToHtml(text(issue.html_url)),
      }));

      const reviewsRes = results[2];
      const reviewsPayload =
        reviewsRes.status === 'fulfilled' && reviewsRes.value.ok
          ? ((await reviewsRes.value.json()) as Record<string, unknown>)
          : {};
      const reviewsItems = Array.isArray(reviewsPayload.items)
        ? (reviewsPayload.items as Array<Record<string, unknown>>)
        : [];
      const reviews: GithubItem[] = reviewsItems.map((issue) => ({
        id: String(issue.id ?? ''),
        title: text(issue.title) || '(sem título)',
        repo: text(issue.repository_url).replace('https://api.github.com/repos/', ''),
        reason: 'revisão',
        url: this.apiUrlToHtml(text(issue.html_url)),
      }));

      this.githubDash = {
        unread: notifications.length,
        notifications,
        assigned,
        reviews,
        error: '',
        loading: false,
      };
    } catch (error) {
      this.githubDash = {
        ...emptyGithubDashboard(),
        error: error instanceof Error ? error.message : 'Falha ao consultar o GitHub.',
      };
    } finally {
      this.githubDash.loading = false;
      this.renderPill();
      if (this.openPanel === 'github') {
        const focused = document.activeElement;
        const typing = focused instanceof HTMLInputElement && this.panelEl.contains(focused);
        if (!typing) this.renderPanel();
      }
    }
  }

  private async saveGithubToken(token: string): Promise<void> {
    const clean = token.trim();
    if (!clean) return;

    const ok = await setSecret('github-token', clean);
    if (!ok) {
      this.githubDash.error = 'Não foi possível salvar o token no Credential Manager.';
      this.renderPanel();
      return;
    }

    this.githubTokenConfigured = true;
    this.githubDash = { ...emptyGithubDashboard(), loading: true };
    this.renderPanel();
    await this.refreshGithubDashboard();
  }

  private async clearGithubToken(): Promise<void> {
    await deleteSecret('github-token');
    this.githubTokenConfigured = false;
    this.githubDash = emptyGithubDashboard();
    this.renderPill();
    this.renderPanel();
  }

  private async saveApiConfig(form: HTMLFormElement): Promise<void> {
    const data = new FormData(form);
    const field = (name: string, max: number): string =>
      String(data.get(name) || '')
        .trim()
        .slice(0, max);

    this.state.hub.api = {
      name: field('name', 40) || 'API',
      url: field('url', 500),
      valuePath: field('valuePath', 120) || 'value',
      labelPath: field('labelPath', 120),
    };
    savePersistentState(this.state);

    const token = String(data.get('token') || '').trim();
    if (token) {
      this.apiTokenConfigured = await setSecret('api-token', token);
    }

    this.renderPill();
    this.renderPanel();
    await this.pollApi();
  }

  private async clearApiToken(): Promise<void> {
    await deleteSecret('api-token');
    this.apiTokenConfigured = false;
    this.renderPanel();
  }

  private async pollApi(): Promise<void> {
    const config = this.state.hub.api;
    if (!this.state.hub.showApi || !config.url) {
      this.apiValue = '—';
      this.apiLabel = '';
      this.apiError = '';
      this.updateApiVisuals();
      return;
    }

    this.apiLoading = true;
    this.apiError = '';
    this.updateApiVisuals();

    try {
      const token = await getSecret('api-token');
      const body = await fetchApiJson(config.url, token);
      const data = JSON.parse(body) as unknown;
      this.apiValue = formatApiValue(readPath(data, config.valuePath));
      this.apiLabel = config.labelPath ? formatApiValue(readPath(data, config.labelPath)) : '';
    } catch (error) {
      this.apiValue = '—';
      this.apiLabel = '';
      this.apiError = error instanceof Error ? error.message : 'Falha ao consultar a API.';
    } finally {
      this.apiLoading = false;
      this.updateApiVisuals();
      this.renderApiPanelIfOpen();
    }
  }

  private updateApiVisuals(): void {
    const value = this.apiLoading ? '…' : this.apiValue || '—';
    this.setAll('[data-api-value]', value);
    this.setAll('[data-api-name]', this.state.hub.api.name || 'API');
    this.setAll('[data-api-hero]', value);
    this.setAll('[data-api-label]', this.apiLabel || '');
    const error = this.root.querySelector<HTMLElement>('[data-api-error]');
    if (error) {
      error.textContent = this.apiError;
      error.hidden = !this.apiError;
    }
  }

  private renderApiPanelIfOpen(): void {
    if (this.openPanel !== 'api') return;
    const focused = document.activeElement;
    if (focused instanceof HTMLInputElement && this.panelEl.contains(focused)) return;
    this.renderPanel();
  }

  private async checkUpdates(install: boolean): Promise<void> {
    this.updateBusy = true;
    this.updateStatus = install ? 'Instalando atualização…' : 'Verificando atualizações…';
    if (this.openPanel === 'settings') this.renderPanel();

    try {
      const result = await checkForUpdates(install);
      if (result.startsWith('available:')) {
        this.updateAvailable = result.slice('available:'.length);
        this.updateStatus = `Versão ${this.updateAvailable} disponível.`;
      } else if (result.startsWith('installed:')) {
        this.updateAvailable = '';
        this.updateStatus = `Atualizado para ${result.slice('installed:'.length)}. Reiniciando…`;
      } else {
        this.updateAvailable = '';
        this.updateStatus = 'Você está na última versão.';
      }
    } catch (error) {
      this.updateStatus =
        error instanceof Error ? error.message : 'Falha ao verificar atualizações.';
    } finally {
      this.updateBusy = false;
      if (this.openPanel === 'settings') this.renderPanel();
    }
  }

  private async autoUpdate(): Promise<void> {
    try {
      const result = await checkForUpdates(true);
      if (result.startsWith('installed:')) {
        this.updateStatus = `Atualizado para ${result.slice('installed:'.length)}.`;
      }
    } catch {
      // Silent: the manual check surfaces errors.
    }
  }

  private async pollMedia(): Promise<void> {
    if (this.mediaBusy) return;
    this.mediaBusy = true;
    try {
      const media = await fetchNowPlayingLight();
      const music = this.state.music;
      const isNew =
        !music.detected || music.title !== media.title || music.artist !== media.artist;

      music.detected = media.detected;
      music.playing = media.playing;
      music.sourceApp = media.source_app;
      music.hwnd = media.hwnd;
      music.estimated = media.estimated !== false;

      if (media.detected) {
        music.title = media.title;
        music.artist = media.artist || media.source_app;

        if (media.duration_sec > 0 && (isNew || music.durationSec <= 0)) {
          music.durationSec = media.duration_sec;
        }
        if (typeof media.position_sec === 'number') {
          let reported = media.position_sec;
          if (music.durationSec > 0) {
            reported = Math.min(reported, music.durationSec);
          }
          const canRewind = reported > 0 || isNew || music.progressSec <= 3;
          if (isNew || (canRewind && Math.abs(music.progressSec - reported) > 3)) {
            music.progressSec = reported;
          }
        }

        const songKey = `${media.artist} - ${media.title}`;
        const smtcArt = sanitizeUrl(media.artwork_data_url || '');
        if (smtcArt.startsWith('data:image/')) {
          music.artworkUrl = smtcArt;
          this.lastArtworkQuery = songKey;
        } else if (songKey !== this.lastArtworkQuery) {
          this.lastArtworkQuery = songKey;
          fetchSongMetadata(media.artist, media.title).then((meta) => {
            if (meta.artworkUrl) music.artworkUrl = meta.artworkUrl;
            if (meta.durationSec > 0 && music.durationSec <= 0) {
              music.durationSec = meta.durationSec;
            }
            this.updateMusicVisuals();
          });
        }
      } else {
        music.title = '';
        music.artist = '';
        music.progressSec = 0;
        music.artworkUrl = '';
        this.lastArtworkQuery = '';
      }

      this.updateMusicVisuals();
    } finally {
      this.mediaBusy = false;
    }
  }

  private tickProgress(): void {
    const music = this.state.music;
    if (!music.detected || !music.playing) return;
    const total = Math.max(1, music.durationSec);
    music.progressSec = Math.min(total, music.progressSec + 1);
    this.updateProgress();
  }

  private async pollMetrics(): Promise<void> {
    this.state.metrics = await fetchSystemMetrics(this.state.metrics);
    this.applyFullscreenVisibility(this.state.metrics.fullscreenActive);
  }

  private applyFullscreenVisibility(fullscreen: boolean): void {
    if (fullscreen !== this.lastFullscreen) {
      this.lastFullscreen = fullscreen;
      // The shell changes the work area when a fullscreen app hides the taskbar; keep the
      // default anchor glued to the right corner when that happens.
      void reanchorHub();
    }

    const shouldHide = fullscreen && !this.state.hub.showOverFullscreen && !this.forceVisible;
    this.hubEl.classList.toggle('is-hidden', shouldHide);

    if (shouldHide && this.openPanel) {
      this.openPanel = null;
      this.panelEl.hidden = true;
      this.panelEl.innerHTML = '';
      void setHubHeight(COLLAPSED_HEIGHT);
    }
  }

  private listenTrayEvents(): void {
    void import('@tauri-apps/api/event')
      .then(({ listen }) =>
        listen('leme:open-settings', () => {
          this.forceVisible = true;
          this.hubEl.classList.remove('is-hidden');
          void this.togglePanel('settings');
        })
      )
      .catch(() => {
        // Preview mode: no Tauri event bus.
      });
  }

  private async beginDrag(): Promise<void> {
    try {
      const { getCurrentWindow } = await import('@tauri-apps/api/window');
      const win = getCurrentWindow();
      await win.startDragging();
      await new Promise((resolve) => window.setTimeout(resolve, 120));
      const position = await win.outerPosition();
      const size = await win.outerSize();
      const anchor = { x: position.x, bottom: position.y + size.height };
      this.state.hub.anchor = anchor;
      savePersistentState(this.state);
      await setHubAnchor(anchor.x, anchor.bottom);
    } catch {
      // Ignore (drag unavailable).
    }
  }

  private async resetPosition(): Promise<void> {
    this.state.hub.anchor = null;
    savePersistentState(this.state);
    await clearHubAnchor();
    this.renderPanel();
  }

  private async onAutostartToggle(enabled: boolean): Promise<void> {
    const ok = await setAutostart(enabled);
    if (!ok) {
      const input = this.panelEl.querySelector<HTMLInputElement>('[data-autostart]');
      if (input) input.checked = !enabled;
    }
  }

  private checkDay(): void {
    if (!resetDailyIfNeeded(this.state)) return;
    savePersistentState(this.state);
    this.renderPill();
    if (this.openPanel === 'daily') this.renderPanel();
  }

  private async onSmtc(action: SmtcAction): Promise<void> {
    if (!this.state.music.detected) return;
    if (action === 'toggle') {
      this.state.music.playing = !this.state.music.playing;
    } else if (action === 'next' || action === 'prev') {
      this.state.music.progressSec = 0;
    }
    this.updateMusicVisuals();
    await smtcControl(action);
  }

  private setTheme(theme: 'dark' | 'light'): void {
    this.state.hub.theme = theme;
    savePersistentState(this.state);
    this.applyAppearance();
    this.renderPill();
    this.renderPanel();
  }

  private async refreshGithub(render: boolean): Promise<void> {
    const username = this.state.github.username;
    if (!username) {
      if (render) this.renderPanel();
      return;
    }

    this.state.github.loading = true;
    if (render) this.renderPanel();

    this.state.github = await fetchRealGithubData(username, this.state.github);
    savePersistentState(this.state);
    this.renderPill();
    if (this.openPanel === 'github') this.renderPanel();
  }

  private addTask(raw: string): void {
    const text = raw.trim().slice(0, 160);
    if (!text) return;
    this.state.daily.tasks.push({ id: makeId(), text, done: false });
    savePersistentState(this.state);
    this.renderPill();
    this.renderPanel();
    this.panelEl.querySelector<HTMLInputElement>('input[name="task"]')?.focus();
  }

  private toggleTask(id: string, done: boolean): void {
    const task = this.state.daily.tasks.find((entry) => entry.id === id);
    if (!task) return;
    task.done = done;
    savePersistentState(this.state);
    this.renderPill();
    this.renderPanel();
  }

  private deleteTask(id: string): void {
    this.state.daily.tasks = this.state.daily.tasks.filter((task) => task.id !== id);
    savePersistentState(this.state);
    this.renderPill();
    this.renderPanel();
  }
}

const appRoot = document.getElementById('app');
if (appRoot) {
  new LemeHub(appRoot);
}
