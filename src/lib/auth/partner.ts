import { NextResponse } from "next/server";

export function validatePartnerRequest(req: Request) {
  const apiKey = req.headers.get("x-api-key");
  
  // In a real app, we would check this against a database of partner keys
  // For now, we'll accept a hardcoded mock key or any key starting with "pk_"
  if (!apiKey || !apiKey.startsWith("pk_")) {
    return false;
  }
  
  return true;
}

export function unauthorizedResponse() {
  return NextResponse.json({ error: "Unauthorized: Invalid API Key" }, { status: 401 });
}
