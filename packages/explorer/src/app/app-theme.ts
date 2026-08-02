export type AppThemePreference = 'dark' | 'light' | 'system';
export type EffectiveAppTheme = 'dark' | 'light';

export function normaliseThemePreference(value: string | null): AppThemePreference {
  if (value === 'light' || value === 'system') return value;
  return 'dark';
}

export function resolveEffectiveTheme(
  preference: AppThemePreference,
  systemPrefersLight: boolean,
): EffectiveAppTheme {
  if (preference === 'system') return systemPrefersLight ? 'light' : 'dark';
  return preference;
}
