import { describe, expect, it } from 'vitest';
import {
  createDefaultState,
  sanitizeDomId,
  SCHEMA_VERSION,
  validateAndMigrateSavedState,
} from '../state';

describe('state.ts — Schema validation, migration & DOM ID sanitization', () => {
  it('sanitizes dangerous DOM IDs so querySelector never breaks', () => {
    expect(sanitizeDomId('w-pomo_1', 'fallback')).toBe('w-pomo_1');
    expect(sanitizeDomId('bad"][data-x="1', 'fallback')).toBe('baddata-x1');
    expect(sanitizeDomId('";alert(1);//', 'fallback')).toBe('alert1');
    expect(sanitizeDomId('   ', 'fallback')).toBe('fallback');
    expect(sanitizeDomId(null, 'fallback')).toBe('fallback');
  });

  it('returns baseState when saved data is null, primitive, or from a future unknown schema version', () => {
    const base = createDefaultState();
    expect(validateAndMigrateSavedState(null, base)).toEqual(base);
    expect(validateAndMigrateSavedState('corrupted', base)).toEqual(base);
    expect(validateAndMigrateSavedState({ version: SCHEMA_VERSION + 99 }, base)).toEqual(base);
  });

  it('clamps out-of-range numeric settings and validates enums', () => {
    const base = createDefaultState();
    const migrated = validateAndMigrateSavedState(
      {
        version: 2,
        themeId: 'non-existent-theme',
        petType: 'invalid-pet',
        dockScreenMode: 'invalid-mode',
        iconSize: 999,
        magnification: 0.1,
        waterGoal: 500,
      },
      base
    );

    expect(migrated.themeId).toBe('native');
    expect(migrated.petType).toBe('cat');
    expect(migrated.dockScreenMode).toBe('reserve');
    expect(migrated.iconSize).toBe(64);
    expect(migrated.magnification).toBe(1.0);
    expect(migrated.waterGoal).toBe(base.waterGoal);
  });

  it('sanitizes corrupted environment items and ensures unique safe item IDs', () => {
    const base = createDefaultState();
    const migrated = validateAndMigrateSavedState(
      {
        version: 1, // Legacy v1 migration
        activeEnvId: 'custom_env',
        environments: [
          {
            id: 'custom_env',
            name: 'Dev Env',
            color: '#22c55e',
            shortcut: 'Alt+1',
            items: [
              { id: 'dup"][id', kind: 'widget', label: 'Timer', widgetType: 'timer', span: 99 },
              { id: 'dup"][id', kind: 'app', label: 'Terminal', target: 'wt.exe' },
              { id: 'bad_kind', kind: 'unknown_kind', label: 'Ignored' },
            ],
          },
        ],
      },
      base
    );

    expect(migrated.activeEnvId).toBe('custom_env');
    expect(migrated.environments).toHaveLength(1);
    expect(migrated.environments[0].items).toHaveLength(2);
    expect(migrated.environments[0].items[0].id).toBe('dupid');
    expect(migrated.environments[0].items[0].span).toBe(1);
    expect(migrated.environments[0].items[1].id).toBe('dupid_1');
  });
});
