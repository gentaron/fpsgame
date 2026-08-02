import { NextRequest, NextResponse } from 'next/server'

// リクエストごとに一意な CSP nonce を生成し、厳格な Content-Security-Policy を適用する。
// Next.js はリクエストヘッダーの CSP から nonce を検出し、自身のインラインスクリプトに付与する。
export function proxy(request: NextRequest) {
  const nonceBytes = new Uint8Array(16)
  crypto.getRandomValues(nonceBytes)
  const nonce = btoa(String.fromCharCode(...nonceBytes))

  const isDev = process.env.NODE_ENV === 'development'

  const csp = [
    "default-src 'self'",
    // strict-dynamic: nonce 付きスクリプトが読み込むチャンクのみ信頼する。
    // wasm-unsafe-eval: meshopt デコーダー(GLB 読み込み)の WebAssembly のみ許可(JS の eval は不許可)
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic' 'wasm-unsafe-eval'${isDev ? " 'unsafe-eval'" : ''}`,
    // Tailwind / framer-motion / Three.js が style 属性を使うため unsafe-inline が必要
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' blob: data:",
    "font-src 'self' data:",
    // blob: は GLB 埋め込みテクスチャの読み込みに必要。開発時は HMR の WebSocket も許可
    `connect-src 'self' blob:${isDev ? ' ws:' : ''}`,
    "worker-src 'self' blob:",
    "media-src 'self' blob:",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
    "manifest-src 'self'",
    ...(isDev ? [] : ['upgrade-insecure-requests']),
  ].join('; ')

  const requestHeaders = new Headers(request.headers)
  requestHeaders.set('x-nonce', nonce)
  requestHeaders.set('Content-Security-Policy', csp)

  const response = NextResponse.next({
    request: { headers: requestHeaders },
  })
  response.headers.set('Content-Security-Policy', csp)
  return response
}

export const config = {
  matcher: [
    {
      // 静的アセットとプリフェッチを除く全ドキュメントリクエストに適用
      source:
        '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|glb|txt|xml|ico)$).*)',
      missing: [
        { type: 'header', key: 'next-router-prefetch' },
        { type: 'header', key: 'purpose', value: 'prefetch' },
      ],
    },
  ],
}
