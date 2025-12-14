import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { ensureCorrelationId, recordApiMetric } from "@/lib/metrics";
import { logger } from "@/lib/logger";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const correlationId = ensureCorrelationId(request.headers.get("x-correlation-id"));
  const start = performance.now();
  try {
    const creatives = await prisma.interactiveCreative.findMany({ orderBy: { updatedAt: "desc" } });

    const latency = performance.now() - start;
    recordApiMetric("api.ads.interactive.creatives.get", latency, false);
    logger.info("Interactive creatives listed", {
      count: creatives.length,
      correlationId,
      latencyMs: Number(latency.toFixed(2)),
    });

    const response = NextResponse.json({ data: creatives });
    response.headers.set("x-correlation-id", correlationId);
    return response;
  } catch (error) {
    const latency = performance.now() - start;
    recordApiMetric("api.ads.interactive.creatives.get", latency, true);
    logger.error(
      "Failed to list interactive creatives",
      error instanceof Error ? error : new Error(String(error)),
      { correlationId, latencyMs: Number(latency.toFixed(2)) }
    );
    const response = NextResponse.json({ error: "Failed to list creatives" }, { status: 500 });
    response.headers.set("x-correlation-id", correlationId);
    return response;
  }
}

export async function POST(request: NextRequest) {
  const correlationId = ensureCorrelationId(request.headers.get("x-correlation-id"));
  const start = performance.now();
  try {
    const body = await request.json();
    const { type, name, payload } = body ?? {};

    if (!type || !name) {
      return NextResponse.json({ error: "type and name required" }, { status: 400 });
    }

    if (!["quiz", "carousel"].includes(type)) {
      return NextResponse.json({ error: "invalid type" }, { status: 400 });
    }

    const created = await prisma.interactiveCreative.create({ data: { type, name, payload } });

    const latency = performance.now() - start;
    recordApiMetric("api.ads.interactive.creatives.post", latency, false);
    logger.info("Interactive creative created", {
      id: created.id,
      type,
      correlationId,
      latencyMs: Number(latency.toFixed(2)),
    });

    const response = NextResponse.json({ data: created }, { status: 201 });
    response.headers.set("x-correlation-id", correlationId);
    return response;
  } catch (error) {
    const latency = performance.now() - start;
    recordApiMetric("api.ads.interactive.creatives.post", latency, true);
    logger.error(
      "Failed to create interactive creative",
      error instanceof Error ? error : new Error(String(error)),
      { correlationId, latencyMs: Number(latency.toFixed(2)) }
    );
    const response = NextResponse.json({ error: "Failed to create creative" }, { status: 500 });
    response.headers.set("x-correlation-id", correlationId);
    return response;
  }
}
