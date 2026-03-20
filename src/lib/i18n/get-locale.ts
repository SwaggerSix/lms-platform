import { cookies, headers } from 'next/headers';
import { locales, defaultLocale, type Locale } from '@/i18n/config';

/**
 * Determine the current locale from (in priority order):
 * 1. Cookie (lms-locale)
 * 2. Accept-Language header
 * 3. Default to 'en'
 *
 * Note: User's saved preference (users.preferences.locale) is synced
 * to the cookie on login/preference change, so the cookie check
 * effectively covers the database preference as well.
 */
export async function getLocale(): Promise<Locale> {
  // 1. Check cookie
  const cookieStore = await cookies();
  const cookieLocale = cookieStore.get('lms-locale')?.value;
  if (cookieLocale && locales.includes(cookieLocale as Locale)) {
    return cookieLocale as Locale;
  }

  // 2. Check Accept-Language header
  const headerStore = await headers();
  const acceptLanguage = headerStore.get('accept-language');
  if (acceptLanguage) {
    // Parse Accept-Language header, e.g. "en-US,en;q=0.9,fr;q=0.8"
    const preferred = acceptLanguage
      .split(',')
      .map((part) => {
        const [lang, q] = part.trim().split(';q=');
        return {
          lang: lang.trim().split('-')[0].toLowerCase(), // "en-US" -> "en"
          quality: q ? parseFloat(q) : 1,
        };
      })
      .sort((a, b) => b.quality - a.quality);

    for (const { lang } of preferred) {
      if (locales.includes(lang as Locale)) {
        return lang as Locale;
      }
    }
  }

  // 3. Default
  return defaultLocale;
}
