import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { leadDb } from "@/lib/db";
import { scoreLead } from "@/lib/leadScoring";
import { deliverWithRetries } from "@/lib/leads/delivery";
import { ensureCorrelationId, recordApiMetric } from "@/lib/metrics";
import { logger } from "@/lib/logger";

const DeliverSchema = z.object({
  leadId: z.string().min(1),
  destinationUrl: z.string().url(),
  includeLead: z.boolean().default(true),
  retries: z.number().int().min(0).max(5).default(2),
  timeoutMs: z.number().int().min(100).max(1500).default(800),
});

export async function POST(request: NextRequest) {
  const correlationId = ensureCorrelationId(request.headers.get("x-correlation-id"));
  const start = performance.now();
  try {
    const body = await request.json();
    const validated = DeliverSchema.parse(body);

    const lead = (await leadDb.findById(validated.leadId)) as Awaited<ReturnType<typeof leadDb.findById>> & {
      priceCents?: number;
      explanation?: unknown;
    };

    let priceCents = lead.priceCents ?? 0;
    let score = lead.score ?? 0;
    let tier = lead.tier;
    let modelVersion: string | undefined;
    let pricedLead = lead as typeof lead & { priceCents?: number; explanation?: unknown; score?: number };

    if (!priceCents || priceCents <= 0) {
      const scored = scoreLead({
        source: lead.source,
        tier: lead.tier,
        createdAt: lead.createdAt,
        score: lead.score ?? undefined,
      });
      await leadDb.updateScore(validated.leadId, scored.score, scored.tier, scored.priceCents, scored.explanation);
      priceCents = scored.priceCents;
      score = scored.score;
      tier = scored.tier;
      modelVersion = scored.modelVersion;
      pricedLead = { ...lead, priceCents, score, tier, explanation: JSON.stringify(scored.explanation) };
    }

    const payload = {
      leadId: validated.leadId,
      priceCents,
      tier,
      score,
      modelVersion,
      lead: validated.includeLead ? pricedLead : undefined,
    };

    const delivery = await deliverWithRetries({
      destinationUrl: validated.destinationUrl,
      payload,
      retries: validated.retries,
      timeoutMs: validated.timeoutMs,
      correlationId,
    });

    const latency = performance.now() - start;
    recordApiMetric("api.leads.deliver.post", latency, delivery.status !== "delivered");

    const response = NextResponse.json(
      {
        status: delivery.status,
        leadId: validated.leadId,
        priceCents,
        tier,
        score,
        attempts: delivery.attempts,
        latencyMs: delivery.latencyMs,
      },
      { status: delivery.status === "delivered" ? 201 : 502 }
    );
    response.headers.set("x-correlation-id", correlationId);

    if (delivery.status === "delivered") {
      logger.info("Lead delivered with pricing", {
        leadId: validated.leadId,
        priceCents,
        tier,
        attempts: delivery.attempts,
        correlationId,
        destinationUrl: validated.destinationUrl,
      });
      return response;
    }

    logger.error(
      "Lead delivery failed",
      delivery.lastError instanceof Error ? delivery.lastError : undefined,
      { leadId: validated.leadId, destinationUrl: validated.destinationUrl, attempts: delivery.attempts, correlationId }
    );
    return response;
  } catch (error) {
    const latency = performance.now() - start;
    recordApiMetric("api.leads.deliver.post", latency, true);
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "Validation failed", details: error.issues }, { status: 400 });
    }
    logger.error("Error delivering priced lead", error instanceof Error ? error : new Error(String(error)), { correlationId });
    const response = NextResponse.json({ error: "Internal server error" }, { status: 500 });
    response.headers.set("x-correlation-id", correlationId);
    return response;
  }
}
