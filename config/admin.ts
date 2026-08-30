import type { Core } from '@strapi/strapi';

const config = ({ env }: Core.Config.Shared.ConfigParams): Core.Config.Admin => ({
  auth: {
    secret: env('ADMIN_JWT_SECRET', 'mluuOBFRH4HIR23bzdcumA=='),
  },
  apiToken: {
    salt: env('API_TOKEN_SALT', '3Y5fYV1Xw8ORqqH1kqyLdQ=='),
  },
  transfer: {
    token: {
      salt: env('TRANSFER_TOKEN_SALT', 'nAHTRQFQ+JajLmQ/PFQ82Q=='),
    },
  },
  secrets: {
    encryptionKey: env('ENCRYPTION_KEY', 'KK4r1wfMUHSaQ1yUzNpxWg=='),
  },
  flags: {
    nps: env.bool('FLAG_NPS', true),
    promoteEE: env.bool('FLAG_PROMOTE_EE', true),
    docLinks: env.bool('FLAG_DOC_LINKS', true),
  },
});

export default config;
