import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, ScrollView, Share, StyleSheet, Text, TextInput, View } from 'react-native';
import { router } from 'expo-router';
import { ExpoSpeechRecognitionModule } from 'expo-speech-recognition';
import * as Speech from 'expo-speech';
import { ArrowLeft, ArrowLeftRight, Clock3, Languages, Mic, MicOff, Share2, Trash2, Volume2 } from 'lucide-react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, fonts, radius, semanticColors, spacing } from '@/constants/theme';
import { clearTranslationHistory, loadTranslationHistory, saveTranslationRecord, type TranslationDirection, type TranslationRecord } from '@/storage/translatorHistory';
import { translateText } from '@/utils/translator';

const MAX_INPUT_LENGTH = 5000;
const errorText = (error: unknown) => error instanceof Error ? error.message : 'مشکلی پیش آمد. دوباره تلاش کنید.';

export default function TranslatorScreen() {
  const insets = useSafeAreaInsets();
  const [direction, setDirection] = useState<TranslationDirection>('fa-en');
  const [sourceText, setSourceText] = useState('');
  const [translatedText, setTranslatedText] = useState('');
  const [history, setHistory] = useState<TranslationRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [listening, setListening] = useState(false);
  const [inputMode, setInputMode] = useState<'typed' | 'voice'>('typed');
  const [historyLoading, setHistoryLoading] = useState(true);
  const mounted = useRef(true);
  const subscriptions = useRef<Array<{ remove: () => void }>>([]);

  const sourceLanguage = direction === 'fa-en' ? 'فارسی' : 'English';
  const targetLanguage = direction === 'fa-en' ? 'English' : 'فارسی';
  const sourceLocale = direction === 'fa-en' ? 'fa-IR' : 'en-US';
  const targetLocale = direction === 'fa-en' ? 'en-US' : 'fa-IR';

  useEffect(() => {
    mounted.current = true;
    loadTranslationHistory()
      .then((records) => { if (mounted.current) setHistory(records); })
      .catch(() => { if (mounted.current) Alert.alert('خطا', 'بارگذاری تاریخچه انجام نشد.'); })
      .finally(() => { if (mounted.current) setHistoryLoading(false); });
    return () => {
      mounted.current = false;
      subscriptions.current.forEach((subscription) => subscription.remove());
      subscriptions.current = [];
      try { ExpoSpeechRecognitionModule.abort(); } catch { /* Recognition may already be stopped. */ }
      Speech.stop();
    };
  }, []);

  const runTranslation = useCallback(async (
    text: string,
    mode: 'typed' | 'voice' = 'typed',
    selectedDirection: TranslationDirection = direction,
  ) => {
    const cleanText = text.trim();
    if (!cleanText) {
      Alert.alert('متن خالی است', 'ابتدا متن را تایپ کنید یا با میکروفون صحبت کنید.');
      return;
    }
    setLoading(true);
    setTranslatedText('');
    try {
      const translated = await translateText(cleanText, selectedDirection);
      const record: TranslationRecord = {
        id: Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 8),
        sourceText: cleanText,
        translatedText: translated,
        direction: selectedDirection,
        createdAt: new Date().toISOString(),
        inputMode: mode,
      };
      const updated = await saveTranslationRecord(record);
      if (!mounted.current) return;
      setTranslatedText(translated);
      setHistory(updated);
    } catch (error) {
      if (mounted.current) Alert.alert('ترجمه انجام نشد', errorText(error));
    } finally {
      if (mounted.current) setLoading(false);
    }
  }, [direction]);

  const startVoiceInput = async () => {
    if (listening || loading) return;
    try {
      if (!ExpoSpeechRecognitionModule.isRecognitionAvailable()) {
        Alert.alert('تشخیص گفتار در دسترس نیست', 'سرویس تشخیص گفتار روی گوشی فعال نیست. می‌توانید متن را تایپ کنید.');
        return;
      }
      const current = await ExpoSpeechRecognitionModule.getPermissionsAsync();
      const permission = current.granted ? current : await ExpoSpeechRecognitionModule.requestPermissionsAsync();
      if (!permission.granted) {
        Alert.alert('اجازه میکروفون لازم است', 'برای تبدیل گفتار به متن، اجازه استفاده از میکروفون را فعال کنید.');
        return;
      }
      subscriptions.current.forEach((subscription) => subscription.remove());
      subscriptions.current = [];
      setListening(true);
      setInputMode('voice');
      let finished = false;
      const finish = () => {
        if (finished) return;
        finished = true;
        subscriptions.current.forEach((subscription) => subscription.remove());
        subscriptions.current = [];
        if (mounted.current) setListening(false);
      };
      subscriptions.current.push(
        ExpoSpeechRecognitionModule.addListener('result', (event) => {
          const transcript = event.results[0]?.transcript?.trim() ?? '';
          finish();
          if (!transcript) {
            Alert.alert('صدایی تشخیص داده نشد', 'دوباره تلاش کنید یا متن را تایپ کنید.');
            return;
          }
          setSourceText(transcript);
          void runTranslation(transcript, 'voice');
        }),
        ExpoSpeechRecognitionModule.addListener('error', (event) => {
          finish();
          const message = event.error === 'not-allowed' || event.error === 'service-not-allowed'
            ? 'اجازه میکروفون یا تشخیص گفتار داده نشده است.'
            : event.error === 'no-speech' ? 'صدایی دریافت نشد. دوباره تلاش کنید.' : 'تشخیص گفتار ناموفق بود.';
          Alert.alert('مشکل در دریافت صدا', message);
        }),
        ExpoSpeechRecognitionModule.addListener('end', () => {
          if (!finished) {
            finish();
            if (mounted.current) Alert.alert('پایان ضبط', 'متنی تشخیص داده نشد. دوباره تلاش کنید.');
          }
        }),
      );
      ExpoSpeechRecognitionModule.start({ lang: sourceLocale, interimResults: false, maxAlternatives: 1, continuous: false });
    } catch (error) {
      setListening(false);
      subscriptions.current.forEach((subscription) => subscription.remove());
      subscriptions.current = [];
      Alert.alert('خطا در میکروفون', errorText(error));
    }
  };

  const stopVoiceInput = () => {
    try { ExpoSpeechRecognitionModule.stop(); } catch { /* Ignore stop errors. */ }
  };

  const switchDirection = () => {
    Speech.stop();
    setDirection((current) => current === 'fa-en' ? 'en-fa' : 'fa-en');
    setSourceText(translatedText);
    setTranslatedText('');
    setInputMode('typed');
  };

  const speakTranslation = () => {
    if (!translatedText) return;
    Speech.stop();
    Speech.speak(translatedText, {
      language: targetLocale,
      rate: 0.88,
      onError: () => Alert.alert('پخش صدا ممکن نیست', 'صدای زبان مقصد روی گوشی در دسترس نیست. تنظیمات تبدیل متن به گفتار گوشی را بررسی کنید.'),
    });
  };

  const shareTranslation = async () => {
    if (!translatedText) return;
    try { await Share.share({ message: sourceText + '\n\n' + translatedText }); }
    catch { Alert.alert('خطا', 'اشتراک‌گذاری متن انجام نشد.'); }
  };

  const removeHistory = () => Alert.alert('پاک‌کردن تاریخچه', 'همه ترجمه‌های ذخیره‌شده حذف شوند؟', [
    { text: 'انصراف', style: 'cancel' },
    { text: 'حذف همه', style: 'destructive', onPress: async () => {
      try { await clearTranslationHistory(); setHistory([]); }
      catch { Alert.alert('خطا', 'حذف تاریخچه انجام نشد.'); }
    } },
  ]);

  const restoreRecord = (record: TranslationRecord) => {
    Speech.stop();
    setDirection(record.direction);
    setSourceText(record.sourceText);
    setTranslatedText(record.translatedText);
    setInputMode(record.inputMode);
  };

  const formatDate = (value: string) => new Date(value).toLocaleString('fa-IR', {
    month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
  });

  return (
    <LinearGradient colors={[colors.navy[950], colors.navy[900], colors.navy[800]]} style={styles.background}>
      <ScrollView contentContainerStyle={[styles.content, { paddingTop: insets.top + spacing.sm, paddingBottom: insets.bottom + spacing.xl }]} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <Pressable onPress={() => router.back()} style={styles.backButton} accessibilityRole="button" accessibilityLabel="بازگشت"><ArrowLeft color={semanticColors.textPrimary} size={22} /></Pressable>
          <View style={styles.headerTitleWrap}>
            <Text style={styles.headerTitle}>مترجم هوشمند</Text>
            <Text style={styles.headerSubtitle}>ترجمه نوشتاری و صوتی فارسی و انگلیسی</Text>
          </View>
          <View style={styles.headerIcon}><Languages color={semanticColors.primary} size={23} /></View>
        </View>

        <View style={styles.directionCard}>
          <View style={styles.languageSide}><Text style={styles.languageCaption}>زبان ورودی</Text><Text style={styles.languageName}>{sourceLanguage}</Text></View>
          <Pressable onPress={switchDirection} style={styles.swapButton} accessibilityRole="button" accessibilityLabel="جابه‌جایی زبان‌ها"><ArrowLeftRight color={semanticColors.onPrimary} size={22} /></Pressable>
          <View style={styles.languageSide}><Text style={styles.languageCaption}>زبان ترجمه</Text><Text style={styles.languageName}>{targetLanguage}</Text></View>
        </View>

        <View style={styles.panel}>
          <View style={styles.panelTop}><Text style={styles.panelLabel}>متن شما · {sourceLanguage}</Text><Text style={styles.counter}>{sourceText.length}/{MAX_INPUT_LENGTH}</Text></View>
          <TextInput
            value={sourceText}
            onChangeText={(value) => { setSourceText(value); setTranslatedText(''); setInputMode('typed'); }}
            placeholder={direction === 'fa-en' ? 'اینجا فارسی بنویسید یا صحبت کنید...' : 'Type or speak in English here...'}
            placeholderTextColor={semanticColors.textMuted}
            multiline maxLength={MAX_INPUT_LENGTH} textAlignVertical="top"
            textAlign={direction === 'fa-en' ? 'right' : 'left'}
            style={[styles.input, direction === 'fa-en' ? styles.persianText : styles.englishText]}
            editable={!listening && !loading}
          />
          <View style={styles.inputActions}>
            <Pressable onPress={listening ? stopVoiceInput : startVoiceInput} style={[styles.micButton, listening && styles.micActive]} accessibilityRole="button">
              {listening ? <MicOff color="#FFFFFF" size={20} /> : <Mic color="#FFFFFF" size={20} />}
              <Text style={styles.micText}>{listening ? 'توقف ضبط' : 'صحبت کن'}</Text>
            </Pressable>
            <Text style={styles.voiceHint}>{listening ? 'در حال گوش‌دادن...' : 'ورودی صوتی و نوشتاری'}</Text>
          </View>
        </View>

        <Pressable onPress={() => void runTranslation(sourceText, inputMode)} disabled={loading || listening || !sourceText.trim()} style={({ pressed }) => [styles.translateButton, (loading || listening || !sourceText.trim()) && styles.disabled, pressed && styles.pressed]}>
          {loading ? <ActivityIndicator color={semanticColors.onPrimary} /> : <Languages color={semanticColors.onPrimary} size={20} />}
          <Text style={styles.translateButtonText}>{loading ? 'در حال ترجمه...' : 'ترجمه کن'}</Text>
        </Pressable>

        {(translatedText || loading) && (
          <View style={styles.resultCard}>
            <View style={styles.panelTop}>
              <Text style={styles.panelLabel}>ترجمه · {targetLanguage}</Text>
              <View style={styles.resultActions}>
                <Pressable onPress={speakTranslation} disabled={!translatedText} style={styles.smallAction} accessibilityLabel="پخش ترجمه"><Volume2 color={semanticColors.primary} size={20} /></Pressable>
                <Pressable onPress={shareTranslation} disabled={!translatedText} style={styles.smallAction} accessibilityLabel="اشتراک‌گذاری ترجمه"><Share2 color={semanticColors.primary} size={19} /></Pressable>
              </View>
            </View>
            {loading ? <View style={styles.loadingResult}><ActivityIndicator color={semanticColors.primary} /><Text style={styles.voiceHint}>در حال دریافت ترجمه...</Text></View> :
              <Text selectable style={[styles.resultText, direction === 'fa-en' ? styles.englishText : styles.persianText, { textAlign: direction === 'fa-en' ? 'left' : 'right' }]}>{translatedText}</Text>}
            <Text style={styles.savedNote}>متن اصلی و ترجمه پس از دریافت، خودکار در تاریخچه ذخیره می‌شوند.</Text>
          </View>
        )}

        <View style={styles.historyHeader}>
          <View style={styles.historyTitleRow}><Clock3 color={semanticColors.primary} size={19} /><Text style={styles.historyTitle}>تاریخچه ترجمه‌ها</Text><View style={styles.historyCount}><Text style={styles.historyCountText}>{history.length}</Text></View></View>
          {history.length > 0 && <Pressable onPress={removeHistory} style={styles.clearButton}><Trash2 color={semanticColors.heart} size={16} /><Text style={styles.clearText}>پاک‌کردن</Text></Pressable>}
        </View>
        {historyLoading ? <ActivityIndicator color={semanticColors.primary} style={styles.historyLoader} /> :
          history.length === 0 ? <View style={styles.emptyHistory}><Clock3 color={semanticColors.textMuted} size={25} /><Text style={styles.emptyTitle}>هنوز ترجمه‌ای ذخیره نشده</Text><Text style={styles.emptySubtitle}>ترجمه‌های بعدی اینجا باقی می‌مانند.</Text></View> :
          history.map((record) => (
            <Pressable key={record.id} onPress={() => restoreRecord(record)} style={({ pressed }) => [styles.historyItem, pressed && styles.pressed]}>
              <View style={styles.historyItemTop}><Text style={styles.historyDirection}>{record.direction === 'fa-en' ? 'فارسی ← انگلیسی' : 'English ← فارسی'}</Text><Text style={styles.historyDate}>{formatDate(record.createdAt)}</Text></View>
              <Text numberOfLines={2} style={[styles.historySource, record.direction === 'fa-en' ? styles.persianText : styles.englishText]}>{record.sourceText}</Text>
              <Text numberOfLines={2} style={[styles.historyTranslation, record.direction === 'fa-en' ? styles.englishText : styles.persianText]}>{record.translatedText}</Text>
              <Text style={styles.historyMode}>{record.inputMode === 'voice' ? 'ورودی صوتی' : 'ورودی نوشتاری'} · برای مشاهده لمس کنید</Text>
            </Pressable>
          ))}
      </ScrollView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  background: { flex: 1 },
  content: { paddingHorizontal: spacing.sm, gap: spacing.md },
  header: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.xs },
  backButton: { width: 42, height: 42, borderRadius: 14, backgroundColor: semanticColors.surfaceRaised, alignItems: 'center', justifyContent: 'center' },
  headerTitleWrap: { flex: 1, alignItems: 'flex-end' },
  headerTitle: { fontFamily: fonts.persianBold, color: semanticColors.textPrimary, fontSize: 23 },
  headerSubtitle: { fontFamily: fonts.persianRegular, color: semanticColors.textSecondary, fontSize: 12, marginTop: 2 },
  headerIcon: { width: 44, height: 44, borderRadius: 15, backgroundColor: 'rgba(255,201,60,0.12)', alignItems: 'center', justifyContent: 'center' },
  directionCard: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: semanticColors.surface, borderWidth: 1, borderColor: semanticColors.border, borderRadius: radius.lg, padding: spacing.sm },
  languageSide: { flex: 1, alignItems: 'center', gap: 4 },
  languageCaption: { fontFamily: fonts.persianRegular, color: semanticColors.textMuted, fontSize: 11 },
  languageName: { fontFamily: fonts.persianBold, color: semanticColors.textPrimary, fontSize: 17 },
  swapButton: { width: 44, height: 44, borderRadius: 22, backgroundColor: semanticColors.primary, alignItems: 'center', justifyContent: 'center' },
  panel: { backgroundColor: semanticColors.surface, borderRadius: radius.lg, borderWidth: 1, borderColor: semanticColors.border, padding: spacing.sm, gap: spacing.xs },
  panelTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  panelLabel: { fontFamily: fonts.persianMedium, color: semanticColors.textSecondary, fontSize: 13 },
  counter: { color: semanticColors.textMuted, fontFamily: fonts.regular, fontSize: 11 },
  input: { minHeight: 126, maxHeight: 220, color: semanticColors.textPrimary, fontSize: 16, lineHeight: 26, padding: spacing.xs },
  persianText: { fontFamily: fonts.persianRegular },
  englishText: { fontFamily: fonts.regular },
  inputActions: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderTopWidth: 1, borderTopColor: semanticColors.border, paddingTop: spacing.xs },
  micButton: { flexDirection: 'row', alignItems: 'center', gap: 7, backgroundColor: colors.royal[600], paddingHorizontal: 14, paddingVertical: 10, borderRadius: radius.pill },
  micActive: { backgroundColor: semanticColors.heart },
  micText: { color: '#FFFFFF', fontFamily: fonts.persianMedium, fontSize: 13 },
  voiceHint: { color: semanticColors.textMuted, fontFamily: fonts.persianRegular, fontSize: 11 },
  translateButton: { minHeight: 54, borderRadius: radius.lg, backgroundColor: semanticColors.primary, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.xs },
  translateButtonText: { color: semanticColors.onPrimary, fontFamily: fonts.persianBold, fontSize: 16 },
  disabled: { opacity: 0.45 },
  pressed: { opacity: 0.75 },
  resultCard: { backgroundColor: 'rgba(90,141,255,0.12)', borderRadius: radius.lg, borderWidth: 1, borderColor: 'rgba(143,179,255,0.35)', padding: spacing.sm, gap: spacing.sm },
  resultActions: { flexDirection: 'row', gap: spacing.xs },
  smallAction: { width: 34, height: 34, borderRadius: 17, backgroundColor: semanticColors.surfaceRaised, alignItems: 'center', justifyContent: 'center' },
  resultText: { color: semanticColors.textPrimary, fontSize: 18, lineHeight: 29 },
  savedNote: { fontFamily: fonts.persianRegular, color: semanticColors.success, fontSize: 11, textAlign: 'right' },
  loadingResult: { minHeight: 70, flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: spacing.xs },
  historyHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: spacing.xs },
  historyTitleRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  historyTitle: { fontFamily: fonts.persianBold, color: semanticColors.textPrimary, fontSize: 17 },
  historyCount: { minWidth: 23, height: 23, borderRadius: 12, backgroundColor: semanticColors.surfaceRaised, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 5 },
  historyCountText: { color: semanticColors.primary, fontFamily: fonts.bold, fontSize: 11 },
  clearButton: { flexDirection: 'row', alignItems: 'center', gap: 5, padding: 5 },
  clearText: { fontFamily: fonts.persianMedium, color: semanticColors.heart, fontSize: 12 },
  historyLoader: { marginVertical: spacing.md },
  emptyHistory: { alignItems: 'center', backgroundColor: semanticColors.surface, borderRadius: radius.lg, padding: spacing.lg, gap: spacing.xs },
  emptyTitle: { fontFamily: fonts.persianMedium, color: semanticColors.textSecondary, fontSize: 14 },
  emptySubtitle: { fontFamily: fonts.persianRegular, color: semanticColors.textMuted, fontSize: 12 },
  historyItem: { backgroundColor: semanticColors.surface, borderRadius: radius.md, borderWidth: 1, borderColor: semanticColors.border, padding: spacing.sm, gap: spacing.xs },
  historyItemTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  historyDirection: { fontFamily: fonts.persianMedium, color: semanticColors.primary, fontSize: 11 },
  historyDate: { fontFamily: fonts.persianRegular, color: semanticColors.textMuted, fontSize: 10 },
  historySource: { color: semanticColors.textSecondary, fontSize: 13, lineHeight: 21 },
  historyTranslation: { color: semanticColors.textPrimary, fontSize: 14, lineHeight: 22 },
  historyMode: { color: semanticColors.textMuted, fontFamily: fonts.persianRegular, fontSize: 10, textAlign: 'right' },
});
