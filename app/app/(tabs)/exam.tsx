import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import {
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';

import { Colors } from '@/constants/theme';

const sampleExams = [
  {
    id: '1',
    title: 'Placement Test',
    description: 'Kiểm tra trình độ hiện tại của bạn.',
    questionCount: 20,
    duration: '15 phút',
    icon: 'analytics-outline',
  },
  {
    id: '2',
    title: 'Vocabulary Quiz',
    description: 'Ôn lại từ vựng đã học trong tuần.',
    questionCount: 15,
    duration: '10 phút',
    icon: 'reader-outline',
  },
  {
    id: '3',
    title: 'Listening Test',
    description: 'Luyện nghe câu ngắn và chọn đáp án đúng.',
    questionCount: 10,
    duration: '8 phút',
    icon: 'headset-outline',
  },
];

export default function ExamScreen() {
  const theme = Colors.light;

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: theme.background }]}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.header}>
        <Text style={[styles.title, { color: theme.text }]}>
          Bài Thi
        </Text>

        <Text style={[styles.subtitle, { color: theme.textMuted }]}>
          Làm bài kiểm tra ngắn để theo dõi tiến độ học tập.
        </Text>
      </View>

      <View
        style={[
          styles.scoreCard,
          {
            backgroundColor: theme.surface,
            borderColor: theme.border,
          },
        ]}
      >
        <View>
          <Text style={[styles.scoreLabel, { color: theme.textMuted }]}>
            Điểm gần nhất
          </Text>

          <Text style={[styles.scoreValue, { color: theme.text }]}>
            82/100
          </Text>
        </View>

        <View
          style={[
            styles.scoreIcon,
            { backgroundColor: `${theme.primary}18` },
          ]}
        >
          <Ionicons
            name="trophy-outline"
            size={28}
            color={theme.primary}
          />
        </View>
      </View>

      <View style={styles.section}>
        {sampleExams.map(item => (
          <TouchableOpacity
            key={item.id}
            activeOpacity={0.85}
            style={[
              styles.examCard,
              {
                backgroundColor: theme.surface,
                borderColor: theme.border,
              },
            ]}
          >
            <View style={styles.examTop}>
              <View
                style={[
                  styles.iconBox,
                  { backgroundColor: `${theme.primary}18` },
                ]}
              >
                <Ionicons
                  name={item.icon as any}
                  size={24}
                  color={theme.primary}
                />
              </View>

              <View style={styles.examInfo}>
                <Text style={[styles.examTitle, { color: theme.text }]}>
                  {item.title}
                </Text>

                <Text
                  style={[
                    styles.examDescription,
                    { color: theme.textMuted },
                  ]}
                >
                  {item.description}
                </Text>
              </View>
            </View>

            <View style={styles.examBottom}>
              <View style={styles.metaItem}>
                <Ionicons
                  name="help-circle-outline"
                  size={16}
                  color={theme.textMuted}
                />

                <Text style={[styles.metaText, { color: theme.textMuted }]}>
                  {item.questionCount} câu
                </Text>
              </View>

              <View style={styles.metaItem}>
                <Ionicons
                  name="time-outline"
                  size={16}
                  color={theme.textMuted}
                />

                <Text style={[styles.metaText, { color: theme.textMuted }]}>
                  {item.duration}
                </Text>
              </View>

              <View style={styles.startButton}>
                <Text style={styles.startButtonText}>
                  Làm bài
                </Text>
              </View>
            </View>
          </TouchableOpacity>
        ))}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },

  content: {
    paddingHorizontal: 20,
    paddingTop: 56,
    paddingBottom: 32,
  },

  header: {
    marginBottom: 20,
  },

  title: {
    fontSize: 30,
    fontWeight: '800',
  },

  subtitle: {
    marginTop: 8,
    fontSize: 15,
    lineHeight: 22,
  },

  scoreCard: {
    borderWidth: 1,
    borderRadius: 22,
    padding: 20,
    marginBottom: 22,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },

  scoreLabel: {
    fontSize: 14,
    fontWeight: '600',
  },

  scoreValue: {
    marginTop: 6,
    fontSize: 34,
    fontWeight: '900',
  },

  scoreIcon: {
    width: 56,
    height: 56,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },

  section: {
    gap: 14,
  },

  examCard: {
    borderWidth: 1,
    borderRadius: 20,
    padding: 16,
  },

  examTop: {
    flexDirection: 'row',
    gap: 14,
  },

  iconBox: {
    width: 48,
    height: 48,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },

  examInfo: {
    flex: 1,
  },

  examTitle: {
    fontSize: 16,
    fontWeight: '800',
  },

  examDescription: {
    marginTop: 5,
    fontSize: 13,
    lineHeight: 19,
  },

  examBottom: {
    marginTop: 16,
    paddingTop: 14,
    borderTopWidth: 1,
    borderTopColor: '#EEF0F4',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },

  metaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },

  metaText: {
    fontSize: 12,
    fontWeight: '600',
  },

  startButton: {
    marginLeft: 'auto',
    backgroundColor: '#111827',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 999,
  },

  startButtonText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
  },
});