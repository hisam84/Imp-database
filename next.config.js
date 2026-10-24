process.env.TZ = "Asia/Dhaka";

/** @type {import('next').NextConfig} */
const nextConfig = {
  basePath: '/database',
  skipTrailingSlashRedirect: true,
  eslint: { ignoreDuringBuilds: true },
  typescript: { ignoreBuildErrors: true },
  env: {
    TZ: "Asia/Dhaka",
    NEXT_PUBLIC_TIMEZONE: "Asia/Dhaka",
  },
  webpack: (config, { isServer }) => {
    if (!isServer) {
      config.resolve.fallback = {
        ...config.resolve.fallback,
        fs: false,
        child_process: false,
        net: false,
        tls: false,
      };
    }
    return config;
  },
};

module.exports = nextConfig;
