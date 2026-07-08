import qs from 'qs';

import { apiRequest, API_BASE_URL } from './api';
import type { ProductItem } from '@/components/ProductSection';

export type AppProductCategory = {
  id: string;
  documentId?: string;
  name: string;
  url: string;
};

export type AppProductGalleryImage = {
  id: string;
  imageUrl: string;
};

export type AppProduct = {
  id: string;
  documentId?: string;
  name: string;
  url: string;
  price: number;
  salePrice: number;
  displayPrice: number;
  image: string;
  gallery: AppProductGalleryImage[];
  description: string;
  categoryNames: string[];
  categoryUrls: string[];
  categories: AppProductCategory[];
  isOutOfStock?: boolean;
};

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
};

type StrapiProduct = {
  id: number;
  documentId?: string;
  Name?: string;
  Url?: string;
  Price?: number | string | null;
  SalePrice?: number | string | null;
  Description?: string | null;
  FeatureImage?: StrapiMediaItem | null;
  Gallery?: StrapiMediaItem[] | null;
  Categories?: StrapiCategory[];
};

type ProductResponse = {
  data?: StrapiProduct[];
  meta?: {
    pagination?: {
      page: number;
      pageSize: number;
      pageCount: number;
      total: number;
    };
  };
};

type ProductDetailResponse = {
  data?: StrapiProduct;
  meta?: Record<string, unknown>;
};

export type ProductListResult = {
  products: AppProduct[];
  total: number;
  page: number;
  pageSize: number;
  pageCount: number;
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

function toNumber(value?: number | string | null) {
  const num = Number(value);
  return Number.isFinite(num) ? num : 0;
}

function getMediaUrl(media?: StrapiMediaItem | null) {
  if (!media?.url) return '';

  const url =
    media.formats?.medium?.url ||
    media.url ||
    media.formats?.small?.url ||
    media.formats?.thumbnail?.url;

  return url?.startsWith('http') ? url : `${API_BASE_URL}${url}`;
}

function mapCategory(category: StrapiCategory): AppProductCategory {
  return {
    id: String(category.id),
    documentId: category.documentId,
    name: category.Name ?? '',
    url: category.Url ?? '',
  };
}

function mapGalleryItem(item: StrapiMediaItem): AppProductGalleryImage {
  return {
    id: String(item.id),
    imageUrl: getMediaUrl(item),
  };
}

function mapProductToApp(item: StrapiProduct): AppProduct {
  const price = toNumber(item.Price);
  const salePrice = toNumber(item.SalePrice);
  const displayPrice = salePrice > 0 ? salePrice : price;

  const categories = (item.Categories ?? []).map(mapCategory);
  const gallery = (item.Gallery ?? []).map(mapGalleryItem).filter(x => x.imageUrl);

  const featureImage = getMediaUrl(item.FeatureImage);

  return {
    id: String(item.id),
    documentId: item.documentId,
    name: item.Name ?? '',
    url: item.Url ?? '',
    price,
    salePrice,
    displayPrice,
    image: featureImage || gallery[0]?.imageUrl || '',
    gallery,
    description: item.Description ?? '',
    categories,
    categoryNames: categories.map(category => category.name).filter(Boolean),
    categoryUrls: categories.map(category => category.url).filter(Boolean),
    isOutOfStock: false,
  };
}

function mapProductToSectionItem(
  item: StrapiProduct,
  category?: StrapiCategory
): ProductItem {
  const price = toNumber(item.SalePrice) || toNumber(item.Price);

  return {
    id: String(item.id),
    categoryId: String(category?.id ?? ''),
    categoryName: category?.Name ?? '',
    brand: category?.Name ?? '',
    name: item.Name ?? '',
    price,
    image: getMediaUrl(item.FeatureImage),
    warrantyType: '18-months',
  };
}
function buildProductFilters(params?: {
  categoryUrl?: string;
  searchText?: string;
  priceMin?: number;
  priceMax?: number;
  excludeProductUrl?: string;
  productIds?: string[];
}) {
  const andFilters: unknown[] = [];

  if (params?.productIds?.length) {
    andFilters.push({
      id: {
        $in: params.productIds,
      },
    });
  }

  if (params?.categoryUrl) {
    andFilters.push({
      Categories: {
        Url: {
          $eq: params.categoryUrl,
        },
      },
    });
  }

  if (params?.excludeProductUrl) {
    andFilters.push({
      Url: {
        $ne: params.excludeProductUrl,
      },
    });
  }

  if (params?.searchText) {
    andFilters.push({
      $or: [
        {
          Name: {
            $containsi: params.searchText,
          },
        },
        {
          Url: {
            $containsi: params.searchText,
          },
        },
        {
          Description: {
            $containsi: params.searchText,
          },
        },
      ],
    });
  }

  if (
    typeof params?.priceMin === 'number' ||
    typeof params?.priceMax === 'number'
  ) {
    const priceFilter: Record<string, number> = {};

    if (typeof params.priceMin === 'number') {
      priceFilter.$gte = params.priceMin;
    }

    if (typeof params.priceMax === 'number') {
      priceFilter.$lte = params.priceMax;
    }

    andFilters.push({
      $or: [
        {
          Price: priceFilter,
        },
        {
          SalePrice: priceFilter,
        },
      ],
    });
  }

  if (andFilters.length === 0) {
    return undefined;
  }

  return {
    $and: andFilters,
  };
}

const productPopulate = {
  FeatureImage: {
    fields: mediaFields,
  },
  Gallery: {
    fields: mediaFields,
  },
  Categories: {
    fields: ['Name', 'Url', 'documentId'],
  },
};

export async function getProducts(params?: {
  categoryUrl?: string;
  searchText?: string;
  priceMin?: number;
  priceMax?: number;
  excludeProductUrl?: string;
  productIds?: string[];
  page?: number;
  pageSize?: number;
  sort?: string[];
}): Promise<ProductListResult> {
  const filters = buildProductFilters({
    categoryUrl: params?.categoryUrl,
    searchText: params?.searchText,
    priceMin: params?.priceMin,
    priceMax: params?.priceMax,
    excludeProductUrl: params?.excludeProductUrl,
    productIds: params?.productIds,
  });

  const queryObject: Record<string, unknown> = {
    fields: ['Name', 'Url', 'Price', 'SalePrice', 'Description', 'documentId'],
    populate: productPopulate,
    pagination: {
      page: params?.page ?? 1,
      pageSize: params?.pageSize ?? 12,
    },
    sort: params?.sort ?? ['id:desc'],
  };

  if (filters) {
    queryObject.filters = filters;
  }

  const query = buildQuery(queryObject);

  const response = await apiRequest<ProductResponse>(`/api/products?${query}`);
  const pagination = response.meta?.pagination;

  return {
    products: (response.data ?? []).map(mapProductToApp),
    total: pagination?.total ?? 0,
    page: pagination?.page ?? params?.page ?? 1,
    pageSize: pagination?.pageSize ?? params?.pageSize ?? 12,
    pageCount: pagination?.pageCount ?? 1,
  };
}

export async function getProductByUrl(productUrl: string): Promise<AppProduct | null> {
  if (!productUrl) return null;

  const query = buildQuery({
    filters: {
      Url: {
        $eq: productUrl,
      },
    },
    fields: ['Name', 'Url', 'Price', 'SalePrice', 'Description', 'documentId'],
    populate: productPopulate,
    pagination: {
      pageSize: 1,
    },
  });

  const response = await apiRequest<ProductResponse>(`/api/products?${query}`);
  const product = response.data?.[0];

  return product ? mapProductToApp(product) : null;
}

export async function getProductByDocumentId(
  documentId: string
): Promise<AppProduct | null> {
  if (!documentId) return null;

  const query = buildQuery({
    fields: ['Name', 'Url', 'Price', 'SalePrice', 'Description', 'documentId'],
    populate: productPopulate,
  });

  const response = await apiRequest<ProductDetailResponse>(
    `/api/products/${documentId}?${query}`
  );

  return response.data ? mapProductToApp(response.data) : null;
}

export async function getRelatedProducts(params: {
  categoryUrl?: string;
  excludeProductUrl?: string;
  pageSize?: number;
}): Promise<AppProduct[]> {
  if (!params.categoryUrl) return [];

  const response = await getProducts({
    categoryUrl: params.categoryUrl,
    excludeProductUrl: params.excludeProductUrl,
    page: 1,
    pageSize: params.pageSize ?? 12,
    sort: ['id:desc'],
  });

  return response.products;
}

export async function getProductsByCategoryUrl(params: {
  categoryUrl: string;
  page?: number;
  pageSize?: number;
}): Promise<{
  products: ProductItem[];
  total: number;
  page: number;
  pageCount: number;
}> {
  const query = buildQuery({
    filters: {
      Categories: {
        Url: {
          $eq: params.categoryUrl,
        },
      },
    },
    fields: ['Name', 'Url', 'Price', 'SalePrice', 'documentId'],
    populate: productPopulate,
    pagination: {
      page: params.page ?? 1,
      pageSize: params.pageSize ?? 12,
    },
    sort: ['id:desc'],
  });

  const response = await apiRequest<ProductResponse>(`/api/products?${query}`);

  return {
    products:
      response.data?.map(product => {
        const category = product.Categories?.find(
          item => item.Url === params.categoryUrl
        );

        return mapProductToSectionItem(product, category);
      }) ?? [],
    total: response.meta?.pagination?.total ?? 0,
    page: response.meta?.pagination?.page ?? 1,
    pageCount: response.meta?.pagination?.pageCount ?? 1,
  };
}

export async function searchProducts(params: {
  searchText: string;
  categoryUrl?: string;
  page?: number;
  pageSize?: number;
}) {
  return getProducts({
    searchText: params.searchText,
    categoryUrl: params.categoryUrl,
    page: params.page,
    pageSize: params.pageSize,
  });
}

export async function getProductsByIds(params: {
  productIds: string[];
  page?: number;
  pageSize?: number;
  sort?: string[];
}) {
  const ids = Array.from(
    new Set(
      params.productIds
        .map(item => String(item).trim())
        .filter(Boolean)
    )
  );

  if (!ids.length) {
    return {
      products: [],
      total: 0,
      page: params.page ?? 1,
      pageSize: params.pageSize ?? 12,
      pageCount: 1,
    };
  }

  return getProducts({
    productIds: ids,
    page: params.page,
    pageSize: params.pageSize,
    sort: params.sort ?? ['id:desc'],
  });
}