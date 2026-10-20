// Componentes Visuais Vetoriais (SVG) do Apex GP Manager:
// Monoposto F1 de alta precisão, Miniatura de Circuito, Anel Circular de OVR (72px) e Gauge Semicircular de Setup

import { Point2D, Team } from '../models/types';
import { getRatingTier } from './icons';

export function renderF1CarSvg(team: Team, width = 220, height = 84): string {
  return `
    <svg class="f1-car-svg" width="${width}" height="${height}" viewBox="0 0 240 90" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <defs>
        <linearGradient id="bodyGrad-${team.id}" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stop-color="${team.secondaryColor}" />
          <stop offset="28%" stop-color="${team.primaryColor}" />
          <stop offset="85%" stop-color="${team.primaryColor}" />
          <stop offset="100%" stop-color="${team.accentColor}" />
        </linearGradient>
        <filter id="carGlow-${team.id}" x="-15%" y="-20%" width="130%" height="140%">
          <feDropShadow dx="0" dy="4" stdDeviation="5" flood-color="${team.primaryColor}" flood-opacity="0.45"/>
        </filter>
      </defs>

      <g filter="url(#carGlow-${team.id})">
        <!-- Assoalho / Floor aerodinâmico em fibra de carbono -->
        <path d="M26 24 L162 26 L186 35 L186 55 L162 64 L26 66 Z" fill="#0B101D" stroke="rgba(255,255,255,0.14)" stroke-width="1"/>

        <!-- Braços de Suspensão Dianteira e Traseira -->
        <line x1="44" y1="26" x2="36" y2="14" stroke="#475569" stroke-width="2"/>
        <line x1="56" y1="26" x2="46" y2="14" stroke="#475569" stroke-width="2"/>
        <line x1="44" y1="64" x2="36" y2="76" stroke="#475569" stroke-width="2"/>
        <line x1="56" y1="64" x2="46" y2="76" stroke="#475569" stroke-width="2"/>

        <line x1="172" y1="34" x2="184" y2="16" stroke="#475569" stroke-width="2"/>
        <line x1="186" y1="36" x2="194" y2="16" stroke="#475569" stroke-width="2"/>
        <line x1="172" y1="56" x2="184" y2="74" stroke="#475569" stroke-width="2"/>
        <line x1="186" y1="54" x2="194" y2="74" stroke="#475569" stroke-width="2"/>

        <!-- Pneus Traseiros Pirelli -->
        <rect x="20" y="4" width="38" height="17" rx="5" fill="#0F172A" stroke="#334155" stroke-width="1.5"/>
        <rect x="24" y="7" width="30" height="3" rx="1.5" fill="${team.accentColor}" opacity="0.75"/>
        <rect x="20" y="69" width="38" height="17" rx="5" fill="#0F172A" stroke="#334155" stroke-width="1.5"/>
        <rect x="24" y="80" width="30" height="3" rx="1.5" fill="${team.accentColor}" opacity="0.75"/>

        <!-- Pneus Dianteiros Pirelli -->
        <rect x="168" y="6" width="34" height="15" rx="4.5" fill="#0F172A" stroke="#334155" stroke-width="1.5"/>
        <rect x="172" y="9" width="26" height="2.5" rx="1.2" fill="${team.primaryColor}" opacity="0.85"/>
        <rect x="168" y="69" width="34" height="15" rx="4.5" fill="#0F172A" stroke="#334155" stroke-width="1.5"/>
        <rect x="172" y="78.5" width="26" height="2.5" rx="1.2" fill="${team.primaryColor}" opacity="0.85"/>

        <!-- Asa Traseira (DRS) -->
        <rect x="6" y="16" width="13" height="58" rx="3" fill="${team.secondaryColor}" stroke="${team.primaryColor}" stroke-width="2"/>
        <line x1="12" y1="20" x2="12" y2="70" stroke="${team.accentColor}" stroke-width="1.5" opacity="0.85"/>

        <!-- Chassi Principal, Sidepods e Bico (Nosecone) -->
        <path d="M19 33 L64 21 L138 25 L206 37 L226 42 L226 48 L206 53 L138 65 L64 69 L19 57 Z" fill="url(#bodyGrad-${team.id})" stroke="rgba(255,255,255,0.32)" stroke-width="1.2"/>

        <!-- Faixas de Livery da Escuderia -->
        <path d="M40 39 L196 41 L212 45 L196 49 L40 51 Z" fill="${team.accentColor}" opacity="0.88"/>

        <!-- Cockpit, Capacete & Halo Titânio -->
        <ellipse cx="114" cy="45" rx="22" ry="9.5" fill="#070B14" stroke="${team.secondaryColor}" stroke-width="2"/>
        <circle cx="110" cy="45" r="6" fill="${team.accentColor}" stroke="#FFFFFF" stroke-width="1"/>
        <path d="M106 36 C122 36, 132 42, 134 45 C132 48, 122 54, 106 54" stroke="${team.primaryColor}" stroke-width="2.4" fill="none"/>
        <line x1="122" y1="45" x2="135" y2="45" stroke="${team.primaryColor}" stroke-width="2.2"/>

        <!-- Asa Dianteira Multi-Elemento -->
        <path d="M210 12 L233 17 L233 73 L210 78 L215 62 L215 28 Z" fill="${team.secondaryColor}" stroke="${team.primaryColor}" stroke-width="1.8"/>
        <line x1="224" y1="18" x2="224" y2="72" stroke="${team.accentColor}" stroke-width="1.5"/>
      </g>
    </svg>
  `;
}

/**
 * Renderiza o anel circular SVG de 72px para o OVR do piloto
 */
export function renderOvrRingSvg(ovr: number): string {
  const tier = getRatingTier(ovr);
  const radius = 29;
  const circumference = 2 * Math.PI * radius;
  const pct = Math.max(50, Math.min(100, ovr));
  const dashOffset = circumference - (pct / 100) * circumference;

  return `
    <div class="ovr-ring-wrap" title="Overall ${ovr} (${tier.label})">
      <svg width="72" height="72" viewBox="0 0 72 72" aria-label="Overall ${ovr}">
        <circle cx="36" cy="36" r="${radius}" fill="var(--bg-1)" stroke="rgba(255,255,255,0.08)" stroke-width="5" />
        <circle
          cx="36"
          cy="36"
          r="${radius}"
          fill="none"
          stroke="${tier.color}"
          stroke-width="5"
          stroke-linecap="round"
          stroke-dasharray="${circumference.toFixed(1)}"
          stroke-dashoffset="${dashOffset.toFixed(1)}"
          transform="rotate(-90 36 36)"
        />
      </svg>
      <div class="ovr-ring-value" style="color:${tier.color}">
        <span class="ovr-num" data-animate-num="${ovr}">${ovr}</span>
        <span class="ovr-sub">OVR</span>
      </div>
    </div>
  `;
}

/**
 * Renderiza miniatura SVG do traçado do circuito (Albert Park etc.) em verde translúcido
 */
export function renderTrackMiniSvg(points: Point2D[], width = 136, height = 84): string {
  if (!points || points.length < 3) return '';
  const pad = 10;
  const w = width - pad * 2;
  const h = height - pad * 2;

  const scaled = points.map((p) => ({
    x: Math.round(pad + p.x * w),
    y: Math.round(pad + p.y * h),
  }));

  const pathData =
    scaled.reduce((acc, pt, idx) => (idx === 0 ? `M ${pt.x} ${pt.y}` : `${acc} L ${pt.x} ${pt.y}`), '') + ' Z';
  const start = scaled[0];

  return `
    <svg class="track-mini-svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" fill="none" xmlns="http://www.w3.org/2000/svg" aria-label="Traçado do circuito">
      <path d="${pathData}" fill="rgba(0, 229, 138, 0.08)" stroke="rgba(0, 229, 138, 0.25)" stroke-width="6" stroke-linejoin="round" stroke-linecap="round"/>
      <path d="${pathData}" fill="none" stroke="var(--green)" stroke-width="2.2" stroke-linejoin="round" stroke-linecap="round"/>
      <circle cx="${start.x}" cy="${start.y}" r="4" fill="var(--text-1)" stroke="var(--green)" stroke-width="2"/>
    </svg>
  `;
}

/**
 * Renderiza o Gauge Semicircular para a Compatibilidade de Acerto Mecânico (ex: 93% em verde)
 */
export function renderCompatibilityGaugeSvg(compatPct: number): string {
  const clamped = Math.max(0, Math.min(100, compatPct));
  const radius = 46;
  const semiCircumference = Math.PI * radius;
  const offset = semiCircumference - (clamped / 100) * semiCircumference;
  const strokeColor = clamped >= 85 ? 'var(--green)' : clamped >= 72 ? 'var(--gold)' : 'var(--orange)';

  return `
    <div class="setup-gauge-wrap" aria-label="Compatibilidade atual ${clamped}%">
      <svg width="124" height="70" viewBox="0 0 124 70">
        <path
          d="M 16 60 A 46 46 0 0 1 108 60"
          fill="none"
          stroke="rgba(255,255,255,0.09)"
          stroke-width="9"
          stroke-linecap="round"
        />
        <path
          d="M 16 60 A 46 46 0 0 1 108 60"
          fill="none"
          stroke="${strokeColor}"
          stroke-width="9"
          stroke-linecap="round"
          stroke-dasharray="${semiCircumference.toFixed(1)}"
          stroke-dashoffset="${offset.toFixed(1)}"
        />
      </svg>
      <div class="setup-gauge-label">
        <span class="setup-gauge-num" style="color:${strokeColor}" data-animate-num="${clamped}" data-suffix="%">${clamped}%</span>
        <span class="setup-gauge-caption">SINERGIA PISTA</span>
      </div>
    </div>
  `;
}

export function renderTireBadge(compound: string): string {
  const map: Record<string, { label: string; color: string; bg: string }> = {
    SOFT: { label: 'S', color: 'var(--red)', bg: 'rgba(255, 77, 94, 0.16)' },
    MEDIUM: { label: 'M', color: 'var(--gold)', bg: 'rgba(255, 200, 61, 0.16)' },
    HARD: { label: 'H', color: 'var(--text-1)', bg: 'rgba(242, 245, 250, 0.15)' },
    INTER: { label: 'I', color: 'var(--green)', bg: 'rgba(0, 229, 138, 0.16)' },
    WET: { label: 'W', color: 'var(--blue)', bg: 'rgba(61, 169, 255, 0.18)' },
  };
  const info = map[compound] ?? map.MEDIUM;
  return `<span class="tire-badge" style="border-color:${info.color};color:${info.color};background:${info.bg}" title="Pneu ${compound}">${info.label}</span>`;
}
