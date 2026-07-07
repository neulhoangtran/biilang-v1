import type { AdminUser } from '../../../../types/admin-user';
import { systemError } from '../../../utils/system-logger';

type BranchAdminContext = {
  authUser: any | null;
  currentUser: AdminUser | null;
  branchId: number | null;
};

type RelationIdValue = {
  id?: number | string;
};

type VoucherWithRelations = {
  id: number | string;
  documentId?: string;
  Name?: string;
  IsActive?: boolean;
  Description?: string | null;
  VoucherCode?: string | null;
  ApplyFor?: 'All' | 'User' | 'Branch';
  ExpiryDate?: string | null;
  createdAt?: string | Date | null;
  publishedAt?: string | Date | null;
  User?: RelationIdValue[] | RelationIdValue | null;
  Branch?: RelationIdValue[] | RelationIdValue | null;
};

type UseCustomerVoucherInput = {
  authUserId: number;
  customerId: number | string;
  voucherType: 'FIRST_REGISTER' | 'STANDARD';
  voucherId?: number | string | null;
  requestId?: string;
};

class VikofServiceError extends Error {
  status: number;

  constructor(message: string, status = 400) {
    super(message);
    this.name = 'VikofServiceError';
    this.status = status;
  }
}

function badRequest(message: string): never {
  throw new VikofServiceError(message, 400);
}

function unauthorized(message: string): never {
  throw new VikofServiceError(message, 401);
}

function forbidden(message: string): never {
  throw new VikofServiceError(message, 403);
}

function notFound(message: string): never {
  throw new VikofServiceError(message, 404);
}

function getNumberId(value: unknown) {
  const numberValue = Number(value);

  return Number.isFinite(numberValue) && numberValue > 0
    ? numberValue
    : null;
}

function getBranchId(user: any) {
  const branch = user?.Branch || user?.branch;

  if (!branch) {
    return null;
  }

  if (Array.isArray(branch)) {
    return getNumberId(branch[0]?.id);
  }

  return getNumberId(branch.id);
}

function getRelationIds(value: any) {
  const items = Array.isArray(value)
    ? value
    : value
      ? [value]
      : [];

  return items
    .map((item: any) => getNumberId(item?.id))
    .filter(Boolean) as number[];
}

function getRelationId(value: any) {
  if (Array.isArray(value)) {
    return getNumberId(value[0]?.id);
  }

  return getNumberId(value?.id);
}

function getRelationDocumentId(value: any) {
  const relation = Array.isArray(value)
    ? value[0]
    : value;

  return String(
    relation?.documentId || ''
  ).trim();
}

function chunkValues<T>(
  values: T[],
  size = 500
) {
  const chunks: T[][] = [];

  for (
    let index = 0;
    index < values.length;
    index += size
  ) {
    chunks.push(
      values.slice(index, index + size)
    );
  }

  return chunks;
}

function isExpiredDate(value: unknown) {
  if (!value) {
    return false;
  }

  const expiryDate = new Date(String(value));

  if (Number.isNaN(expiryDate.getTime())) {
    return false;
  }

  return expiryDate.getTime() < Date.now();
}

function getVoucherStatus({
  isUsed,
  isExpired,
}: {
  isUsed: boolean;
  isExpired: boolean;
}) {
  if (isUsed) {
    return 'USED';
  }

  if (isExpired) {
    return 'EXPIRED';
  }

  return 'AVAILABLE';
}

function getHistoryMapKey(
  userId: number,
  voucherDocumentId: string
) {
  return `${userId}:${voucherDocumentId}`;
}

function sanitizeVoucherHistory(history: any) {
  return {
    id: history.id,
    documentId: history.documentId,
    Name: history.Name,
    IsSuccess: Boolean(history.IsSuccess),
    AppliedDate: history.AppliedDate,
  };
}

function buildVoucherHistoryMap(histories: any[]) {
  const historyMap = new Map<string, any[]>();

  for (const history of histories) {
    const userId = getRelationId(history?.User);
    const voucherDocumentId =
      getRelationDocumentId(history?.Voucher);

    if (!userId || !voucherDocumentId) {
      continue;
    }

    const key = getHistoryMapKey(
      userId,
      voucherDocumentId
    );
    const currentHistories = historyMap.get(key) || [];

    currentHistories.push(sanitizeVoucherHistory(history));
    historyMap.set(key, currentHistories);
  }

  return historyMap;
}

function buildFirstRegisterVoucher(user: any) {
  if (user?.IsFirstRegister !== true) {
    return null;
  }

  const expiryDate =
    user?.ExpiredFirstRegisterVoucher || null;
  const isUsed =
    user?.IsUseFirstRegisterVoucher === true;
  const isExpired = isExpiredDate(expiryDate);

  return {
    id: `first-register-${user.id}`,
    documentId: null,
    Type: 'FIRST_REGISTER',
    Name: 'Voucher đăng ký lần đầu',
    Description: 'Voucher dành cho khách hàng đăng ký lần đầu.',
    VoucherCode: null,
    ApplyFor: 'User',
    IsActive: true,
    ExpiryDate: expiryDate,
    IsUsed: isUsed,
    IsExpired: isExpired,
    Status: getVoucherStatus({
      isUsed,
      isExpired,
    }),
    UsedAt: null,
    createdAt: user.createdAt,
    voucher_histories: [],
  };
}

function sanitizeStandardVoucher(
  voucher: any,
  userId: number,
  historyMap: Map<string, any[]>
) {
  const voucherDocumentId = String(
    voucher.documentId || ''
  ).trim();

  const histories =
    historyMap.get(
      getHistoryMapKey(
        userId,
        voucherDocumentId
      )
    ) || [];
  const isUsed = histories.length > 0;
  const isExpired = isExpiredDate(voucher?.ExpiryDate);

  return {
    id: voucher.id,
    documentId: voucher.documentId,
    Type: 'STANDARD',
    Name: voucher.Name,
    Description: voucher.Description || null,
    VoucherCode: voucher.VoucherCode || null,
    ApplyFor: voucher.ApplyFor,
    IsActive: Boolean(voucher.IsActive),
    ExpiryDate: voucher.ExpiryDate,
    IsUsed: isUsed,
    IsExpired: isExpired,
    Status: getVoucherStatus({
      isUsed,
      isExpired,
    }),
    UsedAt: histories[0]?.AppliedDate || null,
    createdAt: voucher.createdAt,
    voucher_histories: histories,
  };
}

function buildCustomerVouchers(
  user: any,
  customerVouchers: any[],
  historyMap: Map<string, any[]>
) {
  const firstRegisterVoucher =
    buildFirstRegisterVoucher(user);

  const standardVouchers = customerVouchers.map(
    voucher =>
      sanitizeStandardVoucher(
        voucher,
        Number(user.id),
        historyMap
      )
  );

  return firstRegisterVoucher
    ? [firstRegisterVoucher, ...standardVouchers]
    : standardVouchers;
}

function buildCustomerVoucherMap(
  customers: any[],
  vouchers: any[],
  branchId: number
) {
  const customerVoucherMap = new Map<number, any[]>();

  for (const customer of customers) {
    const customerId = getNumberId(customer?.id);

    if (customerId) {
      customerVoucherMap.set(customerId, []);
    }
  }

  for (const voucher of vouchers) {
    const applyFor = String(voucher?.ApplyFor || '');

    if (applyFor === 'All') {
      for (const customerVouchers of customerVoucherMap.values()) {
        customerVouchers.push(voucher);
      }

      continue;
    }

    if (
      applyFor === 'Branch' &&
      getRelationIds(voucher?.Branch).includes(branchId)
    ) {
      for (const customerVouchers of customerVoucherMap.values()) {
        customerVouchers.push(voucher);
      }

      continue;
    }

    if (applyFor === 'User') {
      for (const customerId of getRelationIds(voucher?.User)) {
        customerVoucherMap.get(customerId)?.push(voucher);
      }
    }
  }

  return customerVoucherMap;
}

async function getRelevantVouchers(
  customerIds: number[],
  branchId: number
) {
  if (customerIds.length === 0) {
    return [];
  }

  const voucherResult = await strapi
    .documents('api::voucher.voucher')
    .findMany({
      status: 'published',
      filters: {
        IsActive: {
          $eq: true,
        },
        $or: [
          {
            ApplyFor: {
              $eq: 'All',
            },
          },
          {
            ApplyFor: {
              $eq: 'User',
            },
          },
          {
            ApplyFor: {
              $eq: 'Branch',
            },
            Branch: {
              id: {
                $eq: branchId,
              },
            },
          },
        ],
      },
      fields: [
        'Name',
        'IsActive',
        'Description',
        'VoucherCode',
        'ApplyFor',
        'ExpiryDate',
        'createdAt',
      ],
      populate: {
        User: {
          fields: ['id'],
        },
        Branch: {
          fields: ['id'],
        },
      },
      sort: {
        createdAt: 'desc',
      },
    } as any);

  if (!Array.isArray(voucherResult)) {
    return [];
  }

  const vouchers =
    voucherResult as unknown as VoucherWithRelations[];

  const customerIdSet = new Set(customerIds);

  return vouchers.filter(voucher => {
    const applyFor = String(voucher?.ApplyFor || '');

    if (applyFor === 'All') {
      return true;
    }

    if (applyFor === 'Branch') {
      return getRelationIds(voucher?.Branch).includes(branchId);
    }

    if (applyFor === 'User') {
      return getRelationIds(voucher?.User).some(userId =>
        customerIdSet.has(userId)
      );
    }

    return false;
  });
}

async function getSuccessfulVoucherHistories(
  customerIds: number[],
  voucherDocumentIds: string[]
) {
  if (
    customerIds.length === 0 ||
    voucherDocumentIds.length === 0
  ) {
    return [];
  }

  const histories: any[] = [];
  const customerIdChunks =
    chunkValues(customerIds);
  const voucherDocumentIdChunks =
    chunkValues(voucherDocumentIds);

  // Query theo lô để tránh danh sách $in quá lớn và không tạo N+1 query.
  for (const customerIdChunk of customerIdChunks) {
    for (
      const voucherDocumentIdChunk of
      voucherDocumentIdChunks
    ) {
      const historyBatch = await strapi
        .documents(
          'api::voucher-history.voucher-history'
        )
        .findMany({
          status: 'published',
          filters: {
            IsSuccess: {
              $eq: true,
            },
            User: {
              id: {
                $in: customerIdChunk,
              },
            },
            Voucher: {
              documentId: {
                $in: voucherDocumentIdChunk,
              },
            },
          },
          fields: [
            'Name',
            'IsSuccess',
            'AppliedDate',
          ],
          populate: {
            User: {
              fields: ['id'],
            },
            Voucher: {
              fields: ['Name'],
            },
          },
          sort: {
            AppliedDate: 'desc',
          },
        } as any);

      if (Array.isArray(historyBatch)) {
        histories.push(...historyBatch);
      }
    }
  }

  return histories;
}

function getCustomerVouchers(
  user: any,
  customerVoucherMap: Map<number, any[]>
) {
  const customerId = getNumberId(user?.id);

  if (!customerId) {
    return [];
  }

  return customerVoucherMap.get(customerId) || [];
}

async function getBranchCustomer(
  customerId: number,
  branchId: number
) {
  const customer = await strapi.db
    .query('plugin::users-permissions.user')
    .findOne({
      where: {
        id: customerId,
      },
      populate: {
        Branch: true,
      },
    } as any);

  if (!customer) {
    notFound('Không tìm thấy khách hàng.');
  }

  if (getBranchId(customer) !== branchId) {
    forbidden('Khách hàng không thuộc chi nhánh của bạn.');
  }

  return customer as any;
}

async function getStandardVoucher(voucherId: number) {
  const voucherReference = await strapi.db
    .query('api::voucher.voucher')
    .findOne({
      where: {
        id: voucherId,
      },
      select: ['documentId'],
    } as any);

  const documentId = String(
    voucherReference?.documentId || ''
  ).trim();

  if (!documentId) {
    notFound('Không tìm thấy voucher.');
  }

  const voucherResult = await strapi
    .documents('api::voucher.voucher')
    .findOne({
      documentId,
      status: 'published',
      fields: [
        'Name',
        'IsActive',
        'Description',
        'VoucherCode',
        'ApplyFor',
        'ExpiryDate',
        'createdAt',
      ],
      populate: {
        User: {
          fields: ['id'],
        },
        Branch: {
          fields: ['id'],
        },
      },
    } as any);

  if (!voucherResult) {
    badRequest('Voucher chưa được phát hành.');
  }

  return voucherResult as unknown as VoucherWithRelations;
}

function validateStandardVoucherForCustomer(
  voucher: VoucherWithRelations,
  customer: any
) {
  if (voucher.IsActive !== true) {
    badRequest('Voucher hiện không hoạt động.');
  }

  if (isExpiredDate(voucher.ExpiryDate)) {
    badRequest('Voucher đã hết hạn.');
  }

  const applyFor = String(voucher.ApplyFor || '');
  const customerId = Number(customer.id);
  const customerBranchId = getBranchId(customer);

  if (applyFor === 'All') {
    return;
  }

  if (
    applyFor === 'User' &&
    getRelationIds(voucher.User).includes(customerId)
  ) {
    return;
  }

  if (
    applyFor === 'Branch' &&
    customerBranchId &&
    getRelationIds(voucher.Branch).includes(customerBranchId)
  ) {
    return;
  }

  forbidden('Voucher không áp dụng cho khách hàng này.');
}

async function findSuccessfulVoucherHistory(
  customerId: number,
  voucherDocumentId: string
) {
  const histories = await strapi
    .documents(
      'api::voucher-history.voucher-history'
    )
    .findMany({
      status: 'published',
      filters: {
        IsSuccess: {
          $eq: true,
        },
        User: {
          id: {
            $eq: customerId,
          },
        },
        Voucher: {
          documentId: {
            $eq: voucherDocumentId,
          },
        },
      },
      fields: [
        'Name',
        'IsSuccess',
        'AppliedDate',
      ],
      sort: {
        AppliedDate: 'desc',
      },
      limit: 1,
    } as any);

  return Array.isArray(histories)
    ? histories[0] || null
    : null;
}

function sanitizeAdminCustomer(
  user: any,
  customerVouchers: any[],
  historyMap: Map<string, any[]>
) {
  const avatarUrl =
    user?.Avatar?.formats?.thumbnail?.url ||
    user?.Avatar?.formats?.small?.url ||
    user?.Avatar?.url ||
    null;

  return {
    id: user.id,
    documentId: user.documentId,

    username: user.username,
    email: user.email,
    PhoneNumber: user.PhoneNumber,

    FirstName: user.FirstName,
    LastName: user.LastName,
    DateOfBirth: user.DateOfBirth || null,

    IsFirstRegister: Boolean(user.IsFirstRegister),
    ExpiredFirstRegisterVoucher:
      user.ExpiredFirstRegisterVoucher || null,
    IsUseFirstRegisterVoucher: Boolean(
      user.IsUseFirstRegisterVoucher
    ),

    confirmed: user.confirmed,
    blocked: user.blocked,
    createdAt: user.createdAt,

    Avatar: avatarUrl
      ? {
          url: avatarUrl,
        }
      : null,

    Branch: user.Branch
      ? {
          id: user.Branch.id,
          documentId: user.Branch.documentId,
          Name: user.Branch.Name,
          Area: user.Branch.Area,
        }
      : null,

    Vouchers: buildCustomerVouchers(
      user,
      customerVouchers,
      historyMap
    ),
  };
}

function logServiceError({
  event,
  error,
  requestId,
  userId,
  data,
}: {
  event: string;
  error: any;
  requestId?: string;
  userId?: number | string;
  data?: Record<string, unknown>;
}) {
  systemError({
    scope: 'admin',
    event,
    requestId,
    userId,
    data: {
      ...(data ?? {}),
      errorName: error?.name,
      errorMessage: error?.message || String(error),
      errorStack: error?.stack,
    },
  });
}

async function getCurrentBranchAdminByAuthUserId(
  authUserId: number
): Promise<BranchAdminContext> {
  if (!authUserId) {
    unauthorized('Bạn cần đăng nhập.');
  }

  const currentUser = (await strapi.db
    .query('plugin::users-permissions.user')
    .findOne({
      where: {
        id: authUserId,
      },
      populate: {
        Branch: true,
        role: true,
      },
    } as any)) as AdminUser;

  if (!currentUser) {
    unauthorized('Không tìm thấy tài khoản.');
  }

  if (currentUser?.role?.type !== 'admin_branch') {
    forbidden('Bạn không có quyền.');
  }

  const branchId = getBranchId(currentUser);

  if (!branchId) {
    badRequest('Admin chưa có chi nhánh.');
  }

  return {
    authUser: {
      id: authUserId,
    },
    currentUser,
    branchId,
  };
}

export default {
  async getAdminCustomers(input: {
    authUserId: number;
    requestId?: string;
  }) {
    const { authUserId, requestId } = input;

    try {
      const { branchId } =
        await getCurrentBranchAdminByAuthUserId(authUserId);

      if (!branchId) {
        badRequest('Admin chưa có chi nhánh.');
      }

      const customers = await strapi.entityService.findMany(
        'plugin::users-permissions.user',
        {
          filters: {
            Branch: {
              id: {
                $eq: branchId,
              },
            },
          },
          populate: {
            Avatar: true,
            Branch: true,
          },
          sort: {
            createdAt: 'desc',
          },
        } as any
      );

      const customerList = Array.isArray(customers)
        ? customers
        : [];
      const customerIds = customerList
        .map(customer => getNumberId(customer?.id))
        .filter(Boolean) as number[];

      if (customerIds.length === 0) {
        return {
          data: [],
        };
      }

      const vouchers = await getRelevantVouchers(
        customerIds,
        branchId
      );
      const voucherDocumentIds = vouchers
        .map(voucher =>
          String(
            voucher?.documentId || ''
          ).trim()
        )
        .filter(Boolean);

      const histories =
        await getSuccessfulVoucherHistories(
          customerIds,
          voucherDocumentIds
        );
      const historyMap =
        buildVoucherHistoryMap(histories);
      const customerVoucherMap =
        buildCustomerVoucherMap(
          customerList,
          vouchers,
          branchId
        );

      return {
        data: customerList.map(customer =>
          sanitizeAdminCustomer(
            customer,
            getCustomerVouchers(
              customer,
              customerVoucherMap
            ),
            historyMap
          )
        ),
      };
    } catch (error: any) {
      logServiceError({
        event: 'GET_ADMIN_CUSTOMERS_FAILED',
        error,
        requestId,
        userId: authUserId,
      });

      throw error;
    }
  },

  async useAdminCustomerVoucher(
    input: UseCustomerVoucherInput
  ) {
    const {
      authUserId,
      customerId,
      voucherType,
      voucherId,
      requestId,
    } = input;

    try {
      const { branchId } =
        await getCurrentBranchAdminByAuthUserId(authUserId);

      if (!branchId) {
        badRequest('Admin chưa có chi nhánh.');
      }

      const customerNumberId = getNumberId(customerId);

      if (!customerNumberId) {
        badRequest('Khách hàng không hợp lệ.');
      }

      const customer = await getBranchCustomer(
        customerNumberId,
        branchId
      );

      if (voucherType === 'FIRST_REGISTER') {
        if (customer.IsFirstRegister !== true) {
          badRequest(
            'Khách hàng không có voucher đăng ký lần đầu.'
          );
        }

        if (customer.IsUseFirstRegisterVoucher === true) {
          badRequest(
            'Voucher đăng ký lần đầu đã được sử dụng.'
          );
        }

        if (
          isExpiredDate(
            customer.ExpiredFirstRegisterVoucher
          )
        ) {
          badRequest(
            'Voucher đăng ký lần đầu đã hết hạn.'
          );
        }

        const usedAt = new Date().toISOString();

        await strapi.entityService.update(
          'plugin::users-permissions.user',
          customerNumberId,
          {
            data: {
              IsUseFirstRegisterVoucher: true,
            },
          } as any
        );

        return {
          success: true,
          message:
            'Đã xác nhận sử dụng voucher đăng ký lần đầu.',
          data: {
            customerId: customerNumberId,
            voucherId: `first-register-${customerNumberId}`,
            voucherType: 'FIRST_REGISTER',
            IsUsed: true,
            UsedAt: usedAt,
          },
        };
      }

      if (voucherType !== 'STANDARD') {
        badRequest('Loại voucher không hợp lệ.');
      }

      const voucherNumberId = getNumberId(voucherId);

      if (!voucherNumberId) {
        badRequest('Voucher không hợp lệ.');
      }

      const voucher = await getStandardVoucher(
        voucherNumberId
      );

      const publishedVoucherId = getNumberId(
        voucher.id
      );

      if (!publishedVoucherId) {
        badRequest('Voucher không hợp lệ.');
      }

      const voucherDocumentId = String(
        voucher.documentId || ''
      ).trim();

      if (!voucherDocumentId) {
        badRequest('Voucher không có documentId.');
      }

      validateStandardVoucherForCustomer(
        voucher,
        customer
      );

      const existingHistory =
        await findSuccessfulVoucherHistory(
          customerNumberId,
          voucherDocumentId
        );

      if (existingHistory) {
        badRequest('Voucher đã được khách hàng sử dụng.');
      }

      const appliedDate = new Date().toISOString();
      const customerDocumentId = String(
        customer.documentId || ''
      ).trim();

      if (!customerDocumentId) {
        badRequest('Khách hàng không có documentId.');
      }

      const history = await strapi
        .documents(
          'api::voucher-history.voucher-history'
        )
        .create({
          status: 'published',
          data: {
            Name: `Sử dụng ${voucher.Name || 'voucher'}`,
            Voucher: {
              connect: [
                {
                  documentId: voucherDocumentId,
                },
              ],
            },
            User: {
              connect: [
                {
                  documentId: customerDocumentId,
                },
              ],
            },
            IsSuccess: true,
            AppliedDate: appliedDate,
          },
        } as any);

      return {
        success: true,
        message: 'Đã xác nhận sử dụng voucher.',
        data: {
          customerId: customerNumberId,
          voucherId: publishedVoucherId,
          voucherType: 'STANDARD',
          IsUsed: true,
          UsedAt: appliedDate,
          history: sanitizeVoucherHistory(history),
        },
      };
    } catch (error: any) {
      logServiceError({
        event: 'USE_ADMIN_CUSTOMER_VOUCHER_FAILED',
        error,
        requestId,
        userId: authUserId,
        data: {
          customerId,
          voucherType,
          voucherId,
        },
      });

      throw error;
    }
  },

  async getAdminMessages(_input?: unknown) {
    return {
      success: false,
      message: 'Coming soon.',
      data: [],
    };
  },

  async createAdminMessage(_input?: unknown) {
    return {
      success: false,
      message: 'Coming soon.',
      data: null,
    };
  },

  async updateAdminMessage(_input?: unknown) {
    return {
      success: false,
      message: 'Coming soon.',
      data: null,
    };
  },
};
