import qs from 'qs';

import { apiRequest, API_BASE_URL } from './api';

type StrapiImageFormat = {
  url: string;
  width?: number;
  height?: number;
};

type StrapiImageFormats = {
  thumbnail?: StrapiImageFormat;
  small?: StrapiImageFormat;
  medium?: StrapiImageFormat;
  large?: StrapiImageFormat;
};

type StrapiMediaItem = {
  id: number;
  documentId?: string;
  name?: string;
  alternativeText?: string | null;
  width?: number;
  height?: number;
  url: string;
  formats?: StrapiImageFormats;
};

type StrapiCategory = {
  id: number;
  documentId?: string;
  Name?: string;
  Url?: string;
  FeatureImage?: StrapiMediaItem | null;
};

type StrapiProduct = {
  id: number;
  documentId?: string;
  Name?: string;
  Url?: string;
  Price?: number | string | null;
  SalePrice?: number | string | null;
  FeatureImage?: StrapiMediaItem | null;
};

type BannerSliderBlock = {
  __component: 'cms-block.banner-slider';
  id: number;
  SliderImage?: StrapiMediaItem[];
};

type GridCategoryBlock = {
  __component: 'cms-block.grid-category';
  id: number;
  Categories?: StrapiCategory[];
};

type FeatureCategoryBlock = {
  __component: 'cms-block.feature-category';
  id: number;
  Category?: StrapiCategory | null;
  Products?: StrapiProduct[];
};

type SingleImageBlock = {
  __component: 'cms-block.single-image';
  id: number;
  Image?: StrapiMediaItem | null;
};

type CmsBlock =
  | BannerSliderBlock
  | GridCategoryBlock
  | FeatureCategoryBlock
  | SingleImageBlock;

type LandingPageResponse = {
  data?: {
    id: number;
    documentId?: string;
    CmsBlock?: CmsBlock[];
  };
  meta?: Record<string, unknown>;
};

export type HomeBanner = {
  id: number;
  imageUrl: string;
};

export type HomeCategory = {
  id: string;
  documentId?: string;
  name: string;
  url: string;
  image: string;
};

export type HomeSingleImage = {
  id: string;
  imageUrl: string;
};

export type HomeProduct = {
  id: string;
  documentId?: string;
  categoryId: string;
  categoryName: string;
  categoryUrl: string;
  brand: string;
  name: string;
  url: string;
  price: number;
  salePrice: number;
  displayPrice: number;
  image: string;
  warrantyType?: '18-months' | '5-years';
  isOutOfStock?: boolean;
};

export type HomeProductSection = {
  id: string;
  title: string;
  categoryId: string;
  categoryName: string;
  categoryUrl: string;
  products: HomeProduct[];
};

export type HomePageBlock =
  | {
      type: 'banner-slider';
      id: string;
      banners: HomeBanner[];
    }
  | {
      type: 'grid-category';
      id: string;
      categories: HomeCategory[];
    }
  | {
      type: 'feature-category';
      id: string;
      section: HomeProductSection;
    }
  | {
      type: 'single-image';
      id: string;
      image: HomeSingleImage;
    };

export type LandingPageData = {
  blocks: HomePageBlock[];
  banners: HomeBanner[];
  categories: HomeCategory[];
  featureSections: HomeProductSection[];
  singleImages: HomeSingleImage[];
  raw?: LandingPageResponse['data'];
};

const mediaFields = [
  'url',
  'formats',
  'name',
  'alternativeText',
  'width',
  'height',
];

function buildQuery(queryObject: Record<string, unknown>) {
  return qs.stringify(queryObject, {
    encode: false,
    encodeValuesOnly: true,
  });
}

const landingPageQuery = buildQuery({
  populate: {
    CmsBlock: {
      on: {
        'cms-block.banner-slider': {
          populate: {
            SliderImage: {
              fields: mediaFields,
            },
          },
        },

        'cms-block.grid-category': {
          populate: {
            Categories: {
              fields: ['Name', 'Url', 'documentId'],
              populate: {
                FeatureImage: {
                  fields: mediaFields,
                },
              },
            },
          },
        },

        'cms-block.feature-category': {
          populate: {
            Category: {
              fields: ['Name', 'Url', 'documentId'],
              populate: {
                FeatureImage: {
                  fields: mediaFields,
                },
              },
            },
            Products: {
              fields: [
                'Name',
                'Url',
                'Price',
                'SalePrice',
                'documentId',
              ],
              populate: {
                FeatureImage: {
                  fields: mediaFields,
                },
              },
            },
          },
        },

        'cms-block.single-image': {
          populate: {
            Image: {
              fields: mediaFields,
            },
          },
        },
      },
    },
  },
});

function toNumber(value?: number | string | null) {
  const num = Number(value);
  return Number.isFinite(num) ? num : 0;
}

function getMediaUrl(media?: StrapiMediaItem | null) {
  if (!media?.url) return '';

  const url =
    media.url ||
    media.formats?.medium?.url ||
    media.formats?.small?.url ||
    media.formats?.thumbnail?.url;

  return url?.startsWith('http') ? url : `${API_BASE_URL}${url}`;
}

function mapCategory(category?: StrapiCategory | null): HomeCategory | null {
  if (!category) return null;

  return {
    id: String(category.id),
    documentId: category.documentId,
    name: category.Name ?? '',
    url: category.Url ?? '',
    image: getMediaUrl(category.FeatureImage),
  };
}

function mapBannerSliderBlock(block: BannerSliderBlock): HomeBanner[] {
  return (
    block.SliderImage?.map(item => ({
      id: item.id,
      imageUrl: getMediaUrl(item),
    })).filter(item => item.imageUrl) ?? []
  );
}

function mapProduct(
  product: StrapiProduct,
  category?: HomeCategory | null
): HomeProduct {
  const price = toNumber(product.Price);
  const salePrice = toNumber(product.SalePrice);
  const displayPrice = salePrice > 0 ? salePrice : price;

  return {
    id: String(product.id),
    documentId: product.documentId,
    categoryId: category?.id ?? '',
    categoryName: category?.name ?? '',
    categoryUrl: category?.url ?? '',
    brand: category?.name ?? '',
    name: product.Name ?? '',
    url: product.Url ?? '',
    price,
    salePrice,
    displayPrice,
    image: getMediaUrl(product.FeatureImage),
    warrantyType: '18-months',
    isOutOfStock: false,
  };
}

function mapFeatureCategoryBlock(block: FeatureCategoryBlock): HomeProductSection {
  const category = mapCategory(block.Category);

  return {
    id: String(block.id),
    title: category?.name || 'Sản phẩm nổi bật',
    categoryId: category?.id ?? '',
    categoryName: category?.name ?? '',
    categoryUrl: category?.url ?? '',
    products: (block.Products ?? []).map(product =>
      mapProduct(product, category)
    ),
  };
}

function mapSingleImageBlock(block: SingleImageBlock): HomeSingleImage {
  return {
    id: String(block.Image?.id ?? block.id),
    imageUrl: getMediaUrl(block.Image),
  };
}

function mapBlock(block: CmsBlock): HomePageBlock | null {
  switch (block.__component) {
    case 'cms-block.banner-slider':
      return {
        type: 'banner-slider',
        id: String(block.id),
        banners: mapBannerSliderBlock(block),
      };

    case 'cms-block.grid-category':
      return {
        type: 'grid-category',
        id: String(block.id),
        categories: (block.Categories ?? [])
          .map(mapCategory)
          .filter(Boolean) as HomeCategory[],
      };

    case 'cms-block.feature-category':
      return {
        type: 'feature-category',
        id: String(block.id),
        section: mapFeatureCategoryBlock(block),
      };

    case 'cms-block.single-image':
      return {
        type: 'single-image',
        id: String(block.id),
        image: mapSingleImageBlock(block),
      };

    default:
      return null;
  }
}

export async function getLandingPage(): Promise<LandingPageData> {
  const response = await apiRequest<LandingPageResponse>(
    `/api/landing-page?${landingPageQuery}`
  );

  const blocks = (response.data?.CmsBlock ?? [])
    .map(mapBlock)
    .filter(Boolean) as HomePageBlock[];

  const banners = blocks
    .filter(block => block.type === 'banner-slider')
    .flatMap(block => block.banners);

  const categories = blocks
    .filter(block => block.type === 'grid-category')
    .flatMap(block => block.categories);

  const featureSections = blocks
    .filter(block => block.type === 'feature-category')
    .map(block => block.section);

  const singleImages = blocks
    .filter(block => block.type === 'single-image')
    .map(block => block.image)
    .filter(item => item.imageUrl);

  return {
    blocks,
    banners,
    categories,
    featureSections,
    singleImages,
    raw: response.data,
  };
}