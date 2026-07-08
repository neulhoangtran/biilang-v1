import React from 'react';
import {
  Dimensions,
  StyleSheet,
  TouchableOpacity,
} from 'react-native';

import CachedImage from '@/components/CachedImage';

import {
  Colors,
  Layout,
  Radius,
  Spacing,
} from '@/constants/theme';

const { width } = Dimensions.get('window');

const theme = Colors.light;

// Cùng tỉ lệ với BannerSlider
const DEFAULT_SINGLE_IMAGE_ASPECT_RATIO = 1920 / 1080;

const SINGLE_IMAGE_WIDTH =
  width - Layout.screenHorizontalPadding * 2;

const SINGLE_IMAGE_HEIGHT =
  SINGLE_IMAGE_WIDTH / DEFAULT_SINGLE_IMAGE_ASPECT_RATIO;

type SingleImageProps = {
  imageUrl: string;
  onPress?: () => void;
};

export default function SingleImage({
  imageUrl,
  onPress,
}: SingleImageProps) {
  if (!imageUrl) return null;

  return (
    <TouchableOpacity
      activeOpacity={0.9}
      disabled={!onPress}
      onPress={onPress}
      style={styles.container}
    >
      <CachedImage
        uri={imageUrl}
        style={styles.image}
        cachePolicy="disk"
        contentFit="contain"
      />
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: {
    marginHorizontal: Layout.screenHorizontalPadding,
    marginBottom: Spacing.md,
    borderRadius: Radius.lg,
    backgroundColor: theme.surface,
    overflow: 'hidden',
  },

  image: {
    width: '100%',
    height: SINGLE_IMAGE_HEIGHT,
  },
});