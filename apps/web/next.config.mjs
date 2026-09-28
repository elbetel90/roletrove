/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: ['@roletrove/db', '@roletrove/shared', '@roletrove/search'],
}

export default nextConfig
