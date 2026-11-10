import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { BookOpen, Lock, RefreshCw } from 'lucide-react-native';
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
import { getSections } from '@/content/lessons';
import { getLevelProgress } from '@/utils/lessonProgress';
import { openMistakeWordIds } from '@/utils/mistakeReview';

export default function LessonsScreen() {
  const { activeProfile } = useProfiles();
  if (!activeProfile) return null;

  const { learningLevel, completedLessons } = activeProfile.progress;
  const levelInfo = cefrLevelByCode[learningLevel];
  const sections = getSections(learningLevel);
  const { done, total } = getLevelProgress(learningLevel, completedLessons);
  const percent = total === 0 ? 0 : done / total;
  const openMistakes = openMistakeWordIds(activeProfile.progress).length;

  return (
    <GradientBackground>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <ScreenHeader title="درس‌ها" />

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
  lockedLevel: {\n    flexDirection: 'row',\n    alignItems: 'center',\n    gap: spacing.sm,\n    opacity: 0.72,\n  },\n  lockIcon: {\n    width: 38,\n    height: 38,\n    borderRadius: 13,\n    alignItems: 'center',\n    justifyContent: 'center',\n  },\n  lockedLevelText: {\n    flex: 1,\n    gap: 3,\n  },\n  lockedLevelTitle: {\n    ...typography.bodyStrong,\n    color: semanticColors.textPrimary,\n    textAlign: 'right',\n  },\n  lockedLevelDescription: {\n    ...typography.caption,\n    color: semanticColors.textSecondary,\n    textAlign: 'right',\n  },\n  reviewBox: {
    borderRadius: 24,
    backgroundColor: semanticColors.surface,
    borderWidth: 1,
    borderColor: semanticColors.border,
    overflow: 'hidden',
  },
});
