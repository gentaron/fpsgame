import type { NextConfig } from "next";

// 全レスポンスに付与するセキュリティヘッダー。
// Content-Security-Policy はリクエストごとの nonce が必要なため src/proxy.ts で設定する。
const securityHeaders = [
  {
    // 2年間 HTTPS を強制(プリロードリスト対応)
    key: "Strict-Transport-Security",
    value: "max-age=63072000; includeSubDomains; preload",
  },
  {
    key: "X-Content-Type-Options",
    value: "nosniff",
  },
  {
    // クリックジャッキング防止(CSP frame-ancestors のフォールバック)
    key: "X-Frame-Options",
    value: "DENY",
  },
  {
    key: "Referrer-Policy",
    value: "strict-origin-when-cross-origin",
  },
  {
    // 使用しない強力なブラウザ機能を明示的に無効化(全画面はゲーム用に自サイトのみ許可)
    key: "Permissions-Policy",
    value:
      "camera=(), microphone=(), geolocation=(), payment=(), usb=(), midi=(), magnetometer=(), gyroscope=(), accelerometer=(), browsing-topics=(), fullscreen=(self)",
  },
  {
    key: "Cross-Origin-Opener-Policy",
    value: "same-origin",
  },
  {
    key: "Cross-Origin-Resource-Policy",
    value: "same-origin",
  },
  {
    key: "X-DNS-Prefetch-Control",
    value: "off",
  },
];

const nextConfig: NextConfig = {
  output: "standalone",
  // ビルド時の型エラーを許容しない
  typescript: {
    ignoreBuildErrors: false,
  },
  reactStrictMode: false,
  // X-Powered-By ヘッダーを削除(技術スタックの露出を防ぐ)
  poweredByHeader: false,
  async headers() {
    return [
      {
        source: "/:path*",
        headers: securityHeaders,
      },
    ];
  },
};

export default nextConfig;
