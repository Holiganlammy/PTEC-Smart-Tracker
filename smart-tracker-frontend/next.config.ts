import type { NextConfig } from "next";

// โดเมน tunnel ที่ใช้ทดสอบกับ LINE (เช่น abc.ngrok-free.app) คั่นหลายตัวด้วยจุลภาค — ใส่เฉพาะชื่อโดเมน ไม่มี https://
const devTunnelHosts = (process.env.DEV_TUNNEL_HOST ?? "")
  .split(",")
  .map((h) => h.trim())
  .filter(Boolean);

// backend (NestJS) ที่ Next จะ proxy /api/* ไปหา
const backendUrl = process.env.BACKEND_URL ?? "http://localhost:4000";

// security headers ทุกหน้า (ยังไม่ใส่ CSP เพราะ Next + LIFF SDK ต้องปรับ allowlist ให้ละเอียดก่อน)
const securityHeaders = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  // กัน clickjacking (LIFF เปิดเป็นหน้าหลักใน webview ของ LINE ไม่ได้ฝังใน iframe)
  { key: "X-Frame-Options", value: "SAMEORIGIN" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
  // บังคับ https เฉพาะ production (ตอน dev ผ่าน http://localhost ไม่ควรตั้ง)
  ...(process.env.NODE_ENV === "production"
    ? [{ key: "Strict-Transport-Security", value: "max-age=31536000; includeSubDomains" }]
    : []),
];

const nextConfig: NextConfig = {
  /* config options here */
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
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
