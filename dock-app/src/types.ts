export type ThemeId =
  | 'native'
  | 'midnight'
  | 'rocket'
  | 'aqua'
  | 'neon'
  | 'canarinho'
  | 'paper'
  | 'floating'
  | 'halloween'
  | 'haunted-night'
  | 'candy-corn'
  | 'christmas'
  | 'snowy-night'
  | 'candy-cane';

export type PetType = 'cat' | 'dog' | 'dragon' | 'ghost' | 'none';

export type DockScreenMode = 'reserve' | 'autohide' | 'float';

export type WidgetType =
  | 'pomodoro'
  | 'timer'
  | 'weather'
  | 'music'
  | 'battery'
  | 'activity'
  | 'calendar'
  | 'clock'
  | 'notes'
  | 'reminders'
  | 'github'
  | 'water';

export type WidgetSpan = 1 | 2 | 4;

export interface DockItem {
  id: string;
  kind: 'app' | 'widget' | 'separator';
  label: string;
  icon?: string;
  target?: string;
  running?: boolean;
  widgetType?: WidgetType;
  span?: WidgetSpan;
}

export interface EnvironmentProfile {
  id: string;
  name: string;
  description: string;
  color: string;
  shortcut: string;
  themeOverride?: ThemeId;
  items: DockItem[];
}

export interface ReminderItem {
  id: string;
  text: string;
  done: boolean;
  time: string;
}

export interface CalendarEventItem {
  id: string;
  title: string;
  time: string;
  link?: string;
}

export interface WeatherData {
  city: string;
  temp: number;
  feelsLike: number;
  condition: string;
  isDay: boolean;
  high: number;
  low: number;
  forecast: { day: string; tempMax: number; tempMin: number; icon: 'sun' | 'cloud' | 'rain' }[];
}

export interface SystemMetrics {
  cpuUsage: number;
  ramUsage: number;
  ramUsedGb: number;
  ramTotalGb: number;
  batteryLevel: number;
  batteryCharging: boolean;
  batteryTimeRemaining: string;
  cursorReveal: boolean;
  fullscreenActive: boolean;
}

export interface TrackItem {
  title: string;
  artist: string;
  durationSec: number;
  freqBase: number;
  colors: [string, string, string];
}

export interface LiveMediaState {
  detected: boolean;
  sourceApp: string;
  playing: boolean;
  title: string;
  artist: string;
  artworkUrl: string;
  hwnd: number;
  // Real or fallback timeline (in seconds)
  trackIndex: number;
  progressSec: number;
  durationSec: number;
  /** `true` only when the timeline came from the title heuristic, not from Windows SMTC. */
  estimated: boolean;
  soundSynthEnabled: boolean;
}

export interface GithubProfileState {
  username: string;
  avatarUrl: string;
  totalYear: number;
  contributions: number[];
  publicRepos: number;
  latestEventText: string;
  loading: boolean;
  error: string;
}

export interface DailyTask {
  id: string;
  text: string;
  done: boolean;
}

export interface DailyState {
  /** Local day (`YYYY-MM-DD`) the checklist belongs to. */
  date: string;
  tasks: DailyTask[];
}

export interface HubAnchor {
  x: number;
  bottom: number;
}

export interface HubSettings {
  theme: 'dark' | 'light';
  opacity: number;
  showMusic: boolean;
  showGithub: boolean;
  showDaily: boolean;
  showOverFullscreen: boolean;
  anchor: HubAnchor | null;
}

export interface DockState {
  activeEnvId: string;
  environments: EnvironmentProfile[];
  themeId: ThemeId;
  petType: PetType;
  dockScreenMode: DockScreenMode;
  iconSize: number;
  magnification: number;
  showReflections: boolean;
  desktopSimulatorBg: string;
  isOverlayMode: boolean;
  activePanelItemId: string | null;
  settingsOpen: boolean;

  pomodoro: {
    running: boolean;
    mode: 'focus' | 'short' | 'long';
    remainingSec: number;
    totalSec: number;
    endsAt: number | null;
    cyclesCompleted: number;
  };
  timer: {
    running: boolean;
    remainingSec: number;
    totalSec: number;
    endsAt: number | null;
  };
  music: LiveMediaState;
  weather: WeatherData;
  metrics: SystemMetrics;
  noteText: string;
  reminders: ReminderItem[];
  calendarEvents: CalendarEventItem[];
  waterGlasses: number;
  waterGoal: number;
  lastWaterDate: string;
  github: GithubProfileState;
  daily: DailyState;
  hub: HubSettings;
}
