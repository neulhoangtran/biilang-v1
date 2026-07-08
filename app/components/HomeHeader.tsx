import React from 'react';
import {
  StyleSheet,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import {
  Colors,
  Fonts,
  FontSizes,
  Layout,
  Radius,
  Spacing,
} from '@/constants/theme';

const theme = Colors.light;

type HomeHeaderProps = {
  onPressSearch: () => void;
  onPressNotification?: () => void;
};

export default function HomeHeader({
  onPressSearch,
  onPressNotification,
}: HomeHeaderProps) {
  return (
    <View style={styles.header}>
      <TouchableOpacity
        activeOpacity={0.85}
        style={styles.searchBox}
        onPress={onPressSearch}
      >
        <Ionicons name="search-outline" size={28} color={theme.primary} />

        <TextInput
          editable={false}
          pointerEvents="none"
          placeholder="Tìm kiếm"
          placeholderTextColor={theme.primary}
          style={styles.searchInput}
        />
      </TouchableOpacity>

      <TouchableOpacity
        activeOpacity={0.85}
        style={styles.headerIcon}
        onPress={onPressNotification}
      >
        <Ionicons
          name="notifications-outline"
          size={32}
          color={theme.primary}
        />
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    paddingHorizontal: Layout.screenHorizontalPadding,
    paddingTop: Spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },

  searchBox: {
    flex: 1,
    height: 58,
    backgroundColor: theme.surface,
    borderRadius: Radius.md,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    gap: 8,
    borderWidth: 1,
    borderColor: theme.primarySoft,
  },

  searchInput: {
    flex: 1,
    fontFamily: Fonts.medium,
    fontSize: FontSizes.lg,
    color: theme.primary,
    padding: 0,
  },

  headerIcon: {
    width: 42,
    height: 58,
    alignItems: 'center',
    justifyContent: 'center',
  },
});