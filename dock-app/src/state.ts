import {
  CalendarEventItem,
  DockItem,
  DockScreenMode,
  DockState,
  EnvironmentProfile,
  GithubProfileState,
  PetType,
  ReminderItem,
  ThemeId,
  TrackItem,
  WeatherData,
  WidgetSpan,
  WidgetType,
} from './types';
import { THEMES } from './themes';
import { isTauriRuntime } from './tauri-bridge';

const STORAGE_KEY = 'leme_state_v1';
export const SCHEMA_VERSION = 2;

const VALID_WIDGET_TYPES = new Set<WidgetType>([
  'pomodoro',
  'timer',
  'weather',
  'music',
  'battery',
  'activity',
  'calendar',
  'clock',
  'notes',
  'reminders',
  'github',
  'water',
]);

const VALID_PET_TYPES = new Set<PetType>(['cat', 'dog', 'dragon', 'ghost', 'none']);
const VALID_SCREEN_MODES = new Set<DockScreenMode>(['reserve', 'autohide', 'float']);

/**
 * Sanitizes any DOM / item ID so corrupted localStorage can never break CSS selectors or attributes.
 */
export function sanitizeDomId(id: unknown, fallback: string): string {
  if (typeof id !== 'string') return fallback;
  const cleaned = id.replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 64);
  return cleaned.length > 0 ? cleaned : fallback;
}

/**
 * Network helper with AbortController timeout to prevent hanging requests.
 */
export async function fetchWithTimeout(url: string, timeoutMs = 6500): Promise<Response> {
  const controller = new AbortController();
  const timer = globalThis.setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { signal: controller.signal });
  } finally {
    globalThis.clearTimeout(timer);
  }
}

export const PLAYLIST: TrackItem[] = [
  {
    title: 'Garota de Ipanema',
    artist: 'João e Astrud',
    durationSec: 214,
    freqBase: 261.63,
    colors: ['#ffd18a', '#f08a6c', '#2e4a7d'],
  },
  {
    title: 'Midnight Lo-Fi Study',
    artist: 'Leme Beats',
    durationSec: 186,
    freqBase: 293.66,
    colors: ['#a78bfa', '#ec4899', '#1e1b4b'],
  },
  {
    title: 'Águas de Março',
    artist: 'Elis & Tom',
    durationSec: 212,
    freqBase: 329.63,
    colors: ['#6ee7b7', '#059669', '#064e3b'],
  },
  {
    title: 'Cyberpunk Horizon',
    artist: 'Neon Synth',
    durationSec: 240,
    freqBase: 220.0,
    colors: ['#22d3ee', '#f43f5e', '#090d16'],
  },
];

export const CITIES: Record<string, { lat: number; lon: number; name: string }> = {
  'São Paulo': { lat: -23.5505, lon: -46.6333, name: 'São Paulo' },
  'Rio de Janeiro': { lat: -22.9068, lon: -43.1729, name: 'Rio de Janeiro' },
  Curitiba: { lat: -25.4284, lon: -49.2733, name: 'Curitiba' },
  'Belo Horizonte': { lat: -19.9167, lon: -43.9345, name: 'Belo Horizonte' },
  Brasília: { lat: -15.7975, lon: -47.8919, name: 'Brasília' },
  Lisboa: { lat: 38.7223, lon: -9.1393, name: 'Lisboa' },
};

export function inferIconForWindow(title: string, exeName = ''): string {
  const t = (title + ' ' + exeName).toLowerCase();
  if (
    t.includes('code.exe') ||
    t.includes('visual studio') ||
    t.includes('antigravity') ||
    t.includes('cursor') ||
    t.includes('.ts') ||
    t.includes('.rs')
  ) {
    return '#i-code';
  }
  if (
    t.includes('windowsterminal') ||
    t.includes('powershell') ||
    t.includes('cmd.exe') ||
    t.includes('terminal') ||
    t.includes('prompt')
  ) {
    return '#i-terminal';
  }
  if (
    t.includes('chrome.exe') ||
    t.includes('msedge.exe') ||
    t.includes('firefox.exe') ||
    t.includes('brave.exe') ||
    t.includes('opera.exe')
  ) {
    return '#i-browser';
  }
  if (t.includes('spotify') || t.includes('music')) {
    return '#i-music';
  }
  if (t.includes('explorer.exe') || t.includes('explorador')) {
    return '#i-folder';
  }
  if (t.includes('notepad') || t.includes('bloco de notas') || t.includes('obsidian') || t.includes('notion')) {
    return '#i-notes';
  }
  if (t.includes('whatsapp') || t.includes('discord') || t.includes('slack') || t.includes('teams') || t.includes('telegram')) {
    return '#i-chat';
  }
  if (t.includes('figma') || t.includes('photoshop') || t.includes('canva')) {
    return '#i-design';
  }
  return '#i-finder';
}

export const DEFAULT_ENVIRONMENTS: EnvironmentProfile[] = [
  {
    id: 'work',
    name: 'Trabalho',
    description: 'Editor, terminal e janelas abertas do Windows, com Pomodoro, Clima, Spotify e seu GitHub.',
    color: '#6670F5',
    shortcut: 'Alt+1',
    items: [
      { id: 'w-start', kind: 'app', label: 'Iniciar do Windows', icon: '#i-start', target: '__START_MENU__' },
      { id: 'w-finder', kind: 'app', label: 'Explorador de Arquivos', icon: '#i-finder', target: 'explorer.exe', running: true },
      { id: 'w-term', kind: 'app', label: 'Terminal', icon: '#i-terminal', target: 'wt.exe', running: true },
      { id: 'w-sep1', kind: 'separator', label: 'Separador' },
      { id: 'w-pomo', kind: 'widget', label: 'Pomodoro', widgetType: 'pomodoro', span: 1 },
      { id: 'w-cal', kind: 'widget', label: 'Minha Agenda', widgetType: 'calendar', span: 1 },
      { id: 'w-weather', kind: 'widget', label: 'Meu Clima', widgetType: 'weather', span: 2 },
      { id: 'w-music', kind: 'widget', label: 'Spotify / Mídia do Sistema', widgetType: 'music', span: 4 },
      { id: 'w-github', kind: 'widget', label: 'Meu GitHub', widgetType: 'github', span: 4 },
      { id: 'w-act', kind: 'widget', label: 'CPU & RAM', widgetType: 'activity', span: 2 },
    ],
  },
  {
    id: 'study',
    name: 'Estudos',
    description: 'Navegador, caderno de notas, timer de foco e lembretes.',
    color: '#F59E0B',
    shortcut: 'Alt+2',
    items: [
      { id: 's-start', kind: 'app', label: 'Iniciar do Windows', icon: '#i-start', target: '__START_MENU__' },
      { id: 's-browser', kind: 'app', label: 'Navegador', icon: '#i-browser', target: 'https://developer.mozilla.org', running: true },
      { id: 's-notes-app', kind: 'app', label: 'Bloco de Notas', icon: '#i-notes', target: 'notepad.exe', running: false },
      { id: 's-sep1', kind: 'separator', label: 'Separador' },
      { id: 's-clock', kind: 'widget', label: 'Relógio & Progresso', widgetType: 'clock', span: 1 },
      { id: 's-timer', kind: 'widget', label: 'Timer de Estudo', widgetType: 'timer', span: 1 },
      { id: 's-rem', kind: 'widget', label: 'Lembretes', widgetType: 'reminders', span: 2 },
      { id: 's-note', kind: 'widget', label: 'Nota Rápida', widgetType: 'notes', span: 1 },
      { id: 's-water', kind: 'widget', label: 'Hidratação', widgetType: 'water', span: 2 },
    ],
  },
  {
    id: 'weekend',
    name: 'Casa / Lazer',
    description: 'Spotify, fotos, projetos pessoais e clima.',
    color: '#22C55E',
    shortcut: 'Alt+3',
    items: [
      { id: 'k-start', kind: 'app', label: 'Iniciar do Windows', icon: '#i-start', target: '__START_MENU__' },
      { id: 'k-photos', kind: 'app', label: 'Fotos', icon: '#i-photos', target: 'ms-photos:', running: false },
      { id: 'k-browser', kind: 'app', label: 'YouTube', icon: '#i-browser', target: 'https://youtube.com', running: true },
      { id: 'k-sep1', kind: 'separator', label: 'Separador' },
      { id: 'k-music', kind: 'widget', label: 'Spotify / Música', widgetType: 'music', span: 4 },
      { id: 'k-github', kind: 'widget', label: 'Meu GitHub', widgetType: 'github', span: 4 },
      { id: 'k-weather', kind: 'widget', label: 'Clima', widgetType: 'weather', span: 2 },
      { id: 'k-trash', kind: 'app', label: 'Lixeira', icon: '#i-trash', target: 'shell:RecycleBinFolder' },
    ],
  },
];

function generateDefaultHeatmap(): number[] {
  return new Array(182).fill(0);
}

export function todayDateKey(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export function cloneDefaultEnvironments(): EnvironmentProfile[] {
  return JSON.parse(JSON.stringify(DEFAULT_ENVIRONMENTS));
}

function sanitizeDockItem(raw: unknown, idx: number): DockItem | null {
  if (!raw || typeof raw !== 'object') return null;
  const obj = raw as Record<string, unknown>;
  const kind = obj.kind;
  if (kind !== 'app' && kind !== 'widget' && kind !== 'separator') return null;

  const id = sanitizeDomId(obj.id, `item_${idx}`);
  const label = typeof obj.label === 'string' && obj.label.trim() ? obj.label.trim().slice(0, 80) : 'Item';
  const spanRaw = Number(obj.span);
  const span: WidgetSpan = spanRaw === 4 ? 4 : spanRaw === 2 ? 2 : 1;

  if (kind === 'separator') {
    return { id, kind: 'separator', label };
  }
  if (kind === 'widget') {
    const wt = obj.widgetType as WidgetType;
    const widgetType: WidgetType = VALID_WIDGET_TYPES.has(wt) ? wt : 'clock';
    return { id, kind: 'widget', label, widgetType, span };
  }
  return {
    id,
    kind: 'app',
    label,
    icon: typeof obj.icon === 'string' && obj.icon ? obj.icon : '#i-finder',
    target: typeof obj.target === 'string' ? obj.target.slice(0, 512) : '',
    running: Boolean(obj.running),
  };
}

function sanitizeEnvironments(rawEnvs: unknown): EnvironmentProfile[] {
  if (!Array.isArray(rawEnvs) || rawEnvs.length === 0) {
    return cloneDefaultEnvironments();
  }
  const validated: EnvironmentProfile[] = [];
  for (let i = 0; i < rawEnvs.length; i++) {
    const e = rawEnvs[i];
    if (!e || typeof e !== 'object') continue;
    const envObj = e as Record<string, unknown>;
    const id = sanitizeDomId(envObj.id, `env_${i}`);
    const name = typeof envObj.name === 'string' && envObj.name.trim() ? envObj.name.trim().slice(0, 40) : `Ambiente ${i + 1}`;
    const description = typeof envObj.description === 'string' ? envObj.description.slice(0, 160) : '';
    const color = typeof envObj.color === 'string' && /^#[0-9a-fA-F]{3,8}$/.test(envObj.color) ? envObj.color : '#6670F5';
    const shortcut = typeof envObj.shortcut === 'string' ? envObj.shortcut.slice(0, 16) : `Alt+${i + 1}`;

    const rawItems = Array.isArray(envObj.items) ? envObj.items : [];
    const items: DockItem[] = [];
    const seenIds = new Set<string>();
    for (let j = 0; j < rawItems.length; j++) {
      const sanitized = sanitizeDockItem(rawItems[j], j);
      if (!sanitized) continue;
      let uniqueId = sanitized.id;
      if (seenIds.has(uniqueId)) {
        uniqueId = `${uniqueId}_${j}`;
      }
      seenIds.add(uniqueId);
      items.push({ ...sanitized, id: uniqueId });
    }
    if (items.length > 0) {
      validated.push({ id, name, description, color, shortcut, items });
    }
  }
  return validated.length > 0 ? validated : cloneDefaultEnvironments();
}

function sanitizeReminders(raw: unknown, fallback: ReminderItem[]): ReminderItem[] {
  if (!Array.isArray(raw)) return fallback;
  const out: ReminderItem[] = [];
  for (let i = 0; i < raw.length; i++) {
    const r = raw[i];
    if (!r || typeof r !== 'object') continue;
    const obj = r as Record<string, unknown>;
    if (typeof obj.text !== 'string' || !obj.text.trim()) continue;
    out.push({
      id: sanitizeDomId(obj.id, `rem_${i}`),
      text: obj.text.trim().slice(0, 200),
      done: Boolean(obj.done),
      time: typeof obj.time === 'string' ? obj.time.slice(0, 24) : 'Hoje',
    });
  }
  return out;
}

function sanitizeCalendarEvents(raw: unknown, fallback: CalendarEventItem[]): CalendarEventItem[] {
  if (!Array.isArray(raw)) return fallback;
  const out: CalendarEventItem[] = [];
  for (let i = 0; i < raw.length; i++) {
    const ev = raw[i];
    if (!ev || typeof ev !== 'object') continue;
    const obj = ev as Record<string, unknown>;
    if (typeof obj.title !== 'string' || !obj.title.trim()) continue;
    out.push({
      id: sanitizeDomId(obj.id, `ev_${i}`),
      title: obj.title.trim().slice(0, 120),
      time: typeof obj.time === 'string' && obj.time.trim() ? obj.time.trim().slice(0, 16) : '09:00',
      link: typeof obj.link === 'string' && obj.link.trim() ? obj.link.trim().slice(0, 300) : undefined,
    });
  }
  return out;
}

export function createDefaultState(): DockState {
  const today = todayDateKey();
  return {
    activeEnvId: 'work',
    environments: cloneDefaultEnvironments(),
    themeId: 'native',
    petType: 'cat',
    dockScreenMode: 'reserve',
    iconSize: 48,
    magnification: 1.48,
    showReflections: true,
    desktopSimulatorBg: 'aurora',
    isOverlayMode: isTauriRuntime(),
    activePanelItemId: null,
    settingsOpen: false,

    pomodoro: {
      running: false,
      mode: 'focus',
      remainingSec: 25 * 60,
      totalSec: 25 * 60,
      endsAt: null,
      cyclesCompleted: 0,
    },
    timer: {
      running: false,
      remainingSec: 15 * 60,
      totalSec: 15 * 60,
      endsAt: null,
    },
    music: {
      detected: false,
      sourceApp: 'Spotify',
      playing: false,
      title: 'Abra o Spotify ou dê Play',
      artist: 'Conectado ao controle de mídia do Windows',
      artworkUrl: '',
      hwnd: 0,
      trackIndex: 0,
      progressSec: 0,
      durationSec: 214,
      estimated: true,
      soundSynthEnabled: false,
    },
    weather: {
      city: 'São Paulo',
      temp: 24,
      feelsLike: 25,
      condition: 'Céu limpo',
      isDay: true,
      high: 27,
      low: 19,
      forecast: [
        { day: 'Hoje', tempMax: 27, tempMin: 19, icon: 'sun' },
        { day: 'Amanhã', tempMax: 26, tempMin: 18, icon: 'cloud' },
        { day: 'Dia 3', tempMax: 24, tempMin: 17, icon: 'rain' },
        { day: 'Dia 4', tempMax: 28, tempMin: 20, icon: 'sun' },
      ],
    },
    metrics: {
      cpuUsage: 12,
      ramUsage: 45,
      ramUsedGb: 7.2,
      ramTotalGb: 16,
      batteryLevel: 100,
      batteryCharging: true,
      batteryTimeRemaining: 'Sincronizando...',
      cursorReveal: true,
      fullscreenActive: false,
    },
    noteText: 'Minhas anotações rápidas no Dock...',
    reminders: [
      { id: 'r1', text: 'Conectar meu @username do GitHub no widget', done: false, time: 'Hoje' },
      { id: 'r2', text: 'Pressionar Alt + Espaço para testar o Command Bar', done: false, time: 'Hoje' },
    ],
    calendarEvents: [
      { id: 'ev1', title: 'Daily / Alinhamento', time: '10:00', link: 'https://meet.google.com' },
      { id: 'ev2', title: 'Bloco de Foco Profundo', time: '14:00' },
    ],
    waterGlasses: 0,
    waterGoal: 8,
    lastWaterDate: today,
    github: {
      username: '',
      avatarUrl: '',
      totalYear: 0,
      contributions: generateDefaultHeatmap(),
      publicRepos: 0,
      latestEventText: 'Clique para conectar seu @username do GitHub',
      loading: false,
      error: '',
    },
  };
}

/**
 * Validates and migrates any persisted JSON object from localStorage into a safe DockState.
 */
export function validateAndMigrateSavedState(
  rawSaved: unknown,
  baseState: DockState = createDefaultState()
): DockState {
  if (!rawSaved || typeof rawSaved !== 'object') {
    return baseState;
  }
  const saved = rawSaved as Record<string, unknown>;
  const version = typeof saved.version === 'number' ? saved.version : 1;
  if (version > SCHEMA_VERSION) {
    // Future unknown version: fall back safely
    return baseState;
  }

  const today = todayDateKey();
  const environments = sanitizeEnvironments(saved.environments);
  const requestedEnvId = typeof saved.activeEnvId === 'string' ? sanitizeDomId(saved.activeEnvId, '') : '';
  const activeEnvId = environments.some((e) => e.id === requestedEnvId)
    ? requestedEnvId
    : environments[0].id;

  const themeId: ThemeId =
    typeof saved.themeId === 'string' && Object.prototype.hasOwnProperty.call(THEMES, saved.themeId)
      ? (saved.themeId as ThemeId)
      : baseState.themeId;

  const petType: PetType =
    typeof saved.petType === 'string' && VALID_PET_TYPES.has(saved.petType as PetType)
      ? (saved.petType as PetType)
      : baseState.petType;

  const dockScreenMode: DockScreenMode =
    typeof saved.dockScreenMode === 'string' && VALID_SCREEN_MODES.has(saved.dockScreenMode as DockScreenMode)
      ? (saved.dockScreenMode as DockScreenMode)
      : baseState.dockScreenMode;

  const rawIconSize = Number(saved.iconSize);
  const iconSize = Number.isFinite(rawIconSize)
    ? Math.max(36, Math.min(64, Math.round(rawIconSize)))
    : baseState.iconSize;

  const rawMag = Number(saved.magnification);
  const magnification = Number.isFinite(rawMag)
    ? Math.max(1.0, Math.min(1.75, Number(rawMag.toFixed(2))))
    : baseState.magnification;

  const showReflections =
    typeof saved.showReflections === 'boolean' ? saved.showReflections : baseState.showReflections;

  const noteText =
    typeof saved.noteText === 'string' ? saved.noteText.slice(0, 8000) : baseState.noteText;

  const isSameDay = saved.lastWaterDate === today;
  const rawGlasses = Number(saved.waterGlasses);
  const waterGlasses =
    isSameDay && Number.isFinite(rawGlasses) && rawGlasses >= 0
      ? Math.min(50, Math.floor(rawGlasses))
      : 0;

  const rawGoal = Number(saved.waterGoal);
  const waterGoal =
    Number.isFinite(rawGoal) && rawGoal >= 1 && rawGoal <= 30
      ? Math.floor(rawGoal)
      : baseState.waterGoal;

  const weatherCity =
    typeof saved.weatherCity === 'string' && saved.weatherCity.trim()
      ? saved.weatherCity.trim().slice(0, 80)
      : baseState.weather.city;

  const githubUsername =
    typeof saved.githubUsername === 'string'
      ? saved.githubUsername.trim().replace(/^@/, '').slice(0, 40)
      : '';

  return {
    ...baseState,
    activeEnvId,
    environments,
    themeId,
    petType,
    dockScreenMode,
    iconSize,
    magnification,
    showReflections,
    noteText,
    reminders: sanitizeReminders(saved.reminders, baseState.reminders),
    calendarEvents: sanitizeCalendarEvents(saved.calendarEvents, baseState.calendarEvents),
    waterGlasses,
    waterGoal,
    lastWaterDate: today,
    weather: {
      ...baseState.weather,
      city: weatherCity,
    },
    github: {
      ...baseState.github,
      username: githubUsername,
    },
  };
}

export function createInitialState(): DockState {
  const defaultState = createDefaultState();
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      return validateAndMigrateSavedState(parsed, defaultState);
    }
  } catch {
    // Ignore storage read errors
  }
  return defaultState;
}

export function savePersistentState(state: DockState): void {
  try {
    const subset = {
      version: SCHEMA_VERSION,
      activeEnvId: state.activeEnvId,
      environments: state.environments,
      themeId: state.themeId,
      petType: state.petType,
      dockScreenMode: state.dockScreenMode,
      iconSize: state.iconSize,
      magnification: state.magnification,
      showReflections: state.showReflections,
      noteText: state.noteText,
      reminders: state.reminders,
      calendarEvents: state.calendarEvents,
      waterGlasses: state.waterGlasses,
      waterGoal: state.waterGoal,
      lastWaterDate: state.lastWaterDate || todayDateKey(),
      weatherCity: state.weather.city !== 'Detectando...' ? state.weather.city : undefined,
      githubUsername: state.github.username,
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(subset));
  } catch {
    // Ignore
  }
}

export interface SongMetadata {
  artworkUrl: string;
  durationSec: number;
}

/**
 * Fetches real album artwork AND real track duration (seconds) via iTunes Search API with AbortController timeout.
 */
const songMetaCache = new Map<string, SongMetadata>();
export async function fetchSongMetadata(artist: string, title: string): Promise<SongMetadata> {
  const query = `${artist} ${title}`.trim();
  if (!query || query.includes('Pausado')) {
    return { artworkUrl: '', durationSec: 180 };
  }
  if (songMetaCache.has(query)) return songMetaCache.get(query)!;

  try {
    const url = `https://itunes.apple.com/search?term=${encodeURIComponent(query)}&entity=song&limit=1`;
    const res = await fetchWithTimeout(url, 5500);
    if (!res.ok) return { artworkUrl: '', durationSec: 180 };
    const data = await res.json();
    const hit = data.results?.[0];
    const artworkUrl = typeof hit?.artworkUrl100 === 'string' ? hit.artworkUrl100 : '';
    const durationMs = Number(hit?.trackTimeMillis);
    const durationSec =
      Number.isFinite(durationMs) && durationMs > 10_000
        ? Math.round(durationMs / 1000)
        : 180;
    const meta = { artworkUrl, durationSec };
    if (artworkUrl) songMetaCache.set(query, meta);
    return meta;
  } catch {
    return { artworkUrl: '', durationSec: 180 };
  }
}

export async function fetchSongArtwork(artist: string, title: string): Promise<string> {
  const meta = await fetchSongMetadata(artist, title);
  return meta.artworkUrl;
}

/**
 * Fetches REAL GitHub profile, contribution heatmap, and latest public commits/PRs for any GitHub username!
 * Properly distinguishes HTTP 403/429 (rate-limit) from HTTP 404 (not found) and network timeouts.
 */
export async function fetchRealGithubData(
  username: string,
  current: GithubProfileState
): Promise<GithubProfileState> {
  const cleanUser = username.trim().replace(/^@/, '');
  if (!cleanUser) {
    return {
      ...current,
      username: '',
      error: '',
      loading: false,
    };
  }

  try {
    const [userRes, contribRes, eventsRes] = await Promise.all([
      fetchWithTimeout(`https://api.github.com/users/${encodeURIComponent(cleanUser)}`, 6500),
      fetchWithTimeout(
        `https://github-contributions-api.jogruber.de/v4/${encodeURIComponent(cleanUser)}?y=last`,
        6500
      ),
      fetchWithTimeout(
        `https://api.github.com/users/${encodeURIComponent(cleanUser)}/events/public?per_page=5`,
        6500
      ),
    ]);

    if (!userRes.ok) {
      let errorMsg = `Erro HTTP ${userRes.status} ao consultar o GitHub.`;
      if (userRes.status === 404) {
        errorMsg = `Usuário "${cleanUser}" não encontrado no GitHub.`;
      } else if (userRes.status === 403 || userRes.status === 429) {
        errorMsg =
          'Limite de requisições da API do GitHub atingido (HTTP 403). Aguarde alguns minutos.';
      }
      return {
        ...current,
        username: cleanUser,
        loading: false,
        error: errorMsg,
      };
    }

    const userData = await userRes.json();
    let totalYear = current.totalYear;
    let contributions = current.contributions;

    if (contribRes.ok) {
      const contribData = await contribRes.json();
      totalYear = Number(contribData.total?.lastYear ?? contribData.total ?? 0);
      const list: { level: number }[] = contribData.contributions || [];
      if (list.length > 0) {
        contributions = list.slice(-182).map((c) => Number(c.level || 0));
      }
    }

    let latestEventText = `@${cleanUser} · ${userData.public_repos ?? 0} repositórios públicos`;
    if (eventsRes.ok) {
      const events = await eventsRes.json();
      if (Array.isArray(events) && events.length > 0) {
        const ev = events[0];
        const repoName = ev.repo?.name || '';
        const commitMsg = ev.payload?.commits?.[0]?.message?.split('\n')[0] || '';
        if (commitMsg) {
          latestEventText = `Último commit em ${repoName}: "${commitMsg}"`;
        } else if (ev.type && repoName) {
          latestEventText = `${ev.type.replace('Event', '')} em ${repoName}`;
        }
      }
    }

    return {
      username: cleanUser,
      avatarUrl: userData.avatar_url || '',
      totalYear,
      contributions,
      publicRepos: Number(userData.public_repos ?? 0),
      latestEventText,
      loading: false,
      error: '',
    };
  } catch (err) {
    const isAbort = err instanceof Error && err.name === 'AbortError';
    return {
      ...current,
      username: cleanUser,
      loading: false,
      error: isAbort
        ? 'Tempo limite esgotado ao consultar o GitHub.'
        : 'Sem conexão para atualizar o GitHub agora.',
    };
  }
}

/**
 * Fetches live weather for a preset city, a searched city via Open-Meteo Geocoding,
 * or IP geolocation ONLY when the user explicitly opts in (`options.allowIpLookup === true`).
 */
export async function fetchLiveWeather(
  cityQuery: string,
  fallback: WeatherData,
  options?: { allowIpLookup?: boolean }
): Promise<WeatherData> {
  let lat = -23.5505;
  let lon = -46.6333;
  let resolvedCity = cityQuery && cityQuery !== 'Detectando...' ? cityQuery : 'São Paulo';

  try {
    if (options?.allowIpLookup) {
      // Explicit user opt-in to detect city by IP
      const ipRes = await fetchWithTimeout('https://ipwho.is/', 5500);
      if (ipRes.ok) {
        const ipData = await ipRes.json();
        if (ipData.city && ipData.latitude && ipData.longitude) {
          lat = Number(ipData.latitude);
          lon = Number(ipData.longitude);
          resolvedCity = String(ipData.city);
        }
      }
    } else if (CITIES[resolvedCity]) {
      lat = CITIES[resolvedCity].lat;
      lon = CITIES[resolvedCity].lon;
      resolvedCity = CITIES[resolvedCity].name;
    } else if (resolvedCity) {
      // Geocode any city typed by the user!
      const geoUrl = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(resolvedCity)}&count=1&language=pt&format=json`;
      const geoRes = await fetchWithTimeout(geoUrl, 5500);
      if (geoRes.ok) {
        const geoData = await geoRes.json();
        const hit = geoData.results?.[0];
        if (hit) {
          lat = Number(hit.latitude);
          lon = Number(hit.longitude);
          resolvedCity = String(hit.name);
        }
      }
    }

    const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,apparent_temperature,is_day,weather_code&daily=weather_code,temperature_2m_max,temperature_2m_min&timezone=auto&forecast_days=4`;
    const res = await fetchWithTimeout(url, 6500);
    if (!res.ok) return { ...fallback, city: resolvedCity };
    const data = await res.json();

    const code = Number(data.current?.weather_code ?? 0);
    const condition =
      code === 0
        ? 'Céu limpo'
        : code <= 3
        ? 'Parcialmente nublado'
        : code <= 48
        ? 'Neblina'
        : code <= 67
        ? 'Chuva leve'
        : 'Tempestade';

    const days = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
    const forecast = (data.daily?.time || []).slice(0, 4).map((iso: string, idx: number) => {
      const d = new Date(iso + 'T12:00:00');
      const wCode = Number(data.daily?.weather_code?.[idx] ?? 0);
      const icon: 'sun' | 'cloud' | 'rain' = wCode === 0 ? 'sun' : wCode <= 3 ? 'cloud' : 'rain';
      return {
        day: days[d.getDay()] || 'Dia',
        tempMax: Math.round(data.daily?.temperature_2m_max?.[idx] ?? 26),
        tempMin: Math.round(data.daily?.temperature_2m_min?.[idx] ?? 19),
        icon,
      };
    });

    return {
      city: resolvedCity || 'São Paulo',
      temp: Math.round(data.current?.temperature_2m ?? fallback.temp),
      feelsLike: Math.round(data.current?.apparent_temperature ?? fallback.feelsLike),
      condition,
      isDay: Boolean(data.current?.is_day ?? 1),
      high: forecast[0]?.tempMax ?? 28,
      low: forecast[0]?.tempMin ?? 20,
      forecast: forecast.length ? forecast : fallback.forecast,
    };
  } catch {
    return { ...fallback, city: resolvedCity || 'São Paulo' };
  }
}
