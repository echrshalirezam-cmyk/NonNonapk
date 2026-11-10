import AsyncStorage from '@react-native-async-storage/async-storage';
import { useEffect, useState, type ReactNode } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { ArrowRight, Brain, CheckCircle2, Sparkles, Target, Trophy, XCircle } from 'lucide-react-native';
import { cefrCodes, cefrLevelByCode, type CefrCode } from '@/constants/levels';
import { semanticColors, spacing, typography } from '@/constants/theme';
import { GradientBackground } from '@/components/ui/GradientBackground';
import { ScreenHeader } from '@/components/ui/ScreenHeader';
import { GlowCard } from '@/components/ui/GlowCard';
import { ProgressBar } from '@/components/ui/ProgressBar';
import { useProfiles } from '@/context/ProfileContext';
import { orderedLessons } from '@/content/lessons';
import type { Word } from '@/types/lesson';

type Mode = 'placement' | 'daily' | 'level';
type Question = { id: string; level: CefrCode; prompt: string; display: string; helper: string; choices: string[]; answer: number; reviewKey: string };
type AssessmentRecord = { id: string; date: string; mode: Mode; score: number; total: number; level: CefrCode; weakWords: string[] };

const HISTORY_LIMIT = 50;
const QUESTION_COUNT = 12;
const randomItem = <T,>(items: T[]): T => items[Math.floor(Math.random() * items.length)];
const shuffled = <T,>(items: T[]): T[] => [...items].sort(() => Math.random() - 0.5);

function wordsForLevel(level: CefrCode): Word[] {
  const seen = new Set<string>();
  return orderedLessons.filter((entry) => entry.level === level).flatMap((entry) => entry.lesson.words)
    .filter((word) => {
      const key = word.en.trim().toLowerCase();
      if (!key || seen.has(key)) return false;
      seen.add(key);
      return true;
    });
}

const allWords = cefrCodes.flatMap(wordsForLevel);

function makeQuestion(level: CefrCode): Question | null {
  const entries = orderedLessons.filter((entry) => entry.level === level);
  const pool = wordsForLevel(level);
  const exercisePool = entries.flatMap((entry) => entry.lesson.exercises.flatMap((exercise) => {
    if (exercise.type !== 'choice' && exercise.type !== 'translation') return [];
    if (exercise.type === 'choice' && exercise.audio) return [];
    return [{ exercise, lessonTitle: entry.lesson.title }];
  }));
  if (exercisePool.length && Math.random() < 0.4) {
    const item = randomItem(exercisePool);
    return {
      id: item.lessonTitle + ':' + Math.random().toString(36).slice(2),
      level,
      prompt: item.exercise.prompt,
      display: item.lessonTitle,
      helper: 'تمرین جمله و گرامر',
      choices: item.exercise.choices,
      answer: item.exercise.answer,
      reviewKey: item.lessonTitle + ' — ' + item.exercise.prompt,
    };
  }
  if (!pool.length) return null;
  const word = randomItem(pool);
  const distractors = shuffled(allWords.filter((item) => item.en !== word.en && item.fa !== word.fa))
    .filter((item, index, arr) => arr.findIndex((x) => x.fa === item.fa) === index)
    .slice(0, 3).map((item) => item.fa);
  if (distractors.length < 3) return null;
  const choices = shuffled([word.fa, ...distractors]);
  return {
    id: word.en + ':' + Math.random().toString(36).slice(2),
    level,
    prompt: 'معنی این واژه چیست؟',
    display: word.en,
    helper: word.ipa,
    choices,
    answer: choices.indexOf(word.fa),
    reviewKey: word.en,
  };
}

export default function AssessmentScreen() {
  const { activeProfile } = useProfiles();
  const [mode, setMode] = useState<Mode | null>(null);
  const [question, setQuestion] = useState<Question | null>(null);
  const [number, setNumber] = useState(0);
  const [score, setScore] = useState(0);
  const [levelIndex, setLevelIndex] = useState(0);
  const [correctStreak, setCorrectStreak] = useState(0);
  const [wrongStreak, setWrongStreak] = useState(0);
  const [selected, setSelected] = useState<number | null>(null);
  const [weakWords, setWeakWords] = useState<string[]>([]);
  const [history, setHistory] = useState<AssessmentRecord[]>([]);
  const [finished, setFinished] = useState<AssessmentRecord | null>(null);
  const [previousQuestion, setPreviousQuestion] = useState<{ question: Question; selected: number; number: number } | null>(null);
  const [returnQuestion, setReturnQuestion] = useState<{ question: Question; selected: number | null; number: number } | null>(null);
  const [viewingPrevious, setViewingPrevious] = useState(false);

  const storageKey = activeProfile ? 'nonnon.assessments.' + activeProfile.id : '';

  useEffect(() => {
    if (!storageKey) return;
    AsyncStorage.getItem(storageKey).then((raw) => {
      if (raw) setHistory(JSON.parse(raw) as AssessmentRecord[]);
    }).catch(() => undefined);
  }, [storageKey]);

  const nextQuestion = (target: CefrCode) => {
    const candidate = makeQuestion(target);
    setQuestion(candidate);
    setSelected(null);
  };

  const start = (selectedMode: Mode) => {
    const startLevel = selectedMode === 'placement' ? 0 : Math.max(0, cefrCodes.indexOf(activeProfile?.progress.learningLevel ?? 'A1'));
    setMode(selectedMode);
    setLevelIndex(startLevel);
    setNumber(0);
    setScore(0);
    setCorrectStreak(0);
    setWrongStreak(0);
    setWeakWords([]);
    setFinished(null);
    setPreviousQuestion(null);
    setReturnQuestion(null);
    setViewingPrevious(false);
    nextQuestion(cefrCodes[startLevel]);
  };

  const answer = async (choiceIndex: number) => {
    if (!question || selected !== null || viewingPrevious) return;
    setSelected(choiceIndex);
    const isCorrect = choiceIndex === question.answer;
    const nextScore = score + (isCorrect ? 1 : 0);
    const nextWeak = isCorrect ? weakWords : [...weakWords, question.reviewKey];
    setScore(nextScore);
    setWeakWords(nextWeak);
    const nextCorrectStreak = isCorrect ? correctStreak + 1 : 0;
    const nextWrongStreak = isCorrect ? 0 : wrongStreak + 1;
    setCorrectStreak(nextCorrectStreak);
    setWrongStreak(nextWrongStreak);

    const nextIndex = mode === 'placement'
      ? Math.min(cefrCodes.length - 1, Math.max(0, levelIndex + (nextCorrectStreak === 2 ? 1 : nextWrongStreak === 2 ? -1 : 0)))
      : levelIndex;

    setTimeout(async () => {
      const completed = number + 1;
      if (completed >= QUESTION_COUNT) {
        const record: AssessmentRecord = {
          id: Date.now().toString(),
          date: new Date().toISOString(),
          mode: mode ?? 'daily',
          score: nextScore,
          total: QUESTION_COUNT,
          level: cefrCodes[nextIndex],
          weakWords: nextWeak,
        };
        setFinished(record);
        setQuestion(null);
        if (storageKey) {
          const updated = [record, ...history].slice(0, HISTORY_LIMIT);
          setHistory(updated);
          await AsyncStorage.setItem(storageKey, JSON.stringify(updated)).catch(() => undefined);
        }
      } else {
        setPreviousQuestion({ question, selected: choiceIndex, number });
        setReturnQuestion(null);
        setViewingPrevious(false);
        setNumber(completed);
        setLevelIndex(nextIndex);
        nextQuestion(cefrCodes[nextIndex]);
      }
    }, 650);
  };

  const goToPrevious = () => {
    if (!previousQuestion || viewingPrevious || !question) return;
    setReturnQuestion({ question, selected, number });
    setQuestion(previousQuestion.question);
    setSelected(previousQuestion.selected);
    setNumber(previousQuestion.number);
    setViewingPrevious(true);
  };

  const goToCurrent = () => {
    if (!returnQuestion) return;
    setQuestion(returnQuestion.question);
    setSelected(returnQuestion.selected);
    setNumber(returnQuestion.number);
    setReturnQuestion(null);
    setViewingPrevious(false);
  };

  const reset = () => {
    setMode(null);
    setQuestion(null);
    setFinished(null);
    setSelected(null);
  };

  return (
    <GradientBackground>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <ScreenHeader title="آزمون هوشمند آفلاین" onBack={() => router.back()} />
        {!mode ? (
          <>
            <GlowCard style={styles.hero}>
              <View style={styles.heroIcon}><Brain size={28} color={semanticColors.primary} /></View>
              <Text style={styles.heroTitle}>معلم و ارزیاب آفلاین</Text>
              <Text style={styles.description}>بدون اینترنت و بدون هزینه؛ سؤال‌ها با توجه به پاسخ‌های درست و غلط، سطح دشواری‌شان را تغییر می‌دهند. نتیجه و نقاط ضعف روی همین گوشی ذخیره می‌شود.</Text>
            </GlowCard>
            <Text style={styles.sectionTitle}>نوع آزمون را انتخاب کن</Text>
            <ModeCard icon={<Target color={semanticColors.primary} size={22} />} title="تعیین سطح A1 تا C2" detail="۱۲ سؤال تطبیقی برای تخمین سطح فعلی" onPress={() => start('placement')} />
            <ModeCard icon={<Sparkles color={semanticColors.primary} size={22} />} title="آزمون روزانه" detail="۱۲ سؤال از سطح آموزشی فعلی" onPress={() => start('daily')} />
            <ModeCard icon={<Trophy color={semanticColors.primary} size={22} />} title="آزمون سطح فعلی" detail={'تمرین واژگان سطح ' + (activeProfile?.progress.learningLevel ?? 'A1')} onPress={() => start('level')} />
            <View style={styles.historyHeader}><Text style={styles.sectionTitle}>سوابق آزمون</Text><Text style={styles.muted}>{history.length} آزمون</Text></View>
            {history.length === 0 ? <Text style={styles.empty}>هنوز آزمونی ثبت نشده است.</Text> : history.slice(0, 5).map((item) => (
              <View key={item.id} style={styles.historyRow}>
                <Text style={styles.historyScore}>{item.score}/{item.total}</Text>
                <Text style={styles.historyText}>{cefrLevelByCode[item.level].name} ({item.level})</Text>
                <Text style={styles.muted}>{new Date(item.date).toLocaleDateString('fa-IR')}</Text>
              </View>
            ))}
          </>
        ) : finished ? (
          <GlowCard style={styles.resultCard}>
            <Trophy size={42} color={semanticColors.primary} />
            <Text style={styles.resultTitle}>آزمون تمام شد!</Text>
            <Text style={styles.resultScore}>{finished.score} از {finished.total}</Text>
            <Text style={styles.resultLevel}>سطح تخمینی: {finished.level} — {cefrLevelByCode[finished.level].name}</Text>
            <ProgressBar progress={finished.score / finished.total} height={12} />
            <Text style={styles.sectionTitle}>موارد نیازمند مرور</Text>
            {finished.weakWords.length ? finished.weakWords.slice(0, 8).map((word) => <Text key={word} style={styles.weakWord}>• {word}</Text>) : <Text style={styles.description}>عالی بود! در این آزمون اشتباهی نداشتی.</Text>}
            <Text style={styles.note}>نتیجه در سوابق این پروفایل ذخیره شد. این ارزیابی از واژگان و بخشی از تمرین‌های جمله و گرامر استفاده می‌کند و جایگزین آزمون رسمی CEFR نیست.</Text>
            <Pressable style={styles.primaryButton} onPress={reset}><Text style={styles.primaryButtonText}>بازگشت به آزمون‌ها</Text></Pressable>
          </GlowCard>
        ) : question ? (
          <View style={styles.quiz}>
            <View style={styles.quizMeta}><Text style={styles.muted}>سؤال {number + 1} از {QUESTION_COUNT}</Text><Text style={styles.levelPill}>{question.level}</Text></View>
            <ProgressBar progress={(number + 1) / QUESTION_COUNT} height={8} />
            <Text style={styles.questionHint}>{question.prompt}</Text>
            <Text style={styles.word}>{question.display}</Text>
            <Text style={styles.ipa}>{question.helper}</Text>
            <View style={styles.options}>
              {question.choices.map((choice, index) => {
                const isAnswer = index === question.answer;
                const isSelected = selected === index;
                return (
                  <Pressable key={choice + index} disabled={selected !== null} onPress={() => answer(index)}
                    style={[styles.option, selected !== null && isAnswer && styles.correctOption, isSelected && !isAnswer && styles.wrongOption]}>
                    <Text style={[styles.optionText, selected !== null && isAnswer && styles.correctText]}>{choice}</Text>
                    {selected !== null && isAnswer ? <CheckCircle2 color={semanticColors.success} size={20} /> : null}
                    {isSelected && !isAnswer ? <XCircle color={semanticColors.danger} size={20} /> : null}
                  </Pressable>
                );
              })}
            </View>
            <Text style={styles.muted}>سطح سؤال: {question.level}</Text>
            <View style={styles.navigationRow}>
              {viewingPrevious ? (
                <Pressable style={styles.navButton} onPress={goToCurrent}>
                  <Text style={styles.navButtonText}>سؤال بعدی</Text>
                </Pressable>
              ) : previousQuestion ? (
                <Pressable style={styles.navButton} onPress={goToPrevious}>
                  <Text style={styles.navButtonText}>سؤال قبلی</Text>
                </Pressable>
              ) : <View />}
              {viewingPrevious ? <Text style={styles.muted}>در حال مرور سؤال قبلی</Text> : <Text style={styles.muted}>پاسخ ثبت‌شده قابل تغییر نیست</Text>}
            </View>
          </View>
        ) : null}
      </ScrollView>
    </GradientBackground>
  );
}

function ModeCard({ icon, title, detail, onPress }: { icon: ReactNode; title: string; detail: string; onPress: () => void }) {
  return <Pressable onPress={onPress} style={({ pressed }) => [styles.modeCard, pressed && styles.pressed]}><View style={styles.modeIcon}>{icon}</View><View style={styles.modeText}><Text style={styles.modeTitle}>{title}</Text><Text style={styles.modeDetail}>{detail}</Text></View><ArrowRight size={19} color={semanticColors.textMuted} /></Pressable>;
}

const styles = StyleSheet.create({
  content: { padding: spacing.sm, paddingBottom: spacing.xl, gap: spacing.sm },
  hero: { alignItems: 'center', gap: spacing.xs, paddingVertical: spacing.md },
  heroIcon: { width: 58, height: 58, borderRadius: 20, alignItems: 'center', justifyContent: 'center', backgroundColor: semanticColors.surfaceRaised },
  heroTitle: { ...typography.heading, color: semanticColors.textPrimary, textAlign: 'center' },
  description: { ...typography.caption, color: semanticColors.textSecondary, textAlign: 'center', lineHeight: 24 },
  sectionTitle: { ...typography.bodyStrong, color: semanticColors.textPrimary, textAlign: 'right', marginTop: spacing.xs },
  modeCard: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, padding: spacing.sm, borderRadius: 18, backgroundColor: semanticColors.surface, borderWidth: 1, borderColor: semanticColors.border },
  modeIcon: { width: 42, height: 42, borderRadius: 14, alignItems: 'center', justifyContent: 'center', backgroundColor: semanticColors.surfaceRaised },
  modeText: { flex: 1, gap: 3 },
  modeTitle: { ...typography.bodyStrong, color: semanticColors.textPrimary, textAlign: 'right' },
  modeDetail: { ...typography.caption, color: semanticColors.textSecondary, textAlign: 'right' },
  pressed: { opacity: 0.75 },
  historyHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: spacing.sm },
  muted: { ...typography.caption, color: semanticColors.textMuted },
  empty: { ...typography.caption, color: semanticColors.textSecondary, textAlign: 'center', padding: spacing.md },
  historyRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: spacing.sm, backgroundColor: semanticColors.surface, borderRadius: 14 },
  historyScore: { ...typography.bodyStrong, color: semanticColors.primary },
  historyText: { ...typography.caption, color: semanticColors.textPrimary },
  quiz: { gap: spacing.md, paddingTop: spacing.md },
  navigationRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: spacing.sm, minHeight: 48 },
  navButton: { minHeight: 44, justifyContent: 'center', paddingHorizontal: spacing.md, borderRadius: 14, borderWidth: 1, borderColor: semanticColors.borderGlow, backgroundColor: semanticColors.surfaceRaised },
  navButtonText: { ...typography.bodyStrong, color: semanticColors.primary },
  quizMeta: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  levelPill: { ...typography.label, color: semanticColors.primary, backgroundColor: semanticColors.surfaceRaised, paddingHorizontal: 12, paddingVertical: 5, borderRadius: 12 },
  questionHint: { ...typography.body, color: semanticColors.textSecondary, textAlign: 'center', marginTop: spacing.md },
  word: { ...typography.display, color: semanticColors.textPrimary, textAlign: 'center', marginTop: spacing.xs },
  ipa: { ...typography.body, color: semanticColors.textMuted, textAlign: 'center' },
  options: { gap: spacing.xs, marginTop: spacing.md },
  option: { minHeight: 58, paddingHorizontal: spacing.sm, paddingVertical: spacing.sm, borderRadius: 16, borderWidth: 1, borderColor: semanticColors.border, backgroundColor: semanticColors.surface, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  optionText: { ...typography.bodyStrong, color: semanticColors.textPrimary, textAlign: 'right', flex: 1 },
  correctOption: { borderColor: semanticColors.success, backgroundColor: semanticColors.successTint },
  correctText: { color: semanticColors.success },
  wrongOption: { borderColor: semanticColors.danger, backgroundColor: semanticColors.dangerTint },
  resultCard: { alignItems: 'center', gap: spacing.sm, paddingVertical: spacing.lg },
  resultTitle: { ...typography.title, color: semanticColors.textPrimary },
  resultScore: { ...typography.display, color: semanticColors.primary },
  resultLevel: { ...typography.bodyStrong, color: semanticColors.textPrimary, textAlign: 'center' },
  weakWord: { ...typography.body, color: semanticColors.textSecondary, alignSelf: 'stretch', textAlign: 'right' },
  note: { ...typography.caption, color: semanticColors.textMuted, textAlign: 'center', marginTop: spacing.sm },
  primaryButton: { backgroundColor: semanticColors.primary, borderRadius: 16, paddingHorizontal: spacing.lg, paddingVertical: spacing.sm, marginTop: spacing.sm },
  primaryButtonText: { ...typography.bodyStrong, color: semanticColors.onPrimary },
});
