import AsyncStorage from '@react-native-async-storage/async-storage';

export type FavoriteWord = {
  id: string;
  word: string;
  meaning: string;
  context: string;
  createdAt: string;
};

const KEY = 'nonnon.favoriteWords';

export async function loadFavoriteWords(): Promise<FavoriteWord[]> {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    if (!raw) return [];
    const value: unknown = JSON.parse(raw);
    if (!Array.isArray(value)) return [];
    return value.filter((item): item is FavoriteWord =>
      typeof item?.id === 'string' && typeof item?.word === 'string' &&
      typeof item?.meaning === 'string' && typeof item?.context === 'string' &&
      typeof item?.createdAt === 'string',
    );
  } catch { return []; }
}

export async function addFavoriteWord(word: string, meaning = '', context = ''): Promise<FavoriteWord[]> {
  const clean = word.trim().replace(/^[^\\p{L}]+|[^\\p{L}]+$/gu, '');
  if (!clean) return loadFavoriteWords();
  const current = await loadFavoriteWords();
  const existing = current.find((item) => item.word.toLocaleLowerCase() === clean.toLocaleLowerCase());
  if (existing) {
    const updated = current.map((item) => item.id === existing.id
      ? { ...item, meaning: meaning || item.meaning, context: context || item.context }
      : item);
    await AsyncStorage.setItem(KEY, JSON.stringify(updated));
    return updated;
  }
  const next = [{ id: Date.now().toString(36) + Math.random().toString(36).slice(2, 7), word: clean, meaning, context, createdAt: new Date().toISOString() }, ...current];
  await AsyncStorage.setItem(KEY, JSON.stringify(next));
  return next;
}

export async function removeFavoriteWord(id: string): Promise<FavoriteWord[]> {
  const next = (await loadFavoriteWords()).filter((item) => item.id !== id);
  await AsyncStorage.setItem(KEY, JSON.stringify(next));
  return next;
}

export async function updateFavoriteMeaning(id: string, meaning: string): Promise<FavoriteWord[]> {
  const next = (await loadFavoriteWords()).map((item) => item.id === id ? { ...item, meaning } : item);
  await AsyncStorage.setItem(KEY, JSON.stringify(next));
  return next;
}
