import { router } from 'expo-router';
import { syncNotificationTokenAfterLogin } from './notification.service';

import {
    clearAppSession,
    getAppSession,
    saveAppSession,
    type AppConfig,
    type SelectedBranchConfig,
    type UserInfo,
} from './app-storage.service';

const API_URL = process.env.EXPO_PUBLIC_API_BASE_URL ?? '';

export type AuthNextStep = 'VERIFY_PHONE' | 'SELECT_BRANCH' | 'HOME';

export type VoucherSmsResult = {
    smsSent?: boolean;
    smsErrorMessage?: string;
    message?: string;
    [key: string]: unknown;
};

export type AuthPayload = {
    jwt?: string;
    token?: string;
    user?: UserInfo;
    user_info?: UserInfo;
    nextStep?: AuthNextStep;
    smsSent?: boolean;
    smsErrorMessage?: string;
    voucherSms?: VoucherSmsResult | null;
    message?: string;
    config?: Partial<AppConfig>;
};

export type AuthRedirectTarget =
    | '/welcome'
    | '/(tabs)'
    | {
          pathname: '/verify-phone';
          params: {
              userId: string;
              phone: string;
              smsSent: string;
          };
      }
    | {
          pathname: '/select-branch';
          params: {
              userId: string;
          };
      };

let bootstrapPromise: Promise<AuthRedirectTarget> | null = null;

const normalizePhone = (value: unknown) => {
    let phone = String(value || '').replace(/[^\d]/g, '');

    if (phone.startsWith('82')) {
        phone = `0${phone.slice(2)}`;
    }

    return phone;
};

const getUserPhone = (user: UserInfo | null) => {
    if (!user) {
        return '';
    }

    return normalizePhone(
        user.PhoneNumber ||
            user.phoneNumber ||
            user.phone ||
            user.username ||
            ''
    );
};

const getUserBranch = (user: UserInfo | null) => {
    if (!user) {
        return null;
    }

    return (
        user.Branch ||
        user.branch ||
        user.selected_branch ||
        user.selectedBranch ||
        null
    );
};

const isBlockedUser = (user: UserInfo | null) => {
    return Boolean(user?.blocked);
};

const mapUserBranchToSelectedBranch = (
    branch: any
): SelectedBranchConfig | null => {
    if (!branch?.id) {
        return null;
    }

    return {
        id: branch.id,
        documentId: branch.documentId || '',
        name: branch.Name || branch.name || '',
        slug: branch.Slug || branch.slug || '',
        area: branch.Area || branch.area || '',
        address: branch.Address || branch.address || '',
        phone: branch.Phone ?? branch.phone ?? null,
        zalo: branch.Zalo ?? branch.zalo ?? null,
        messenger: branch.Messenger ?? branch.messenger ?? null,
        messenger_web:
            branch.MessengerWeb ??
            branch.messenger_web ??
            branch.messengerWeb ??
            null,
    };
};

const normalizeWishlistProductIds = (value: unknown): string[] => {
    if (!Array.isArray(value)) {
        return [];
    }

    return Array.from(
        new Set(
            value
                .map(item => String(item).trim())
                .filter(Boolean)
        )
    );
};

const buildAppConfig = (
    config?: Partial<AppConfig>,
    user?: UserInfo | null
): AppConfig => {
    const userBranch = getUserBranch(user ?? null);

    const selectedBranchFromUser =
        mapUserBranchToSelectedBranch(userBranch);

    const hasUserWishlistProductIds = Array.isArray(
        (user as any)?.wishlist_product_ids
    );

    const userWishlistProductIds =
        normalizeWishlistProductIds(
            (user as any)?.wishlist_product_ids
        );

    const configWishlistProductIds =
        normalizeWishlistProductIds(
            config?.wishlist_product_ids
        );

    return {
        ...(config ?? {}),

        search_terms: Array.isArray(config?.search_terms)
            ? config.search_terms
            : [],

        wishlist_product_ids: hasUserWishlistProductIds
            ? userWishlistProductIds
            : configWishlistProductIds,

        selected_branch:
            selectedBranchFromUser ||
            config?.selected_branch ||
            null,
    };
};

const hasBranch = (
    user: UserInfo | null,
    config?: AppConfig
) => {
    if (config?.selected_branch?.id) {
        return true;
    }

    return Boolean(getUserBranch(user));
};

const resolveNextStep = (
    user: UserInfo | null,
    nextStep?: AuthNextStep,
    config?: AppConfig
): AuthNextStep => {
    if (nextStep) {
        return nextStep;
    }

    if (!user?.confirmed) {
        return 'VERIFY_PHONE';
    }

    if (!hasBranch(user, config)) {
        return 'SELECT_BRANCH';
    }

    return 'HOME';
};

const buildRedirectTarget = (
    user: UserInfo | null,
    step: AuthNextStep,
    smsSent?: boolean
): AuthRedirectTarget => {
    const userId = String(user?.id || '');
    const phone = getUserPhone(user);

    if (step === 'VERIFY_PHONE') {
        return {
            pathname: '/verify-phone',
            params: {
                userId,
                phone,
                smsSent: String(smsSent ?? true),
            },
        };
    }

    if (step === 'SELECT_BRANCH') {
        return {
            pathname: '/select-branch',
            params: {
                userId,
            },
        };
    }

    return '/(tabs)';
};

async function parseJsonResponse(response: Response) {
    const text = await response.text();

    if (!text) {
        return null;
    }

    try {
        return JSON.parse(text);
    } catch {
        return null;
    }
}

function createHttpError(
    message: string,
    status?: number,
    data?: unknown
) {
    const error = new Error(message);

    (error as any).status = status;
    (error as any).data = data;

    return error;
}

async function fetchCurrentUser(token: string): Promise<UserInfo> {
    if (!API_URL) {
        throw new Error('Missing API URL');
    }

    const response = await fetch(`${API_URL}/api/vikof/profile`, {
        method: 'GET',
        headers: {
            Authorization: `Bearer ${token}`,
        },
    });

    const data = await parseJsonResponse(response);

    if (response.status === 401 || response.status === 403) {
        throw createHttpError(
            'TOKEN_EXPIRED',
            response.status,
            data
        );
    }

    if (!response.ok) {
        throw createHttpError(
            'USER_PROFILE_FAILED',
            response.status,
            data
        );
    }

    const user = data?.user_info || data?.user || data;

    if (!user) {
        throw new Error('USER_PROFILE_EMPTY');
    }

    return user as UserInfo;
}

async function getFreshUserByToken(
    token: string,
    fallbackUser: UserInfo | null
) {
    try {
        const freshUser = await fetchCurrentUser(token);

        return {
            ...(fallbackUser ?? {}),
            ...(freshUser ?? {}),
        } as UserInfo;
    } catch (error) {
        console.log('[FETCH_FRESH_USER_ERROR]', error);

        if (
            (error as any)?.status === 401 ||
            (error as any)?.status === 403
        ) {
            throw error;
        }

        return fallbackUser;
    }
}

async function resolveInitialAuthTarget(): Promise<AuthRedirectTarget> {
    const session = await getAppSession();

    /**
     * Mở app không có token thì về Welcome.
     * Guest mode chỉ vào Tabs khi user bấm nút:
     * "Hoặc xem không cần tài khoản".
     */
    if (!session.token) {
        return '/welcome';
    }

    const localUser = session.user_info;

    if (isBlockedUser(localUser)) {
        await clearAppSession();

        return '/welcome';
    }

    const localConfig = buildAppConfig(
        session.config,
        localUser
    );

    const localStep = resolveNextStep(
        localUser,
        undefined,
        localConfig
    );

    /**
     * User đã đăng ký nhưng chưa verify phone:
     * cho vào thẳng step verify-phone.
     */
    if (localUser && localStep === 'VERIFY_PHONE') {
        await saveAppSession({
            token: session.token,
            user_info: localUser,
            config: localConfig,
        });

        return buildRedirectTarget(
            localUser,
            'VERIFY_PHONE',
            true
        );
    }

    try {
        const freshUser = await getFreshUserByToken(
            session.token,
            localUser
        );

        if (!freshUser) {
            await clearAppSession();

            return '/welcome';
        }

        if (isBlockedUser(freshUser)) {
            await clearAppSession();

            return '/welcome';
        }

        const nextConfig = buildAppConfig(
            session.config,
            freshUser
        );

        const nextStep = resolveNextStep(
            freshUser,
            undefined,
            nextConfig
        );

        await saveAppSession({
            token: session.token,
            user_info: freshUser,
            config: nextConfig,
        });

        if (nextStep === 'HOME') {
            await syncNotificationTokenAfterLogin();
        }

        return buildRedirectTarget(
            freshUser,
            nextStep,
            true
        );
    } catch (error: any) {
        console.log('[AUTH_BOOTSTRAP_ERROR]', error);

        if (error?.status === 401 || error?.status === 403) {
            await clearAppSession();
        }

        return '/welcome';
    }
}

export async function getInitialAuthTarget(): Promise<AuthRedirectTarget> {
    if (!bootstrapPromise) {
        bootstrapPromise = resolveInitialAuthTarget().finally(() => {
            bootstrapPromise = null;
        });
    }

    return bootstrapPromise;
}

export async function redirectAfterAuth(payload: AuthPayload) {
    const session = await getAppSession();

    const token =
        payload.jwt ||
        payload.token ||
        session.token ||
        '';

    const payloadUser =
        payload.user_info ||
        payload.user ||
        session.user_info ||
        null;

    if (isBlockedUser(payloadUser)) {
        await clearAppSession();

        router.replace('/welcome');

        return;
    }

    const baseConfig = buildAppConfig(
        {
            ...session.config,
            ...(payload.config ?? {}),
        },
        payloadUser
    );

    const baseStep = resolveNextStep(
        payloadUser,
        payload.nextStep,
        baseConfig
    );

    /**
     * Register/Login user chưa active vẫn lưu token + user,
     * sau đó đi tiếp VERIFY_PHONE.
     */
    if (baseStep === 'VERIFY_PHONE') {
        await saveAppSession({
            token,
            user_info: payloadUser,
            config: baseConfig,
        });

        const target = buildRedirectTarget(
            payloadUser,
            'VERIFY_PHONE',
            payload.smsSent
        );

        router.replace(target as any);

        return;
    }

    if (!token) {
        await clearAppSession();

        router.replace('/welcome');

        return;
    }

    let userInfo: UserInfo | null = payloadUser;

    try {
        userInfo = await getFreshUserByToken(
            token,
            payloadUser
        );
    } catch (error: any) {
        console.log('[AUTH_REDIRECT_FETCH_USER_ERROR]', error);

        if (error?.status === 401 || error?.status === 403) {
            await clearAppSession();

            router.replace('/welcome');

            return;
        }

        userInfo = payloadUser;
    }

    if (!userInfo) {
        await clearAppSession();

        router.replace('/welcome');

        return;
    }

    if (isBlockedUser(userInfo)) {
        await clearAppSession();

        router.replace('/welcome');

        return;
    }

    const nextConfig = buildAppConfig(
        {
            ...session.config,
            ...(payload.config ?? {}),
        },
        userInfo
    );

    const nextStep = resolveNextStep(
        userInfo,
        payload.nextStep,
        nextConfig
    );

    await saveAppSession({
        token,
        user_info: userInfo,
        config: nextConfig,
    });

    if (nextStep === 'HOME') {
        await syncNotificationTokenAfterLogin();
    }

    const target = buildRedirectTarget(
        userInfo,
        nextStep,
        payload.smsSent
    );

    router.replace(target as any);
}