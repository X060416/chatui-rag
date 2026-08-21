import { NextRequest, NextResponse } from "next/server";
import { RAG_SERVER_URL } from "../_config";

// Proxy RAG query to Python RAG server
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    const res = await fetch(`${RAG_SERVER_URL}/api/rag/query`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    const data = await res.json();

    if (!res.ok) {
      return NextResponse.json(data, { status: res.status });
    }

    return NextResponse.json(data);
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Unknown error";
    console.error("[/api/rag/query] Error:", msg);
    return NextResponse.json(
      { error: `RAG server unreachable: ${msg}` },
      { status: 502 }
    );
  }
}