import { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { BookOpen, Brain, CheckCircle2, Dumbbell, Languages, RotateCcw, Sparkles, XCircle } from 'lucide-react-native';
import { cefrLevelByCode } from '@/constants/levels';
import { semanticColors, spacing, typography } from '@/constants/theme';
import { orderedLessons } from '@/content/lessons';
import type { CefrCode } from '@/constants/levels';
import type { Exercise } from '@/types/lesson';
import { GradientBackground } from '@/components/ui/GradientBackground';
import { ScreenHeader } from '@/components/ui/ScreenHeader';
import { PrimaryButton } from '@/components/ui/PrimaryButton';
import { GlowCard } from '@/components/ui/GlowCard';
import { useProfiles } from '@/context/ProfileContext';

type PracticeMode = 'vocabulary' | 'grammar' | 'mixed';
type Question = { id: string; prompt: string; choices: string[]; answer: number; explanation: string };

const QUESTION_COUNT = 10;

function shuffle<T>(items: T[]): T[] {
  const result = [...items];
  for (let i = result.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

function withAnswer(correct: string, distractors: string[], id: string, prompt: string, explanation: string): Question {
  const choices = shuffle([correct, ...shuffle(distractors.filter((item) => item !== correct)).slice(0, 3)]);
  return { id, prompt, choices, answer: choices.indexOf(correct), explanation };
}

function buildQuestions(level: CefrCode, mode: PracticeMode): Question[] {
  const levelIndex = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'].indexOf(level);
  const entries = orderedLessons.filter((entry) => ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'].indexOf(entry.level) <= levelIndex);
  const words = entries.flatMap((entry) => entry.lesson.words);
  const vocabulary = mode === 'grammar' ? [] : words.map((word) =>
    withAnswer(word.fa, words.map((item) => item.fa), word.en, `معنی واژه «${word.en}» چیست؟`, `${word.en} یعنی «${word.fa}».`),
  );

  const grammarItems = entries.flatMap((entry) => {
    const note = entry.lesson.grammar;
    if (!note || note.examples.length === 0) return [];
    const titles = entries.map((item) => item.lesson.grammar?.title).filter((title): title is string => Boolean(title));
    const example = note.examples[0];
    return [withAnswer(note.title, titles, `grammar-${entry.lesson.id}`, `این جمله به کدام نکته گرامری مربوط است؟\n${example.en}`, `${note.title}: ${note.rule}`)];
  });
  const grammar = mode === 'vocabulary' ? [] : grammarItems;

  const exerciseQuestions = mode === 'mixed'
    ? entries.flatMap((entry) => entry.lesson.exercises.flatMap((exercise: Exercise, index) => {
        if (exercise.type !== 'choice' && exercise.type !== 'translation') return [];
        return [{
          id: `exercise-${entry.lesson.id}-${index}`,
          prompt: exercise.prompt,
          choices: exercise.choices,
          answer: exercise.answer,
          explanation: `پاسخ درست: ${exercise.choices[exercise.answer]}`,
        }];
      }))
    : [];

  return shuffle([...vocabulary, ...grammar, ...exerciseQuestions]).slice(0, 80);
}

const modes: { id: PracticeMode; title: string; subtitle: string; icon: typeof BookOpen }[] = [
  { id: 'vocabulary', title: 'تمرین واژگان', subtitle: 'معنی واژه‌های انگلیسی را یاد بگیر', icon: Languages },
  { id: 'grammar', title: 'تمرین گرامر', subtitle: 'ساختار جمله‌ها و قواعد را مرور کن', icon: Brain },
  { id: 'mixed', title: 'تمرین ترکیبی', subtitle: 'واژگان، ترجمه و سؤال‌های درس‌ها', icon: Sparkles },
];

export default function PracticeScreen() {
  const { activeProfile } = useProfiles();
  const [mode, setMode] = useState<PracticeMode | null>(null);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [index, setIndex] = useState(0);
  const [selected, setSelected] = useState<number | null>(null);
  const [score, setScore] = useState(0);
  const [finished, setFinished] = useState(false);

  const level = activeProfile?.progress.learningLevel ?? 'A1';
  const levelInfo = cefrLevelByCode[level];
  const current = questions[index];
  const progress = useMemo(() => questions.length ? (index + (selected !== null ? 1 : 0)) / questions.length : 0, [index, selected, questions.length]);

  if (!activeProfile) return null;

  function startPractice(nextMode: PracticeMode) {
    const pool = buildQuestions(level, nextMode);
    const session = shuffle(pool).slice(0, QUESTION_COUNT);
    setMode(nextMode);
    setQuestions(session);
    setIndex(0);
    setSelected(null);
    setScore(0);
    setFinished(false);
  }

  function chooseAnswer(choiceIndex: number) {
    if (selected !== null || !current) return;
    setSelected(choiceIndex);
    if (choiceIndex === current.answer) setScore((value) => value + 1);
  }

  function nextQuestion() {
    if (index + 1 >= questions.length) {
      setFinished(true);
      return;
    }
    setIndex((value) => value + 1);
    setSelected(null);
  }

  function resetPractice() {
    setMode(null);
    setQuestions([]);
    setIndex(0);
    setSelected(null);
    setScore(0);
    setFinished(false);
  }

  return (
    <GradientBackground>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <ScreenHeader title="مرکز تمرین" onBack={() => (mode ? resetPractice() : router.back())} />
        {!mode ? (
          <>
            <GlowCard style={styles.intro}>
              <View style={styles.introIcon}><Dumbbell size={26} color={semanticColors.primary} /></View>
              <Text style={styles.introTitle}>هر روز کمی تمرین کن</Text>
              <Text style={styles.introText}>تمرین‌ها مستقل از درس‌ها هستند؛ نتیجه هر نوبت را همین‌جا می‌بینی و پیشرفت درس‌هایت تغییر نمی‌کند.</Text>
              <Text style={styles.levelText}>سطح فعلی: {levelInfo.code} · {levelInfo.name}</Text>
            </GlowCard>
            <Text style={styles.sectionTitle}>نوع تمرین را انتخاب کن</Text>
            {modes.map((item) => {
              const Icon = item.icon;
              return (
                <Pressable key={item.id} onPress={() => startPractice(item.id)} style={({ pressed }) => [styles.modeCard, pressed && styles.pressed]}>
                  <View style={styles.modeIcon}><Icon size={23} color={semanticColors.primary} /></View>
                  <View style={styles.modeText}>
                    <Text style={styles.modeTitle}>{item.title}</Text>
                    <Text style={styles.modeSubtitle}>{item.subtitle}</Text>
                    <Text style={styles.modeCount}>آزمون ۱۰ سؤالی</Text>
                  </View>
                </Pressable>
              );
            })}
          </>
        ) : finished ? (
          <GlowCard style={styles.resultCard}>
            <CheckCircle2 size={42} color={semanticColors.success} />
            <Text style={styles.resultTitle}>تمرین تمام شد!</Text>
            <Text style={styles.resultScore}>{score} از {questions.length}</Text>
            <Text style={styles.resultText}>{score >= 8 ? 'عالی بود! همین‌طور ادامه بده.' : score >= 5 ? 'خوب پیش رفتی؛ با تکرار بهتر می‌شی.' : 'اشکالی نداره؛ دوباره تمرین کن.'}</Text>
            <PrimaryButton label="تمرین دوباره" icon={<RotateCcw size={18} color={semanticColors.onPrimary} />} onPress={() => startPractice(mode ?? 'mixed')} />
            <Pressable onPress={resetPractice} style={styles.secondaryButton}><Text style={styles.secondaryText}>بازگشت به مرکز تمرین</Text></Pressable>
          </GlowCard>
        ) : current ? (
          <View style={styles.quiz}>
            <View style={styles.quizTop}>
              <Text style={styles.counter}>سؤال {index + 1} از {questions.length}</Text>
              <Text style={styles.counter}>درست: {score}</Text>
            </View>
            <View style={styles.track}><View style={[styles.trackFill, { width: `${progress * 100}%` }]} /></View>
            <GlowCard style={styles.questionCard}>
              <Text style={styles.questionLabel}>بهترین پاسخ را انتخاب کن</Text>
              <Text style={styles.question}>{current.prompt}</Text>
            </GlowCard>
            <View style={styles.options}>
              {current.choices.map((choice, choiceIndex) => {
                const isCorrect = choiceIndex === current.answer;
                const isSelected = selected === choiceIndex;
                return (
                  <Pressable key={`${current.id}-${choiceIndex}`} disabled={selected !== null} onPress={() => chooseAnswer(choiceIndex)} style={[styles.option, isSelected && (isCorrect ? styles.correctOption : styles.wrongOption), selected !== null && isCorrect && styles.correctOption]}>
                    <Text style={[styles.optionText, (isSelected || (selected !== null && isCorrect)) && styles.selectedOptionText]}>{choice}</Text>
                    {selected !== null && isCorrect ? <CheckCircle2 size={19} color={semanticColors.success} /> : null}
                    {isSelected && !isCorrect ? <XCircle size={19} color={semanticColors.danger} /> : null}
                  </Pressable>
                );
              })}
            </View>
            {selected !== null ? (
              <View style={styles.feedback}>
                <Text style={styles.feedbackTitle}>{selected === current.answer ? 'آفرین! پاسخ درست بود.' : 'این بار درست نبود.'}</Text>
                <Text style={styles.feedbackText}>{current.explanation}</Text>
                <PrimaryButton label={index + 1 === questions.length ? 'دیدن نتیجه' : 'سؤال بعدی'} onPress={nextQuestion} />
              </View>
            ) : null}
          </View>
        ) : (
          <GlowCard style={styles.resultCard}>
            <Text style={styles.resultTitle}>تمرین کافی برای این بخش پیدا نشد.</Text>
            <Text style={styles.resultText}>با انتخاب سطح دیگری از مسیر یادگیری، محتوای بیشتری در دسترس خواهد بود.</Text>
            <PrimaryButton label="بازگشت" onPress={resetPractice} />
          </GlowCard>
        )}
      </ScrollView>
    </GradientBackground>
  );
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: spacing.sm, paddingTop: spacing.md, paddingBottom: spacing.xl, gap: spacing.sm },
  intro: { alignItems: 'center', gap: spacing.xs, paddingVertical: spacing.lg },
  introIcon: { width: 54, height: 54, borderRadius: 18, alignItems: 'center', justifyContent: 'center', backgroundColor: semanticColors.surfaceRaised },
  introTitle: { ...typography.heading, color: semanticColors.textPrimary },
  introText: { ...typography.body, color: semanticColors.textSecondary, textAlign: 'center', lineHeight: 26 },
  levelText: { ...typography.label, color: semanticColors.primary },
  sectionTitle: { ...typography.bodyStrong, color: semanticColors.textPrimary, textAlign: 'right', marginTop: spacing.sm },
  modeCard: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, padding: spacing.md, borderRadius: 22, backgroundColor: semanticColors.surface, borderWidth: 1, borderColor: semanticColors.border },
  pressed: { opacity: 0.8, transform: [{ scale: 0.99 }] },
  modeIcon: { width: 48, height: 48, borderRadius: 16, alignItems: 'center', justifyContent: 'center', backgroundColor: semanticColors.surfaceRaised },
  modeText: { flex: 1, gap: 4 },
  modeTitle: { ...typography.bodyStrong, color: semanticColors.textPrimary, textAlign: 'right' },
  modeSubtitle: { ...typography.caption, color: semanticColors.textSecondary, textAlign: 'right' },
  modeCount: { ...typography.label, color: semanticColors.primary, textAlign: 'right' },
  quiz: { gap: spacing.md },
  quizTop: { flexDirection: 'row', justifyContent: 'space-between' },
  counter: { ...typography.label, color: semanticColors.textSecondary },
  track: { height: 8, borderRadius: 8, backgroundColor: semanticColors.surfaceRaised, overflow: 'hidden' },
  trackFill: { height: '100%', backgroundColor: semanticColors.primary, borderRadius: 8 },
  questionCard: { gap: spacing.sm, padding: spacing.lg },
  questionLabel: { ...typography.caption, color: semanticColors.textSecondary, textAlign: 'center' },
  question: { ...typography.heading, color: semanticColors.textPrimary, textAlign: 'center', lineHeight: 32 },
  options: { gap: spacing.xs },
  option: { minHeight: 54, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: spacing.md, borderRadius: 17, backgroundColor: semanticColors.surface, borderWidth: 1, borderColor: semanticColors.border },
  optionText: { ...typography.bodyStrong, color: semanticColors.textPrimary, flex: 1, textAlign: 'right' },
  selectedOptionText: { color: semanticColors.textPrimary },
  correctOption: { borderColor: semanticColors.success, backgroundColor: 'rgba(40, 180, 120, 0.16)' },
  wrongOption: { borderColor: semanticColors.danger, backgroundColor: 'rgba(220, 70, 90, 0.14)' },
  feedback: { gap: spacing.xs, padding: spacing.md, borderRadius: 20, backgroundColor: semanticColors.surface },
  feedbackTitle: { ...typography.bodyStrong, color: semanticColors.textPrimary, textAlign: 'right' },
  feedbackText: { ...typography.body, color: semanticColors.textSecondary, textAlign: 'right' },
  resultCard: { alignItems: 'center', gap: spacing.md, padding: spacing.lg },
  resultTitle: { ...typography.heading, color: semanticColors.textPrimary, textAlign: 'center' },
  resultScore: { fontSize: 42, fontWeight: '800', color: semanticColors.primary },
  resultText: { ...typography.body, color: semanticColors.textSecondary, textAlign: 'center' },
  secondaryButton: { padding: spacing.sm },
  secondaryText: { ...typography.bodyStrong, color: semanticColors.primary },
});
