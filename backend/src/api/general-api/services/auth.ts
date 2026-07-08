// import sendAligoSms from './aligo-sms';
import {
  systemError,
  systemInfo,
} from '../../../utils/system-logger';
import {
  getRenderedConfigurationValue,
} from '../../../utils/configuration.helper';

const OTP_EXPIRE_MINUTES = 5;
const DELETE_ACCOUNT_DELAY_HOURS = 24;

const SMS_SUPPORT_ERROR =
  'Đã xảy ra lỗi, vui lòng liên hệ admin để được hỗ trợ.';

const EMAIL_SUPPORT_ERROR =
  'Đã xảy ra lỗi, vui lòng liên hệ admin để được hỗ trợ.';

const DEFAULT_EMAIL_FROM =
  process.env.SMTP_DEFAULT_FROM ||
  process.env.EMAIL_DEFAULT_FROM ||
  'no-reply@billang.site';

const FIRST_REGISTER_VOUCHER_MONTHS = 1;

const FIRST_REGISTER_VOUCHER_SMS =
  'Chao mung ban den voi VIKOF Mobile! Ban duoc giam gia 30.000 KRW tren toan san pham va ap dung tren toan he thong Vikof Mobile.';

const RETURNING_REGISTER_VOUCHER_SMS =
  'Chao mung ban quay tro lai VIKOF Mobile! Ban duoc giam gia 10.000 KRW tren toan san pham va ap dung tren toan he thong Vikof Mobile.';

type OtpPurpose =
  | 'register'
  | 'verify_phone'
  | 'login'
  | 'reset_password';

class AuthServiceError extends Error {
  status: number;

  constructor(message: string, status = 400) {
    super(message);
    this.name = 'AuthServiceError';
    this.status = status;
  }
}

function badRequest(message: string) {
  throw new AuthServiceError(message, 400);
}

const generateOtpCode = () => {
  return Math.floor(100000 + Math.random() * 900000).toString();
};

const addMinutes = (date: Date, minutes: number) => {
  return new Date(date.getTime() + minutes * 60 * 1000);
};

const addHours = (date: Date, hours: number) => {
  return new Date(date.getTime() + hours * 60 * 60 * 1000);
};

const addMonths = (date: Date, months: number) => {
  const result = new Date(date);
  result.setMonth(result.getMonth() + months);
  return result;
};

const isDeleteDateReached = (value: unknown) => {
  const date = new Date(String(value || ''));

  if (Number.isNaN(date.getTime())) {
    return false;
  }

  return date.getTime() <= Date.now();
};

const normalizePhone = (value: unknown) => {
  let phone = String(value || '').replace(/[^\d]/g, '');

  if (phone.startsWith('82')) {
    phone = `0${phone.slice(2)}`;
  }

  return phone;
};

const normalizeEmail = (value: unknown) => {
  return String(value || '').trim().toLowerCase();
};

const normalizeDateOfBirth = (value: unknown) => {
  const raw = String(value || '').trim();

  const match = raw.match(
    /^(\d{4})-(\d{2})-(\d{2})$/
  );

  if (!match) {
    throw new AuthServiceError(
      'Ngày sinh không hợp lệ. Vui lòng nhập theo định dạng YYYY-MM-DD.',
      400
    );
  }

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);

  const date = new Date(
    Date.UTC(year, month - 1, day)
  );

  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) {
    throw new AuthServiceError('Ngày sinh không hợp lệ.', 400);
  }

  const now = new Date();
  const todayUtc = Date.UTC(
    now.getUTCFullYear(),
    now.getUTCMonth(),
    now.getUTCDate()
  );

  if (date.getTime() > todayUtc) {
    throw new AuthServiceError(
      'Ngày sinh không được lớn hơn ngày hiện tại.',
      400
    );
  }

  return raw;
};

const normalizeIdentifier = (value: unknown) => {
  const raw = String(value || '').trim();

  if (raw.includes('@')) {
    return normalizeEmail(raw);
  }

  return normalizePhone(raw) || raw;
};

const getUserPhone = (user: any) => {
  return normalizePhone(
    user?.PhoneNumber ||
      user?.phoneNumber ||
      user?.phone_number ||
      user?.username ||
      ''
  );
};

const getUserEmail = (user: any) => {
  return normalizeEmail(user?.email || user?.Email || '');
};

const buildUserCustomName = ({
  phoneNumber,
  lastName,
  firstName,
}: {
  phoneNumber: string;
  lastName?: string;
  firstName?: string;
}) => {
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
};

const getUserCustomName = (user: any) => {
  const customName = String(user?.CustomName || '').trim();

  if (customName) {
    return customName;
  }

  return buildUserCustomName({
    phoneNumber: getUserPhone(user),
    lastName: user?.LastName || user?.lastName,
    firstName: user?.FirstName || user?.firstName,
  });
};

const getUserDisplayName = (user: any) => {
  const fullName = [
    user?.LastName || user?.lastName,
    user?.FirstName || user?.firstName,
  ]
    .map(item => String(item || '').trim())
    .filter(Boolean)
    .join(' ')
    .trim();

  return (
    fullName ||
    String(user?.username || '').trim() ||
    getUserPhone(user) ||
    'ban'
  );
};

const hasBranch = (user: any) => {
  return Boolean(
    user?.Branch?.id ||
      user?.branch?.id ||
      user?.selected_branch?.id ||
      user?.selectedBranch?.id ||
      user?.Branch ||
      user?.branch ||
      user?.selected_branch ||
      user?.selectedBranch
  );
};

const getNextStep = (user: any) => {
  if (!user?.confirmed) return 'VERIFY_PHONE';
  if (!hasBranch(user)) return 'SELECT_BRANCH';

  return 'HOME';
};

const issueJwt = (userId: number) => {
  return strapi.plugin('users-permissions').service('jwt').issue({
    id: userId,
  });
};

const getDefaultRole = async () => {
  const pluginStore = await strapi.store({
    type: 'plugin',
    name: 'users-permissions',
  });

  const settings = (await pluginStore.get({
    key: 'advanced',
  })) as {
    default_role?: string;
  };

  const defaultRoleType = settings.default_role || 'authenticated';

  return strapi.query('plugin::users-permissions.role').findOne({
    where: {
      type: defaultRoleType,
    },
  });
};

const getUserById = async (userId: number) => {
  return strapi.entityService.findOne(
    'plugin::users-permissions.user',
    userId,
    {
      populate: {
        Branch: true,
        Avatar: true,
        role: true,
      },
    } as any
  );
};

const getUserForPasswordCheck = async (identifier: string) => {
  const cleanIdentifier = normalizeIdentifier(identifier);

  return strapi.db.query('plugin::users-permissions.user').findOne({
    where: {
      $or: [
        { email: cleanIdentifier },
        { username: cleanIdentifier },
        { PhoneNumber: cleanIdentifier },
      ],
    },
    populate: {
      Branch: true,
      Avatar: true,
      role: true,
    },
  } as any);
};

const findUserByPhone = async (phoneNumber: string) => {
  const cleanPhone = normalizePhone(phoneNumber);

  return strapi.db.query('plugin::users-permissions.user').findOne({
    where: {
      $or: [{ username: cleanPhone }, { PhoneNumber: cleanPhone }],
    },
    populate: {
      Branch: true,
      Avatar: true,
      role: true,
    },
  } as any);
};

const findUserByPhoneOrEmail = async ({
  phoneNumber,
  email,
}: {
  phoneNumber: string;
  email: string;
}) => {
  const cleanPhone = normalizePhone(phoneNumber);
  const cleanEmail = normalizeEmail(email);

  return strapi.db.query('plugin::users-permissions.user').findOne({
    where: {
      $or: [
        { email: cleanEmail },
        { username: cleanPhone },
        { PhoneNumber: cleanPhone },
      ],
    },
    populate: {
      Branch: true,
      Avatar: true,
      role: true,
    },
  } as any);
};

const sanitizeAuthUser = (user: any) => {
  const userPhone = getUserPhone(user);

  return {
    id: user?.id,
    username: user?.username,
    email: user?.email,

    PhoneNumber: userPhone,
    FirstName: user?.FirstName ?? null,
    LastName: user?.LastName ?? null,
    DateOfBirth: user?.DateOfBirth ?? null,
    CustomName: getUserCustomName(user),

    IsFirstRegister: user?.IsFirstRegister ?? false,
    ExpiredFirstRegisterVoucher:
      user?.ExpiredFirstRegisterVoucher ?? null,

    MarkDelete: user?.MarkDelete ?? false,
    MarkDeleteDate: user?.MarkDeleteDate ?? null,

    confirmed: user?.confirmed,
    blocked: user?.blocked,

    role: user?.role
      ? {
          id: user.role.id,
          type: user.role.type,
          name: user.role.name,
        }
      : null,

    Branch:
      user?.Branch ||
      user?.branch ||
      user?.selected_branch ||
      user?.selectedBranch ||
      null,
  };
};

const expireOldOtps = async (
  userId: number,
  phoneNumber: string,
  purpose: OtpPurpose
) => {
  const oldOtps = await strapi.entityService.findMany(
    'api::general-api.user-otp' as any,
    {
      filters: {
        user: {
          id: userId,
        },
        phoneNumber,
        purpose,
        used: false,
      },
      limit: 100,
    } as any
  );

  if (!Array.isArray(oldOtps) || oldOtps.length === 0) {
    return;
  }

  await Promise.all(
    oldOtps.map((item: any) =>
      strapi.entityService.update('api::general-api.user-otp' as any, item.id, {
        data: {
          used: true,
          expiresAt: new Date().toISOString(),
        } as any,
      })
    )
  );
};

function getOtpEmailSubject(purpose: OtpPurpose) {
  if (purpose === 'login') {
    return '[Billang] Mã OTP đăng nhập';
  }

  if (purpose === 'reset_password') {
    return '[Billang] Mã OTP đặt lại mật khẩu';
  }

  return '[Billang] Mã OTP xác thực tài khoản';
}

function getOtpEmailTitle(purpose: OtpPurpose) {
  if (purpose === 'login') {
    return 'Mã OTP đăng nhập';
  }

  if (purpose === 'reset_password') {
    return 'Mã OTP đặt lại mật khẩu';
  }

  return 'Mã OTP xác thực tài khoản';
}

function getOtpEmailTemplate({
  otpCode,
  purpose,
}: {
  otpCode: string;
  purpose: OtpPurpose;
}) {
  const subject = getOtpEmailSubject(purpose);
  const title = getOtpEmailTitle(purpose);

  const text = `${title}: ${otpCode}. Mã này có hiệu lực trong ${OTP_EXPIRE_MINUTES} phút.`;

  const html = `
    <div style="margin:0;padding:0;background:#f5f7fb;font-family:Arial,Helvetica,sans-serif;color:#222;">
      <div style="max-width:560px;margin:0 auto;padding:32px 16px;">
        <div style="background:#ffffff;border-radius:14px;padding:28px;border:1px solid #e5e7eb;">
          <h2 style="margin:0 0 16px;font-size:22px;color:#111827;">
            ${title}
          </h2>

          <p style="margin:0 0 14px;font-size:15px;line-height:1.6;color:#374151;">
            Xin chào,
          </p>

          <p style="margin:0 0 16px;font-size:15px;line-height:1.6;color:#374151;">
            Bạn đang thực hiện yêu cầu xác thực trên hệ thống Billang.
            Vui lòng sử dụng mã OTP bên dưới:
          </p>

          <div style="margin:24px 0;padding:18px;background:#f3f4f6;border-radius:12px;text-align:center;">
            <div style="font-size:34px;font-weight:700;letter-spacing:8px;color:#111827;">
              ${otpCode}
            </div>
          </div>

          <p style="margin:0 0 14px;font-size:15px;line-height:1.6;color:#374151;">
            Mã OTP này có hiệu lực trong
            <strong>${OTP_EXPIRE_MINUTES} phút</strong>.
          </p>

          <p style="margin:0;font-size:14px;line-height:1.6;color:#6b7280;">
            Nếu bạn không thực hiện yêu cầu này, vui lòng bỏ qua email.
          </p>
        </div>

        <p style="margin:18px 0 0;text-align:center;font-size:12px;color:#9ca3af;">
          © Billang
        </p>
      </div>
    </div>
  `;

  return {
    subject,
    text,
    html,
  };
}

async function sendOtpEmail({
  to,
  otpCode,
  purpose,
}: {
  to: string;
  otpCode: string;
  purpose: OtpPurpose;
}) {
  const template = getOtpEmailTemplate({
    otpCode,
    purpose,
  });

  await strapi.plugin('email').service('email').send({
    to,
    from: DEFAULT_EMAIL_FROM,
    subject: template.subject,
    text: template.text,
    html: template.html,
  });
}

const createOtp = async ({
  userId,
  phoneNumber,
  email,
  purpose,
  failWhenSmsError = false,
}: {
  userId: number;
  phoneNumber: string;
  email?: string;
  purpose: OtpPurpose;
  failWhenSmsError?: boolean;
}) => {
  const otpCode = generateOtpCode();
  const expiresAt = addMinutes(new Date(), OTP_EXPIRE_MINUTES);

  await strapi.entityService.create('api::general-api.user-otp' as any, {
    data: {
      user: userId,
      phoneNumber,
      code: otpCode,
      purpose,
      expiresAt: expiresAt.toISOString(),
      used: false,
      attempt: 0,
    } as any,
  });

  const otpEmail = normalizeEmail(email || '');

  if (!otpEmail) {
    systemError({
      scope: 'auth',
      event: 'OTP_EMAIL_MISSING',
      userId,
      data: {
        phoneNumber,
        purpose,
      },
    });

    throw new AuthServiceError('Không tìm thấy email để gửi OTP.', 400);
  }

  let smsSent = false;
  let smsErrorMessage = '';

  try {
    await sendOtpEmail({
      to: otpEmail,
      otpCode,
      purpose,
    });

    smsSent = true;

    systemInfo({
      scope: 'auth',
      event: 'OTP_EMAIL_SENT',
      userId,
      data: {
        phoneNumber,
        email: otpEmail,
        purpose,
        expiresAt: expiresAt.toISOString(),
      },
    });
  } catch (error: any) {
    smsSent = false;
    smsErrorMessage = error?.message || 'Email send failed';

    systemError({
      scope: 'auth',
      event: 'OTP_EMAIL_SEND_FAILED',
      userId,
      data: {
        phoneNumber,
        email: otpEmail,
        purpose,
        errorName: error?.name,
        errorMessage: smsErrorMessage,
        errorStack: error?.stack,
      },
    });

    if (failWhenSmsError) {
      throw new AuthServiceError(EMAIL_SUPPORT_ERROR, 400);
    }
  }

  return {
    otpCode,
    expiresAt,
    smsSent,
    smsErrorMessage,
  };

  /**
   * Old Aligo SMS logic - disabled.
   *
   * const smsMessage =
   *   purpose === 'login'
   *     ? `[Vikof Mobile] Login OTP: ${otpCode}. Valid ${OTP_EXPIRE_MINUTES} minutes.`
   *     : purpose === 'reset_password'
   *       ? `[Vikof Mobile] Password reset OTP: ${otpCode}. Valid ${OTP_EXPIRE_MINUTES} minutes.`
   *       : `[Vikof Mobile] OTP: ${otpCode}. Valid ${OTP_EXPIRE_MINUTES} minutes.`;
   *
   * await sendAligoSms({
   *   receiver: phoneNumber,
   *   message: smsMessage,
   * });
   */
};

const verifyOtpRecord = async ({
  userId,
  phoneNumber,
  otp,
  purpose,
  purposes,
}: {
  userId: number;
  phoneNumber: string;
  otp: string;
  purpose?: OtpPurpose;
  purposes?: OtpPurpose[];
}) => {
  const cleanOtp = String(otp || '').replace(/[^\d]/g, '');

  if (!/^\d{6}$/.test(cleanOtp)) {
    badRequest('Mã OTP không hợp lệ');
  }

  const allowedPurposes =
    Array.isArray(purposes) && purposes.length > 0
      ? purposes
      : purpose
        ? [purpose]
        : [];

  if (allowedPurposes.length === 0) {
    badRequest('Thiếu loại OTP cần xác thực');
  }

  const otps = await strapi.entityService.findMany(
    'api::general-api.user-otp' as any,
    {
      filters: {
        user: {
          id: userId,
        },
        phoneNumber,
        purpose: {
          $in: allowedPurposes,
        },
        used: false,
      },
      sort: {
        createdAt: 'desc',
      },
      limit: 1,
    } as any
  );

  const otpRecord = Array.isArray(otps) ? otps[0] : null;

  if (!otpRecord) {
    badRequest('Mã OTP không đúng hoặc đã được sử dụng');
  }

  const currentAttempt = Number((otpRecord as any).attempt || 0);

  if (currentAttempt >= 5) {
    await strapi.entityService.update(
      'api::general-api.user-otp' as any,
      (otpRecord as any).id,
      {
        data: {
          used: true,
          expiresAt: new Date().toISOString(),
        } as any,
      }
    );

    badRequest('Bạn đã nhập sai quá số lần cho phép. Vui lòng gửi lại mã mới.');
  }

  const expiresAt = new Date((otpRecord as any).expiresAt);

  if (
    Number.isNaN(expiresAt.getTime()) ||
    expiresAt.getTime() < new Date().getTime()
  ) {
    await strapi.entityService.update(
      'api::general-api.user-otp' as any,
      (otpRecord as any).id,
      {
        data: {
          used: true,
        } as any,
      }
    );

    badRequest('Mã OTP đã hết hạn');
  }

  if ((otpRecord as any).code !== cleanOtp) {
    await strapi.entityService.update(
      'api::general-api.user-otp' as any,
      (otpRecord as any).id,
      {
        data: {
          attempt: currentAttempt + 1,
        } as any,
      }
    );

    badRequest('Mã OTP không đúng');
  }

  await strapi.entityService.update(
    'api::general-api.user-otp' as any,
    (otpRecord as any).id,
    {
      data: {
        used: true,
      } as any,
    }
  );

  return otpRecord;
};

function getVoucherEmailTemplate({
  message,
  isFirstRegister,
}: {
  message: string;
  isFirstRegister: boolean;
}) {
  const subject = isFirstRegister
    ? '[Billang] Voucher đăng ký lần đầu'
    : '[Billang] Voucher chào mừng quay lại';

  const html = `
    <div style="margin:0;padding:0;background:#f5f7fb;font-family:Arial,Helvetica,sans-serif;color:#222;">
      <div style="max-width:560px;margin:0 auto;padding:32px 16px;">
        <div style="background:#ffffff;border-radius:14px;padding:28px;border:1px solid #e5e7eb;">
          <h2 style="margin:0 0 16px;font-size:22px;color:#111827;">
            ${subject}
          </h2>

          <p style="margin:0;font-size:15px;line-height:1.7;color:#374151;">
            ${message}
          </p>
        </div>

        <p style="margin:18px 0 0;text-align:center;font-size:12px;color:#9ca3af;">
          © Billang
        </p>
      </div>
    </div>
  `;

  return {
    subject,
    text: message,
    html,
  };
}

const sendRegisterVoucherSmsSafely = async ({
  user,
  phoneNumber,
}: {
  user: any;
  phoneNumber: string;
}) => {
  const isFirstRegister = Boolean(user?.IsFirstRegister);
  const expiryDate = String(
    user?.ExpiredFirstRegisterVoucher || ''
  ).slice(0, 10);
  const message =
    await getRenderedConfigurationValue({
      key: isFirstRegister
        ? 'RegisterMessage'
        : 'ReRegisterMessage',
      fallback: isFirstRegister
        ? FIRST_REGISTER_VOUCHER_SMS
        : RETURNING_REGISTER_VOUCHER_SMS,
      values: {
        name: getUserDisplayName(user),
        fullName: getUserDisplayName(user),
        firstName: user?.FirstName || user?.firstName || '',
        lastName: user?.LastName || user?.lastName || '',
        phoneNumber,
        voucherCode: '',
        expiryDate,
        voucherAmount: isFirstRegister
          ? '30.000 KRW'
          : '10.000 KRW',
        isFirstRegister,
        user,
      },
    });

  const userEmail = getUserEmail(user);

  if (!userEmail) {
    systemError({
      scope: 'auth',
      event: 'REGISTER_VOUCHER_EMAIL_MISSING',
      userId: user?.id,
      data: {
        phoneNumber,
        isFirstRegister,
        customName: getUserCustomName(user),
      },
    });

    return {
      smsSent: false,
      smsErrorMessage: 'Missing email',
      message,
    };
  }

  try {
    const template = getVoucherEmailTemplate({
      message,
      isFirstRegister,
    });

    await strapi.plugin('email').service('email').send({
      to: userEmail,
      from: DEFAULT_EMAIL_FROM,
      subject: template.subject,
      text: template.text,
      html: template.html,
    });

    systemInfo({
      scope: 'auth',
      event: 'REGISTER_VOUCHER_EMAIL_SENT',
      userId: user?.id,
      data: {
        phoneNumber,
        email: userEmail,
        isFirstRegister,
        customName: getUserCustomName(user),
      },
    });

    return {
      smsSent: true,
      smsErrorMessage: '',
      message,
    };

    /**
     * Old Aligo SMS logic - disabled.
     *
     * await sendAligoSms({
     *   receiver: phoneNumber,
     *   message,
     * });
     */
  } catch (error: any) {
    systemError({
      scope: 'auth',
      event: 'REGISTER_VOUCHER_EMAIL_SEND_FAILED',
      userId: user?.id,
      data: {
        phoneNumber,
        email: userEmail,
        isFirstRegister,
        customName: getUserCustomName(user),
        errorName: error?.name,
        errorMessage: error?.message || String(error),
        errorStack: error?.stack,
      },
    });

    return {
      smsSent: false,
      smsErrorMessage: error?.message || 'Voucher email send failed',
      message,
    };
  }
};

const buildAuthResponse = async ({
  user,
  jwt,
  smsSent,
  smsErrorMessage,
  voucherSms,
  message,
}: {
  user: any;
  jwt: string;
  smsSent?: boolean;
  smsErrorMessage?: string;
  voucherSms?: any;
  message?: string;
}) => {
  const freshUser = await getUserById(Number(user.id));
  const safeUser = sanitizeAuthUser(freshUser || user);
  const nextStep = getNextStep(freshUser || user);

  return {
    jwt,
    user: safeUser,
    nextStep,
    smsSent,
    smsErrorMessage,
    voucherSms,
    message:
      message ||
      (nextStep === 'VERIFY_PHONE'
        ? 'Vui lòng xác thực số điện thoại.'
        : 'Đăng nhập thành công.'),
  };
};

export default {
  async register(payload: {
    phoneNumber: string;
    lastName: string;
    firstName: string;
    email: string;
    password: string;
    dateOfBirth: string;
  }) {
    const {
      phoneNumber,
      lastName,
      firstName,
      email,
      password,
      dateOfBirth,
    } = payload;

    if (
      !phoneNumber ||
      !email ||
      !password ||
      !lastName ||
      !firstName
    ) {
      badRequest('Thiếu thông tin đăng ký');
    }

    if (!dateOfBirth) {
      badRequest('Vui lòng nhập ngày sinh.');
    }

    const cleanPhone = normalizePhone(phoneNumber);
    const cleanEmail = normalizeEmail(email);
    const cleanLastName = String(lastName).trim();
    const cleanFirstName = String(firstName).trim();
    const cleanDateOfBirth =
      normalizeDateOfBirth(dateOfBirth);

    if (!/^\d{10,12}$/.test(cleanPhone)) {
      badRequest('Số điện thoại không hợp lệ');
    }

    if (!cleanLastName || !cleanFirstName) {
      badRequest('Thiếu họ tên');
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
      badRequest('Email không hợp lệ');
    }

    if (String(password).length < 6) {
      badRequest('Mật khẩu phải có ít nhất 6 ký tự');
    }

    const existingUser = await findUserByPhoneOrEmail({
      phoneNumber: cleanPhone,
      email: cleanEmail,
    });

    const now = new Date();
    const expiredFirstRegisterVoucher = addMonths(
      now,
      FIRST_REGISTER_VOUCHER_MONTHS
    );

    const customName = buildUserCustomName({
      phoneNumber: cleanPhone,
      lastName: cleanLastName,
      firstName: cleanFirstName,
    });

    let user: any = null;
    let isReactivatedUser = false;

    if (existingUser) {
      if (!(existingUser as any).blocked) {
        badRequest('Email hoặc số điện thoại đã được sử dụng');
      }

      isReactivatedUser = true;

      user = await strapi.entityService.update(
        'plugin::users-permissions.user',
        Number((existingUser as any).id),
        {
          data: {
            username: cleanPhone,
            email: cleanEmail,
            password,
            confirmed: false,
            blocked: false,
            PhoneNumber: cleanPhone,
            LastName: cleanLastName,
            FirstName: cleanFirstName,
            DateOfBirth: cleanDateOfBirth,
            CustomName: customName,
            Branch: null,
            MarkDelete: false,
            MarkDeleteDate: null,
            IsFirstRegister: false,
            ExpiredFirstRegisterVoucher:
              expiredFirstRegisterVoucher.toISOString(),
          } as any,
          populate: {
            Branch: true,
            Avatar: true,
            role: true,
          },
        } as any
      );
    } else {
      const defaultRole = await getDefaultRole();

      if (!defaultRole) {
        badRequest('Không tìm thấy role mặc định');
      }

      user = await strapi.entityService.create(
        'plugin::users-permissions.user',
        {
          data: {
            username: cleanPhone,
            email: cleanEmail,
            password,
            provider: 'local',
            confirmed: false,
            blocked: false,
            role: defaultRole.id,
            PhoneNumber: cleanPhone,
            LastName: cleanLastName,
            FirstName: cleanFirstName,
            DateOfBirth: cleanDateOfBirth,
            CustomName: customName,
            IsFirstRegister: true,
            ExpiredFirstRegisterVoucher:
              expiredFirstRegisterVoucher.toISOString(),
            MarkDelete: false,
            MarkDeleteDate: null,
          } as any,
          populate: {
            Branch: true,
            Avatar: true,
            role: true,
          },
        }
      );
    }

    const jwt = issueJwt(Number(user.id));

    await expireOldOtps(Number(user.id), cleanPhone, 'register');

    const { smsSent, smsErrorMessage } = await createOtp({
      userId: Number(user.id),
      phoneNumber: cleanPhone,
      email: cleanEmail,
      purpose: 'register',
      failWhenSmsError: false,
    });

    systemInfo({
      scope: 'auth',
      event: isReactivatedUser
        ? 'AUTH_REACTIVATE_USER_REGISTER_DONE'
        : 'AUTH_FIRST_REGISTER_DONE',
      userId: Number(user.id),
      data: {
        userId: Number(user.id),
        phoneNumber: cleanPhone,
        email: cleanEmail,
        dateOfBirth: cleanDateOfBirth,
        customName,
        isReactivatedUser,
        IsFirstRegister: !isReactivatedUser,
        ExpiredFirstRegisterVoucher:
          expiredFirstRegisterVoucher.toISOString(),
      },
    });

    return buildAuthResponse({
      user,
      jwt,
      smsSent,
      smsErrorMessage,
      message: smsSent
        ? 'Đăng ký thành công. Vui lòng kiểm tra email để xác thực tài khoản.'
        : 'Đăng ký thành công nhưng chưa gửi được email OTP. Vui lòng bấm gửi lại mã.',
    });
  },

  async login(payload: { identifier: string; password: string }) {
    const { identifier, password } = payload;

    if (!identifier || !password) {
      badRequest('Thiếu thông tin đăng nhập');
    }

    const user = await getUserForPasswordCheck(identifier);

    if (!user) {
      badRequest('Tài khoản hoặc mật khẩu không đúng');
    }

    if ((user as any).blocked) {
      badRequest('Tài khoản đã bị khóa');
    }

    const validPassword = await strapi
      .plugin('users-permissions')
      .service('user')
      .validatePassword(password, (user as any).password);

    if (!validPassword) {
      badRequest('Tài khoản hoặc mật khẩu không đúng');
    }

    const jwt = issueJwt(Number((user as any).id));

    let smsSent: boolean | undefined;
    let smsErrorMessage: string | undefined;

    if (!(user as any).confirmed) {
      const phone = getUserPhone(user);

      await expireOldOtps(Number((user as any).id), phone, 'verify_phone');

      const result = await createOtp({
        userId: Number((user as any).id),
        phoneNumber: phone,
        email: getUserEmail(user),
        purpose: 'verify_phone',
        failWhenSmsError: false,
      });

      smsSent = result.smsSent;
      smsErrorMessage = result.smsErrorMessage;
    }

    return buildAuthResponse({
      user,
      jwt,
      smsSent,
      smsErrorMessage,
      message: 'Đăng nhập thành công.',
    });
  },

  async sendLoginOtp(payload: { phoneNumber: string }) {
    const { phoneNumber } = payload;

    if (!phoneNumber) {
      badRequest('Vui lòng nhập số điện thoại');
    }

    const cleanPhone = normalizePhone(phoneNumber);

    if (!/^\d{10,12}$/.test(cleanPhone)) {
      badRequest('Số điện thoại không hợp lệ');
    }

    const user = await findUserByPhone(cleanPhone);

    if (!user) {
      badRequest('Không tìm thấy tài khoản với số điện thoại này');
    }

    if ((user as any).blocked) {
      badRequest('Tài khoản đã bị khóa');
    }

    await expireOldOtps(Number((user as any).id), cleanPhone, 'login');

    await createOtp({
      userId: Number((user as any).id),
      phoneNumber: cleanPhone,
      email: getUserEmail(user),
      purpose: 'login',
      failWhenSmsError: true,
    });

    return {
      userId: (user as any).id,
      phoneNumber: cleanPhone,
      otpExpiresIn: OTP_EXPIRE_MINUTES * 60,
      message: 'Đã gửi mã OTP qua email.',
    };
  },

  async verifyLoginOtp(payload: { phoneNumber: string; otp: string }) {
    const { phoneNumber, otp } = payload;

    if (!phoneNumber || !otp) {
      badRequest('Thiếu thông tin xác thực OTP');
    }

    const cleanPhone = normalizePhone(phoneNumber);
    const user = await findUserByPhone(cleanPhone);

    if (!user) {
      badRequest('Không tìm thấy tài khoản');
    }

    if ((user as any).blocked) {
      badRequest('Tài khoản đã bị khóa');
    }

    await verifyOtpRecord({
      userId: Number((user as any).id),
      phoneNumber: cleanPhone,
      otp,
      purpose: 'login',
    });

    let finalUser = user;

    if (!(user as any).confirmed) {
      finalUser = await strapi.entityService.update(
        'plugin::users-permissions.user',
        Number((user as any).id),
        {
          data: {
            confirmed: true,
            blocked: false,
          } as any,
          populate: {
            Branch: true,
            Avatar: true,
            role: true,
          },
        } as any
      );
    }

    const jwt = issueJwt(Number((user as any).id));

    return buildAuthResponse({
      user: finalUser,
      jwt,
      message: 'Đăng nhập thành công.',
    });
  },

  async verifyPhone(payload: {
    userId: number | string;
    phoneNumber: string;
    otp: string;
  }) {
    const { userId, phoneNumber, otp } = payload;

    if (!userId || !phoneNumber || !otp) {
      badRequest('Thiếu thông tin xác thực');
    }

    const cleanUserId = Number(userId);
    const cleanPhone = normalizePhone(phoneNumber);

    if (!Number.isFinite(cleanUserId)) {
      badRequest('UserId không hợp lệ');
    }

    if (!/^\d{10,12}$/.test(cleanPhone)) {
      badRequest('Số điện thoại không hợp lệ');
    }

    const user = await getUserById(cleanUserId);

    if (!user) {
      badRequest('Không tìm thấy tài khoản');
    }

    const userPhone = getUserPhone(user);

    if (userPhone !== cleanPhone) {
      badRequest('Số điện thoại không khớp với tài khoản');
    }

    if ((user as any).blocked) {
      badRequest('Tài khoản đã bị khóa');
    }

    const otpRecord = await verifyOtpRecord({
      userId: cleanUserId,
      phoneNumber: cleanPhone,
      otp,
      purposes: ['register', 'verify_phone'],
    });

    const updatedUser = await strapi.entityService.update(
      'plugin::users-permissions.user',
      cleanUserId,
      {
        data: {
          confirmed: true,
          blocked: false,
        } as any,
        populate: {
          Branch: true,
          Avatar: true,
          role: true,
        },
      } as any
    );

    const jwt = issueJwt(cleanUserId);

    let voucherSms: any = null;

    if ((otpRecord as any)?.purpose === 'register') {
      voucherSms = await sendRegisterVoucherSmsSafely({
        user: updatedUser,
        phoneNumber: cleanPhone,
      });
    }

    return buildAuthResponse({
      user: updatedUser,
      jwt,
      voucherSms,
      message: 'Xác thực tài khoản thành công.',
    });
  },

  async resendPhoneVerifyOtp(payload: {
    userId: number | string;
    phoneNumber: string;
  }) {
    const { userId, phoneNumber } = payload;

    if (!userId || !phoneNumber) {
      badRequest('Thiếu thông tin gửi lại OTP');
    }

    const cleanUserId = Number(userId);
    const cleanPhone = normalizePhone(phoneNumber);

    if (!Number.isFinite(cleanUserId)) {
      badRequest('UserId không hợp lệ');
    }

    const user = await getUserById(cleanUserId);

    if (!user) {
      badRequest('Không tìm thấy tài khoản');
    }

    const userPhone = getUserPhone(user);

    if (userPhone !== cleanPhone) {
      badRequest('Số điện thoại không khớp với tài khoản');
    }

    if ((user as any).blocked) {
      badRequest('Tài khoản đã bị khóa');
    }

    if ((user as any).confirmed) {
      badRequest('Tài khoản đã được xác thực');
    }

    const purpose: OtpPurpose = (user as any).IsFirstRegister === true ||
      (user as any).IsFirstRegister === false
      ? 'register'
      : 'verify_phone';

    await expireOldOtps(cleanUserId, cleanPhone, purpose);

    const result = await createOtp({
      userId: cleanUserId,
      phoneNumber: cleanPhone,
      email: getUserEmail(user),
      purpose,
      failWhenSmsError: true,
    });

    return {
      otpExpiresIn: OTP_EXPIRE_MINUTES * 60,
      smsSent: result.smsSent,
      purpose,
      message: 'Đã gửi lại mã OTP qua email.',
    };
  },

  async sendForgotPasswordOtp(payload: { phoneNumber: string }) {
    const { phoneNumber } = payload;

    if (!phoneNumber) {
      badRequest('Vui lòng nhập số điện thoại');
    }

    const cleanPhone = normalizePhone(phoneNumber);

    if (!/^\d{10,12}$/.test(cleanPhone)) {
      badRequest('Số điện thoại không hợp lệ');
    }

    const user = await findUserByPhone(cleanPhone);

    if (!user) {
      badRequest('Không tìm thấy tài khoản với số điện thoại này');
    }

    if ((user as any).blocked) {
      badRequest('Tài khoản đã bị khóa');
    }

    await expireOldOtps(
      Number((user as any).id),
      cleanPhone,
      'reset_password'
    );

    const result = await createOtp({
      userId: Number((user as any).id),
      phoneNumber: cleanPhone,
      email: getUserEmail(user),
      purpose: 'reset_password',
      failWhenSmsError: true,
    });

    return {
      userId: (user as any).id,
      phoneNumber: cleanPhone,
      otpExpiresIn: OTP_EXPIRE_MINUTES * 60,
      smsSent: result.smsSent,
      message: 'Đã gửi mã OTP đặt lại mật khẩu qua email.',
    };
  },

  async resetPasswordWithOtp(payload: {
    phoneNumber: string;
    otp: string;
    newPassword: string;
  }) {
    const { phoneNumber, otp, newPassword } = payload;

    if (!phoneNumber || !otp || !newPassword) {
      badRequest('Thiếu thông tin đặt lại mật khẩu');
    }

    const cleanPhone = normalizePhone(phoneNumber);

    if (!/^\d{10,12}$/.test(cleanPhone)) {
      badRequest('Số điện thoại không hợp lệ');
    }

    if (String(newPassword).length < 6) {
      badRequest('Mật khẩu mới phải có ít nhất 6 ký tự');
    }

    const user = await findUserByPhone(cleanPhone);

    if (!user) {
      badRequest('Không tìm thấy tài khoản');
    }

    if ((user as any).blocked) {
      badRequest('Tài khoản đã bị khóa');
    }

    await verifyOtpRecord({
      userId: Number((user as any).id),
      phoneNumber: cleanPhone,
      otp,
      purpose: 'reset_password',
    });

    const updatedUser = await strapi.entityService.update(
      'plugin::users-permissions.user',
      Number((user as any).id),
      {
        data: {
          password: newPassword,
        } as any,
        populate: {
          Branch: true,
          Avatar: true,
          role: true,
        },
      } as any
    );

    return {
      success: true,
      user: sanitizeAuthUser(updatedUser),
      message: 'Đặt lại mật khẩu thành công. Vui lòng đăng nhập lại.',
    };
  },

  async requestDeleteAccount(payload: { userId: number | string }) {
    const cleanUserId = Number(payload.userId);

    if (!Number.isFinite(cleanUserId)) {
      badRequest('UserId không hợp lệ');
    }

    const user = await getUserById(cleanUserId);

    if (!user) {
      badRequest('Không tìm thấy tài khoản');
    }

    if ((user as any).MarkDelete) {
      return {
        success: true,
        alreadyRequested: true,
        userId: cleanUserId,
        MarkDelete: true,
        MarkDeleteDate: (user as any).MarkDeleteDate,
        canCancel: !isDeleteDateReached((user as any).MarkDeleteDate),
        user: sanitizeAuthUser(user),
        message: 'Tài khoản đã được đánh dấu chờ xóa.',
      };
    }

    const now = new Date();
    const markDeleteDate = addHours(now, DELETE_ACCOUNT_DELAY_HOURS);

    const updatedUser = await strapi.entityService.update(
      'plugin::users-permissions.user',
      cleanUserId,
      {
        data: {
          MarkDelete: true,
          MarkDeleteDate: markDeleteDate.toISOString(),
        } as any,
        populate: {
          Branch: true,
          Avatar: true,
          role: true,
        },
      } as any
    );

    systemInfo({
      scope: 'auth',
      event: 'REQUEST_DELETE_ACCOUNT_DONE',
      userId: cleanUserId,
      data: {
        userId: cleanUserId,
        email: (user as any).email,
        phoneNumber: getUserPhone(user),
        customName: getUserCustomName(user),
        MarkDelete: true,
        MarkDeleteDate: markDeleteDate.toISOString(),
      },
    });

    return {
      success: true,
      alreadyRequested: false,
      userId: cleanUserId,
      MarkDelete: true,
      MarkDeleteDate: markDeleteDate.toISOString(),
      canCancel: true,
      user: sanitizeAuthUser(updatedUser),
      message: 'Tài khoản đã được đánh dấu chờ xóa. Bạn có thể hủy trong vòng 24 giờ.',
    };
  },

  async cancelDeleteAccount(payload: { userId: number | string }) {
    const cleanUserId = Number(payload.userId);

    if (!Number.isFinite(cleanUserId)) {
      badRequest('UserId không hợp lệ');
    }

    const user = await getUserById(cleanUserId);

    if (!user) {
      badRequest('Không tìm thấy tài khoản');
    }

    if (!(user as any).MarkDelete) {
      return {
        success: true,
        alreadyCancelled: true,
        userId: cleanUserId,
        MarkDelete: false,
        MarkDeleteDate: null,
        user: sanitizeAuthUser(user),
        message: 'Tài khoản không có yêu cầu xóa.',
      };
    }

    if (isDeleteDateReached((user as any).MarkDeleteDate)) {
      badRequest('Yêu cầu xóa đã đến hạn xử lý, không thể hủy.');
    }

    const updatedUser = await strapi.entityService.update(
      'plugin::users-permissions.user',
      cleanUserId,
      {
        data: {
          MarkDelete: false,
          MarkDeleteDate: null,
        } as any,
        populate: {
          Branch: true,
          Avatar: true,
          role: true,
        },
      } as any
    );

    systemInfo({
      scope: 'auth',
      event: 'CANCEL_DELETE_ACCOUNT_DONE',
      userId: cleanUserId,
      data: {
        userId: cleanUserId,
        email: (user as any).email,
        phoneNumber: getUserPhone(user),
        customName: getUserCustomName(user),
        oldMarkDeleteDate: (user as any).MarkDeleteDate,
        MarkDelete: false,
        MarkDeleteDate: null,
      },
    });

    return {
      success: true,
      alreadyCancelled: false,
      userId: cleanUserId,
      MarkDelete: false,
      MarkDeleteDate: null,
      user: sanitizeAuthUser(updatedUser),
      message: 'Đã hủy yêu cầu xóa tài khoản.',
    };
  },
};