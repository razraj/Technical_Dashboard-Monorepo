/** @type {import('next').NextConfig} */
const nextConfig = {
    allowedDevOrigins: [],
    skipProxyUrlNormalize: true,
    transpilePackages: ["@repo/db"]
};
export default nextConfig;
