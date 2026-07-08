import { getAuthToken } from './app-storage.service';

const API_BASE_URL =
  process.env.EXPO_PUBLIC_API_BASE_URL ?? '';

const API_TOKEN =
  process.env.EXPO_PUBLIC_API_TOKEN ?? '';

type RequestMethod =
  | 'GET'
  | 'POST'
  | 'PUT'
  | 'DELETE'
  | 'PATCH';

type ApiAuthMode = 'public' | 'user' | 'none';

type ApiRequestOptions = {
  method?: RequestMethod;
  body?: unknown;
  headers?: Record<string, string>;
  authMode?: ApiAuthMode;
};

async function parseResponse(response: Response) {
  const text = await response.text();

  if (!text) {
    return {};
  }

  try {
    return JSON.parse(text);
  } catch {
    // Giữ lại lỗi dạng text như "Method Not Allowed"
    return {
      message: text.trim(),
    };
  }
}

function getStatusMessage(
  status: number,
  method: RequestMethod,
  endpoint: string
) {
  switch (status) {
    case 400:
      return 'Dữ liệu gửi lên không hợp lệ.';
    case 401:
      return 'Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.';
    case 403:
      return 'Bạn không có quyền thực hiện thao tác này.';
    case 404:
      return 'Không tìm thấy nội dung yêu cầu.';
    case 405:
      return `API không hỗ trợ phương thức ${method} cho đường dẫn ${endpoint}.`;
    case 413:
      return 'Dữ liệu hoặc tệp tải lên quá lớn.';
    case 429:
      return 'Bạn thao tác quá nhanh. Vui lòng thử lại sau.';
    default:
      if (status >= 500) {
        return 'Máy chủ đang gặp sự cố. Vui lòng thử lại sau.';
      }

      return `Không thể tải nội dung. Mã lỗi: ${status}.`;
  }
}

export async function apiRequest<T>(
  endpoint: string,
  options: ApiRequestOptions = {}
): Promise<T> {
  if (!API_BASE_URL) {
    throw new Error(
      'Thiếu cấu hình API URL. Vui lòng kiểm tra file .env.'
    );
  }

  const {
    method = 'GET',
    body,
    headers = {},
    authMode = 'public',
  } = options;

  let token = '';

  if (authMode === 'public') {
    token = API_TOKEN;
  }

  if (authMode === 'user') {
    token = (await getAuthToken()) ?? '';

    if (!token) {
      throw new Error('Bạn cần đăng nhập.');
    }
  }

  const hasBody =
    body !== undefined && body !== null;

  const isFormData =
    typeof FormData !== 'undefined' &&
    body instanceof FormData;

  let response: Response;

  try {
    response = await fetch(
      `${API_BASE_URL}${endpoint}`,
      {
        method,
        headers: {
          Accept: 'application/json',
          ...(token
            ? { Authorization: `Bearer ${token}` }
            : {}),
          ...(hasBody && !isFormData
            ? { 'Content-Type': 'application/json' }
            : {}),
          ...headers,
        },
        ...(hasBody
          ? {
              body: isFormData
                ? body
                : JSON.stringify(body),
            }
          : {}),
      }
    );
  } catch (error) {
    console.log('[API_NETWORK_ERROR]', {
      method,
      endpoint,
      error,
    });

    throw new Error(
      'Không thể kết nối đến máy chủ. Vui lòng kiểm tra mạng và thử lại.'
    );
  }

  const data = await parseResponse(response);

  if (!response.ok) {
    const serverMessage =
      data?.error?.message ||
      data?.message?.[0]?.messages?.[0]?.message ||
      data?.message;

    const fallback = getStatusMessage(
      response.status,
      method,
      endpoint
    );

    const message =
      typeof serverMessage === 'string' &&
      serverMessage.trim()
        ? serverMessage.trim()
        : fallback;

    console.log('[API_RESPONSE_ERROR]', {
      method,
      endpoint,
      status: response.status,
      data,
    });

    throw new Error(message);
  }

  return data as T;
}

export { API_BASE_URL };