/**
 * Security & Sanitization Utilities (P0 Hardening)
 * Prevents DOM XSS in Tauri WebView and provides CSP-safe math evaluation.
 */

const HTML_ESCAPE_MAP: Record<string, string> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;',
};

export function escapeHtml(raw: unknown): string {
  if (raw === null || raw === undefined) return '';
  return String(raw).replace(/[&<>"']/g, (ch) => HTML_ESCAPE_MAP[ch] || ch);
}

export function escapeAttr(raw: unknown): string {
  return escapeHtml(raw);
}

/**
 * Allows only safe URLs (`https://`, `http://`, `spotify:`, `ms-settings:`, or `data:image/png;base64,`).
 * Blocks `javascript:`, `data:text/html`, `vbscript:`, `file:`, etc.
 */
export function sanitizeUrl(raw: unknown): string {
  if (typeof raw !== 'string') return '';
  const trimmed = raw.trim();
  if (!trimmed) return '';

  if (trimmed.startsWith('data:image/png;base64,')) {
    const b64Part = trimmed.slice('data:image/png;base64,'.length);
    return /^[A-Za-z0-9+/=]+$/.test(b64Part) ? trimmed : '';
  }

  try {
    const parsed = new URL(trimmed);
    const allowedProtocols = ['https:', 'http:', 'spotify:', 'ms-settings:'];
    if (allowedProtocols.includes(parsed.protocol)) {
      return parsed.toString();
    }
  } catch {
    // Not a valid absolute URL
  }
  return '';
}

/**
 * Validates whether a launch target is safe to pass to Rust `launch_target` (`ShellExecuteW`).
 * - For `http://` and `https://` URLs: allows standard query parameters (`&`, `=`, `?`, `#`),
 *   blocking only control chars, whitespace, or quotes.
 * - For executables / shell targets: rejects shell metacharacters (`&`, `|`, `;`, `>`, `<`, `` ` ``, `$`, `\n`, `\r`)
 *   and dangerous URI schemes (`javascript:`, `vbscript:`, `data:`).
 */
export function isSafeLaunchTarget(raw: string): boolean {
  const t = raw.trim();
  if (!t || /[\r\n\0"]/.test(t)) return false;

  const lower = t.toLowerCase();
  if (
    lower.startsWith('javascript:') ||
    lower.startsWith('vbscript:') ||
    lower.startsWith('data:')
  ) {
    return false;
  }

  if (lower.startsWith('https://') || lower.startsWith('http://')) {
    try {
      const parsed = new URL(t);
      return (parsed.protocol === 'https:' || parsed.protocol === 'http:') && !/\s/.test(t);
    } catch {
      return false;
    }
  }

  if (/[&|;><`$]/.test(t)) return false;
  return true;
}

/**
 * Pure, CSP-compliant (`script-src 'self'`, zero `eval` / `new Function`) arithmetic parser
 * supporting `+`, `-`, `*`, `/`, `%`, parentheses `(...)`, and decimal numbers.
 */
export function safeEvaluateMath(input: string): number | null {
  const cleaned = input.replace(/,/g, '.').replace(/\s+/g, '');
  if (!cleaned || !/^[0-9+\-*/().%]+$/.test(cleaned) || !/[+\-*/%]/.test(cleaned)) {
    return null;
  }

  let pos = 0;

  function parseExpression(): number {
    let val = parseTerm();
    while (pos < cleaned.length && (cleaned[pos] === '+' || cleaned[pos] === '-')) {
      const op = cleaned[pos++];
      const right = parseTerm();
      val = op === '+' ? val + right : val - right;
    }
    return val;
  }

  function parseTerm(): number {
    let val = parseFactor();
    while (
      pos < cleaned.length &&
      (cleaned[pos] === '*' || cleaned[pos] === '/' || cleaned[pos] === '%')
    ) {
      const op = cleaned[pos++];
      const right = parseFactor();
      if (op === '*') val *= right;
      else if (op === '/') val = right === 0 ? NaN : val / right;
      else val = right === 0 ? NaN : val % right;
    }
    return val;
  }

  function parseFactor(): number {
    if (cleaned[pos] === '+') {
      pos++;
      return parseFactor();
    }
    if (cleaned[pos] === '-') {
      pos++;
      return -parseFactor();
    }
    if (cleaned[pos] === '(') {
      pos++;
      const val = parseExpression();
      if (cleaned[pos] !== ')') return NaN;
      pos++;
      return val;
    }
    const start = pos;
    let dotCount = 0;
    while (
      pos < cleaned.length &&
      ((cleaned[pos] >= '0' && cleaned[pos] <= '9') || cleaned[pos] === '.')
    ) {
      if (cleaned[pos] === '.') dotCount++;
      pos++;
    }
    if (start === pos || dotCount > 1) return NaN;
    return Number(cleaned.slice(start, pos));
  }

  const result = parseExpression();
  if (pos !== cleaned.length || !Number.isFinite(result)) {
    return null;
  }
  return result;
}
