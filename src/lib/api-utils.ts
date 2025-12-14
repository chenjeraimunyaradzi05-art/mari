import { NextResponse, NextRequest } from "next/server";

export function createErrorResponse(
  message: string,
  status: number = 400,
  error?: unknown
) {
  console.error(`API Error (${status}):`, message, error);
  return NextResponse.json(
    {
      error: message,
      ...(process.env.NODE_ENV === "development" && { details: error }),
    },
    { status }
  );
}

export function createSuccessResponse(data: unknown, status: number = 200) {
  return NextResponse.json(data, { status });
}

export async function withErrorHandling(
  handler: (req: NextRequest) => Promise<NextResponse>
) {
  return async (req: NextRequest) => {
    try {
      return await handler(req);
    } catch (error) {
      console.error("Unhandled API error:", error);
      return createErrorResponse(
        "Internal Server Error",
        500,
        error instanceof Error ? error.message : "Unknown error"
      );
    }
  };
}
