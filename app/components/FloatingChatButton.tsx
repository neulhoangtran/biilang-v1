import React, { useEffect, useRef, useState } from 'react';
import {
  Alert,
  Animated,
  Easing,
  Linking,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { usePathname } from 'expo-router';
import { FontAwesome5, Ionicons } from '@expo/vector-icons';

import { Colors, Fonts } from '@/constants/theme';
import {
  getAppConfig,
  type SelectedBranchConfig,
} from '@/services/app-storage.service';

const theme = Colors.light;

export default function FloatingChatButton() {
  const pathname = usePathname();

  const [open, setOpen] = useState(false);
  const [selectedBranch, setSelectedBranch] =
    useState<SelectedBranchConfig | null>(null);

  const menuAnim = useRef(new Animated.Value(0)).current;
  const idleAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    loadSelectedBranch();
  }, [pathname]);

  useEffect(() => {
    if (open) {
      idleAnim.stopAnimation();
      idleAnim.setValue(0);
      return;
    }

    idleAnim.setValue(0);

    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(idleAnim, {
          toValue: 1,
          duration: 520,
          easing: Easing.linear,
          useNativeDriver: true,
        }),
        Animated.delay(1800),
        Animated.timing(idleAnim, {
          toValue: 0,
          duration: 0,
          useNativeDriver: true,
        }),
      ])
    );

    loop.start();

    return () => {
      loop.stop();
    };
  }, [open, idleAnim]);

  const loadSelectedBranch = async () => {
    try {
      const config = await getAppConfig();
      setSelectedBranch(config.selected_branch ?? null);
    } catch {
      setSelectedBranch(null);
    }
  };

  const closeMenu = () => {
    setOpen(false);

    Animated.spring(menuAnim, {
      toValue: 0,
      friction: 7,
      tension: 80,
      useNativeDriver: true,
    }).start();
  };

  const toggleOpen = () => {
    const nextOpen = !open;

    setOpen(nextOpen);

    Animated.spring(menuAnim, {
      toValue: nextOpen ? 1 : 0,
      friction: 7,
      tension: 80,
      useNativeDriver: true,
    }).start();
  };

  const normalizePhoneNumber = (value?: string | number | null) => {
    const raw = String(value || '').trim();

    if (!raw) {
      return '';
    }

    const cleaned = raw.replace(/[^\d+]/g, '');

    if (!cleaned) {
      return '';
    }

    return cleaned.startsWith('+')
      ? `+${cleaned.slice(1).replace(/\+/g, '')}`
      : cleaned.replace(/\+/g, '');
  };

  const getBranchPhone = () => {
    const branch = selectedBranch as any;

    return normalizePhoneNumber(
      branch?.phone ||
        branch?.phoneNumber ||
        branch?.PhoneNumber ||
        branch?.Phone ||
        branch?.tel ||
        branch?.Tel ||
        branch?.TEL ||
        branch?.mobile ||
        branch?.Mobile ||
        branch?.contact ||
        branch?.Contact
    );
  };

  const openLink = async (url?: string | null) => {
    if (!url) {
      return;
    }

    try {
      await Linking.openURL(url);
      closeMenu();
    } catch {
      Alert.alert('Thông báo', 'Không thể mở liên kết này');
    }
  };

  const openPhoneCall = async () => {
    const phoneNumber = getBranchPhone();

    if (!phoneNumber) {
      Alert.alert('Thông báo', 'Chi nhánh hiện chưa có số điện thoại');
      return;
    }

    const phoneUrl = `tel:${phoneNumber}`;

    try {
      const canOpen = await Linking.canOpenURL(phoneUrl);

      if (!canOpen) {
        Alert.alert('Thông báo', `Không thể gọi số ${phoneNumber}`);
        return;
      }

      await Linking.openURL(phoneUrl);
      closeMenu();
    } catch {
      Alert.alert('Thông báo', 'Không thể thực hiện cuộc gọi');
    }
  };

  const zaloUrl = selectedBranch?.zalo ?? null;
  const messengerUrl = selectedBranch?.messenger ?? null;
  const phoneNumber = getBranchPhone();

  const actions = [
    messengerUrl
      ? {
          key: 'messenger',
          backgroundColor: '#0084FF',
          onPress: () => openLink(messengerUrl),
          icon: (
            <FontAwesome5
              name="facebook-messenger"
              size={28}
              color="#FFFFFF"
            />
          ),
        }
      : null,

    zaloUrl
      ? {
          key: 'zalo',
          backgroundColor: theme.surface,
          onPress: () => openLink(zaloUrl),
          icon: <Text style={styles.zaloText}>Zalo</Text>,
        }
      : null,

    phoneNumber
      ? {
          key: 'phone',
          backgroundColor: '#16A34A',
          onPress: openPhoneCall,
          icon: (
            <Ionicons
              name="call"
              size={27}
              color="#FFFFFF"
            />
          ),
        }
      : null,
  ].filter(Boolean) as {
    key: string;
    backgroundColor: string;
    onPress: () => void;
    icon: React.ReactNode;
  }[];

  if (actions.length === 0) {
    return null;
  }

  const mainIconStyle = {
    transform: [
      {
        rotate: menuAnim.interpolate({
          inputRange: [0, 1],
          outputRange: ['0deg', '135deg'],
        }),
      },
      {
        scale: menuAnim.interpolate({
          inputRange: [0, 0.5, 1],
          outputRange: [1, 0.92, 1],
        }),
      },
    ],
  };

  const idleButtonStyle = {
    transform: [
      {
        rotate: idleAnim.interpolate({
          inputRange: [0, 0.2, 0.4, 0.6, 0.8, 1],
          outputRange: ['0deg', '-4deg', '4deg', '-3deg', '3deg', '0deg'],
        }),
      },
      {
        translateX: idleAnim.interpolate({
          inputRange: [0, 0.2, 0.4, 0.6, 0.8, 1],
          outputRange: [0, -1.5, 1.5, -1, 1, 0],
        }),
      },
    ],
  };

  return (
    <View pointerEvents="box-none" style={styles.wrapper}>
      {actions.map((action, index) => {
        const actionStyle = {
          opacity: menuAnim,
          transform: [
            {
              translateY: menuAnim.interpolate({
                inputRange: [0, 1],
                outputRange: [0, -60 * (index + 1)],
              }),
            },
            {
              scale: menuAnim.interpolate({
                inputRange: [0, 0.7, 1],
                outputRange: [0.3, 1.08, 1],
              }),
            },
          ],
        };

        return (
          <Animated.View
            key={action.key}
            pointerEvents={open ? 'auto' : 'none'}
            style={[
              styles.actionButton,
              {
                backgroundColor: action.backgroundColor,
              },
              actionStyle,
            ]}
          >
            <Pressable
              style={styles.actionPressable}
              onPress={action.onPress}
            >
              {action.icon}
            </Pressable>
          </Animated.View>
        );
      })}

      <Animated.View style={[styles.mainButtonWrap, !open && idleButtonStyle]}>
        <Pressable style={styles.mainButton} onPress={toggleOpen}>
          <Animated.View style={mainIconStyle}>
            {open ? (
              <Ionicons name="add" size={34} color="#FFFFFF" />
            ) : (
              <FontAwesome5
                name="facebook-messenger"
                size={28}
                color="#FFFFFF"
              />
            )}
          </Animated.View>
        </Pressable>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    position: 'absolute',
    right: 16,
    bottom: 70,
    width: 72,
    height: 250,
    alignItems: 'center',
    justifyContent: 'flex-end',
    zIndex: 999,
    elevation: 999,
  },

  mainButtonWrap: {
    width: 72,
    height: 72,
    alignItems: 'center',
    justifyContent: 'center',
  },

  mainButton: {
    width: 58,
    height: 58,
    borderRadius: 29,
    backgroundColor: theme.primary,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000000',
    shadowOffset: {
      width: 0,
      height: 8,
    },
    shadowOpacity: 0.18,
    shadowRadius: 10,
    elevation: 8,
  },

  actionButton: {
    position: 'absolute',
    bottom: 7,
    width: 54,
    height: 54,
    borderRadius: 27,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000000',
    shadowOffset: {
      width: 0,
      height: 6,
    },
    shadowOpacity: 0.16,
    shadowRadius: 8,
    elevation: 6,
  },

  actionPressable: {
    width: '100%',
    height: '100%',
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
  },

  zaloText: {
    fontFamily: Fonts.bold,
    fontSize: 16,
    color: '#0068FF',
  },
});