import type { Core } from '@strapi/strapi';

const config = ({ env }: Core.Config.Shared.ConfigParams): Core.Config.Server => ({
  host: env('HOST', '0.0.0.0'),
  port: env.int('PORT', 1337),
  url: env('PUBLIC_URL', undefined),
  app: {
    keys: env.array('APP_KEYS', [
      'iXs9Sg1k+dnIdTlmRgiPYQ==',
      'fCkM/PIc8AGlshOeObv4Cw==',
      'w8jqw9rooDjvKZd07WiBjg==',
      'zI0MVWKiBLLvjxsKWCDzHw=='
    ]),
  },
  webhooks: {
    populateRelations: env.bool('WEBHOOKS_POPULATE_RELATIONS', false),
  },
});

export default config;
