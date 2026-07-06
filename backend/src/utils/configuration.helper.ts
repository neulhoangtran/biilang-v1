const CONFIGURATION_UID =
  'api::configuration.configuration';
const CONFIGURATION_CACHE_MS = 60 * 1000;

export type ConfigurationTemplateValues =
  Record<string, unknown>;

type ConfigurationCache = {
  expiredAt: number;
  data: Record<string, any> | null;
};

let configurationCache: ConfigurationCache = {
  expiredAt: 0,
  data: null,
};

function getNestedTemplateValue(
  values: ConfigurationTemplateValues,
  key: string
) {
  return key
    .split('.')
    .reduce<unknown>((result, part) => {
      if (
        result &&
        typeof result === 'object' &&
        part in result
      ) {
        return (result as Record<string, unknown>)[part];
      }

      return undefined;
    }, values);
}

function stringifyTemplateValue(value: unknown) {
  if (value === undefined || value === null) {
    return '';
  }

  if (value instanceof Date) {
    return value.toISOString();
  }

  if (typeof value === 'string') {
    return value;
  }

  if (
    typeof value === 'number' ||
    typeof value === 'boolean' ||
    typeof value === 'bigint'
  ) {
    return String(value);
  }

  return '';
}

export function renderConfigurationTemplate(
  template: string,
  values: ConfigurationTemplateValues = {}
) {
  return String(template || '').replace(
    /{{\s*([a-zA-Z0-9_.-]+)\s*}}/g,
    (_match, key: string) =>
      stringifyTemplateValue(
        getNestedTemplateValue(values, key)
      )
  );
}

function logConfigurationError(
  event: string,
  error: any
) {
  strapi?.log?.error?.(
    `[${event}] ${
      error?.message || String(error)
    }`
  );
}

export function clearConfigurationCache() {
  configurationCache = {
    expiredAt: 0,
    data: null,
  };
}

export async function getConfiguration() {
  const now = Date.now();

  if (configurationCache.expiredAt > now) {
    return configurationCache.data;
  }

  let data: Record<string, any> | null = null;

  try {
    data = await strapi
      .documents(CONFIGURATION_UID)
      .findFirst({
        status: 'published',
      } as any);
  } catch (error: any) {
    logConfigurationError(
      'CONFIGURATION_DOCUMENT_READ_FAILED',
      error
    );

    try {
      const fallbackData =
        await strapi.entityService.findMany(
          CONFIGURATION_UID as any
        );

      data =
        Array.isArray(fallbackData)
          ? fallbackData[0] || null
          : fallbackData || null;
    } catch (fallbackError: any) {
      logConfigurationError(
        'CONFIGURATION_ENTITY_READ_FAILED',
        fallbackError
      );
    }
  }

  configurationCache = {
    expiredAt: now + CONFIGURATION_CACHE_MS,
    data,
  };

  return data;
}

export async function getConfigurationValue<T = string>(
  key: string,
  fallback: T
): Promise<T> {
  const configuration = await getConfiguration();
  const value = configuration?.[key];

  if (typeof value === 'string') {
    const cleanValue = value.trim();

    return (cleanValue || fallback) as T;
  }

  if (value === undefined || value === null) {
    return fallback;
  }

  return value as T;
}

export async function getRenderedConfigurationValue({
  key,
  fallback,
  values,
}: {
  key: string;
  fallback: string;
  values?: ConfigurationTemplateValues;
}) {
  const template =
    await getConfigurationValue<string>(
      key,
      fallback
    );

  return renderConfigurationTemplate(
    template,
    values
  );
}
