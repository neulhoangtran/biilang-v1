import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { goBackOrDefault } from '@/services/safe-router.service';
import React, { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Image,
  Modal,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import PhoneLink from '@/components/PhoneLink';
import {
  Colors,
  Fonts,
  FontSizes,
  Layout,
  Radius,
  Spacing,
} from '@/constants/theme';
import {
  getAdminCustomers,
  useAdminCustomerVoucher,
  type AdminCustomerItem,
  type AdminVoucherItem,
} from '@/services/admin.service';

const theme = Colors.light;

type CustomerExtra = AdminCustomerItem &
  Record<string, any>;

function getStringValue(value: unknown) {
  if (value === undefined || value === null) {
    return '';
  }

  return String(value).trim();
}

function getDisplayName(user: AdminCustomerItem) {
  const lastName = getStringValue(user.LastName);
  const firstName = getStringValue(user.FirstName);

  const name = [lastName, firstName]
    .filter(Boolean)
    .join(' ')
    .trim();

  return (
    name ||
    getStringValue(user.username) ||
    getStringValue(user.email) ||
    'Khách hàng'
  );
}

function getAvatarUrl(user: AdminCustomerItem) {
  const url =
    user.Avatar?.formats?.thumbnail?.url ||
    user.Avatar?.formats?.small?.url ||
    user.Avatar?.url;

  if (!url) {
    return '';
  }

  if (url.startsWith('http')) {
    return url;
  }

  return `${process.env.EXPO_PUBLIC_API_BASE_URL}${url}`;
}

function formatDateValue(value: unknown) {
  const raw = getStringValue(value);

  if (!raw) {
    return '';
  }

  const compactDate = raw.match(
    /^(\d{4})(\d{2})(\d{2})$/
  );

  if (compactDate) {
    const [, year, month, day] = compactDate;
    return `${day}/${month}/${year}`;
  }

  const isoDate = raw.split('T')[0];
  const standardDate = isoDate.match(
    /^(\d{4})-(\d{2})-(\d{2})$/
  );

  if (standardDate) {
    const [, year, month, day] = standardDate;
    return `${day}/${month}/${year}`;
  }

  const date = new Date(raw);

  if (!Number.isNaN(date.getTime())) {
    const day = String(date.getDate()).padStart(
      2,
      '0'
    );
    const month = String(
      date.getMonth() + 1
    ).padStart(2, '0');

    return `${day}/${month}/${date.getFullYear()}`;
  }

  return raw;
}

function getDateOfBirth(
  user: CustomerExtra | null
) {
  if (!user) {
    return '';
  }

  return formatDateValue(
    user.DateOfBirth ||
    user.dateOfBirth ||
    user.Birthday ||
    user.birthday ||
    user.BirthDay ||
    user.birthDay ||
    user.DOB ||
    user.dob
  );
}

function getUserPhone(
  user: CustomerExtra | null
) {
  if (!user) {
    return '';
  }

  return (
    getStringValue(user.PhoneNumber) ||
    getStringValue(user.phoneNumber) ||
    getStringValue(user.phone) ||
    getStringValue(user.username)
  );
}

function getVoucherExpireDate(
  voucher: AdminVoucherItem
) {
  return formatDateValue(voucher.ExpiryDate);
}

function getVoucherStatus(
  voucher: AdminVoucherItem
) {
  if (
    voucher.Status === 'USED' ||
    voucher.IsUsed
  ) {
    return {
      label: 'Đã sử dụng',
      color: '#FFFFFF',
      backgroundColor: theme.textSecondary,
    };
  }

  if (
    voucher.Status === 'EXPIRED' ||
    voucher.IsExpired
  ) {
    return {
      label: 'Đã hết hạn',
      color: '#FFFFFF',
      backgroundColor: theme.danger,
    };
  }

  return {
    label: 'Chưa sử dụng',
    color: '#FFFFFF',
    backgroundColor: theme.primary,
  };
}

function showMessage(
  title: string,
  message: string
) {
  if (Platform.OS === 'web') {
    window.alert(`${title}\n\n${message}`);
    return;
  }

  Alert.alert(title, message);
}

export default function AdminCustomersScreen() {
  const [customers, setCustomers] = useState<
    AdminCustomerItem[]
  >([]);

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] =
    useState(false);
  const [searchText, setSearchText] =
    useState('');

  const [
    selectedCustomer,
    setSelectedCustomer,
  ] = useState<CustomerExtra | null>(null);

  const [
    customerModalVisible,
    setCustomerModalVisible,
  ] = useState(false);

  const [
    usingVoucherKey,
    setUsingVoucherKey,
  ] = useState('');

  const filteredCustomers = useMemo(() => {
    const keyword = searchText
      .trim()
      .toLowerCase();

    if (!keyword) {
      return customers;
    }

    return customers.filter(customer => {
      const extra = customer as CustomerExtra;

      const name = getDisplayName(
        customer
      ).toLowerCase();

      const phone =
        getUserPhone(extra).toLowerCase();

      const email = getStringValue(
        customer.email
      ).toLowerCase();

      const dateOfBirth =
        getDateOfBirth(extra).toLowerCase();

      return (
        name.includes(keyword) ||
        phone.includes(keyword) ||
        email.includes(keyword) ||
        dateOfBirth.includes(keyword)
      );
    });
  }, [customers, searchText]);

  useEffect(() => {
    void loadCustomers();
  }, []);

  const loadCustomers = async (
    isRefresh = false
  ) => {
    try {
      if (isRefresh) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }

      const data = await getAdminCustomers();

      setCustomers(data);
      return data;
    } catch {
      setCustomers([]);
      return [];
    } finally {
      if (isRefresh) {
        setRefreshing(false);
      } else {
        setLoading(false);
      }
    }
  };

  const onRefresh = async () => {
    await loadCustomers(true);
  };

  const openCustomerModal = (
    customer: CustomerExtra
  ) => {
    setSelectedCustomer(customer);
    setCustomerModalVisible(true);
  };

  const closeCustomerModal = () => {
    if (usingVoucherKey) {
      return;
    }

    setCustomerModalVisible(false);
  };

  const selectedAvatarUrl = selectedCustomer
    ? getAvatarUrl(selectedCustomer)
    : '';

  const selectedVouchers =
    selectedCustomer?.Vouchers ?? [];

  const useVoucher = async (
    voucher: AdminVoucherItem
  ) => {
    if (
      !selectedCustomer ||
      voucher.IsUsed ||
      voucher.IsExpired ||
      usingVoucherKey
    ) {
      return;
    }

    const voucherKey = String(voucher.id);

    try {
      setUsingVoucherKey(voucherKey);

      const response =
        await useAdminCustomerVoucher({
          customerId: selectedCustomer.id,
          voucherType: voucher.Type,
          voucherId:
            voucher.Type === 'STANDARD'
              ? Number(voucher.id)
              : undefined,
        });

      const freshCustomers =
        await loadCustomers();

      const freshSelectedCustomer =
        freshCustomers.find(
          customer =>
            customer.id === selectedCustomer.id
        );

      if (freshSelectedCustomer) {
        setSelectedCustomer(
          freshSelectedCustomer as CustomerExtra
        );
      }

      showMessage(
        'Thành công',
        response.message ||
        'Đã xác nhận sử dụng voucher.'
      );
    } catch (error) {
      showMessage(
        'Không thể sử dụng voucher',
        error instanceof Error
          ? error.message
          : 'Vui lòng thử lại sau.'
      );
    } finally {
      setUsingVoucherKey('');
    }
  };

  const confirmUseVoucher = (
    voucher: AdminVoucherItem
  ) => {
    const message =
      `Xác nhận khách hàng đã sử dụng "${voucher.Name}"?`;

    if (Platform.OS === 'web') {
      if (window.confirm(message)) {
        void useVoucher(voucher);
      }

      return;
    }

    Alert.alert(
      'Xác nhận sử dụng',
      message,
      [
        {
          text: 'Hủy',
          style: 'cancel',
        },
        {
          text: 'Xác nhận',
          onPress: () => {
            void useVoucher(voucher);
          },
        },
      ]
    );
  };

  return (
    <SafeAreaView style={styles.safe}>
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
          Danh sách khách hàng
        </Text>
      </View>

      <View style={styles.searchBox}>
        <Ionicons
          name="search-outline"
          size={22}
          color={theme.textSecondary}
        />

        <TextInput
          value={searchText}
          onChangeText={setSearchText}
          placeholder="Tìm kiếm khách hàng"
          placeholderTextColor={theme.textMuted}
          style={styles.searchInput}
        />
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator
            size="large"
            color={theme.primary}
          />
        </View>
      ) : (
        <FlatList
          data={filteredCustomers}
          keyExtractor={item =>
            String(item.id)
          }
          contentContainerStyle={styles.content}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={theme.primary}
            />
          }
          ListEmptyComponent={
            <View style={styles.emptyBox}>
              <Text style={styles.emptyText}>
                Không tìm thấy khách hàng
              </Text>
            </View>
          }
          renderItem={({ item }) => {
            const customer =
              item as CustomerExtra;

            const avatarUrl =
              getAvatarUrl(item);

            const phone =
              getUserPhone(customer);

            const dateOfBirth =
              getDateOfBirth(customer);

            return (
              <Pressable
                style={({ pressed }) => [
                  styles.card,
                  pressed && styles.cardPressed,
                ]}
                onPress={() =>
                  openCustomerModal(customer)
                }
              >
                <View style={styles.avatarBox}>
                  {avatarUrl ? (
                    <Image
                      source={{ uri: avatarUrl }}
                      style={styles.avatarImage}
                    />
                  ) : (
                    <Ionicons
                      name="person"
                      size={26}
                      color="#FFFFFF"
                    />
                  )}
                </View>

                <View style={styles.info}>
                  <Text
                    style={styles.name}
                    numberOfLines={1}
                  >
                    {getDisplayName(item)}
                  </Text>

                  {!!phone && (
                    <Text style={styles.phone}>
                      {phone}
                    </Text>
                  )}

                  <Text
                    style={styles.dateOfBirth}
                    numberOfLines={1}
                  >
                    {dateOfBirth
                      ? `Ngày sinh: ${dateOfBirth}`
                      : 'Ngày sinh: Chưa cập nhật'}
                  </Text>
                </View>

                <Ionicons
                  name="chevron-forward"
                  size={22}
                  color={theme.textMuted}
                />
              </Pressable>
            );
          }}
        />
      )}

      <Modal
        visible={customerModalVisible}
        transparent
        animationType="fade"
        onRequestClose={closeCustomerModal}
      >
        <View style={styles.modalOverlay}>
          <Pressable
            style={styles.modalBackdrop}
            onPress={closeCustomerModal}
          />

          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>
                Chi tiết khách hàng
              </Text>

              <Pressable
                style={styles.closeButton}
                onPress={closeCustomerModal}
              >
                <Ionicons
                  name="close"
                  size={24}
                  color={theme.text}
                />
              </Pressable>
            </View>

            {selectedCustomer ? (
              <ScrollView
                showsVerticalScrollIndicator={false}
                contentContainerStyle={
                  styles.modalContent
                }
              >
                <View style={styles.modalUserBox}>
                  <View
                    style={styles.modalAvatarBox}
                  >
                    {selectedAvatarUrl ? (
                      <Image
                        source={{
                          uri: selectedAvatarUrl,
                        }}
                        style={styles.avatarImage}
                      />
                    ) : (
                      <Ionicons
                        name="person"
                        size={34}
                        color="#FFFFFF"
                      />
                    )}
                  </View>

                  <Text style={styles.modalUserName}>
                    {getDisplayName(
                      selectedCustomer
                    )}
                  </Text>

                  {getUserPhone(
                    selectedCustomer
                  ) ? (
                    <PhoneLink
                      phone={getUserPhone(
                        selectedCustomer
                      )}
                    >
                      <Text
                        style={styles.modalUserPhone}
                      >
                        {getUserPhone(
                          selectedCustomer
                        )}
                      </Text>
                    </PhoneLink>
                  ) : (
                    <Text
                      style={styles.modalUserPhone}
                    >
                      Chưa có số điện thoại
                    </Text>
                  )}
                </View>

                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>
                    Tên khách hàng
                  </Text>

                  <Text style={styles.detailValue}>
                    {getDisplayName(
                      selectedCustomer
                    )}
                  </Text>
                </View>

                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>
                    Ngày tháng năm sinh
                  </Text>

                  <Text style={styles.detailValue}>
                    {getDateOfBirth(
                      selectedCustomer
                    ) || 'Chưa cập nhật'}
                  </Text>
                </View>

                <View
                  style={styles.voucherSectionHeader}
                >
                  <Text
                    style={styles.voucherSectionTitle}
                  >
                    Voucher
                  </Text>

                  <Text style={styles.voucherCount}>
                    {selectedVouchers.length}
                  </Text>
                </View>

                {selectedVouchers.length > 0 ? (
                  selectedVouchers.map(voucher => {
                    const voucherStatus =
                      getVoucherStatus(voucher);

                    const isUsing =
                      usingVoucherKey ===
                      String(voucher.id);

                    const canUse =
                      !voucher.IsUsed &&
                      !voucher.IsExpired;

                    return (
                      <View
                        key={String(voucher.id)}
                        style={styles.voucherBox}
                      >
                        <View
                          style={styles.voucherTopRow}
                        >
                          <View
                            style={
                              styles.voucherHeading
                            }
                          >
                            <Text
                              style={
                                styles.voucherTitle
                              }
                            >
                              {voucher.Name ||
                                'Voucher'}
                            </Text>

                            <Text
                              style={
                                styles.voucherType
                              }
                            >
                              {voucher.Type ===
                                'FIRST_REGISTER'
                                ? 'Đăng ký lần đầu'
                                : voucher.ApplyFor ===
                                  'All'
                                  ? 'Tất cả khách hàng'
                                  : voucher.ApplyFor ===
                                    'Branch'
                                    ? 'Theo chi nhánh'
                                    : 'Theo khách hàng'}
                            </Text>
                          </View>

                          <View
                            style={[
                              styles.voucherBadge,
                              {
                                backgroundColor:
                                  voucherStatus.backgroundColor,
                              },
                            ]}
                          >
                            <Text
                              style={[
                                styles.voucherBadgeText,
                                {
                                  color:
                                    voucherStatus.color,
                                },
                              ]}
                            >
                              {voucherStatus.label}
                            </Text>
                          </View>
                        </View>

                        {!!voucher.Description && (
                          <Text
                            style={
                              styles.voucherDescription
                            }
                          >
                            {voucher.Description}
                          </Text>
                        )}

                        <View
                          style={styles.voucherMetaRow}
                        >
                          <Ionicons
                            name="calendar-outline"
                            size={16}
                            color={theme.textSecondary}
                          />

                          <Text
                            style={
                              styles.voucherMetaText
                            }
                          >
                            Hạn dùng:{' '}
                            {getVoucherExpireDate(
                              voucher
                            ) || 'Không giới hạn'}
                          </Text>
                        </View>

                        {!!voucher.VoucherCode && (
                          <View
                            style={
                              styles.voucherMetaRow
                            }
                          >
                            <Ionicons
                              name="ticket-outline"
                              size={16}
                              color={
                                theme.textSecondary
                              }
                            />

                            <Text
                              style={
                                styles.voucherMetaText
                              }
                            >
                              Mã: {voucher.VoucherCode}
                            </Text>
                          </View>
                        )}

                        {!!voucher.UsedAt && (
                          <View
                            style={
                              styles.voucherMetaRow
                            }
                          >
                            <Ionicons
                              name="checkmark-circle-outline"
                              size={16}
                              color={
                                theme.textSecondary
                              }
                            />

                            <Text
                              style={
                                styles.voucherMetaText
                              }
                            >
                              Đã dùng:{' '}
                              {formatDateValue(
                                voucher.UsedAt
                              )}
                            </Text>
                          </View>
                        )}

                        {canUse && (
                          <Pressable
                            disabled={isUsing}
                            onPress={() =>
                              confirmUseVoucher(
                                voucher
                              )
                            }
                            style={({ pressed }) => [
                              styles.useVoucherButton,
                              (pressed || isUsing) &&
                              styles.useVoucherButtonPressed,
                            ]}
                          >
                            {isUsing ? (
                              <ActivityIndicator
                                size="small"
                                color="#FFFFFF"
                              />
                            ) : (
                              <>
                                <Ionicons
                                  name="checkmark-circle"
                                  size={19}
                                  color="#FFFFFF"
                                />

                                <Text
                                  style={
                                    styles.useVoucherButtonText
                                  }
                                >
                                  Đánh dấu đã sử dụng
                                </Text>
                              </>
                            )}
                          </Pressable>
                        )}
                      </View>
                    );
                  })
                ) : (
                  <View style={styles.voucherEmpty}>
                    <Ionicons
                      name="ticket-outline"
                      size={28}
                      color={theme.textMuted}
                    />

                    <Text
                      style={styles.voucherEmptyText}
                    >
                      Khách hàng chưa có voucher
                    </Text>
                  </View>
                )}
              </ScrollView>
            ) : null}
          </View>
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

  header: {
    height: 64,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal:
      Layout.screenHorizontalPadding,
  },

  backButton: {
    width: 42,
    height: 42,
    justifyContent: 'center',
  },

  headerTitle: {
    marginLeft: 8,
    fontFamily: Fonts.bold,
    fontSize: 24,
    color: theme.text,
  },

  searchBox: {
    height: 54,
    marginHorizontal:
      Layout.screenHorizontalPadding,
    marginBottom: Spacing.lg,
    borderRadius: Radius.md,
    backgroundColor: theme.surface,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },

  searchInput: {
    flex: 1,
    fontFamily: Fonts.regular,
    fontSize: FontSizes.md,
    color: theme.text,
  },

  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },

  content: {
    paddingHorizontal:
      Layout.screenHorizontalPadding,
    paddingBottom: 120,
  },

  card: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    marginBottom: Spacing.md,
    borderRadius: Radius.lg,
    backgroundColor: theme.surface,
  },

  cardPressed: {
    opacity: 0.84,
  },

  avatarBox: {
    width: 58,
    height: 58,
    borderRadius: 29,
    overflow: 'hidden',
    backgroundColor: theme.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14,
  },

  avatarImage: {
    width: '100%',
    height: '100%',
  },

  info: {
    flex: 1,
  },

  name: {
    fontFamily: Fonts.bold,
    fontSize: FontSizes.lg,
    color: theme.text,
  },

  phone: {
    marginTop: 4,
    fontFamily: Fonts.regular,
    fontSize: FontSizes.md,
    color: theme.textSecondary,
  },

  dateOfBirth: {
    marginTop: 2,
    fontFamily: Fonts.regular,
    fontSize: FontSizes.sm,
    color: theme.textMuted,
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

  modalOverlay: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal:
      Layout.screenHorizontalPadding,
  },

  modalBackdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#00000080',
  },

  modalCard: {
    maxHeight: '88%',
    borderRadius: Radius.lg,
    backgroundColor: theme.background,
    padding: 18,
  },

  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: Spacing.lg,
  },

  modalContent: {
    paddingBottom: 4,
  },

  modalTitle: {
    fontFamily: Fonts.bold,
    fontSize: FontSizes.lg,
    color: theme.text,
  },

  closeButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: theme.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },

  modalUserBox: {
    alignItems: 'center',
    marginBottom: Spacing.lg,
  },

  modalAvatarBox: {
    width: 78,
    height: 78,
    borderRadius: 39,
    overflow: 'hidden',
    backgroundColor: theme.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.md,
  },

  modalUserName: {
    fontFamily: Fonts.bold,
    fontSize: FontSizes.xl,
    color: theme.text,
    textAlign: 'center',
  },

  modalUserPhone: {
    marginTop: 4,
    fontFamily: Fonts.regular,
    fontSize: FontSizes.md,
    color: theme.textSecondary,
    textAlign: 'center',
  },

  detailRow: {
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: theme.border,
  },

  detailLabel: {
    fontFamily: Fonts.regular,
    fontSize: FontSizes.sm,
    color: theme.textSecondary,
    marginBottom: 4,
  },

  detailValue: {
    fontFamily: Fonts.bold,
    fontSize: FontSizes.md,
    color: theme.text,
  },

  voucherSectionHeader: {
    marginTop: Spacing.lg,
    marginBottom: Spacing.sm,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },

  voucherSectionTitle: {
    fontFamily: Fonts.bold,
    fontSize: FontSizes.lg,
    color: theme.text,
  },

  voucherCount: {
    minWidth: 28,
    height: 28,
    borderRadius: 8,
    backgroundColor: theme.primarySoft,
    color: theme.primary,
    fontFamily: Fonts.bold,
    fontSize: FontSizes.sm,
    textAlign: 'center',
    lineHeight: 28,
  },

  voucherBox: {
    marginBottom: Spacing.md,
    padding: 14,
    borderRadius: Radius.md,
    backgroundColor: theme.surface,
  },

  voucherTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },

  voucherHeading: {
    flex: 1,
  },

  voucherTitle: {
    fontFamily: Fonts.bold,
    fontSize: FontSizes.md,
    color: theme.text,
  },

  voucherType: {
    marginTop: 3,
    fontFamily: Fonts.regular,
    fontSize: FontSizes.xs,
    color: theme.textMuted,
  },

  voucherBadge: {
    minHeight: 28,
    paddingHorizontal: 10,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
  },

  voucherBadgeText: {
    fontFamily: Fonts.bold,
    fontSize: FontSizes.xs,
  },

  voucherDescription: {
    marginTop: 8,
    fontFamily: Fonts.regular,
    fontSize: FontSizes.sm,
    color: theme.textSecondary,
  },

  voucherMetaRow: {
    marginTop: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
  },

  voucherMetaText: {
    flex: 1,
    fontFamily: Fonts.regular,
    fontSize: FontSizes.sm,
    color: theme.textSecondary,
  },

  useVoucherButton: {
    height: 44,
    marginTop: 14,
    borderRadius: 8,
    backgroundColor: theme.primary,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },

  useVoucherButtonPressed: {
    opacity: 0.72,
  },

  useVoucherButtonText: {
    color: '#FFFFFF',
    fontFamily: Fonts.bold,
    fontSize: FontSizes.sm,
  },

  voucherEmpty: {
    minHeight: 120,
    borderRadius: Radius.md,
    backgroundColor: theme.surface,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },

  voucherEmptyText: {
    fontFamily: Fonts.regular,
    fontSize: FontSizes.sm,
    color: theme.textSecondary,
  },
});
