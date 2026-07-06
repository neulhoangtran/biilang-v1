import { sanitizeMobileUser } from './sanitize-user';
import { systemError } from '../../../utils/system-logger';

type ServiceInputBase = {
  authUserId: number;
  requestId?: string;
};

type SelectBranchInput = ServiceInputBase & {
  branchId?: number | string;
  branchDocumentId?: string;
};

type UpdateProfileInput = ServiceInputBase & {
  FirstName?: string;
  LastName?: string;
  email?: string;
  DateOfBirth?: string | null;
  Sex?: string | null;
  Avatar?: number | string | null;
};

type UploadAvatarInput = ServiceInputBase & {
  files: any;
};

type ChangePasswordInput = ServiceInputBase & {
  currentPassword: string;
  newPassword: string;
};

class ProfileServiceError extends Error {
  status: number;

  constructor(message: string, status = 400) {
    super(message);
    this.name = 'ProfileServiceError';
    this.status = status;
  }
}

function badRequest(message: string): never {
  throw new ProfileServiceError(message, 400);
}

function unauthorized(message: string): never {
  throw new ProfileServiceError(message, 401);
}

function internalError(message: string): never {
  throw new ProfileServiceError(message, 500);
}

function normalizePhone(value: unknown) {
  let phone = String(value || '').replace(/[^\d]/g, '');

  if (phone.startsWith('82')) {
    phone = `0${phone.slice(2)}`;
  }

  return phone;
}

function getUserPhone(user: any) {
  return normalizePhone(
    user?.PhoneNumber ||
      user?.phoneNumber ||
      user?.phone_number ||
      user?.username ||
      ''
  );
}

function buildUserCustomName({
  phoneNumber,
  lastName,
  firstName,
}: {
  phoneNumber: string;
  lastName?: string;
  firstName?: string;
}) {
  const cleanPhone = normalizePhone(phoneNumber);

  const fullName = [lastName, firstName]
    .map(item => String(item || '').trim())
    .filter(Boolean)
    .join(' ')
    .trim();

  if (cleanPhone && fullName) {
    return `${cleanPhone} - ${fullName}`;
  }

  return cleanPhone || fullName || '';
}

function getUserCustomName(user: any) {
  const customName = String(user?.CustomName || '').trim();

  if (customName) {
    return customName;
  }

  return buildUserCustomName({
    phoneNumber: getUserPhone(user),
    lastName: user?.LastName || user?.lastName,
    firstName: user?.FirstName || user?.firstName,
  });
}

function sanitizeBasicUser(user: any) {
  const userPhone = getUserPhone(user);

  return {
    id: user?.id,
    documentId: user?.documentId,
    username: user?.username,
    email: user?.email,

    PhoneNumber: userPhone,
    FirstName: user?.FirstName ?? null,
    LastName: user?.LastName ?? null,
    CustomName: getUserCustomName(user),

    confirmed: user?.confirmed,
    blocked: user?.blocked,

    MarkDelete: user?.MarkDelete ?? false,
    MarkDeleteDate: user?.MarkDeleteDate ?? null,

    IsFirstRegister: user?.IsFirstRegister ?? false,
    ExpiredFirstRegisterVoucher:
      user?.ExpiredFirstRegisterVoucher ?? null,

    Branch:
      user?.Branch ||
      user?.branch ||
      user?.selected_branch ||
      user?.selectedBranch ||
      null,
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
    scope: 'auth',
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

  try {
    (error as any).logged = true;
  } catch {
    // ignore
  }
}

async function getUserProfile(authUserId: number) {
  return strapi.entityService.findOne(
    'plugin::users-permissions.user',
    authUserId,
    {
      populate: {
        Branch: true,
        Avatar: true,
        role: true,
      },
    }
  );
}

export default {
  async getProfile(input: ServiceInputBase) {
    const { authUserId, requestId } = input;

    try {
      if (!authUserId) {
        unauthorized('Bạn cần đăng nhập.');
      }

      const user = await getUserProfile(authUserId);

      if (!user) {
        badRequest('Không tìm thấy tài khoản.');
      }

      const wishlist = await strapi.entityService.findMany(
        'api::wishlist.wishlist',
        {
          filters: {
            UserId: String(authUserId),
          },
          publicationState: 'live',
          limit: 1000,
        } as any
      );

      const wishlistProductIds = Array.isArray(wishlist)
        ? wishlist.map((item: any) => item.ProductId).filter(Boolean)
        : [];

      return {
        user_info: sanitizeMobileUser({
          ...user,
          CustomName: getUserCustomName(user),
          wishlist_product_ids: wishlistProductIds,
        }),
      };
    } catch (error: any) {
      logServiceError({
        event: 'PROFILE_GET_FAILED',
        error,
        requestId,
        userId: authUserId,
      });

      throw error;
    }
  },

  async selectBranch(input: SelectBranchInput) {
    const {
      authUserId,
      requestId,
      branchId,
      branchDocumentId,
    } = input;

    try {
      if (!authUserId) {
        unauthorized('Vui lòng đăng nhập');
      }

      if (!branchId && !branchDocumentId) {
        badRequest('Thiếu thông tin chi nhánh');
      }

      let branch: any = null;

      if (branchId) {
        branch = await strapi.entityService.findOne(
          'api::branch.branch',
          Number(branchId),
          {
            populate: {
              MapImage: true,
            },
          } as any
        );
      }

      if (!branch && branchDocumentId) {
        const branches = await strapi.entityService.findMany(
          'api::branch.branch',
          {
            filters: {
              documentId: branchDocumentId,
            },
            populate: {
              MapImage: true,
            },
            limit: 1,
          } as any
        );

        branch = Array.isArray(branches) ? branches[0] : null;
      }

      if (!branch) {
        badRequest('Không tìm thấy chi nhánh');
      }

      const updatedUser = await strapi.entityService.update(
        'plugin::users-permissions.user',
        authUserId,
        {
          data: {
            Branch: branch.id,
          } as any,
          populate: {
            Branch: {
              populate: {
                MapImage: true,
              },
            },
            Avatar: true,
            role: true,
          },
        } as any
      );

      return {
        user: sanitizeBasicUser(updatedUser),
        user_info: sanitizeMobileUser({
          ...updatedUser,
          CustomName: getUserCustomName(updatedUser),
        }),
        branch,
        nextStep: 'HOME',
        message: 'Đã chọn chi nhánh thành công.',
      };
    } catch (error: any) {
      logServiceError({
        event: 'PROFILE_SELECT_BRANCH_FAILED',
        error,
        requestId,
        userId: authUserId,
        data: {
          branchId,
          branchDocumentId,
        },
      });

      throw error;
    }
  },

  async updateProfile(input: UpdateProfileInput) {
    const {
      authUserId,
      requestId,
      FirstName,
      LastName,
      email,
      DateOfBirth,
      Sex,
      Avatar,
    } = input;

    try {
      if (!authUserId) {
        unauthorized('Bạn cần đăng nhập.');
      }

      const currentUser = await getUserProfile(authUserId);

      if (!currentUser) {
        badRequest('Không tìm thấy tài khoản.');
      }

      const data: Record<string, any> = {};

      if (typeof FirstName === 'string') {
        data.FirstName = FirstName.trim();
      }

      if (typeof LastName === 'string') {
        data.LastName = LastName.trim();
      }

      if (typeof email === 'string') {
        data.email = email.trim().toLowerCase();
      }

      if (DateOfBirth === null || typeof DateOfBirth === 'string') {
        data.DateOfBirth = DateOfBirth || null;
      }

      if (Sex === null || typeof Sex === 'string') {
        data.Sex = Sex || null;
      }

      if (Avatar !== undefined && Avatar !== null && Avatar !== '') {
        data.Avatar = Avatar;
      }

      const nextFirstName =
        typeof FirstName === 'string'
          ? FirstName.trim()
          : String((currentUser as any)?.FirstName || '').trim();

      const nextLastName =
        typeof LastName === 'string'
          ? LastName.trim()
          : String((currentUser as any)?.LastName || '').trim();

      const nextPhoneNumber = getUserPhone(currentUser);

      data.CustomName = buildUserCustomName({
        phoneNumber: nextPhoneNumber,
        lastName: nextLastName,
        firstName: nextFirstName,
      });

      const updatedUser = await strapi.entityService.update(
        'plugin::users-permissions.user',
        authUserId,
        {
          data,
          populate: {
            Branch: true,
            Avatar: true,
            role: true,
          },
        } as any
      );

      return {
        user_info: sanitizeMobileUser({
          ...updatedUser,
          CustomName: getUserCustomName(updatedUser),
        }),
      };
    } catch (error: any) {
      logServiceError({
        event: 'PROFILE_UPDATE_FAILED',
        error,
        requestId,
        userId: authUserId,
      });

      throw error;
    }
  },

  async uploadAvatar(input: UploadAvatarInput) {
    const { authUserId, requestId, files } = input;

    try {
      if (!authUserId) {
        unauthorized('Bạn cần đăng nhập.');
      }

      if (!files) {
        badRequest('Vui lòng chọn ảnh avatar.');
      }

      const uploadService = strapi.plugin('upload').service('upload');

      const uploadedFiles = await uploadService.upload({
        data: {
          ref: 'plugin::users-permissions.user',
          refId: authUserId,
          field: 'Avatar',
        },
        files,
      });

      const uploadedFile = Array.isArray(uploadedFiles)
        ? uploadedFiles[0]
        : uploadedFiles;

      if (!uploadedFile?.id) {
        badRequest('Upload avatar thất bại.');
      }

      const updatedUser = await strapi.entityService.update(
        'plugin::users-permissions.user',
        authUserId,
        {
          data: {
            Avatar: uploadedFile.id,
          },
          populate: {
            Branch: true,
            Avatar: true,
            role: true,
          },
        } as any
      );

      return {
        file: {
          id: uploadedFile.id,
          url: uploadedFile.url,
          mime: uploadedFile.mime,
          name: uploadedFile.name,
        },
        user_info: sanitizeMobileUser({
          ...updatedUser,
          CustomName: getUserCustomName(updatedUser),
        }),
      };
    } catch (error: any) {
      logServiceError({
        event: 'PROFILE_UPLOAD_AVATAR_FAILED',
        error,
        requestId,
        userId: authUserId,
      });

      throw error;
    }
  },

  async changePassword(input: ChangePasswordInput) {
    const {
      authUserId,
      requestId,
      currentPassword,
      newPassword,
    } = input;

    try {
      if (!authUserId) {
        unauthorized('Bạn cần đăng nhập.');
      }

      if (!currentPassword || !newPassword) {
        badRequest('Vui lòng nhập đầy đủ mật khẩu.');
      }

      if (String(newPassword).length < 6) {
        badRequest('Mật khẩu mới phải có ít nhất 6 ký tự.');
      }

      const user = await strapi.entityService.findOne(
        'plugin::users-permissions.user',
        authUserId,
        {
          fields: ['id', 'password'],
        } as any
      );

      if (!user?.password) {
        badRequest('Không tìm thấy thông tin mật khẩu.');
      }

      const userService = strapi.plugin('users-permissions').service('user');

      const isValidPassword =
        typeof userService.validatePassword === 'function'
          ? await userService.validatePassword(currentPassword, user.password)
          : false;

      if (!isValidPassword) {
        badRequest('Mật khẩu hiện tại không đúng.');
      }

      const hashedPassword =
        typeof userService.hashPassword === 'function'
          ? await userService.hashPassword({
              password: newPassword,
            })
          : undefined;

      if (!hashedPassword) {
        internalError('Không hash được mật khẩu mới.');
      }

      await strapi.entityService.update(
        'plugin::users-permissions.user',
        authUserId,
        {
          data: {
            password: hashedPassword,
          },
        } as any
      );

      return {
        success: true,
        message: 'Đổi mật khẩu thành công.',
      };
    } catch (error: any) {
      logServiceError({
        event: 'PROFILE_CHANGE_PASSWORD_FAILED',
        error,
        requestId,
        userId: authUserId,
      });

      throw error;
    }
  },
};