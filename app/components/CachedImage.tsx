import { Image, ImageProps } from 'expo-image';

type CachedImageProps = ImageProps & {
  uri?: string;
};

export default function CachedImage({
  uri,
  source,
  cachePolicy = 'disk',
  contentFit = 'cover',
  transition = 150,
  ...props
}: CachedImageProps) {
  const finalSource = uri ? { uri } : source;

  if (!finalSource) {
    return null;
  }

  return (
    <Image
      {...props}
      source={finalSource}
      cachePolicy={cachePolicy}
      contentFit={contentFit}
      transition={transition}
    />
  );
}