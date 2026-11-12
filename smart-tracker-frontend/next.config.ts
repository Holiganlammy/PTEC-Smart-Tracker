import type { NextConfig } from "next";

// โดเมน tunnel ที่ใช้ทดสอบกับ LINE (เช่น abc.ngrok-free.app) คั่นหลายตัวด้วยจุลภาค — ใส่เฉพาะชื่อโดเมน ไม่มี https://
const devTunnelHosts = (process.env.DEV_TUNNEL_HOST ?? "")
  .split(",")
  .map((h) => h.trim())
  .filter(Boolean);

// backend (NestJS) ที่ Next จะ proxy /api/* ไปหา
const backendUrl = process.env.BACKEND_URL ?? "http://localhost:4000";

const nextConfig: NextConfig = {
  /* config options here */
  experimental: {
    agentFeedback: true,
  },
  cacheComponents: true,
  partialPrefetching: true,
  allowedDevOrigins: devTunnelHosts,
  // หน้าบ้านเรียก /api/... แล้ว Next ส่งต่อไป backend → ใช้ tunnel ตัวเดียว ไม่ติด CORS / mixed content
  async rewrites() {
    return [{ source: "/api/:path*", destination: `${backendUrl}/:path*` }];
  },
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
