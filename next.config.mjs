/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  experimental: {
    // Native Node bindings — do not try to bundle these into server chunks.
    serverComponentsExternalPackages: ["@node-rs/argon2", "pg", "ioredis", "bullmq"],
  },
};

export default nextConfig;
