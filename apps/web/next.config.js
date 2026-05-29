/* global process */
const backendUrl =
    process.env.NODE_ENV === "production"
        ? `https://${process.env.DATABASE_HOST?.replace(/\/$/, "")}`
        : "http://localhost:3000";
        
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
                destination: `${backendUrl}/:path*`
            }
        ];
    },
    logging: {
        fetches: {
            fullUrl: true
        }
    }
};

export default nextConfig;
