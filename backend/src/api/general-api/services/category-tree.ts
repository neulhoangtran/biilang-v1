type CategoryRawItem = {
  id: number | string;
  documentId?: string;
  Name?: string;
  Url?: string;
  Level?: number | string | null;
  ParentPath?: string | null;
  publishedAt?: string | null;
  FeatureImage?: {
    id?: number;
    documentId?: string;
    url?: string;
    width?: number;
    height?: number;
    formats?: Record<string, any>;
  } | null;
};

export type CategoryTreeNode = {
  id: string;
  documentId: string;
  name: string;
  url: string;
  image: string;
  level: number;
  parentPath: string;
  path: string;
  children: CategoryTreeNode[];
};

export type SkippedCategoryItem = {
  id: string;
  documentId: string;
  name: string;
  url: string;
  level: number;
  parentPath: string;
  path: string;
  reason: string;
};

export type CategoryTreeResult = {
  tree: CategoryTreeNode[];
  skippedItems: SkippedCategoryItem[];
  rawItems: CategoryRawItem[];
};

function normalizeText(value?: string | number | null) {
  return String(value ?? '').trim();
}

function normalizePath(value?: string | null) {
  return normalizeText(value)
    .replace(/^\/+|\/+$/g, '')
    .replace(/\/+/g, '/')
    .toLowerCase();
}

function normalizeLevel(value?: number | string | null) {
  const level = Number(value);

  if (!Number.isFinite(level)) {
    return 1;
  }

  if (level < 1) {
    return 1;
  }

  if (level > 3) {
    return 3;
  }

  return level;
}

function getImageUrl(media?: CategoryRawItem['FeatureImage']) {
  if (!media) {
    return '';
  }

  return (
    media.formats?.medium?.url ||
    media.formats?.small?.url ||
    media.formats?.thumbnail?.url ||
    media.url ||
    ''
  );
}

function buildOwnPath(item: {
  url: string;
  parentPath: string;
}) {
  if (!item.parentPath) {
    return item.url;
  }

  return normalizePath(`${item.parentPath}/${item.url}`);
}

function getLastPathSegment(path: string) {
  const parts = normalizePath(path).split('/').filter(Boolean);

  return parts[parts.length - 1] || '';
}

function mapCategory(item: CategoryRawItem): CategoryTreeNode {
  const url = normalizePath(item.Url || '');
  const parentPath = normalizePath(item.ParentPath || '');
  const level = normalizeLevel(item.Level);

  return {
    id: String(item.id || ''),
    documentId: normalizeText(item.documentId),
    name: normalizeText(item.Name),
    url,
    image: getImageUrl(item.FeatureImage),
    level,
    parentPath,
    path: buildOwnPath({
      url,
      parentPath,
    }),
    children: [],
  };
}

function sortCategory(a: CategoryTreeNode, b: CategoryTreeNode) {
  if (a.level !== b.level) {
    return a.level - b.level;
  }

  if (a.parentPath !== b.parentPath) {
    return a.parentPath.localeCompare(b.parentPath);
  }

  return a.id.localeCompare(b.id, undefined, {
    numeric: true,
  });
}

function toSkippedItem(
  node: CategoryTreeNode,
  reason: string
): SkippedCategoryItem {
  return {
    id: node.id,
    documentId: node.documentId,
    name: node.name,
    url: node.url,
    level: node.level,
    parentPath: node.parentPath,
    path: node.path,
    reason,
  };
}

function buildCategoryTreeFromItems(items: CategoryRawItem[]) {
  const nodes = items
    .map(mapCategory)
    .filter(item => item.name && item.url);

  const byPath = new Map<string, CategoryTreeNode>();
  const byUrl = new Map<string, CategoryTreeNode[]>();

  nodes.forEach(node => {
    byPath.set(node.path, node);

    const sameUrlItems = byUrl.get(node.url) ?? [];
    sameUrlItems.push(node);
    byUrl.set(node.url, sameUrlItems);
  });

  const roots: CategoryTreeNode[] = [];
  const skippedItems: SkippedCategoryItem[] = [];

  nodes.forEach(node => {
    if (node.level <= 1) {
      roots.push(node);
      return;
    }

    if (!node.parentPath) {
      skippedItems.push(
        toSkippedItem(node, 'MISSING_PARENT_PATH')
      );
      return;
    }

    let parentNode: CategoryTreeNode | undefined = byPath.get(node.parentPath);

    if (!parentNode) {
      const parentUrl = getLastPathSegment(node.parentPath);
      const candidates = byUrl.get(parentUrl) ?? [];

      parentNode =
        candidates.find(item => item.level === node.level - 1) ||
        undefined;
    }

    if (!parentNode) {
      skippedItems.push(
        toSkippedItem(node, 'PARENT_NOT_FOUND')
      );
      return;
    }

    if (parentNode.level !== node.level - 1) {
      skippedItems.push(
        toSkippedItem(node, 'INVALID_PARENT_LEVEL')
      );
      return;
    }

    parentNode.children.push(node);
  });

  const sortDeep = (list: CategoryTreeNode[]) => {
    list.sort(sortCategory);

    list.forEach(item => {
      if (item.children.length > 0) {
        sortDeep(item.children);
      }
    });
  };

  sortDeep(roots);

  return {
    tree: roots,
    skippedItems,
  };
}

export default () => ({
  async getCategoryTree(): Promise<CategoryTreeResult> {
    const rawItems = await strapi.db
      .query('api::category.category')
      .findMany({
        where: {
          publishedAt: {
            $notNull: true,
          },
        },
        select: [
          'id',
          'documentId',
          'Name',
          'Url',
          'Level',
          'ParentPath',
          'publishedAt',
        ],
        populate: {
          FeatureImage: {
            select: [
              'id',
              'documentId',
              'url',
              'width',
              'height',
              'formats',
            ],
          },
        },
        orderBy: [
          {
            Level: 'asc',
          },
          {
            ParentPath: 'asc',
          },
          {
            id: 'asc',
          },
        ],
      }) as CategoryRawItem[];

    const {
      tree,
      skippedItems,
    } = buildCategoryTreeFromItems(rawItems);

    return {
      tree,
      skippedItems,
      rawItems,
    };
  },
});