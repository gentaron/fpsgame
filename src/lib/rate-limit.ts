// シンプルなインメモリ・スライディングウィンドウ方式のレート制限。
// 単一インスタンス構成(standalone サーバー)向け。水平スケール時は Redis 等に置き換えること。

interface Bucket {
  timestamps: number[]
}

const buckets = new Map<string, Bucket>()

const WINDOW_MS = 60_000
const MAX_REQUESTS = 60
const MAX_KEYS = 10_000

let lastSweep = Date.now()

function sweep(now: number) {
  // メモリ枯渇(DoS)防止: 定期的に期限切れバケットを掃除する
  if (now - lastSweep < WINDOW_MS && buckets.size < MAX_KEYS) return
  lastSweep = now
  for (const [key, bucket] of buckets) {
    bucket.timestamps = bucket.timestamps.filter((t) => now - t < WINDOW_MS)
    if (bucket.timestamps.length === 0) buckets.delete(key)
  }
}

export interface RateLimitResult {
  success: boolean
  limit: number
  remaining: number
  /** ウィンドウがリセットされる UNIX 時間(秒) */
  reset: number
}

export function rateLimit(key: string): RateLimitResult {
  const now = Date.now()
  sweep(now)

  let bucket = buckets.get(key)
  if (!bucket) {
    bucket = { timestamps: [] }
    buckets.set(key, bucket)
  }

  bucket.timestamps = bucket.timestamps.filter((t) => now - t < WINDOW_MS)

  const reset = Math.ceil((now + WINDOW_MS) / 1000)
  if (bucket.timestamps.length >= MAX_REQUESTS) {
    return { success: false, limit: MAX_REQUESTS, remaining: 0, reset }
  }

  bucket.timestamps.push(now)
  return {
    success: true,
    limit: MAX_REQUESTS,
    remaining: MAX_REQUESTS - bucket.timestamps.length,
    reset,
  }
}
