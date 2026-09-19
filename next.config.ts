import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  reactStrictMode: true,
  experimental: {
    // Server Actions handle timetable images and syllabus PDFs.
    serverActions: { bodySizeLimit: '12mb' },
  },
};

export default nextConfig;
