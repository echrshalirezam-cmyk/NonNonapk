import { StyleSheet, Text, View } from 'react-native';
import { Lock } from 'lucide-react-native';
import { semanticColors, spacing, typography } from '@/constants/theme';
import type { LessonSection } from '@/types/lesson';
import { GlowCard } from '@/components/ui/GlowCard';
import { LessonRow } from '@/components/lessons/LessonRow';
import { getLessonStatus } from '@/utils/lessonProgress';
import { fontForText } from '@/utils/fontForText';

type SectionCardProps = {
  section: LessonSection;
  completedLessons: string[];
  onLessonPress: (lessonId: string) => void;
};

export function SectionCard({ section, completedLessons, onLessonPress }: SectionCardProps) {
  const doneCount = section.lessons.filter((lesson) => completedLessons.includes(lesson.id)).length;
  const sectionLocked =
    section.lessons.length > 0 &&
    getLessonStatus(section.lessons[0].id, completedLessons) === 'locked';

  return (
    <GlowCard style={styles.card}>
      <View style={styles.header}>
        <Text style={[styles.title, { fontFamily: fontForText(section.title, 'bold') }]}>
          {`بخش ${section.index}: ${section.title}`}
        </Text>
        {sectionLocked ? (
          <Lock size={18} color={semanticColors.textMuted} />
        ) : (
          <Text style={styles.count}>{`${doneCount} از ${section.lessons.length}`}</Text>
        )}
      </View>
      {sectionLocked ? (
        <Text style={styles.lockedDescription}>
          برای باز شدن این بخش، تمام درس‌های بخش قبلی را کامل کنید.
        </Text>
      ) : (
        <View style={styles.list}>
          {section.lessons.map((lesson, position) => (
            <LessonRow
              key={lesson.id}
              label={`${section.index}.${position + 1}`}
              lesson={lesson}
              status={getLessonStatus(lesson.id, completedLessons)}
              onPress={() => onLessonPress(lesson.id)}
            />
          ))}
        </View>
      )}
    </GlowCard>
  );
}

const styles = StyleSheet.create({
  card: {
    gap: spacing.sm,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.xs,
  },
  title: {
    ...typography.bodyStrong,
    flex: 1,
    color: semanticColors.textPrimary,
    textAlign: 'right',
  },
  count: {
    ...typography.label,
    color: semanticColors.textSecondary,
  },
  lockedDescription: {
    ...typography.caption,
    color: semanticColors.textMuted,
    textAlign: 'right',
    paddingVertical: spacing.xs,
  },
  list: {
    gap: spacing.xs,
  },
});
