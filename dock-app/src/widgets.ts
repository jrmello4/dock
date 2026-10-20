import { escapeAttr, escapeHtml, sanitizeUrl } from './security';
import { CITIES, PLAYLIST } from './state';
import { DockItem, DockState } from './types';

function formatTime(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

export function renderDockWidgetMarkup(item: DockItem, state: DockState): string {
  const wType = item.widgetType || 'clock';
  const safeId = escapeAttr(item.id);

  switch (wType) {
    case 'pomodoro': {
      const { remainingSec, totalSec, mode } = state.pomodoro;
      const pct = Math.max(0, Math.min(1, remainingSec / Math.max(1, totalSec)));
      const circ = 106.8;
      const dash = (pct * circ).toFixed(1);
      const strokeColor = mode === 'focus' ? '#ff9500' : '#22c55e';
      return `
        <svg viewBox="0 0 64 64" class="tile-svg">
          <rect x="6.3" y="6.3" width="51.5" height="51.5" rx="11.6" fill="url(#gShellTimer)"/>
          <rect x="6.3" y="6.3" width="51.5" height="51.5" rx="11.6" fill="none" stroke="#fff" stroke-opacity=".14"/>
          <circle cx="32" cy="32" r="17" fill="none" stroke="#fff" stroke-opacity=".12" stroke-width="3.9"/>
          <circle cx="32" cy="32" r="17" fill="none" stroke="${strokeColor}" stroke-width="3.9" stroke-linecap="round"
            stroke-dasharray="${dash} ${circ}" transform="rotate(-90 32 32)"/>
          <text x="32" y="35.5" text-anchor="middle" fill="#fff" font-size="10.2" font-weight="600"
            font-family="ui-rounded, -apple-system, system-ui, sans-serif">${formatTime(remainingSec)}</text>
        </svg>
      `;
    }

    case 'timer': {
      const { remainingSec, totalSec } = state.timer;
      const pct = Math.max(0, Math.min(1, remainingSec / Math.max(1, totalSec)));
      const circ = 106.8;
      const dash = (pct * circ).toFixed(1);
      return `
        <svg viewBox="0 0 64 64" class="tile-svg">
          <rect x="6.3" y="6.3" width="51.5" height="51.5" rx="11.6" fill="url(#gShellClock)"/>
          <rect x="6.3" y="6.3" width="51.5" height="51.5" rx="11.6" fill="none" stroke="#fff" stroke-opacity=".14"/>
          <circle cx="32" cy="32" r="17" fill="none" stroke="#fff" stroke-opacity=".12" stroke-width="3.9"/>
          <circle cx="32" cy="32" r="17" fill="none" stroke="#38bdf8" stroke-width="3.9" stroke-linecap="round"
            stroke-dasharray="${dash} ${circ}" transform="rotate(-90 32 32)"/>
          <text x="32" y="35.5" text-anchor="middle" fill="#fff" font-size="10.2" font-weight="600"
            font-family="ui-rounded, -apple-system, system-ui, sans-serif">${formatTime(remainingSec)}</text>
        </svg>
      `;
    }

    case 'calendar': {
      const now = new Date();
      const weekdays = ['DOM', 'SEG', 'TER', 'QUA', 'QUI', 'SEX', 'SÁB'];
      const wDay = weekdays[now.getDay()];
      const dayNum = now.getDate();
      return `
        <svg viewBox="0 0 64 64" class="tile-svg">
          <rect x="6.3" y="6.3" width="51.5" height="51.5" rx="11.6" fill="#fff"/>
          <path d="M6.3 17.9C6.3 11.5 11.5 6.3 17.9 6.3H46.2C52.6 6.3 57.8 11.5 57.8 17.9V20.3H6.3V17.9Z" fill="#ff3b30"/>
          <text x="32" y="16.8" text-anchor="middle" fill="#fff" font-size="8.6" font-weight="700"
            font-family="-apple-system, system-ui, sans-serif">${wDay}</text>
          <text x="32" y="48.5" text-anchor="middle" fill="#1f1f1f" font-size="26" font-weight="500"
            font-family="-apple-system, system-ui, sans-serif">${dayNum}</text>
          <rect x="6.3" y="6.3" width="51.5" height="51.5" rx="11.6" fill="none" stroke="#000" stroke-opacity=".1"/>
        </svg>
      `;
    }

    case 'clock': {
      const now = new Date();
      const sec = now.getSeconds();
      const min = now.getMinutes() + sec / 60;
      const hr = (now.getHours() % 12) + min / 60;
      const hrAngle = hr * 30;
      const minAngle = min * 6;
      const secAngle = sec * 6;
      return `
        <svg viewBox="0 0 64 64" class="tile-svg">
          <rect x="6.3" y="6.3" width="51.5" height="51.5" rx="11.6" fill="url(#gShellClock)"/>
          <rect x="6.3" y="6.3" width="51.5" height="51.5" rx="11.6" fill="none" stroke="#fff" stroke-opacity=".14"/>
          <circle cx="32" cy="32" r="17.5" fill="#fff"/>
          <g stroke="#000" stroke-linecap="round">
            <path d="M32 16.5v2.8M47.5 32h-2.8M32 47.5v-2.8M16.5 32h2.8" stroke-opacity=".65" stroke-width="1.2"/>
            <line x1="32" y1="32" x2="32" y2="22.5" stroke-width="2.6" transform="rotate(${hrAngle.toFixed(1)} 32 32)"/>
            <line x1="32" y1="32" x2="32" y2="19" stroke-width="1.9" transform="rotate(${minAngle.toFixed(1)} 32 32)"/>
          </g>
          <line x1="32" y1="34" x2="32" y2="18.5" stroke="#ff3b30" stroke-width="1.1" stroke-linecap="round"
            transform="rotate(${secAngle} 32 32)"/>
          <circle cx="32" cy="32" r="1.7" fill="#ff3b30"/>
        </svg>
      `;
    }

    case 'notes': {
      return `
        <svg viewBox="0 0 64 64" class="tile-svg">
          <rect x="6.3" y="6.3" width="51.5" height="51.5" rx="9" fill="url(#gShellNote)"/>
          <rect x="6.3" y="6.3" width="51.5" height="51.5" rx="9" fill="none" stroke="#000" stroke-opacity=".14"/>
          <g fill="#000" fill-opacity=".75">
            <rect x="13" y="16" width="32" height="3.4" rx="1.7"/>
            <rect x="13" y="24.5" width="37" height="3.4" rx="1.7"/>
            <rect x="13" y="33" width="26" height="3.4" rx="1.7"/>
            <rect x="13" y="41.5" width="33" height="3.4" rx="1.7"/>
          </g>
        </svg>
      `;
    }

    case 'weather': {
      const { temp, city } = state.weather;
      return `
        <div class="w-card weather">
          <svg class="glyph sun" viewBox="0 0 24 24" aria-hidden="true">
            <circle cx="12" cy="12" r="5" fill="#ffcf5c"/>
            <g stroke="#ffcf5c" stroke-width="1.8" stroke-linecap="round">
              <path d="M12 1.5v3M12 19.5v3M1.5 12h3M19.5 12h3M4.6 4.6l2.1 2.1M17.3 17.3l2.1 2.1M19.4 4.6l-2.1 2.1M6.7 17.3l-2.1 2.1"/>
            </g>
          </svg>
          <span class="stack">
            <b class="num">${Number(temp)}°</b>
            <span class="sub">${escapeHtml(city)}</span>
          </span>
        </div>
      `;
    }

    case 'battery': {
      const { batteryLevel, batteryTimeRemaining, batteryCharging } = state.metrics;
      const fillWidth = Math.max(2, Math.round((batteryLevel / 100) * 19));
      const fillColor = batteryCharging ? '#4ade80' : batteryLevel <= 20 ? '#ef4444' : '#ffffff';
      return `
        <div class="w-card battery">
          <svg class="glyph" viewBox="0 0 30 16" aria-hidden="true">
            <rect x="0.7" y="0.7" width="25" height="14.6" rx="4.6" fill="none" stroke="#fff" stroke-opacity=".55" stroke-width="1.4"/>
            <rect x="3" y="3" width="${fillWidth}" height="10" rx="2.6" fill="${fillColor}"/>
            <path d="M27.4 5.4v5.2a3.2 3.2 0 0 0 0-5.2z" fill="#fff" fill-opacity=".55"/>
          </svg>
          <span class="stack">
            <b class="num">${Number(batteryLevel)}%</b>
            <span class="sub">${escapeHtml(batteryTimeRemaining)}</span>
          </span>
        </div>
      `;
    }

    case 'activity': {
      const { cpuUsage, ramUsage } = state.metrics;
      const c1 = 75.4;
      const c2 = 50.2;
      const dCpu = ((cpuUsage / 100) * c1).toFixed(1);
      const dRam = ((ramUsage / 100) * c2).toFixed(1);
      return `
        <div class="w-card activity">
          <svg class="rings" viewBox="0 0 32 32" aria-hidden="true">
            <circle cx="16" cy="16" r="12" fill="none" stroke="#fa114f" stroke-opacity=".24" stroke-width="3.2"/>
            <circle cx="16" cy="16" r="12" fill="none" stroke="#fa114f" stroke-width="3.2" stroke-linecap="round"
              stroke-dasharray="${dCpu} ${c1}" transform="rotate(-90 16 16)"/>
            <circle cx="16" cy="16" r="8" fill="none" stroke="#a6ff00" stroke-opacity=".24" stroke-width="3.2"/>
            <circle cx="16" cy="16" r="8" fill="none" stroke="#a6ff00" stroke-width="3.2" stroke-linecap="round"
              stroke-dasharray="${dRam} ${c2}" transform="rotate(-90 16 16)"/>
          </svg>
          <span class="stack">
            <b class="num">CPU ${Number(cpuUsage)}%</b>
            <span class="sub">RAM ${Number(ramUsage)}%</span>
          </span>
        </div>
      `;
    }

    case 'music': {
      const fallbackTrack = PLAYLIST[state.music.trackIndex] || PLAYLIST[0];
      const rawTitle = state.music.detected ? state.music.title : fallbackTrack.title;
      const rawArtist = state.music.detected ? state.music.artist : fallbackTrack.artist;
      const totalDuration = Math.max(
        1,
        state.music.detected
          ? state.music.durationSec || 180
          : fallbackTrack.durationSec
      );
      const pct = Math.min(100, Math.round((state.music.progressSec / totalDuration) * 100));
      const [c0, c1, c2] = fallbackTrack.colors;
      const safeArtUrl = sanitizeUrl(state.music.artworkUrl);

      const artMarkup = safeArtUrl
        ? `<img src="${escapeAttr(safeArtUrl)}" class="art-img" alt="Capa" />`
        : `<svg viewBox="0 0 40 40">
            <defs>
              <linearGradient id="artGrad_${safeId}" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0" stop-color="${c0}"/>
                <stop offset=".55" stop-color="${c1}"/>
                <stop offset="1" stop-color="${c2}"/>
              </linearGradient>
            </defs>
            <rect width="40" height="40" fill="url(#artGrad_${safeId})"/>
            <circle cx="27" cy="14" r="5.4" fill="#fff7e6" opacity=".92"/>
            <path d="M0 27q10 -4 20 0t20 0v13H0z" fill="#1d3763" opacity=".85"/>
            <path d="M0 31q10 3 20 0t20 0v9H0z" fill="#12244a"/>
          </svg>`;

      return `
        <div class="w-card music ${state.music.playing ? 'is-playing' : ''}">
          <span class="art" aria-hidden="true">${artMarkup}</span>
          <span class="stack grow">
            <b class="track">
              <span class="eq-bars" aria-hidden="true"><i></i><i></i><i></i></span>
              <span class="track-txt">${escapeHtml(rawTitle)}</span>
            </b>
            <span class="sub">${escapeHtml(rawArtist)}</span>
            <span class="line"><i style="width:${Math.round(pct)}%"></i></span>
          </span>
          <span class="keys" data-music-controls="true">
            <button type="button" class="m-btn" data-music-act="prev" title="Faixa Anterior (Tecla Mídia)">
              <svg viewBox="0 0 12 12"><path d="M10 1.6 4.4 6 10 10.4z"/><rect x="2" y="1.6" width="1.5" height="8.8" rx=".7"/></svg>
            </button>
            <button type="button" class="m-btn" data-music-act="toggle" title="${state.music.playing ? 'Pausar' : 'Tocar'} (Spotify / Sistema)">
              ${
                state.music.playing
                  ? '<svg viewBox="0 0 12 12"><rect x="2.5" y="1.8" width="2.4" height="8.4" rx=".8"/><rect x="7.1" y="1.8" width="2.4" height="8.4" rx=".8"/></svg>'
                  : '<svg viewBox="0 0 12 12"><path d="M2.6 1.4 10 6l-7.4 4.6z"/></svg>'
              }
            </button>
            <button type="button" class="m-btn" data-music-act="next" title="Próxima Faixa (Tecla Mídia)">
              <svg viewBox="0 0 12 12"><path d="M2 1.6 7.6 6 2 10.4z"/><rect x="8.5" y="1.6" width="1.5" height="8.8" rx=".7"/></svg>
            </button>
          </span>
        </div>
      `;
    }

    case 'github': {
      const gh = state.github;
      const cellsHtml = gh.contributions
        .map((lvl) => `<i data-l="${Number(lvl) || 0}"></i>`)
        .join('');
      const hasUser = Boolean(gh.username);
      const topLabel = hasUser ? gh.totalYear.toLocaleString('pt-BR') : 'GitHub';
      const subLabel = hasUser ? `@${escapeHtml(gh.username)}` : 'Conectar @';
      return `
        <div class="w-card github">
          <span class="stack">
            <b class="num">${topLabel}</b>
            <span class="sub">${subLabel}</span>
          </span>
          <span class="grid" aria-hidden="true">${cellsHtml}</span>
        </div>
      `;
    }

    case 'reminders': {
      const pending = state.reminders.filter((r) => !r.done);
      const nextText = pending[0]?.text || 'Tudo concluído!';
      return `
        <div class="w-card reminders">
          <span class="rem-badge">${pending.length}</span>
          <span class="stack grow">
            <b class="track">${escapeHtml(nextText)}</b>
            <span class="sub">${pending.length ? `Próximo: ${escapeHtml(pending[0].time)}` : 'Lista em dia'}</span>
          </span>
        </div>
      `;
    }

    case 'water': {
      return `
        <div class="w-card water">
          <svg class="glyph" viewBox="0 0 24 24" aria-hidden="true">
            <path d="M12 2.5C12 2.5 5.5 10.2 5.5 15a6.5 6.5 0 0 0 13 0c0-4.8-6.5-12.5-6.5-12.5z" fill="#38bdf8"/>
          </svg>
          <span class="stack">
            <b class="num">${Number(state.waterGlasses)}/${Number(state.waterGoal)}</b>
            <span class="sub">copos hoje</span>
          </span>
        </div>
      `;
    }
  }
}

export function renderWidgetPopoverContent(item: DockItem, state: DockState): string {
  const wType = item.widgetType || 'clock';

  switch (wType) {
    case 'pomodoro': {
      const { running, mode, remainingSec, cyclesCompleted } = state.pomodoro;
      return `
        <div class="pop-head">
          <div>
            <span class="pop-kicker">Produtividade • Transição Automática</span>
            <h4>Pomodoro Focus</h4>
          </div>
          <span class="pop-pill">${Number(cyclesCompleted)} ciclos hoje</span>
        </div>
        <div class="pomo-modes">
          <button type="button" class="chip ${mode === 'focus' ? 'active' : ''}" data-pomo-mode="focus">Foco 25m</button>
          <button type="button" class="chip ${mode === 'short' ? 'active' : ''}" data-pomo-mode="short">Pausa 5m</button>
          <button type="button" class="chip ${mode === 'long' ? 'active' : ''}" data-pomo-mode="long">Longa 15m</button>
        </div>
        <div class="big-timer">${formatTime(remainingSec)}</div>
        <div class="pop-actions">
          <button type="button" class="btn-pop primary" data-pomo-act="toggle">${running ? 'Pausar' : 'Iniciar'}</button>
          <button type="button" class="btn-pop" data-pomo-act="reset">Reiniciar</button>
        </div>
      `;
    }

    case 'timer': {
      const { running, remainingSec } = state.timer;
      return `
        <div class="pop-head">
          <div>
            <span class="pop-kicker">Contagem Regressiva Precisa</span>
            <h4>Timer Rápido</h4>
          </div>
        </div>
        <div class="pomo-modes">
          <button type="button" class="chip" data-timer-set="300">5 min</button>
          <button type="button" class="chip" data-timer-set="900">15 min</button>
          <button type="button" class="chip" data-timer-set="1800">30 min</button>
          <button type="button" class="chip" data-timer-set="3600">60 min</button>
        </div>
        <div class="big-timer">${formatTime(remainingSec)}</div>
        <div class="pop-actions">
          <button type="button" class="btn-pop primary" data-timer-act="toggle">${running ? 'Pausar' : 'Iniciar'}</button>
          <button type="button" class="btn-pop" data-timer-act="reset">Zerar</button>
        </div>
      `;
    }

    case 'weather': {
      const w = state.weather;
      const cityButtons = Object.keys(CITIES)
        .map(
          (c) =>
            `<button type="button" class="chip ${w.city === c ? 'active' : ''}" data-weather-city="${escapeAttr(c)}">${escapeHtml(c)}</button>`
        )
        .join('');
      const forecastHtml = w.forecast
        .map(
          (f) => `
          <div class="fc-day">
            <span class="fc-name">${escapeHtml(f.day)}</span>
            <span class="fc-ico">${f.icon === 'sun' ? '☀️' : f.icon === 'cloud' ? '⛅' : '🌧️'}</span>
            <span class="fc-temp"><b>${Number(f.tempMax)}°</b> <small>${Number(f.tempMin)}°</small></span>
          </div>`
        )
        .join('');

      return `
        <div class="pop-head">
          <div>
            <span class="pop-kicker">Clima ao Vivo · Open-Meteo</span>
            <h4>${escapeHtml(w.city)}</h4>
          </div>
          <div class="weather-big">${Number(w.temp)}°C</div>
        </div>
        <p class="pop-sub">${escapeHtml(w.condition)} · Sensação de ${Number(w.feelsLike)}°C (Máx ${Number(w.high)}° / Mín ${Number(w.low)}°)</p>
        <form class="rem-form" data-weather-form="true" style="margin-bottom:8px">
          <input type="text" name="cityQuery" placeholder="Buscar qualquer cidade (ex: Curitiba, Lisboa)..." required />
          <button type="submit" class="btn-pop primary">Buscar</button>
        </form>
        <div class="pomo-modes">
          <button type="button" class="chip" data-weather-auto="true" title="Envia uma requisição única ao ipwho.is apenas quando clicado">📍 Detectar por IP (Opt-in)</button>
          ${cityButtons}
        </div>
        <div class="fc-grid">${forecastHtml}</div>
      `;
    }

    case 'music': {
      const fallbackTrack = PLAYLIST[state.music.trackIndex] || PLAYLIST[0];
      const title = state.music.detected ? state.music.title : fallbackTrack.title;
      const artist = state.music.detected ? state.music.artist : fallbackTrack.artist;
      const totalDuration = Math.max(
        1,
        state.music.detected
          ? state.music.durationSec || 180
          : fallbackTrack.durationSec
      );
      const safeArtUrl = sanitizeUrl(state.music.artworkUrl);

      const estimatedPrefix = state.music.estimated ? '~' : '';
      const estimatedSuffix = state.music.estimated ? ' (estimado)' : '';
      const mediaHeader = state.music.detected
        ? `🟢 Conectado ao ${escapeHtml(state.music.sourceApp)} (${estimatedPrefix}${formatTime(state.music.progressSec)} / ${estimatedPrefix}${formatTime(totalDuration)}${estimatedSuffix})`
        : `🎵 Rádio Local (${formatTime(state.music.progressSec)} / ${formatTime(totalDuration)})`;

      const tracksHtml = PLAYLIST.map(
        (t, idx) => `
        <button type="button" class="track-row ${!state.music.detected && idx === state.music.trackIndex ? 'active' : ''}" data-music-pick="${idx}">
          <span><b>${escapeHtml(t.title)}</b> <small>${escapeHtml(t.artist)}</small></span>
          <span>${formatTime(t.durationSec)}</span>
        </button>`
      ).join('');

      return `
        <div class="pop-head">
          <div style="display:flex;align-items:center;gap:10px">
            ${
              safeArtUrl
                ? `<img src="${escapeAttr(safeArtUrl)}" style="width:44px;height:44px;border-radius:10px;object-fit:cover;border:1px solid rgba(255,255,255,.15)" alt="Capa" />`
                : ''
            }
            <div>
              <span class="pop-kicker">${mediaHeader}</span>
              <h4>${escapeHtml(title)}</h4>
              <p class="pop-sub" style="margin:2px 0 0">${escapeHtml(artist)}</p>
            </div>
          </div>
          <button type="button" class="chip" data-music-act="open-spotify" title="Abrir ou focar o Spotify">
            Abrir Spotify ↗
          </button>
        </div>
        <div class="pop-actions" style="margin:10px 0 12px">
          <button type="button" class="btn-pop" data-music-act="prev">⏮ Anterior</button>
          <button type="button" class="btn-pop primary" data-music-act="toggle">${
            state.music.playing ? '⏸ Pausar' : '▶ Tocar'
          }</button>
          <button type="button" class="btn-pop" data-music-act="next">⏭ Próxima</button>
        </div>
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:6px">
          <span class="pop-kicker">Rádio Synth Lo-Fi Local (Modo Offline)</span>
          <button type="button" class="chip ${state.music.soundSynthEnabled ? 'active' : ''}" data-music-act="synth">
            ${state.music.soundSynthEnabled ? '🔊 Synth ON' : '🔈 Synth OFF'}
          </button>
        </div>
        <div class="track-list">${tracksHtml}</div>
      `;
    }

    case 'activity':
    case 'battery': {
      const m = state.metrics;
      return `
        <div class="pop-head">
          <div>
            <span class="pop-kicker">Monitor do Sistema (Kernel Win32)</span>
            <h4>Atividade & Energia</h4>
          </div>
          <span class="pop-pill">${escapeHtml(m.batteryTimeRemaining)}</span>
        </div>
        <div class="metric-bars">
          <div class="m-row">
            <div class="m-lbl"><span>Processador (CPU)</span><b>${Number(m.cpuUsage)}%</b></div>
            <div class="m-track"><i style="width:${Number(m.cpuUsage)}%;background:#fa114f"></i></div>
          </div>
          <div class="m-row">
            <div class="m-lbl"><span>Memória RAM (${Number(m.ramUsedGb)} / ${Number(m.ramTotalGb)} GB)</span><b>${Number(m.ramUsage)}%</b></div>
            <div class="m-track"><i style="width:${Number(m.ramUsage)}%;background:#a6ff00"></i></div>
          </div>
          <div class="m-row">
            <div class="m-lbl"><span>Energia / Bateria (${escapeHtml(m.batteryTimeRemaining)})</span><b>${Number(m.batteryLevel)}%</b></div>
            <div class="m-track"><i style="width:${Number(m.batteryLevel)}%;background:#38bdf8"></i></div>
          </div>
        </div>
        <div class="pop-actions" style="margin-top:10px">
          <button type="button" class="btn-pop" data-sys-act="taskmgr">Abrir Gerenciador de Tarefas</button>
          <button type="button" class="btn-pop" data-sys-act="screenshot">✂️ Capturar Tela (Win+Shift+S)</button>
        </div>
      `;
    }

    case 'calendar':
    case 'clock': {
      const now = new Date();
      const dayPct = Math.round(((now.getHours() * 60 + now.getMinutes()) / 1440) * 100);
      const startOfYear = new Date(now.getFullYear(), 0, 1);
      const dayOfYear = Math.floor((now.getTime() - startOfYear.getTime()) / 86400000) + 1;
      const yearPct = Math.round((dayOfYear / 365) * 100);
      const monthDays = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
      const monthPct = Math.round((now.getDate() / monthDays) * 100);

      const eventsHtml = state.calendarEvents
        .map((ev) => {
          const safeLink = ev.link
            ? sanitizeUrl(ev.link.startsWith('http') ? ev.link : `https://${ev.link}`)
            : '';
          return `
          <div class="cal-ev-item">
            <span class="cal-ev-time">${escapeHtml(ev.time)}</span>
            <span class="cal-ev-title">${escapeHtml(ev.title)}</span>
            ${
              safeLink
                ? `<button type="button" class="chip active" data-cal-open="${escapeAttr(safeLink)}" title="Entrar na reunião">Entrar ↗</button>`
                : ''
            }
            <button type="button" class="cal-ev-del" data-cal-del="${escapeAttr(ev.id)}" title="Remover">✕</button>
          </div>`;
        })
        .join('');

      return `
        <div class="pop-head">
          <div>
            <span class="pop-kicker">Agenda & Progresso do Dia</span>
            <h4>${escapeHtml(now.toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' }))}</h4>
          </div>
          <span class="pop-pill">${escapeHtml(now.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }))}</span>
        </div>
        <div class="metric-bars" style="margin-bottom:10px">
          <div class="m-row">
            <div class="m-lbl"><span>Progresso do Dia (${dayPct}%) · Mês (${monthPct}%) · Ano (${yearPct}%)</span><b>${dayPct}%</b></div>
            <div class="m-track"><i style="width:${dayPct}%;background:#38bdf8"></i></div>
          </div>
        </div>
        <span class="pop-kicker">Compromissos & Reuniões de Hoje</span>
        <div class="rem-list" style="margin-top:6px">${eventsHtml || '<p class="pop-sub">Sem compromissos cadastrados.</p>'}</div>
        <form class="rem-form" data-cal-form="true">
          <input type="text" name="evTime" placeholder="15:00" style="max-width:64px" required />
          <input type="text" name="evTitle" placeholder="Reunião / Evento..." required />
          <input type="text" name="evUrl" placeholder="Link Meet/Zoom (opcional)" />
          <button type="submit" class="btn-pop primary">+</button>
        </form>
      `;
    }

    case 'notes': {
      return `
        <div class="pop-head">
          <div>
            <span class="pop-kicker">Bloco Instantâneo</span>
            <h4>Nota do Dock</h4>
          </div>
        </div>
        <textarea class="note-area" data-note-input="true" rows="5" placeholder="Digite um lembrete rápido...">${escapeHtml(state.noteText)}</textarea>
      `;
    }

    case 'reminders': {
      const listHtml = state.reminders
        .map(
          (r) => `
          <label class="rem-item ${r.done ? 'done' : ''}">
            <input type="checkbox" data-rem-toggle="${escapeAttr(r.id)}" ${r.done ? 'checked' : ''}/>
            <span class="rem-txt">${escapeHtml(r.text)}</span>
            <small>${escapeHtml(r.time)}</small>
          </label>`
        )
        .join('');
      return `
        <div class="pop-head">
          <div>
            <span class="pop-kicker">Checklist</span>
            <h4>Lembretes do Dia</h4>
          </div>
        </div>
        <div class="rem-list">${listHtml}</div>
        <form class="rem-form" data-rem-form="true">
          <input type="text" name="remText" placeholder="Novo lembrete..." required />
          <button type="submit" class="btn-pop primary">Adicionar</button>
        </form>
      `;
    }

    case 'water': {
      const pct = Math.min(100, Math.round((state.waterGlasses / Math.max(1, state.waterGoal)) * 100));
      return `
        <div class="pop-head">
          <div>
            <span class="pop-kicker">Saúde & Foco (Reseta Diariamente)</span>
            <h4>Meta de Hidratação</h4>
          </div>
          <span class="pop-pill">${pct}%</span>
        </div>
        <div class="big-timer">${Number(state.waterGlasses)} / ${Number(state.waterGoal)} copos</div>
        <div class="pop-actions">
          <button type="button" class="btn-pop primary" data-water-act="add">+ Beber 1 copo (250ml)</button>
          <button type="button" class="btn-pop" data-water-act="reset">Zerar dia</button>
        </div>
      `;
    }

    case 'github': {
      const gh = state.github;
      const safeAvatar = sanitizeUrl(gh.avatarUrl);
      return `
        <div class="pop-head">
          <div style="display:flex;align-items:center;gap:10px">
            ${
              safeAvatar
                ? `<img src="${escapeAttr(safeAvatar)}" style="width:40px;height:40px;border-radius:50%;border:1px solid rgba(255,255,255,.2)" alt="Avatar" />`
                : ''
            }
            <div>
              <span class="pop-kicker">GitHub Real-Time Sync</span>
              <h4>${gh.username ? `@${escapeHtml(gh.username)}` : 'Conectar Conta GitHub'}</h4>
              <p class="pop-sub" style="margin:2px 0 0">${gh.totalYear.toLocaleString('pt-BR')} contribuições no último ano · ${Number(gh.publicRepos)} repos</p>
            </div>
          </div>
          ${
            gh.username
              ? `<button type="button" class="chip" data-gh-act="open-profile">Abrir GitHub ↗</button>`
              : ''
          }
        </div>
        <form class="rem-form" data-gh-form="true" style="margin:8px 0 10px">
          <input type="text" name="ghUser" value="${escapeAttr(gh.username)}" placeholder="Seu username do GitHub (ex: torvalds)..." required />
          <button type="submit" class="btn-pop primary">${gh.loading ? 'Buscando...' : 'Conectar'}</button>
        </form>
        <div class="gh-commit-box">
          <span class="pop-kicker">${gh.error ? '⚠️ Aviso' : 'Atividade Pública Recente'}</span>
          <p class="pop-sub" style="margin:4px 0 0;color:#fff">${escapeHtml(gh.error || gh.latestEventText)}</p>
        </div>
      `;
    }
  }
}
