import React, { useRef } from 'react';
import {
  Dimensions,
  StyleSheet,
  TouchableOpacity,
  View,
} from 'react-native';

import Carousel, { ICarouselInstance } from 'react-native-reanimated-carousel';
import Animated, {
  Extrapolation,
  interpolate,
  interpolateColor,
  useAnimatedStyle,
  useSharedValue,
} from 'react-native-reanimated';
import type { SharedValue } from 'react-native-reanimated';

import CachedImage from '@/components/CachedImage';

import {
  Colors,
  Layout,
  Radius,
  Spacing,
} from '@/constants/theme';

const { width } = Dimensions.get('window');

const theme = Colors.light;

const CAROUSEL_WIDTH = width;
const BANNER_WIDTH = width - Layout.screenHorizontalPadding * 2;

// Ảnh banner hiện tại của bạn khoảng 1576 x 504
const DEFAULT_BANNER_ASPECT_RATIO = 1920 / 1080;
const BANNER_HEIGHT = BANNER_WIDTH / DEFAULT_BANNER_ASPECT_RATIO;

export type BannerSliderItem = {
  id: number | string;
  imageUrl: string;
};

type BannerSliderProps = {
  banners: BannerSliderItem[];
};

type DotProps = {
  index: number;
  progress: SharedValue<number>;
  length: number;
  onPress: () => void;
};

function Dot({ index, progress, length, onPress }: DotProps) {
  const animatedStyle = useAnimatedStyle(() => {
    let val = Math.abs(progress.value - index);

    if (index === 0 && progress.value > length - 1) {
      val = Math.abs(progress.value - length);
    }

    return {
      width: interpolate(val, [0, 1], [28, 9], Extrapolation.CLAMP),
      backgroundColor: interpolateColor(
        val,
        [0, 1],
        [theme.primary, theme.primarySoft]
      ),
    };
  });

  return (
    <TouchableOpacity activeOpacity={0.8} onPress={onPress}>
      <Animated.View style={[styles.dot, animatedStyle]} />
    </TouchableOpacity>
  );
}

export default function BannerSlider({ banners }: BannerSliderProps) {
  const progress = useSharedValue(0);
  const carouselRef = useRef<ICarouselInstance>(null);

  if (!banners.length) return null;

  const handlePressDot = (index: number) => {
    const currentIndex = Math.round(progress.value);

    carouselRef.current?.scrollTo({
      count: index - currentIndex,
      animated: true,
    });
  };

  return (
    <View style={styles.bannerContainer}>
      <Carousel
        ref={carouselRef}
        loop
        autoPlay
        autoPlayInterval={3000}
        width={CAROUSEL_WIDTH}
        height={BANNER_HEIGHT}
        style={styles.carousel}
        data={banners}
        scrollAnimationDuration={500}
        onProgressChange={(_, absoluteProgress) => {
          progress.value = absoluteProgress;
        }}
        renderItem={({ item }) => (
          <View style={styles.bannerItem}>
            <View style={styles.bannerImageWrap}>
              <CachedImage
                uri={item.imageUrl}
                style={styles.bannerImage}
                cachePolicy="disk"
                contentFit="contain"
              />
            </View>
          </View>
        )}
      />

      <View style={styles.pagination}>
        {banners.map((item, index) => (
          <Dot
            key={String(item.id)}
            index={index}
            progress={progress}
            length={banners.length}
            onPress={() => handlePressDot(index)}
          />
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  bannerContainer: {
    paddingHorizontal: 0,
    marginTop: Spacing.lg,
    marginBottom: Spacing.xl,
  },

  carousel: {
    marginHorizontal: 0,
  },

  bannerItem: {
    flex: 1,
    paddingHorizontal: Layout.screenHorizontalPadding,
  },

  bannerImageWrap: {
    width: '100%',
    height: '100%',
    borderRadius: Radius.lg,
    backgroundColor: theme.surface,
    overflow: 'hidden',
  },

  bannerImage: {
    width: '100%',
    height: '100%',
  },

  pagination: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: Spacing.md,
    gap: 8,
  },

  dot: {
    height: 9,
    borderRadius: Radius.pill,
    backgroundColor: theme.primarySoft,
  },
});