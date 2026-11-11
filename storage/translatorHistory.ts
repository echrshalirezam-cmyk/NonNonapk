import AsyncStorage from '@react-native-async-storage/async-storage';

export type TranslationDirection = 'fa-en' | 'en-fa';
export type TranslationRecord = {
  id: string;
  sourceText: string;
  translatedText: string;
  direction: TranslationDirection;
  createdAt: string;
  inputMode: 'typed' | 'voice';
};

const HISTORY_KEY = 'nonnon.translator.history';
const MAX_HISTORY = 100;

export async function loadTranslationHistory(): Promise<TranslationRecord[]> {
  const raw = await AsyncStorage.getItem(HISTORY_KEY);
  if (!raw) return [];
  try {
    const value: unknown = JSON.parse(raw);
    if (!Array.isArray(value)) return [];
    return value.filter((item): item is TranslationRecord =>
      typeof item?.id === 'string' &&
      typeof item?.sourceText === 'string' &&
      typeof item?.translatedText === 'string' &&
      (item?.direction === 'fa-en' || item?.direction === 'en-fa') &&
      typeof item?.createdAt === 'string' &&
      (item?.inputMode === 'typed' || item?.inputMode === 'voice'),
    ).slice(0, MAX_HISTORY);
  } catch {
    return [];
  }
}

export async function saveTranslationRecord(record: TranslationRecord): Promise<TranslationRecord[]> {
  const current = await loadTranslationHistory();
  const next = [record, ...current.filter((item) => item.id !== record.id)].slice(0, MAX_HISTORY);
  await AsyncStorage.setItem(HISTORY_KEY, JSON.stringify(next));
  return next;
}

export async function clearTranslationHistory(): Promise<void> {
  await AsyncStorage.removeItem(HISTORY_KEY);
}
