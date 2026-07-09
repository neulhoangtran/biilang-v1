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

const sampleLessons = [
  {
    id: '1',
    title: 'Korean Basic 01',
    description: 'Làm quen bảng chữ cái và phát âm cơ bản.',
    level: 'Beginner',
    icon: 'language-outline',
  },
  {
    id: '2',
    title: 'Daily Conversation',
    description: 'Các mẫu câu giao tiếp thường dùng hằng ngày.',
    level: 'Beginner',
    icon: 'chatbubbles-outline',
  },
  {
    id: '3',
    title: 'Travel Korean',
    description: 'Từ vựng và câu nói khi đi du lịch.',
    level: 'Basic',
    icon: 'airplane-outline',
  },
];

export default function LessonScreen() {
  const theme = Colors.light;

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: theme.background }]}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.header}>
        <Text style={[styles.title, { color: theme.text }]}>
          Lesson
        </Text>

        <Text style={[styles.subtitle, { color: theme.textMuted }]}>
          Chọn bài học để bắt đầu luyện tập cùng Billang.
        </Text>
      </View>

      <View style={styles.section}>
        {sampleLessons.map(item => (
          <TouchableOpacity
            key={item.id}
            activeOpacity={0.8}
            style={[
              styles.lessonCard,
              {
                backgroundColor: theme.surface,
                borderColor: theme.border,
              },
            ]}
          >
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

            <View style={styles.lessonInfo}>
              <View style={styles.lessonTopRow}>
                <Text style={[styles.lessonTitle, { color: theme.text }]}>
                  {item.title}
                </Text>

                <View style={styles.levelBadge}>
                  <Text style={styles.levelText}>
                    {item.level}
                  </Text>
                </View>
              </View>

              <Text
                style={[
                  styles.lessonDescription,
                  { color: theme.textMuted },
                ]}
              >
                {item.description}
              </Text>
            </View>

            <Ionicons
              name="chevron-forward"
              size={20}
              color={theme.textMuted}
            />
          </TouchableOpacity>
        ))}
      </View>

      <View
        style={[
          styles.practiceBox,
          {
            backgroundColor: theme.primary,
          },
        ]}
      >
        <Text style={styles.practiceTitle}>
          Gợi ý hôm nay
        </Text>

        <Text style={styles.practiceText}>
          Học 10 phút mỗi ngày để ghi nhớ từ vựng tốt hơn.
        </Text>

        <TouchableOpacity style={styles.practiceButton}>
          <Text style={styles.practiceButtonText}>
            Bắt đầu học
          </Text>
        </TouchableOpacity>
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
    marginBottom: 24,
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

  section: {
    gap: 14,
  },

  lessonCard: {
    minHeight: 92,
    borderWidth: 1,
    borderRadius: 18,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },

  iconBox: {
    width: 48,
    height: 48,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },

  lessonInfo: {
    flex: 1,
  },

  lessonTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
    gap: 8,
  },

  lessonTitle: {
    flex: 1,
    fontSize: 16,
    fontWeight: '700',
  },

  lessonDescription: {
    fontSize: 13,
    lineHeight: 19,
  },

  levelBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 999,
    backgroundColor: '#EEF2FF',
  },

  levelText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#4F46E5',
  },

  practiceBox: {
    marginTop: 28,
    borderRadius: 22,
    padding: 20,
  },

  practiceTitle: {
    color: '#FFFFFF',
    fontSize: 20,
    fontWeight: '800',
  },

  practiceText: {
    marginTop: 8,
    color: '#FFFFFF',
    opacity: 0.9,
    fontSize: 14,
    lineHeight: 21,
  },

  practiceButton: {
    marginTop: 18,
    alignSelf: 'flex-start',
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 999,
  },

  practiceButtonText: {
    color: '#111827',
    fontSize: 14,
    fontWeight: '700',
  },
});