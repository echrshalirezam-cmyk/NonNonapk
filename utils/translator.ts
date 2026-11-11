import type { TranslationDirection } from '@/storage/translatorHistory';

const ENDPOINT = 'https://translate.googleapis.com/translate_a/single';

export async function translateText(text: string, direction: TranslationDirection): Promise<string> {
  const cleanText = text.trim();
  if (!cleanText) throw new Error('متنی برای ترجمه وارد نشده است.');
  if (cleanText.length > 5000) throw new Error('متن ورودی نباید بیشتر از ۵۰۰۰ نویسه باشد.');

  const [source, target] = direction === 'fa-en' ? ['fa', 'en'] : ['en', 'fa'];
  const params = new URLSearchParams({ client: 'gtx', sl: source, tl: target, dt: 't', q: cleanText });
  const response = await fetch(ENDPOINT + '?' + params.toString());
  if (!response.ok) throw new Error('سرویس ترجمه در دسترس نیست. کمی بعد دوباره تلاش کنید.');

  const payload: unknown = await response.json();
  if (!Array.isArray(payload) || !Array.isArray(payload[0])) {
    throw new Error('پاسخ سرویس ترجمه قابل‌خواندن نیست.');
  }
  const translated = (payload[0] as unknown[])
    .map((segment) => Array.isArray(segment) && typeof segment[0] === 'string' ? segment[0] : '')
    .join('')
    .trim();
  if (!translated) throw new Error('ترجمه‌ای دریافت نشد. متن را دوباره امتحان کنید.');
  return translated;
}
