import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { BookOpen, Brain, Lock, RefreshCw } from 'lucide-react-native';
import { cefrCodes, cefrLevelByCode } from '@/constants/levels';
import { semanticColors, spacing, typography } from '@/constants/theme';
import { GradientBackground } from '@/components/ui/GradientBackground';
import { ScreenHeader } from '@/components/ui/ScreenHeader';
import { EmptyState } from '@/components/ui/EmptyState';
import { ProgressBar } from '@/components/ui/ProgressBar';
import { ListRow } from '@/components/ui/ListRow';
import { SectionCard } from '@/components/lessons/SectionCard';
import { GlowCard } from '@/components/ui/GlowCard';
import { useProfiles } from '@/context/ProfileContext';
import { getSections, orderedLessons } from '@/content/lessons';
import { getLevelProgress } from '@/utils/lessonProgress';
import { openMistakeWordIds } from '@/utils/mistakeReview';

export default function LessonsScreen() {
  const { activeProfile } = useProfiles();
  if (!activeProfile) return null;

  const { learningLevel: savedLearningLevel, completedLessons } = activeProfile.progress;
  const nextLesson = orderedLessons.find((entry) => !completedLessons.includes(entry.lesson.id));
  const learningLevel = nextLesson?.level ?? savedLearningLevel;
  const levelInfo = cefrLevelByCode[learningLevel];
  const sections = getSections(learningLevel);
  const { done, total } = getLevelProgress(learningLevel, completedLessons);
  const percent = total === 0 ? 0 : done / total;
  const openMistakes = openMistakeWordIds(activeProfile.progress).length;

  return (
    <GradientBackground>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <ScreenHeader title="درس‌ها" />

        <Pressable style={styles.assessmentButton} onPress={() => router.push('/assessment')}>
          <View style={styles.assessmentIcon}><Brain size={22} color={semanticColors.primary} /></View>
          <View style={styles.assessmentText}>
            <Text style={styles.assessmentTitle}>آزمون هوشمند آفلاین</Text>
            <Text style={styles.assessmentDescription}>تعیین سطح، آزمون روزانه و تحلیل اشتباهات</Text>
          </View>
          <BookOpen size={18} color={semanticColors.textMuted} />
        </Pressable>

        <View style={styles.summary}>
          <View style={styles.summaryTop}>
            <Text style={[styles.levelBadge, { backgroundColor: levelInfo.color }]}>{levelInfo.code}</Text>
            <Text style={styles.levelName}>{`سطح ${levelInfo.name}`}</Text>
            <Text style={styles.levelCount}>{`${done} از ${total}`}</Text>
          </View>
          <ProgressBar progress={percent} height={10} />
        </View>

        {openMistakes > 0 ? (
          <View style={styles.reviewBox}>
            <ListRow
              icon={RefreshCw}
              label="مرور اشتباهات"
              value={String(openMistakes)}
              onPress={() => router.push('/review')}
            />
          </View>
        ) : null}

        {sections.length === 0 ? (
          <EmptyState
            icon={BookOpen}
            title="به زودی"
            description="درس‌های این سطح در حال آماده‌سازی هستند."
          />
        ) : (
          sections.map((section) => (
            <SectionCard
              key={section.id}
              section={section}
              completedLessons={completedLessons}
              onLessonPress={(lessonId) => router.push({ pathname: '/lesson/[id]', params: { id: lessonId } })}
            />
          ))
        )}

        {cefrCodes.slice(cefrCodes.indexOf(learningLevel) + 1).map((code) => {
          const lockedInfo = cefrLevelByCode[code];
          return (
            <GlowCard key={code} style={styles.lockedLevel}>
              <View style={[styles.lockIcon, { backgroundColor: lockedInfo.color }]}>
                <Lock size={18} color={semanticColors.onPrimary} />
              </View>
              <View style={styles.lockedLevelText}>
                <Text style={styles.lockedLevelTitle}>{`سطح ${lockedInfo.name} (${code})`}</Text>
                <Text style={styles.lockedLevelDescription}>پس از تکمیل تمام درس‌های سطح قبلی باز می‌شود.</Text>
              </View>
            </GlowCard>
          );
        })}
      </ScrollView>
    </GradientBackground>
  );
}

const styles = StyleSheet.create({
  assessmentButton: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, padding: spacing.sm, borderRadius: 20, backgroundColor: semanticColors.surface, borderWidth: 1, borderColor: semanticColors.borderGlow },
  assessmentIcon: { width: 42, height: 42, borderRadius: 14, alignItems: 'center', justifyContent: 'center', backgroundColor: semanticColors.surfaceRaised },
  assessmentText: { flex: 1, gap: 3 },
  assessmentTitle: { ...typography.bodyStrong, color: semanticColors.textPrimary, textAlign: 'right' },
  assessmentDescription: { ...typography.caption, color: semanticColors.textSecondary, textAlign: 'right' },
  content: {
    paddingHorizontal: spacing.sm,
    paddingTop: spacing.md,
    paddingBottom: spacing.lg,
    gap: spacing.sm,
  },
  summary: {
    gap: spacing.xs,
    padding: spacing.sm,
    borderRadius: 24,
    backgroundColor: semanticColors.surface,
    borderWidth: 1,
    borderColor: semanticColors.border,
  },
  summaryTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  levelBadge: {
    ...typography.label,
    paddingHorizontal: spacing.xs,
    paddingVertical: 4,
    borderRadius: 12,
    color: semanticColors.onPrimary,
    overflow: 'hidden',
  },
  levelName: {
    ...typography.bodyStrong,
    flex: 1,
    color: semanticColors.textPrimary,
    textAlign: 'right',
  },
  levelCount: {
    ...typography.label,
    color: semanticColors.textSecondary,
  },
  lockedLevel: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    opacity: 0.72,
  },
  lockIcon: {
    width: 38,
    height: 38,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
  },
  lockedLevelText: {
    flex: 1,
    gap: 3,
  },
  lockedLevelTitle: {
    ...typography.bodyStrong,
    color: semanticColors.textPrimary,
    textAlign: 'right',
  },
  lockedLevelDescription: {
    ...typography.caption,
    color: semanticColors.textSecondary,
    textAlign: 'right',
  },
  reviewBox: {
    borderRadius: 24,
    backgroundColor: semanticColors.surface,
    borderWidth: 1,
    borderColor: semanticColors.border,
    overflow: 'hidden',
  },
});
