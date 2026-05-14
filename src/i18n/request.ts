import { getRequestConfig } from 'next-intl/server';
import type { AbstractIntlMessages } from 'next-intl';
import { routing } from './routing';

function get(obj: AbstractIntlMessages | undefined, path: string[]): unknown {
  let cur: unknown = obj;
  for (const segment of path) {
    if (cur && typeof cur === 'object' && segment in (cur as Record<string, unknown>)) {
      cur = (cur as Record<string, unknown>)[segment];
    } else {
      return undefined;
    }
  }
  return cur;
}

export default getRequestConfig(async ({ requestLocale }) => {
  let locale = await requestLocale;
  if (!locale || !routing.locales.includes(locale as (typeof routing.locales)[number])) {
    locale = routing.defaultLocale;
  }

  const localeMessages = (await import(`../../messages/${locale}.json`)).default as AbstractIntlMessages;
  const enMessages = (await import(`../../messages/en.json`)).default as AbstractIntlMessages;

  return {
    locale,
    messages: localeMessages,
    formats: {
      dateTime: {
        short: { day: 'numeric', month: 'short', year: 'numeric' },
        long: { day: 'numeric', month: 'long', year: 'numeric' },
      },
      number: {
        price: { style: 'currency', currency: 'USD' },
        percent: { style: 'percent', maximumFractionDigits: 1 },
      },
    },
    onError(error) {
      if (process.env.NODE_ENV !== 'production') {

        console.warn('[next-intl]', error.message);
      }
    },
    getMessageFallback({ namespace, key }) {
      const fullPath = namespace ? `${namespace}.${key}` : key;
      const fallback = get(enMessages, fullPath.split('.'));
      if (typeof fallback === 'string') return fallback;
      return fullPath;
    },
  };
});
