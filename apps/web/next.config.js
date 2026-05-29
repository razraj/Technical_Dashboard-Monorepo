/** @type {import('next').NextConfig} */
const nextConfig = {
    reactStrictMode: true,
    transpilePackages: ["@repo/ui"],
    skipProxyUrlNormalize: true,
    async rewrites() {
        return [
            {
                // Whenever the frontend requests anything starting with /api/
                source: "/api/:path*",
                // Proxy that request to the backend running on port 3000
                destination: "http://localhost:3000/:path*"
            }
        ];
    }
};

export default nextConfig;
