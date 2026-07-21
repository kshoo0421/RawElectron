export type AppLocale = 'ko' | 'en';
export type ThemeMode = 'system' | 'light' | 'dark';

export type AppSettings = {
  locale: AppLocale;
  theme: ThemeMode;
};

export const defaultAppSettings: AppSettings = {
  locale: 'ko',
  theme: 'dark',
};

export function sanitizeAppSettings(value: unknown): AppSettings {
  const candidate = value && typeof value === 'object' ? value as Partial<AppSettings> : {};
  return {
    locale: candidate.locale === 'en' ? 'en' : 'ko',
    theme: candidate.theme === 'system' || candidate.theme === 'light' || candidate.theme === 'dark'
      ? candidate.theme
      : 'dark',
  };
}
