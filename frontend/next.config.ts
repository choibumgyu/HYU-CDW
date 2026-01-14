import type { NextConfig } from "next";
import withPWA from "next-pwa";

const nextConfig: NextConfig = {
    reactStrictMode: true,
};

const withPWAConfig = withPWA({
    dest: "public",
    register: true,
    skipWaiting: true,
    disable: process.env.NODE_ENV === "development",
    exclude: [/middleware-manifest.json$/, /fallback-build-manifest.json$/],
}) as (config: NextConfig) => NextConfig;

const finalConfig = withPWAConfig({
    ...nextConfig,
    // 여기에 추가 설정을 넣을 수 있습니다.
});

export default finalConfig;