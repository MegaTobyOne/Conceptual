import { describe, expect, it } from 'vitest';
import { normaliseThemePreference, resolveEffectiveTheme } from './app-theme.ts';

describe('Explorer theme preferences', () => {
  it('defaults missing, malformed, and retired Colorful preferences to Dark', () => {
    expect(normaliseThemePreference(null)).toBe('dark');
    expect(normaliseThemePreference('unknown')).toBe('dark');
    expect(normaliseThemePreference('colorful')).toBe('dark');
  });

  it('preserves supported preferences', () => {
    expect(normaliseThemePreference('dark')).toBe('dark');
    expect(normaliseThemePreference('light')).toBe('light');
    expect(normaliseThemePreference('system')).toBe('system');
  });

  it('uses the operating-system preference only in System mode', () => {
    expect(resolveEffectiveTheme('system', true)).toBe('light');
    expect(resolveEffectiveTheme('system', false)).toBe('dark');
    expect(resolveEffectiveTheme('dark', true)).toBe('dark');
    expect(resolveEffectiveTheme('light', false)).toBe('light');
  });
});
