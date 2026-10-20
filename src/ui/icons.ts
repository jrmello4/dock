// Biblioteca de Ícones Lucide (stroke 1.75, 18px padrão) e Bandeiras SVG 20x14px (flagcdn)

export type LucideIconName =
  | 'menu'
  | 'x'
  | 'search'
  | 'sliders-horizontal'
  | 'cpu'
  | 'trophy'
  | 'shield'
  | 'calendar'
  | 'users'
  | 'graduation-cap'
  | 'wallet'
  | 'award'
  | 'medal'
  | 'newspaper'
  | 'save'
  | 'timer'
  | 'flag'
  | 'play'
  | 'pause'
  | 'fast-forward'
  | 'wand-sparkles'
  | 'arrow-up-down'
  | 'trending-up'
  | 'cloud-rain'
  | 'sun'
  | 'cloud-lightning'
  | 'zap'
  | 'gauge'
  | 'wrench'
  | 'download'
  | 'check'
  | 'alert-triangle'
  | 'radio'
  | 'arrow-left'
  | 'chevron-right'
  | 'compass'
  | 'gamepad-2'
  | 'arrow-up-right';

const LUCIDE_PATHS: Record<LucideIconName, string> = {
  menu: '<line x1="4" x2="20" y1="12" y2="12"/><line x1="4" x2="20" y1="6" y2="6"/><line x1="4" x2="20" y1="18" y2="18"/>',
  x: '<path d="M18 6 6 18"/><path d="m6 6 12 12"/>',
  search: '<circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/>',
  'sliders-horizontal':
    '<line x1="21" x2="14" y1="4" y2="4"/><line x1="10" x2="3" y1="4" y2="4"/><line x1="21" x2="12" y1="12" y2="12"/><line x1="8" x2="3" y1="12" y2="12"/><line x1="21" x2="16" y1="20" y2="20"/><line x1="12" x2="3" y1="20" y2="20"/><line x1="14" x2="14" y1="2" y2="6"/><line x1="8" x2="8" y1="10" y2="14"/><line x1="16" x2="16" y1="18" y2="22"/>',
  cpu: '<rect width="16" height="16" x="4" y="4" rx="2"/><rect width="6" height="6" x="9" y="9" rx="1"/><path d="M15 2v2"/><path d="M15 20v2"/><path d="M2 15h2"/><path d="M2 9h2"/><path d="M20 15h2"/><path d="M20 9h2"/><path d="M9 2v2"/><path d="M9 20v2"/>',
  trophy:
    '<path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6"/><path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18"/><path d="M4 22h16"/><path d="M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22"/><path d="M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22"/><path d="M18 2H6v7a6 6 0 0 0 12 0V2Z"/>',
  shield: '<path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z"/>',
  calendar:
    '<path d="M8 2v4"/><path d="M16 2v4"/><rect width="18" height="18" x="3" y="4" rx="2"/><path d="M3 10h18"/><path d="M8 14h.01"/><path d="M12 14h.01"/><path d="M16 14h.01"/><path d="M8 18h.01"/><path d="M12 18h.01"/><path d="M16 18h.01"/>',
  users:
    '<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>',
  'graduation-cap':
    '<path d="M21.42 10.922a1 1 0 0 0-.019-1.838L12.83 5.18a2 2 0 0 0-1.66 0L2.6 9.08a1 1 0 0 0 0 1.832l8.57 3.908a2 2 0 0 0 1.66 0z"/><path d="M22 10v6"/><path d="M6 12.5V16a6 3 0 0 0 12 0v-3.5"/>',
  wallet:
    '<path d="M19 7V4a1 1 0 0 0-1-1H5a2 2 0 0 0 0 4h15a1 1 0 0 1 1 1v4h-3a2 2 0 0 0 0 4h3a1 1 0 0 0 1-1v-2a1 1 0 0 0-1-1"/><path d="M3 5v14a2 2 0 0 0 2 2h15a1 1 0 0 0 1-1v-4"/>',
  award:
    '<path d="m15.477 12.89 1.515 8.526a.5.5 0 0 1-.81.47l-3.58-2.687a1 1 0 0 0-1.197 0l-3.586 2.686a.5.5 0 0 1-.81-.469l1.514-8.526"/><circle cx="12" cy="8" r="6"/>',
  medal:
    '<path d="M7.21 15 2.66 7.14a2 2 0 0 1 .13-2.2L4.4 2.8A2 2 0 0 1 6 2h12a2 2 0 0 1 1.6.8l1.6 2.14a2 2 0 0 1 .14 2.2L16.79 15"/><path d="M11 12 5.12 2.2"/><path d="m13 12 5.88-9.8"/><path d="M8 7h8"/><circle cx="12" cy="17" r="5"/><path d="M12 18v-2h-.5"/>',
  newspaper:
    '<path d="M4 22h16a2 2 0 0 0 2-2V4a2 2 0 0 0-2-2H8a2 2 0 0 0-2 2v16a2 2 0 0 1-2 2Zm0 0a2 2 0 0 1-2-2v-9c0-1.1.9-2 2-2h2"/><path d="M18 14h-8"/><path d="M15 18h-5"/><path d="M10 6h8v4h-8V6Z"/>',
  save: '<path d="M15.2 3a2 2 0 0 1 1.4.6l3.8 3.8a2 2 0 0 1 .6 1.4V19a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2z"/><path d="M17 21v-7a1 1 0 0 0-1-1H8a1 1 0 0 0-1 1v7"/><path d="M7 3v4a1 1 0 0 0 1 1h7"/>',
  timer: '<line x1="10" x2="14" y1="2" y2="2"/><line x1="12" x2="15" y1="14" y2="11"/><circle cx="12" cy="14" r="8"/>',
  flag: '<path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z"/><line x1="4" x2="4" y1="22" y2="15"/>',
  play: '<polygon points="6 3 20 12 6 21 6 3"/>',
  pause: '<rect x="14" y="4" width="4" height="16" rx="1"/><rect x="6" y="4" width="4" height="16" rx="1"/>',
  'fast-forward': '<polygon points="13 19 22 12 13 5 13 19"/><polygon points="2 19 11 12 2 5 2 19"/>',
  'wand-sparkles':
    '<path d="m21.64 3.64-1.28-1.28a1.21 1.21 0 0 0-1.72 0L2.36 18.64a1.21 1.21 0 0 0 0 1.72l1.28 1.28a1.2 1.2 0 0 0 1.72 0L21.64 5.36a1.2 1.2 0 0 0 0-1.72"/><path d="m14 7 3 3"/><path d="M5 6v4"/><path d="M19 14v4"/><path d="M10 2v2"/><path d="M7 8H3"/><path d="M21 16h-4"/><path d="M11 3H9"/>',
  'arrow-up-down': '<path d="m21 16-4 4-4-4"/><path d="M17 20V4"/><path d="m3 8 4-4 4 4"/><path d="M7 4v16"/>',
  'trending-up': '<polyline points="22 7 13.5 15.5 8.5 10.5 2 17"/><polyline points="16 7 22 7 22 13"/>',
  'cloud-rain': '<path d="M4 14.899A7 7 0 1 1 15.71 8h1.79a4.5 4.5 0 0 1 2.5 8.242"/><path d="M16 14v6"/><path d="M8 14v6"/><path d="M12 16v6"/>',
  sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2"/><path d="M12 20v2"/><path d="m4.93 4.93 1.41 1.41"/><path d="m17.66 17.66 1.41 1.41"/><path d="M2 12h2"/><path d="M20 12h2"/><path d="m6.34 17.66-1.41 1.41"/><path d="m19.07 4.93-1.41 1.41"/>',
  'cloud-lightning': '<path d="M6 16.326A7 7 0 1 1 15.71 8h1.79a4.5 4.5 0 0 1 .5 8.973"/><path d="m13 12-3 5h4l-3 5"/>',
  zap: '<path d="M4 14a1 1 0 0 1-.78-1.63l9.9-10.2a.5.5 0 0 1 .86.46l-1.92 6.02A1 1 0 0 0 13 10h7a1 1 0 0 1 .78 1.63l-9.9 10.2a.5.5 0 0 1-.86-.46l1.92-6.02A1 1 0 0 0 11 14z"/>',
  gauge: '<path d="m12 14 4-4"/><path d="M3.34 19a10 10 0 1 1 17.32 0"/>',
  wrench:
    '<path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"/>',
  download: '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" x2="12" y1="15" y2="3"/>',
  check: '<path d="M20 6 9 17l-5-5"/>',
  'alert-triangle': '<path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3"/><path d="M12 9v4"/><path d="M12 17h.01"/>',
  radio: '<path d="M4.9 19.1C1 15.2 1 8.8 4.9 4.9"/><path d="M7.8 16.2c-2.3-2.3-2.3-6.1 0-8.5"/><circle cx="12" cy="12" r="2"/><path d="M16.2 7.8c2.3 2.3 2.3 6.1 0 8.5"/><path d="M19.1 4.9C23 8.8 23 15.1 19.1 19"/>',
  'arrow-left': '<path d="m12 19-7-7 7-7"/><path d="M19 12H5"/>',
  'chevron-right': '<path d="m9 18 6-6-6-6"/>',
  compass: '<circle cx="12" cy="12" r="10"/><polygon points="16.24 7.76 14.12 14.12 7.76 16.24 9.88 9.88 16.24 7.76"/>',
  'gamepad-2':
    '<line x1="6" x2="10" y1="11" y2="11"/><line x1="8" x2="8" y1="9" y2="13"/><line x1="15" x2="15.01" y1="12" y2="12"/><line x1="18" x2="18.01" y1="10" y2="10"/><path d="M17.32 5H6.68a4 4 0 0 0-3.978 3.59c-.006.052-.01.101-.017.152C2.604 9.416 2 14.456 2 16a3 3 0 0 0 3 3c1 0 1.5-.5 2-1l1.414-1.414A2 2 0 0 1 9.828 16h4.344a2 2 0 0 1 1.414.586L17 18c.5.5 1 1 2 1a3 3 0 0 0 3-3c0-1.545-.604-6.584-.685-7.258-.007-.05-.011-.1-.017-.151A4 4 0 0 0 17.32 5z"/>',
  'arrow-up-right': '<path d="M7 7h10v10"/><path d="M7 17 17 7"/>',
};

export function icon(name: LucideIconName, size = 18, extraClass = ''): string {
  const path = LUCIDE_PATHS[name] || LUCIDE_PATHS.flag;
  return `<svg class="lucide-icon ${extraClass}" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${path}</svg>`;
}

const FLAG_ISO_MAP: Record<string, { code: string; label: string }> = {
  '🇬🇧': { code: 'gb', label: 'Reino Unido' },
  '🇮🇹': { code: 'it', label: 'Itália' },
  '🇦🇹': { code: 'at', label: 'Áustria' },
  '🇩🇪': { code: 'de', label: 'Alemanha' },
  '🇫🇷': { code: 'fr', label: 'França' },
  '🇺🇸': { code: 'us', label: 'Estados Unidos' },
  '🇨🇭': { code: 'ch', label: 'Suíça' },
  '🇦🇺': { code: 'au', label: 'Austrália' },
  '🇲🇨': { code: 'mc', label: 'Mônaco' },
  '🇳🇱': { code: 'nl', label: 'Holanda' },
  '🇳🇿': { code: 'nz', label: 'Nova Zelândia' },
  '🇪🇸': { code: 'es', label: 'Espanha' },
  '🇨🇦': { code: 'ca', label: 'Canadá' },
  '🇹🇭': { code: 'th', label: 'Tailândia' },
  '🇦🇷': { code: 'ar', label: 'Argentina' },
  '🇯🇵': { code: 'jp', label: 'Japão' },
  '🇧🇷': { code: 'br', label: 'Brasil' },
  '🇲🇽': { code: 'mx', label: 'México' },
  '🇫🇮': { code: 'fi', label: 'Finlândia' },
  '🇩🇰': { code: 'dk', label: 'Dinamarca' },
  '🇸🇪': { code: 'se', label: 'Suécia' },
  '🇧🇭': { code: 'bh', label: 'Bahrein' },
  '🇧🇪': { code: 'be', label: 'Bélgica' },
  '🇸🇬': { code: 'sg', label: 'Singapura' },
  '🇦🇪': { code: 'ae', label: 'Emirados Árabes' },
  'Reino Unido': { code: 'gb', label: 'Reino Unido' },
  'Itália': { code: 'it', label: 'Itália' },
  'Áustria': { code: 'at', label: 'Áustria' },
  'Alemanha': { code: 'de', label: 'Alemanha' },
  'França': { code: 'fr', label: 'França' },
  'Estados Unidos': { code: 'us', label: 'Estados Unidos' },
  'Suíça': { code: 'ch', label: 'Suíça' },
  'Austrália': { code: 'au', label: 'Austrália' },
  'Mônaco': { code: 'mc', label: 'Mônaco' },
  'Holanda': { code: 'nl', label: 'Holanda' },
  'Nova Zelândia': { code: 'nz', label: 'Nova Zelândia' },
  'Espanha': { code: 'es', label: 'Espanha' },
  'Canadá': { code: 'ca', label: 'Canadá' },
  'Tailândia': { code: 'th', label: 'Tailândia' },
  'Argentina': { code: 'ar', label: 'Argentina' },
  'Japão': { code: 'jp', label: 'Japão' },
  'Brasil': { code: 'br', label: 'Brasil' },
  'México': { code: 'mx', label: 'México' },
  'Finlândia': { code: 'fi', label: 'Finlândia' },
  'Dinamarca': { code: 'dk', label: 'Dinamarca' },
  'Suécia': { code: 'se', label: 'Suécia' },
  'Bahrein': { code: 'bh', label: 'Bahrein' },
  'Bélgica': { code: 'be', label: 'Bélgica' },
  'Singapura': { code: 'sg', label: 'Singapura' },
  'Emirados Árabes': { code: 'ae', label: 'Emirados Árabes' },
};

/**
 * Renderiza bandeira SVG oficial via flagcdn (20x14px, cantos arredondados 2px)
 * Nunca exibe emoji nem sigla de 2 letras.
 */
export function renderFlagSvg(flagOrCountry: string, countryName?: string): string {
  const mapped = FLAG_ISO_MAP[flagOrCountry] || (countryName ? FLAG_ISO_MAP[countryName] : undefined) || {
    code: 'un',
    label: countryName || 'País',
  };
  const alt = countryName || mapped.label;
  return `<img class="flag-svg" src="https://flagcdn.com/${mapped.code}.svg" width="20" height="14" alt="Bandeira ${alt}" title="${alt}" loading="lazy" />`;
}

/**
 * Retorna a cor semântica fixa para OVR ou barras de atributo:
 * >=90: Dourado (#FFC83D)
 * 85-89: Verde (#00E58A)
 * 80-84: Azul (#3DA9FF)
 * <80: Cinza (#7D8BA5)
 */
export function getRatingTier(val: number): {
  color: string;
  tierClass: string;
  label: string;
} {
  if (val >= 90) {
    return { color: 'var(--gold)', tierClass: 'tier-elite', label: 'Elite' };
  }
  if (val >= 85) {
    return { color: 'var(--green)', tierClass: 'tier-high', label: 'Alto' };
  }
  if (val >= 80) {
    return { color: 'var(--blue)', tierClass: 'tier-mid', label: 'Médio' };
  }
  return { color: 'var(--text-3)', tierClass: 'tier-low', label: 'Base' };
}
