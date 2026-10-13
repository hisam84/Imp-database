process.env.TZ = "Asia/Dhaka";

/** @type {import('next').NextConfig} */
const nextConfig = {
  basePath: '/clients',
  eslint: { ignoreDuringBuilds: true },
  typescript: { ignoreBuildErrors: true },
  env: {
    TZ: "Asia/Dhaka",
    NEXT_PUBLIC_TIMEZONE: "Asia/Dhaka",
  },
};

module.exports = nextConfig;
