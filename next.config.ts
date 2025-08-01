import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'mxcnpiqjbidjtcdvywih.supabase.co',
      },
    ],
  },
  async redirects() {
    return [
      {
        source: '/admin',
        destination: '/admin/dashboard',
        permanent: true,
      },
    ];
  },
  webpack: (config, { isServer }) => {
    if (isServer) {
      config.externals = [...(Array.isArray(config.externals) ? config.externals : []), 'bcrypt'];
    }
    return config;
  },
  serverExternalPackages: ['bcrypt'],
  experimental: {
    reactCompiler: false,
    serverActions: {
      bodySizeLimit: '5mb',
    },
  },
};

export default nextConfig;