import { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { BookOpen, CheckCircle2, ChevronDown, ChevronUp, Lock, Map, Play, Target } from 'lucide-react-native';
import { cefrCodes, cefrLevelByCode, type CefrCode } from '@/constants/levels';
import { semanticColors, spacing, typography } from '@/constants/theme';
import { GradientBackground } from '@/components/ui/GradientBackground';
import { ScreenHeader } from '@/components/ui/ScreenHeader';
import { GlowCard } from '@/components/ui/GlowCard';
import { ProgressBar } from '@/components/ui/ProgressBar';
import { useProfiles } from '@/context/ProfileContext';
import { getSections, orderedLessons } from '@/content/lessons';
import { getLessonStatus, getLevelProgress } from '@/utils/lessonProgress';
import type { LessonSection } from '@/types/lesson';

function sectionProgress(section: LessonSection, completed: string[]) {
  const done = section.lessons.filter((lesson) => completed.includes(lesson.id)).length;
  return { done, total: section.lessons.length, percent: section.lessons.length ? done / section.lessons.length : 0 };
}

export default function LearningPathScreen() {
  const { activeProfile } = useProfiles();
  const [expandedLevel, setExpandedLevel] = useState<CefrCode | null>(null);

  const completed = activeProfile?.progress.completedLessons ?? [];
  const nextEntry = useMemo(
    () => orderedLessons.find((entry) => !completed.includes(entry.lesson.id)) ?? null,
    [completed],
  );
  const currentLevel = nextEntry?.level ?? activeProfile?.progress.learningLevel ?? 'A1';

  if (!activeProfile) return null;

  function openLesson(id: string) {
    router.push({ pathname: '/lesson/[id]', params: { id } });
  }

  return (
    <GradientBackground>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <ScreenHeader title="مسیر یادگیری" />
        <GlowCard style={styles.hero}>
          <View style={styles.heroIcon}><Map size={27} color={semanticColors.primary} /></View>
          <Text style={styles.heroTitle}>نقشه راه انگلیسی تو</Text>
          <Text style={styles.heroDescription}>از سطح مقدماتی تا حرفه‌ای؛ قدم‌به‌قدم پیش برو و مسیر پیشرفتت را دنبال کن.</Text>
          <View style={styles.currentPill}>
            <Target size={16} color={semanticColors.primary} />
            <Text style={styles.currentText}>سطح فعلی: {currentLevel} · {cefrLevelByCode[currentLevel].name}</Text>
          </View>
          {nextEntry ? (
            <Pressable onPress={() => openLesson(nextEntry.lesson.id)} style={({ pressed }) => [styles.continueButton, pressed && styles.pressed]}>
              <Play size={18} color={semanticColors.onPrimary} fill={semanticColors.onPrimary} />
              <Text style={styles.continueText}>ادامه مسیر · {nextEntry.lesson.title}</Text>
            </Pressable>
          ) : (
            <Text style={styles.finishedText}>تبریک! تمام درس‌های مسیر را کامل کرده‌ای.</Text>
          )}
        </GlowCard>

        <View style={styles.overview}>
          <Text style={styles.overviewTitle}>مراحل یادگیری</Text>
          <Text style={styles.overviewSub}>هر سطح با تکمیل درس‌های سطح قبل باز می‌شود.</Text>
        </View>

        {cefrCodes.map((code, levelIndex) => {
          const info = cefrLevelByCode[code];
          const sections = getSections(code);
          const stats = getLevelProgress(code, completed);
          const percent = stats.total ? stats.done / stats.total : 0;
          const isLocked = sections.length > 0 && getLessonStatus(sections[0].lessons[0]?.id ?? '', completed) === 'locked';
          const isCurrent = code === currentLevel && !isLocked;
          const isExpanded = expandedLevel === code;
          return (
            <GlowCard key={code} style={[styles.levelCard, isLocked && styles.lockedCard]}>
              <Pressable onPress={() => setExpandedLevel(isExpanded ? null : code)} style={styles.levelHeader}>
                <View style={[styles.levelBadge, { backgroundColor: info.color }]}>
                  {isLocked ? <Lock size={19} color={semanticColors.onPrimary} /> : <Text style={styles.levelBadgeText}>{code}</Text>}
                </View>
                <View style={styles.levelInfo}>
                  <View style={styles.levelTitleRow}>
                    <Text style={styles.levelTitle}>سطح {info.name}</Text>
                    {isCurrent ? <Text style={styles.currentBadge}>سطح فعلی</Text> : null}
                    {stats.total > 0 && stats.done === stats.total ? <CheckCircle2 size={18} color={semanticColors.success} /> : null}
                  </View>
                  <Text style={styles.levelCount}>{stats.done} از {stats.total} درس · {Math.round(percent * 100)}٪</Text>
                </View>
                {isExpanded ? <ChevronUp size={21} color={semanticColors.textSecondary} /> : <ChevronDown size={21} color={semanticColors.textSecondary} />}
              </Pressable>
              <ProgressBar progress={percent} height={8} />
              {isLocked ? (
                <Text style={styles.lockedHint}>پس از تکمیل تمام درس‌های سطح قبلی باز می‌شود.</Text>
              ) : null}
              {isExpanded ? (
                <View style={styles.sections}>
                  {sections.map((section) => {
                    const progress = sectionProgress(section, completed);
                    const available = section.lessons.find((lesson) => getLessonStatus(lesson.id, completed) === 'unlocked');
                    const locked = !available && progress.done < progress.total;
                    return (
                      <Pressable
                        key={section.id}
                        disabled={!available}
                        onPress={() => available && openLesson(available.id)}
                        style={({ pressed }) => [styles.sectionRow, pressed && styles.pressed, !available && styles.sectionDisabled]}
                      >
                        <View style={styles.sectionIcon}>
                          {progress.done === progress.total ? <CheckCircle2 size={18} color={semanticColors.success} /> : locked ? <Lock size={17} color={semanticColors.textMuted} /> : <BookOpen size={17} color={semanticColors.primary} />}
                        </View>
                        <View style={styles.sectionInfo}>
                          <Text style={styles.sectionTitle}>{section.index}. {section.title}</Text>
                          <Text style={styles.sectionCount}>{progress.done} از {progress.total} درس کامل شده</Text>
                        </View>
                        {available ? <Play size={16} color={semanticColors.primary} /> : null}
                      </Pressable>
                    );
                  })}
                  {sections.length === 0 ? <Text style={styles.lockedHint}>محتوای این سطح هنوز آماده نشده است.</Text> : null}
                </View>
              ) : null}
              {levelIndex < cefrCodes.length - 1 && !isLocked && stats.total > 0 && stats.done === stats.total ? (
                <Text style={styles.unlockedHint}>این سطح کامل شده؛ سطح بعدی را ادامه بده.</Text>
              ) : null}
            </GlowCard>
          );
        })}
      </ScrollView>
    </GradientBackground>
  );
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: spacing.sm, paddingTop: spacing.md, paddingBottom: spacing.xl, gap: spacing.sm },
  hero: { alignItems: 'center', gap: spacing.sm, padding: spacing.lg },
  heroIcon: { width: 56, height: 56, borderRadius: 19, alignItems: 'center', justifyContent: 'center', backgroundColor: semanticColors.surfaceRaised },
  heroTitle: { ...typography.heading, color: semanticColors.textPrimary, textAlign: 'center' },
  heroDescription: { ...typography.body, color: semanticColors.textSecondary, textAlign: 'center', lineHeight: 26 },
  currentPill: { flexDirection: 'row', alignItems: 'center', gap: 7, borderRadius: 20, paddingHorizontal: spacing.md, paddingVertical: spacing.xs, backgroundColor: semanticColors.surfaceRaised },
  currentText: { ...typography.label, color: semanticColors.primary },
  continueButton: { width: '100%', minHeight: 50, borderRadius: 16, backgroundColor: semanticColors.primary, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.xs, paddingHorizontal: spacing.sm },
  continueText: { ...typography.bodyStrong, color: semanticColors.onPrimary, textAlign: 'center', flexShrink: 1 },
  finishedText: { ...typography.bodyStrong, color: semanticColors.success, textAlign: 'center' },
  overview: { gap: 3, paddingHorizontal: 4, paddingTop: spacing.sm },
  overviewTitle: { ...typography.heading, color: semanticColors.textPrimary, textAlign: 'right' },
  overviewSub: { ...typography.caption, color: semanticColors.textSecondary, textAlign: 'right' },
  levelCard: { gap: spacing.sm },
  lockedCard: { opacity: 0.78 },
  levelHeader: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  levelBadge: { width: 48, height: 48, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  levelBadgeText: { ...typography.bodyStrong, color: semanticColors.onPrimary },
  levelInfo: { flex: 1, gap: 4 },
  levelTitleRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  levelTitle: { ...typography.bodyStrong, color: semanticColors.textPrimary },
  currentBadge: { ...typography.label, color: semanticColors.primary, backgroundColor: semanticColors.surfaceRaised, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 10, overflow: 'hidden' },
  levelCount: { ...typography.caption, color: semanticColors.textSecondary, textAlign: 'right' },
  lockedHint: { ...typography.caption, color: semanticColors.textMuted, textAlign: 'right', lineHeight: 22 },
  sections: { gap: spacing.xs, paddingTop: spacing.xs, borderTopWidth: 1, borderTopColor: semanticColors.border },
  sectionRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, minHeight: 58, paddingHorizontal: spacing.xs, borderRadius: 14, backgroundColor: semanticColors.surfaceRaised },
  sectionDisabled: { opacity: 0.65 },
  sectionIcon: { width: 30, alignItems: 'center' },
  sectionInfo: { flex: 1, gap: 3 },
  sectionTitle: { ...typography.bodyStrong, color: semanticColors.textPrimary, textAlign: 'right' },
  sectionCount: { ...typography.caption, color: semanticColors.textSecondary, textAlign: 'right' },
  unlockedHint: { ...typography.caption, color: semanticColors.success, textAlign: 'right' },
  pressed: { opacity: 0.8, transform: [{ scale: 0.99 }] },
});
