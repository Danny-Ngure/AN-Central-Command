/** @type {import('next').NextConfig} */
const nextConfig = {
  // Workspace packages ship TypeScript source directly — let Next.js compile them.
  transpilePackages: ['@an/auth', '@an/db', '@an/i18n', '@an/types'],

  // Tell Next.js's own bundling pipeline these are externals (node_modules path).
  experimental: {
    serverComponentsExternalPackages: ['@node-rs/argon2', 'postgres', 'ioredis'],
  },

  reactStrictMode: true,

  // serverComponentsExternalPackages above doesn't propagate through transpilePackages.
  // When webpack walks into @an/auth (transpiled) and sees `import '@node-rs/argon2'`,
  // it would try to bundle the .node binary. Mark these as webpack externals on the
  // server side so webpack emits a runtime require() instead.
  webpack: (config, { isServer }) => {
    if (isServer) {
      const existing = Array.isArray(config.externals)
        ? config.externals
        : config.externals
          ? [config.externals]
          : [];
      config.externals = [
        ...existing,
        '@node-rs/argon2',
        'postgres',
        'ioredis',
      ];
    }
    return config;
  },
};

export default nextConfig;
