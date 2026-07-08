import { Ionicons } from '@expo/vector-icons';
import DateTimePicker from '@react-native-community/datetimepicker';
import { router } from 'expo-router';
import { goBackOrDefault } from '@/services/safe-router.service';
import React, {
  useEffect,
  useRef,
  useState,
} from 'react';

import {
  ActivityIndicator,
  Alert,
  Animated,
  Dimensions,
  Easing,
  FlatList,
  Modal,
  Platform,
  Pressable,
  RefreshControl,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import {
  Colors,
  Fonts,
  FontSizes,
  Layout,
  Radius,
  Spacing,
} from '@/constants/theme';

import {
  createAdminMessage,
  getAdminMessages,
  updateAdminMessage,
  type AdminMessageItem,
} from '@/services/admin.service';

const theme = Colors.light;

const SCREEN_HEIGHT = Dimensions.get('window').height;

function formatDateTime(value?: string) {
  if (!value) return '';

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return '';

  return date.toLocaleDateString('vi-VN', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function formatOnlyDate(value: Date) {
  return value.toLocaleDateString('vi-VN', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
}

function formatOnlyTime(value: Date) {
  return value.toLocaleTimeString('vi-VN', {
    hour: '2-digit',
    minute: '2-digit',
  });
}

function getSendStatusText(status?: string) {
  switch (status) {
    case 'waiting':
      return 'Chờ gửi';

    case 'sending':
      return 'Đang gửi';

    case 'success':
      return 'Đã gửi';

    case 'failed':
      return 'Gửi lỗi';

    default:
      return status || 'Chờ gửi';
  }
}

function canEditMessage(item: AdminMessageItem) {
  return (
    item.SendStatus === 'waiting' &&
    !Boolean(item.IsConfirmed)
  );
}

export default function AdminMessageScreen() {
  const [items, setItems] = useState<AdminMessageItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const [renderModal, setRenderModal] = useState(false);
  const [isClosingModal, setIsClosingModal] = useState(false);
  const [editingMessage, setEditingMessage] =
    useState<AdminMessageItem | null>(null);

  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [schedule, setSchedule] = useState(new Date());

  const [pickerMode, setPickerMode] =
    useState<'date' | 'time' | null>(null);

  const modalProgress = useRef(new Animated.Value(0)).current;

  const overlayOpacity = modalProgress.interpolate({
    inputRange: [0, 0.18, 1],
    outputRange: [0, 0.5, 0.5],
    extrapolate: 'clamp',
  });

  const modalTranslateY = modalProgress.interpolate({
    inputRange: [0, 1],
    outputRange: [SCREEN_HEIGHT, 0],
    extrapolate: 'clamp',
  });

  useEffect(() => {
    loadMessages();
  }, []);

  const loadMessages = async (isRefresh = false) => {
    try {
      if (isRefresh) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }

      const data = await getAdminMessages();

      setItems(data);
    } catch {
      Alert.alert(
        'Lỗi',
        'Không tải được danh sách thông báo.'
      );
    } finally {
      if (isRefresh) {
        setRefreshing(false);
      } else {
        setLoading(false);
      }
    }
  };

  const onRefresh = async () => {
    await loadMessages(true);
  };

  const resetForm = () => {
    setTitle('');
    setContent('');
    setSchedule(new Date());
    setEditingMessage(null);
    setPickerMode(null);
  };

  const openModal = () => {
    setIsClosingModal(false);
    setRenderModal(true);
    setPickerMode(null);

    modalProgress.stopAnimation();
    modalProgress.setValue(0);

    requestAnimationFrame(() => {
      Animated.timing(modalProgress, {
        toValue: 1,
        duration: 340,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }).start();
    });
  };

  const closeModal = (afterClose?: () => void) => {
    if (isClosingModal) return;

    setIsClosingModal(true);
    setPickerMode(null);

    modalProgress.stopAnimation();

    Animated.timing(modalProgress, {
      toValue: 0,
      duration: 300,
      easing: Easing.inOut(Easing.cubic),
      useNativeDriver: true,
    }).start(({ finished }) => {
      if (!finished) return;

      setRenderModal(false);
      setIsClosingModal(false);
      setPickerMode(null);

      afterClose?.();
    });
  };

  const openCreateModal = () => {
    resetForm();
    openModal();
  };

  const openEditModal = (item: AdminMessageItem) => {
    setEditingMessage(item);
    setTitle(item.Title || '');
    setContent(item.Content || '');

    const nextSchedule = item.Schedule
      ? new Date(item.Schedule)
      : new Date();

    setSchedule(
      Number.isNaN(nextSchedule.getTime())
        ? new Date()
        : nextSchedule
    );

    setPickerMode(null);

    openModal();
  };

  const handleChangeDate = (_event: any, selectedDate?: Date) => {
    if (!selectedDate) {
      if (Platform.OS !== 'ios') {
        setPickerMode(null);
      }

      return;
    }

    const next = new Date(schedule);

    next.setFullYear(selectedDate.getFullYear());
    next.setMonth(selectedDate.getMonth());
    next.setDate(selectedDate.getDate());

    setSchedule(next);

    if (Platform.OS !== 'ios') {
      setPickerMode(null);
    }
  };

  const handleChangeTime = (_event: any, selectedTime?: Date) => {
    if (!selectedTime) {
      if (Platform.OS !== 'ios') {
        setPickerMode(null);
      }

      return;
    }

    const next = new Date(schedule);

    next.setHours(selectedTime.getHours());
    next.setMinutes(selectedTime.getMinutes());
    next.setSeconds(0);
    next.setMilliseconds(0);

    setSchedule(next);

    if (Platform.OS !== 'ios') {
      setPickerMode(null);
    }
  };

  const handleSubmitMessage = async () => {
    try {
      if (!title.trim()) {
        Alert.alert('Thiếu tiêu đề');
        return;
      }

      if (!content.trim()) {
        Alert.alert('Thiếu nội dung');
        return;
      }

      if (!schedule || Number.isNaN(schedule.getTime())) {
        Alert.alert(
          'Thiếu lịch gửi',
          'Vui lòng chọn ngày giờ gửi.'
        );
        return;
      }

      setSubmitting(true);

      const isEdit = Boolean(editingMessage?.id);

      if (editingMessage?.id) {
        await updateAdminMessage({
          id: editingMessage.id,
          title,
          content,
          schedule: schedule.toISOString(),
        });
      } else {
        await createAdminMessage({
          title,
          content,
          schedule: schedule.toISOString(),
        });
      }

      closeModal(async () => {
        resetForm();

        await loadMessages();

        Alert.alert(
          'Thành công',
          isEdit
            ? 'Đã cập nhật thông báo.'
            : 'Đã tạo thông báo.'
        );
      });
    } catch (error: any) {
      Alert.alert(
        'Lỗi',
        error?.message || 'Không lưu được thông báo.'
      );
    } finally {
      setSubmitting(false);
    }
  };

  const renderHeader = () => {
    return (
      <View style={styles.header}>
        <Pressable
          style={styles.backButton}
          onPress={() => {
            void goBackOrDefault();
          }}
        >
          <Ionicons
            name="arrow-back"
            size={24}
            color={theme.text}
          />
        </Pressable>

        <Text style={styles.headerTitle}>
          Tin nhắn thông báo
        </Text>

        <Pressable
          style={styles.addButton}
          onPress={openCreateModal}
        >
          <Ionicons
            name="add"
            size={28}
            color="#FFFFFF"
          />
        </Pressable>
      </View>
    );
  };

  const renderMessage = ({ item }: { item: AdminMessageItem }) => {
    const confirmed = Boolean(item.IsConfirmed);
    const editable = canEditMessage(item);

    return (
      <View style={styles.card}>
        <View style={styles.cardTop}>
          <View style={styles.cardTitleRow}>
            <Text
              style={styles.cardTitle}
              numberOfLines={2}
            >
              {item.Title}
            </Text>

            <View style={styles.cardActions}>
              <View
                style={[
                  styles.statusBadge,
                  confirmed
                    ? styles.statusConfirmed
                    : styles.statusPending,
                ]}
              >
                <Text
                  style={[
                    styles.statusText,
                    confirmed
                      ? styles.statusTextConfirmed
                      : styles.statusTextPending,
                  ]}
                >
                  {confirmed
                    ? 'Đã xác nhận'
                    : 'Chưa xác nhận'}
                </Text>
              </View>

              {editable && (
                <Pressable
                  style={styles.iconEditButton}
                  onPress={() => openEditModal(item)}
                  hitSlop={8}
                >
                  <Ionicons
                    name="create-outline"
                    size={18}
                    color={theme.textSecondary}
                  />
                </Pressable>
              )}
            </View>
          </View>

          {!!item.Schedule && (
            <Text style={styles.cardDate}>
              Gửi lúc: {formatDateTime(item.Schedule)}
            </Text>
          )}

          <Text style={styles.cardDate}>
            Trạng thái: {getSendStatusText(item.SendStatus)}
          </Text>

          {!!item.createdAt && (
            <Text style={styles.cardDate}>
              Tạo lúc: {formatDateTime(item.createdAt)}
            </Text>
          )}
        </View>

        {!!item.Content && (
          <Text style={styles.cardContent}>
            {item.Content}
          </Text>
        )}

        {!!item.LogMessage && (
          <Text style={styles.logText}>
            {item.LogMessage}
          </Text>
        )}
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.safe}>
      <FlatList
        data={loading ? [] : items}
        keyExtractor={item => String(item.id)}
        renderItem={renderMessage}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={theme.primary}
          />
        }
        ListHeaderComponent={renderHeader}
        ListEmptyComponent={
          loading ? (
            <View style={styles.centerInList}>
              <ActivityIndicator
                size="large"
                color={theme.primary}
              />
            </View>
          ) : (
            <View style={styles.emptyBox}>
              <Text style={styles.emptyText}>
                Chưa có thông báo nào
              </Text>
            </View>
          )
        }
      />

      <Modal
        visible={renderModal}
        transparent
        animationType="none"
        onRequestClose={() => closeModal()}
        statusBarTranslucent
      >
        <View style={styles.modalRoot}>
          <Animated.View
            pointerEvents={renderModal ? 'auto' : 'none'}
            style={[
              styles.overlay,
              {
                opacity: overlayOpacity,
              },
            ]}
          >
            <Pressable
              style={StyleSheet.absoluteFill}
              onPress={() => closeModal()}
              disabled={isClosingModal}
            />
          </Animated.View>

          <Animated.View
            style={[
              styles.modalBox,
              {
                transform: [
                  {
                    translateY: modalTranslateY,
                  },
                ],
              },
            ]}
          >
            <View style={styles.modalHandle} />

            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>
                {editingMessage?.id
                  ? 'Sửa thông báo'
                  : 'Tạo thông báo'}
              </Text>

              <Pressable
                style={styles.modalCloseButton}
                onPress={() => closeModal()}
                disabled={isClosingModal}
              >
                <Ionicons
                  name="close"
                  size={24}
                  color={theme.text}
                />
              </Pressable>
            </View>

            <ScrollView
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
              contentContainerStyle={styles.modalContent}
            >
              <Text style={styles.label}>Tiêu đề</Text>

              <TextInput
                value={title}
                onChangeText={setTitle}
                placeholder="Nhập tiêu đề"
                placeholderTextColor={theme.textMuted}
                style={styles.input}
              />

              <Text style={styles.label}>Nội dung</Text>

              <TextInput
                value={content}
                onChangeText={setContent}
                placeholder="Nhập nội dung thông báo"
                placeholderTextColor={theme.textMuted}
                multiline
                textAlignVertical="top"
                style={styles.textarea}
              />

              <Text style={styles.label}>Ngày giờ gửi</Text>

              <View style={styles.scheduleRow}>
                <Pressable
                  style={styles.scheduleButton}
                  onPress={() => setPickerMode('date')}
                  disabled={isClosingModal}
                >
                  <Ionicons
                    name="calendar-outline"
                    size={20}
                    color={theme.text}
                  />

                  <Text style={styles.scheduleText}>
                    {formatOnlyDate(schedule)}
                  </Text>
                </Pressable>

                <Pressable
                  style={styles.scheduleButton}
                  onPress={() => setPickerMode('time')}
                  disabled={isClosingModal}
                >
                  <Ionicons
                    name="time-outline"
                    size={20}
                    color={theme.text}
                  />

                  <Text style={styles.scheduleText}>
                    {formatOnlyTime(schedule)}
                  </Text>
                </Pressable>
              </View>

              <Pressable
                style={[
                  styles.submitButton,
                  (submitting || isClosingModal) && styles.disabledButton,
                ]}
                disabled={submitting || isClosingModal}
                onPress={handleSubmitMessage}
              >
                {submitting ? (
                  <ActivityIndicator color="#FFFFFF" />
                ) : (
                  <Text style={styles.submitText}>
                    {editingMessage?.id
                      ? 'Cập nhật thông báo'
                      : 'Tạo thông báo'}
                  </Text>
                )}
              </Pressable>
            </ScrollView>
          </Animated.View>

          {pickerMode && (
            <View style={styles.pickerOverlay}>
              <Pressable
                style={StyleSheet.absoluteFill}
                onPress={() => setPickerMode(null)}
              />

              <View style={styles.pickerPanel}>
                <View style={styles.pickerHeader}>
                  <Pressable
                    onPress={() => setPickerMode(null)}
                    hitSlop={8}
                  >
                    <Text style={styles.pickerCancelText}>
                      Hủy
                    </Text>
                  </Pressable>

                  <Text style={styles.pickerTitle}>
                    {pickerMode === 'date'
                      ? 'Chọn ngày gửi'
                      : 'Chọn giờ gửi'}
                  </Text>

                  <Pressable
                    onPress={() => setPickerMode(null)}
                    hitSlop={8}
                  >
                    <Text style={styles.pickerDoneText}>
                      Xong
                    </Text>
                  </Pressable>
                </View>

                <DateTimePicker
                  value={schedule}
                  mode={pickerMode}
                  is24Hour
                  display={
                    Platform.OS === 'ios'
                      ? 'spinner'
                      : 'default'
                  }
                  themeVariant="dark"
                  textColor="#FFFFFF"
                  onChange={
                    pickerMode === 'date'
                      ? handleChangeDate
                      : handleChangeTime
                  }
                />
              </View>
            </View>
          )}
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: theme.background,
  },

  content: {
    paddingHorizontal: Layout.screenHorizontalPadding,
    paddingBottom: 120,
  },

  centerInList: {
    height: 360,
    justifyContent: 'center',
    alignItems: 'center',
  },

  header: {
    height: 64,
    flexDirection: 'row',
    alignItems: 'center',
  },

  backButton: {
    width: 42,
    height: 42,
    justifyContent: 'center',
  },

  headerTitle: {
    flex: 1,
    marginLeft: 8,
    fontFamily: Fonts.bold,
    fontSize: 24,
    color: theme.text,
  },

  addButton: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: theme.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },

  card: {
    padding: 16,
    marginBottom: Spacing.md,
    borderRadius: Radius.lg,
    backgroundColor: theme.surface,
  },

  cardTop: {
    marginBottom: 10,
  },

  cardTitleRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 10,
  },

  cardTitle: {
    flex: 1,
    fontFamily: Fonts.bold,
    fontSize: FontSizes.lg,
    color: theme.text,
  },

  cardDate: {
    marginTop: 4,
    fontFamily: Fonts.regular,
    fontSize: FontSizes.sm,
    color: theme.textSecondary,
  },

  cardContent: {
    fontFamily: Fonts.regular,
    fontSize: FontSizes.md,
    lineHeight: 26,
    color: theme.text,
  },

  logText: {
    marginTop: 10,
    fontFamily: Fonts.regular,
    fontSize: FontSizes.sm,
    color: theme.danger,
  },

  cardActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },

  iconEditButton: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: theme.background,
    alignItems: 'center',
    justifyContent: 'center',
  },

  statusBadge: {
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },

  statusConfirmed: {
    backgroundColor: '#E8F7EF',
  },

  statusPending: {
    backgroundColor: '#FFF4E5',
  },

  statusText: {
    fontFamily: Fonts.bold,
    fontSize: FontSizes.xs,
  },

  statusTextConfirmed: {
    color: '#168A4A',
  },

  statusTextPending: {
    color: '#B96B00',
  },

  emptyBox: {
    height: 240,
    justifyContent: 'center',
    alignItems: 'center',
  },

  emptyText: {
    fontFamily: Fonts.regular,
    fontSize: FontSizes.md,
    color: theme.textSecondary,
  },

  modalRoot: {
    flex: 1,
    justifyContent: 'flex-end',
  },

  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#000000',
  },

  modalBox: {
    height: '84%',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    backgroundColor: theme.background,
    paddingHorizontal: Layout.screenHorizontalPadding,
    paddingTop: 12,
    overflow: 'hidden',
  },

  modalHandle: {
    width: 42,
    height: 5,
    borderRadius: 999,
    backgroundColor: theme.border,
    alignSelf: 'center',
    marginBottom: 14,
  },

  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: Spacing.xl,
  },

  modalTitle: {
    fontFamily: Fonts.bold,
    fontSize: 24,
    color: theme.text,
  },

  modalCloseButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: theme.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },

  modalContent: {
    paddingBottom: 80,
  },

  label: {
    marginBottom: 8,
    fontFamily: Fonts.bold,
    fontSize: FontSizes.md,
    color: theme.text,
  },

  input: {
    height: 54,
    borderRadius: Radius.md,
    backgroundColor: theme.surface,
    paddingHorizontal: 16,
    marginBottom: Spacing.xl,
    fontFamily: Fonts.regular,
    fontSize: FontSizes.md,
    color: theme.text,
  },

  textarea: {
    minHeight: 160,
    borderRadius: Radius.md,
    backgroundColor: theme.surface,
    padding: 16,
    marginBottom: Spacing.xl,
    fontFamily: Fonts.regular,
    fontSize: FontSizes.md,
    color: theme.text,
  },

  scheduleRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: Spacing.xl,
  },

  scheduleButton: {
    flex: 1,
    height: 52,
    borderRadius: Radius.md,
    backgroundColor: theme.surface,
    paddingHorizontal: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },

  scheduleText: {
    fontFamily: Fonts.bold,
    fontSize: FontSizes.md,
    color: theme.text,
  },

  submitButton: {
    height: 54,
    borderRadius: Radius.md,
    backgroundColor: theme.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },

  disabledButton: {
    opacity: 0.6,
  },

  submitText: {
    fontFamily: Fonts.bold,
    fontSize: FontSizes.md,
    color: '#FFFFFF',
  },

  pickerOverlay: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 99,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0,0,0,0.48)',
  },

  pickerPanel: {
    marginHorizontal: 14,
    marginBottom: Platform.OS === 'ios' ? 32 : 24,
    borderRadius: 22,
    backgroundColor: '#111111',
    overflow: 'hidden',
  },

  pickerHeader: {
    height: 52,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.12)',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },

  pickerTitle: {
    fontFamily: Fonts.bold,
    fontSize: FontSizes.md,
    color: '#FFFFFF',
  },

  pickerCancelText: {
    fontFamily: Fonts.bold,
    fontSize: FontSizes.md,
    color: 'rgba(255,255,255,0.68)',
  },

  pickerDoneText: {
    fontFamily: Fonts.bold,
    fontSize: FontSizes.md,
    color: theme.primary,
  },
});