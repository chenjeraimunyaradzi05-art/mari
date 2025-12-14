import { logger } from "@/lib/logger";
import { prisma } from "@/lib/prisma";

export type DeliveryParams = {
  destinationUrl: string;
  payload: unknown;
  retries?: number;
  timeoutMs?: number;
  correlationId?: string;
  headers?: Record<string, string>;
};

export type DeliveryResult = {
  status: "delivered" | "failed";
  attempts: number;
  latencyMs: number;
  lastError?: unknown;
};

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export async function deliverWithRetries(params: DeliveryParams): Promise<DeliveryResult> {
  const { destinationUrl, payload, retries = 2, timeoutMs = 800, correlationId, headers } = params;
  const start = performance.now();
  let attempt = 0;
  let lastError: unknown;

  while (attempt <= retries) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const res = await fetch(destinationUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...(headers ?? {}) },
        body: JSON.stringify(payload),
        signal: controller.signal,
      });
      if (res.ok) {
        clearTimeout(timer);
        const latencyMs = Number((performance.now() - start).toFixed(2));
        return { status: "delivered", attempts: attempt + 1, latencyMs };
      }
      lastError = new Error(`Non-200: ${res.status}`);
    } catch (err) {
      lastError = err;
    }
    clearTimeout(timer);
    attempt += 1;
    await sleep(Math.min(200 * attempt, 800));
  }

  const latencyMs = Number((performance.now() - start).toFixed(2));
  logger.error(
    "Lead delivery failed after retries",
    lastError instanceof Error ? lastError : undefined,
    {
      destinationUrl,
      attempts: attempt,
      correlationId,
      lastError: lastError instanceof Error ? lastError.message : String(lastError),
    }
  );
  return { status: "failed", attempts: attempt, latencyMs, lastError };
}

export async function deliverLead(leadId: string, webhookUrl: string) {
  const lead = await prisma.lead.findUnique({
    where: { id: leadId },
  });

  if (!lead) {
    throw new Error("Lead not found");
  }

  const payload = {
    id: lead.id,
    firstName: lead.firstName,
    lastName: lead.lastName,
    email: lead.email,
    phone: lead.phone,
    score: lead.score,
    tier: lead.tier,
    type: lead.type,
    data: lead.dataJson ? JSON.parse(lead.dataJson) : {},
    deliveredAt: new Date().toISOString(),
  };

  return deliverWithRetries({
    destinationUrl: webhookUrl,
    payload,
    headers: {
      "X-Moneyman-Event": "lead.delivered",
    },
  });
}
