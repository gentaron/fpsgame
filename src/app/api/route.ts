import { NextRequest, NextResponse } from "next/server";
import { rateLimit } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

function clientKey(request: NextRequest): string {
  // リバースプロキシ経由を想定し、先頭の転送元 IP をキーにする
  const forwarded = request.headers.get("x-forwarded-for");
  return forwarded?.split(",")[0]?.trim() || "unknown";
}

export async function GET(request: NextRequest) {
  const result = rateLimit(clientKey(request));

  const headers: Record<string, string> = {
    "Cache-Control": "no-store",
    "RateLimit-Limit": String(result.limit),
    "RateLimit-Remaining": String(result.remaining),
    "RateLimit-Reset": String(result.reset),
  };

  if (!result.success) {
    return NextResponse.json(
      { error: "Too many requests" },
      {
        status: 429,
        headers: {
          ...headers,
          "Retry-After": String(Math.max(1, result.reset - Math.floor(Date.now() / 1000))),
        },
      },
    );
  }

  return NextResponse.json({ message: "Hello, world!" }, { headers });
}
