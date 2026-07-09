import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  BackHandler,
  Modal,
  Platform,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';

import { Ionicons } from '@expo/vector-icons';

import {
  AppVersionCheckResult,
  checkAppVersion,
  openAppStore,
} from '@/services/app-version.service';

export default function AppUpgradeModal() {
  const [checking, setChecking] = useState(true);
  const [versionInfo, setVersionInfo] =
    useState<AppVersionCheckResult | null>(null);
  const [openingStore, setOpeningStore] = useState(false);

  const visible = Boolean(versionInfo?.needUpgrade);

  useEffect(() => {
    let mounted = true;

    async function prepareVersionCheck() {
      try {
        const result = await checkAppVersion();

        console.log('[APP_VERSION_CHECK_RESULT]', {
          currentVersion: result.currentVersion,
          latestVersion: result.latestVersion,
          requiredUpgrade: result.requiredUpgrade,
          needUpgrade: result.needUpgrade,
        });

        if (mounted) {
          setVersionInfo(result);
        }
      } catch (error: any) {
        console.log('[APP_VERSION_CHECK_FAILED]', {
          errorName: error?.name,
          errorMessage: error?.message || String(error),
          errorStack: error?.stack,
        });
      } finally {
        if (mounted) {
          setChecking(false);
        }
      }
    }

    prepareVersionCheck();

    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    if (!visible || Platform.OS !== 'android') {
      return;
    }

    const subscription = BackHandler.addEventListener(
      'hardwareBackPress',
      () => true
    );

    return () => {
      subscription.remove();
    };
  }, [visible]);

  const handleUpgradePress = async () => {
    if (!versionInfo?.storeUrl) {
      console.log('[APP_VERSION_STORE_URL_MISSING]', {
        currentVersion: versionInfo?.currentVersion,
        latestVersion: versionInfo?.latestVersion,
      });

      return;
    }

    try {
      setOpeningStore(true);

      const opened = await openAppStore(versionInfo.storeUrl);

      console.log('[APP_VERSION_OPEN_STORE_RESULT]', {
        opened,
        storeUrl: versionInfo.storeUrl,
      });
    } catch (error: any) {
      console.log('[APP_VERSION_OPEN_STORE_FAILED]', {
        errorName: error?.name,
        errorMessage: error?.message || String(error),
        errorStack: error?.stack,
      });
    } finally {
      setOpeningStore(false);
    }
  };

  if (checking || !visible || !versionInfo) {
    return null;
  }

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      statusBarTranslucent
      onRequestClose={() => {
        /**
         * Required upgrade:
         * Không cho đóng modal bằng nút back Android.
         */
      }}
    >
      <View style={styles.overlay}>
        <View style={styles.card}>
          <View style={styles.topArea}>
            <View style={styles.decorCircleLarge} />
            <View style={styles.decorCircleSmall} />

            <View style={styles.updateIconWrap}>
              <View style={styles.updateIconInner}>
                <Ionicons
                  name="arrow-up-circle"
                  size={46}
                  color="#FFFFFF"
                />
              </View>
            </View>

            <Text style={styles.badgeText}>
              New Version Available
            </Text>
          </View>

          <View style={styles.body}>
            <Text style={styles.title}>
              Cập nhật Billang
            </Text>

            <Text style={styles.message}>
              {versionInfo.message ||
                'Phiên bản hiện tại đã cũ. Vui lòng cập nhật để tiếp tục sử dụng các tính năng mới nhất.'}
            </Text>

            <View style={styles.versionRow}>
              <View style={styles.versionItem}>
                <Text style={styles.versionLabel}>
                  Hiện tại
                </Text>

                <Text style={styles.versionValue}>
                  v{versionInfo.currentVersion}
                </Text>
              </View>

              <View style={styles.arrowBox}>
                <Ionicons
                  name="arrow-forward"
                  size={18}
                  color="#64748B"
                />
              </View>

              <View style={[styles.versionItem, styles.latestVersionItem]}>
                <Text style={styles.versionLabel}>
                  Mới nhất
                </Text>

                <Text style={styles.latestVersionValue}>
                  v{versionInfo.latestVersion}
                </Text>
              </View>
            </View>

            <View style={styles.noticeBox}>
              <Ionicons
                name="shield-checkmark-outline"
                size={18}
                color="#2563EB"
              />

              <Text style={styles.noticeText}>
                Bản cập nhật này là bắt buộc để đảm bảo app hoạt động ổn định.
              </Text>
            </View>

            <TouchableOpacity
              activeOpacity={0.88}
              style={[
                styles.primaryButton,
                openingStore && styles.primaryButtonDisabled,
              ]}
              onPress={handleUpgradePress}
              disabled={openingStore}
            >
              {openingStore ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <>
                  <Text style={styles.primaryButtonText}>
                    Cập nhật ngay
                  </Text>

                  <Ionicons
                    name="open-outline"
                    size={19}
                    color="#FFFFFF"
                  />
                </>
              )}
            </TouchableOpacity>

            <Text style={styles.bottomHint}>
              Bạn sẽ được chuyển đến cửa hàng ứng dụng để cập nhật.
            </Text>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    paddingHorizontal: 22,
    backgroundColor: 'rgba(15, 23, 42, 0.62)',
    alignItems: 'center',
    justifyContent: 'center',
  },

  card: {
    width: '100%',
    maxWidth: 420,
    overflow: 'hidden',
    borderRadius: 32,
    backgroundColor: '#FFFFFF',
    shadowColor: '#000000',
    shadowOffset: {
      width: 0,
      height: 18,
    },
    shadowOpacity: 0.22,
    shadowRadius: 30,
    elevation: 18,
  },

  topArea: {
    height: 178,
    backgroundColor: '#2563EB',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },

  decorCircleLarge: {
    position: 'absolute',
    width: 210,
    height: 210,
    borderRadius: 105,
    backgroundColor: 'rgba(255,255,255,0.12)',
    top: -92,
    right: -62,
  },

  decorCircleSmall: {
    position: 'absolute',
    width: 130,
    height: 130,
    borderRadius: 65,
    backgroundColor: 'rgba(255,255,255,0.10)',
    bottom: -52,
    left: -34,
  },

  updateIconWrap: {
    width: 90,
    height: 90,
    borderRadius: 45,
    backgroundColor: 'rgba(255,255,255,0.18)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
  },

  updateIconInner: {
    width: 70,
    height: 70,
    borderRadius: 35,
    backgroundColor: 'rgba(255,255,255,0.18)',
    alignItems: 'center',
    justifyContent: 'center',
  },

  badgeText: {
    color: '#DBEAFE',
    fontSize: 13,
    fontWeight: '800',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },

  body: {
    paddingHorizontal: 24,
    paddingTop: 26,
    paddingBottom: 24,
  },

  title: {
    fontSize: 24,
    fontWeight: '900',
    color: '#0F172A',
    textAlign: 'center',
  },

  message: {
    marginTop: 10,
    fontSize: 15,
    lineHeight: 23,
    color: '#475569',
    textAlign: 'center',
  },

  versionRow: {
    marginTop: 22,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },

  versionItem: {
    flex: 1,
    minHeight: 72,
    borderRadius: 18,
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    alignItems: 'center',
    justifyContent: 'center',
  },

  latestVersionItem: {
    backgroundColor: '#EFF6FF',
    borderColor: '#BFDBFE',
  },

  versionLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: '#64748B',
    marginBottom: 5,
  },

  versionValue: {
    fontSize: 18,
    fontWeight: '900',
    color: '#334155',
  },

  latestVersionValue: {
    fontSize: 18,
    fontWeight: '900',
    color: '#2563EB',
  },

  arrowBox: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
  },

  noticeBox: {
    marginTop: 18,
    padding: 13,
    borderRadius: 16,
    backgroundColor: '#EFF6FF',
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
  },

  noticeText: {
    flex: 1,
    fontSize: 13,
    lineHeight: 19,
    color: '#1E3A8A',
    fontWeight: '600',
  },

  primaryButton: {
    height: 54,
    marginTop: 22,
    borderRadius: 18,
    backgroundColor: '#2563EB',
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 8,
  },

  primaryButtonDisabled: {
    opacity: 0.72,
  },

  primaryButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '900',
  },

  bottomHint: {
    marginTop: 12,
    fontSize: 12,
    color: '#94A3B8',
    textAlign: 'center',
    lineHeight: 17,
  },
});