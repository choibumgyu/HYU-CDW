const withPWA = require("next-pwa");

const nextConfig = {
  // 여기에 Next.js 설정을 추가하세요
};

const withPWAConfig = withPWA({
  dest: "public",
  register: true,
  skipWaiting: true,
  disable: process.env.NODE_ENV === "development",
  exclude: [/middleware-manifest.json$/, /fallback-build-manifest.json$/],
});

module.exports = withPWAConfig(nextConfig);