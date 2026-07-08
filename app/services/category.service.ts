import { apiRequest, API_BASE_URL } from './api';

export type AppCategory = {
  id: string;
  documentId?: string;
  name: string;
  url: string;
  image: string;
};

export type AppCategoryTreeNode = AppCategory & {
  parentId?: string | null;
  parentDocumentId?: string;
  children: AppCategoryTreeNode[];
};

type CategoryTreeResponse = {
  success?: boolean;
  data?: ApiCategoryTreeNode[];
};

type ApiCategoryTreeNode = {
  id: number | string;
  documentId?: string;
  name?: string;
  url?: string;
  image?: string;
  parentId?: number | string | null;
  parentDocumentId?: string;
  children?: ApiCategoryTreeNode[];
};

let categoryTreeCache: AppCategoryTreeNode[] | null = null;

function normalizeMediaUrl(url?: string | null) {
  if (!url) {
    return '';
  }

  return url.startsWith('http')
    ? url
    : `${API_BASE_URL}${url}`;
}

function mapCategoryTreeNode(
  item: ApiCategoryTreeNode
): AppCategoryTreeNode {
  return {
    id: String(item.id || ''),
    documentId: item.documentId || '',
    name: item.name || '',
    url: item.url || '',
    image: normalizeMediaUrl(item.image),
    parentId:
      item.parentId === undefined || item.parentId === null
        ? null
        : String(item.parentId),
    parentDocumentId: item.parentDocumentId || '',
    children: Array.isArray(item.children)
      ? item.children.map(mapCategoryTreeNode)
      : [],
  };
}

function flattenCategoryTree(
  tree: AppCategoryTreeNode[]
): AppCategoryTreeNode[] {
  const result: AppCategoryTreeNode[] = [];

  const walk = (items: AppCategoryTreeNode[]) => {
    items.forEach(item => {
      result.push(item);

      if (item.children?.length) {
        walk(item.children);
      }
    });
  };

  walk(tree);

  return result;
}

function toAppCategory(item: AppCategoryTreeNode): AppCategory {
  return {
    id: item.id,
    documentId: item.documentId,
    name: item.name,
    url: item.url,
    image: item.image,
  };
}

function findCategoryInTreeByUrl(
  tree: AppCategoryTreeNode[],
  url: string
): AppCategoryTreeNode | null {
  if (!url) {
    return null;
  }

  for (const item of tree) {
    if (item.url === url) {
      return item;
    }

    const found = findCategoryInTreeByUrl(item.children, url);

    if (found) {
      return found;
    }
  }

  return null;
}

function findParentOfCategoryByUrl(
  tree: AppCategoryTreeNode[],
  childUrl: string,
  parent: AppCategoryTreeNode | null = null
): AppCategoryTreeNode | null {
  for (const item of tree) {
    if (item.url === childUrl) {
      return parent;
    }

    const found = findParentOfCategoryByUrl(
      item.children,
      childUrl,
      item
    );

    if (found) {
      return found;
    }
  }

  return null;
}

/**
 * API mới: lấy full cây category 3 level.
 */
export async function getCategoryTree(
  forceRefresh = false
): Promise<AppCategoryTreeNode[]> {
  if (categoryTreeCache && !forceRefresh) {
    return categoryTreeCache;
  }

  const response = await apiRequest<CategoryTreeResponse>(
    '/api/vikof/category-tree',
    {
      authMode: 'public',
    }
  );

  const data = Array.isArray(response.data)
    ? response.data
    : [];

  categoryTreeCache = data.map(mapCategoryTreeNode);

  return categoryTreeCache;
}

/**
 * Clear cache khi cần reload category tree.
 */
export function clearCategoryTreeCache() {
  categoryTreeCache = null;
}

/**
 * Category cấp 1.
 * Bây giờ lấy trực tiếp từ root của cây category.
 */
export async function getRootCategories(): Promise<AppCategory[]> {
  const tree = await getCategoryTree();

  return tree.map(toAppCategory);
}

/**
 * Lấy category con theo Url của parent.
 * Bây giờ không gọi API nữa, chỉ tìm trong cây đã load.
 */
export async function getChildCategoriesByParentUrl(
  parentUrl: string
): Promise<AppCategory[]> {
  if (!parentUrl) {
    return [];
  }

  const tree = await getCategoryTree();
  const parent = findCategoryInTreeByUrl(tree, parentUrl);

  if (!parent?.children?.length) {
    return [];
  }

  return parent.children.map(toAppCategory);
}

/**
 * Khi cần lấy tất cả level 3 dưới danh sách level 2.
 * Giữ lại để các UI cũ không lỗi.
 */
export async function getAllLevel3ByLevel2List(
  level2Categories: AppCategory[]
): Promise<AppCategory[]> {
  if (!level2Categories.length) {
    return [];
  }

  const tree = await getCategoryTree();
  const map = new Map<string, AppCategory>();

  level2Categories.forEach(level2 => {
    const node = findCategoryInTreeByUrl(tree, level2.url);

    if (!node?.children?.length) {
      return;
    }

    node.children.forEach(level3 => {
      if (!map.has(level3.url)) {
        map.set(level3.url, toAppCategory(level3));
      }
    });
  });

  return Array.from(map.values());
}

/**
 * Lấy toàn bộ category dạng flat.
 * Giữ lại hàm cũ để các chỗ khác còn dùng không lỗi.
 */
export async function getCategories(): Promise<AppCategory[]> {
  const tree = await getCategoryTree();
  const flat = flattenCategoryTree(tree);

  return flat.map(toAppCategory);
}

/**
 * Helper mới: tìm category theo url.
 */
export async function getCategoryByUrl(
  url: string
): Promise<AppCategory | null> {
  if (!url) {
    return null;
  }

  const tree = await getCategoryTree();
  const category = findCategoryInTreeByUrl(tree, url);

  return category ? toAppCategory(category) : null;
}

/**
 * Helper mới: tìm parent của category theo url.
 */
export async function getParentCategoryByUrl(
  childUrl: string
): Promise<AppCategory | null> {
  if (!childUrl) {
    return null;
  }

  const tree = await getCategoryTree();
  const parent = findParentOfCategoryByUrl(tree, childUrl);

  return parent ? toAppCategory(parent) : null;
}