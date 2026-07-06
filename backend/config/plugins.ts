import type { Core } from '@strapi/strapi';

const config = ({ env }: Core.Config.Shared.ConfigParams): Core.Config.Plugin => ({
  'users-permissions': {
    config: {
      register: {
        allowedFields: ['PhoneNumber', 'DateOfBirth', 'Sex'],
      },
    },
  },
});

export default config;
