import { NextRequest, NextResponse } from "next/server";

interface RateLimitConfig {
  limit: number;
  windowMs: number;
}

const ipRequests = new Map<string, { count: number; resetTime: number }>();

/**
 * Simple in-memory rate limiter.
 * In production, use Redis (e.g., @upstash/ratelimit).
 */
export function rateLimit(req: NextRequest, config: RateLimitConfig = { limit: 100, windowMs: 60000 }) {
  const ip = req.headers.get("x-forwarded-for") || "unknown";
  const now = Date.now();

  const record = ipRequests.get(ip);

  if (!record || now > record.resetTime) {
    ipRequests.set(ip, { count: 1, resetTime: now + config.windowMs });
    return { success: true };
  }

  if (record.count >= config.limit) {
    return { 
      success: false, 
      response: NextResponse.json(
        { error: "Too Many Requests" }, 
        { status: 429, headers: { "Retry-After": Math.ceil((record.resetTime - now) / 1000).toString() } }
      ) 
    };
  }

  record.count++;
  return { success: true };
}
