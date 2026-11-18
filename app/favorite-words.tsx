import { useCallback, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect, router } from 'expo-router';
import { ArrowLeft, Star, Trash2, Volume2 } from 'lucide-react-native';
import * as Speech from 'expo-speech';
import { fonts, semanticColors, spacing, radius } from '@/constants/theme';
import { GradientBackground } from '@/components/ui/GradientBackground';
import { loadFavoriteWords, removeFavoriteWord, type FavoriteWord } from '@/storage/favoriteWords';

export default function FavoriteWordsScreen() {
  const [items, setItems] = useState<FavoriteWord[]>([]);
  const [loading, setLoading] = useState(true);
  useFocusEffect(useCallback(() => {
    let active = true;
    loadFavoriteWords().then((value) => { if (active) setItems(value); }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []));
  const remove = (item: FavoriteWord) => Alert.alert('حذف کلمه', '«' + item.word + '» از کلمات برگزیده حذف شود؟', [
    { text: 'انصراف', style: 'cancel' },
    { text: 'حذف', style: 'destructive', onPress: async () => setItems(await removeFavoriteWord(item.id)) },
  ]);
  return (
    <GradientBackground>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.header}>
          <Pressable onPress={() => router.back()} style={styles.back}><ArrowLeft color={semanticColors.textPrimary} size={22} /></Pressable>
          <View style={styles.heading}><Text style={styles.title}>کلمات برگزیده</Text><Text style={styles.subtitle}>{items.length} کلمه ذخیره‌شده</Text></View>
          <Star color={semanticColors.primary} size={25} />
        </View>
        {loading ? <Text style={styles.empty}>در حال بارگذاری...</Text> : items.length === 0 ?
          <View style={styles.emptyBox}><Star color={semanticColors.textMuted} size={30}/><Text style={styles.empty}>هنوز کلمه‌ای انتخاب نکرده‌ای.</Text><Text style={styles.hint}>در متن انگلیسی روی هر کلمه بزن تا اینجا ذخیره شود.</Text></View> :
          items.map((item) => <View key={item.id} style={styles.card}>
            <View style={styles.actions}>
              <Pressable onPress={() => Speech.speak(item.word, { language: 'en-US' })} style={styles.action}><Volume2 color={semanticColors.primary} size={19}/></Pressable>
              <Pressable onPress={() => remove(item)} style={styles.action}><Trash2 color={semanticColors.heart} size={18}/></Pressable>
            </View>
            <Text style={styles.word}>{item.word}</Text>
            {item.meaning ? <Text style={styles.meaning}>{item.meaning}</Text> : <Text style={styles.hint}>معنی هنوز ثبت نشده</Text>}
            {item.context ? <Text style={styles.context}>{item.context}</Text> : null}
          </View>)}
      </ScrollView>
    </GradientBackground>
  );
}
const styles = StyleSheet.create({
  content: { padding: spacing.sm, gap: spacing.sm, paddingBottom: spacing.xl },
  header: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.sm },
  back: { width: 42, height: 42, borderRadius: 14, backgroundColor: semanticColors.surfaceRaised, alignItems: 'center', justifyContent: 'center' },
  heading: { flex: 1, alignItems: 'flex-end' },
  title: { color: semanticColors.textPrimary, fontFamily: fonts.persianBold, fontSize: 22 },
  subtitle: { color: semanticColors.textMuted, fontFamily: fonts.persianRegular, fontSize: 12 },
  card: { backgroundColor: semanticColors.surface, borderColor: semanticColors.border, borderWidth: 1, borderRadius: radius.lg, padding: spacing.sm, gap: spacing.xs },
  actions: { flexDirection: 'row', justifyContent: 'flex-start', gap: spacing.xs },
  action: { padding: 7, borderRadius: 18, backgroundColor: semanticColors.surfaceRaised },
  word: { color: semanticColors.textPrimary, fontFamily: fonts.bold, fontSize: 20, textAlign: 'left' },
  meaning: { color: semanticColors.primary, fontFamily: fonts.persianMedium, fontSize: 15, textAlign: 'right' },
  context: { color: semanticColors.textMuted, fontFamily: fonts.regular, fontSize: 12 },
  emptyBox: { alignItems: 'center', padding: spacing.lg, gap: spacing.sm },
  empty: { color: semanticColors.textSecondary, fontFamily: fonts.persianMedium, textAlign: 'center' },
  hint: { color: semanticColors.textMuted, fontFamily: fonts.persianRegular, fontSize: 12, textAlign: 'right' },
});
