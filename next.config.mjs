import path from 'node:path';
import { PHASE_DEVELOPMENT_SERVER } from 'next/constants.js';

export default (phase) => ({
  distDir: phase === PHASE_DEVELOPMENT_SERVER ? '.next-dev' : '.next',
  devIndicators: false,
  serverExternalPackages: ['@libsql/client', 'libsql'],
  webpack(config, { isServer }) {
    const rootNodeModules = path.resolve(process.cwd(), 'node_modules');
    config.resolve.modules = [rootNodeModules, ...(config.resolve.modules || ['node_modules'])];
    config.resolve.extensionAlias = {
      ...(config.resolve.extensionAlias || {}),
      '.js': ['.ts', '.tsx', '.js', '.jsx'],
      '.mjs': ['.mts', '.mjs'],
    };
    if (isServer) {
      config.externals = [
        ...(Array.isArray(config.externals) ? config.externals : [config.externals].filter(Boolean)),
        ({ request }, callback) => {
          if (request === '@libsql/client' || request === 'libsql' || request?.startsWith('@libsql/')) {
            return callback(null, `commonjs ${request}`);
          }
          return callback();
        },
      ];
    }
    return config;
  },
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'X-Frame-Options', value: 'DENY' },
        ],
      },
    ];
  },
});
