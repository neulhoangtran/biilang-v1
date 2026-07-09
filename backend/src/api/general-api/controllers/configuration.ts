import {
  getAppVersionConfiguration,
} from '../../../utils/configuration.helper';

export default {
  async getAppVersion(ctx: any) {
    try {
      const config = await getAppVersionConfiguration();

      return ctx.send({
        success: true,
        data: {
          appVersion: config.appVersion,
          isRequireUpdate: config.isRequireUpdate,
          androidUrlDownload: config.androidUrlDownload,
          iosUrlDownload: config.iosUrlDownload,
        },
      });
    } catch (error: any) {
      strapi.log.error('[GENERAL_API_GET_APP_VERSION_CONFIG_FAILED]', {
        errorName: error?.name,
        errorMessage: error?.message || String(error),
        errorStack: error?.stack,
      });

      return ctx.internalServerError(
        'Không thể tải cấu hình phiên bản app.'
      );
    }
  },

  async getPublicConfiguration(ctx: any) {
    try {
      const appVersionConfig = await getAppVersionConfiguration();

      return ctx.send({
        success: true,
        data: {
          version: {
            appVersion: appVersionConfig.appVersion,
            isRequireUpdate: appVersionConfig.isRequireUpdate,
            androidUrlDownload: appVersionConfig.androidUrlDownload,
            iosUrlDownload: appVersionConfig.iosUrlDownload,
          },
        },
      });
    } catch (error: any) {
      strapi.log.error('[GENERAL_API_GET_PUBLIC_CONFIG_FAILED]', {
        errorName: error?.name,
        errorMessage: error?.message || String(error),
        errorStack: error?.stack,
      });

      return ctx.internalServerError(
        'Không thể tải cấu hình app.'
      );
    }
  },
};