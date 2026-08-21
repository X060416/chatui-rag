import { NextResponse } from "next/server";
import { APP_CONFIG } from "../../chat.config";

// Base URL of the Python RAG server (same proxy target as other RAG routes)
const RAG_BASE = "http://localhost:8000";

interface ConnectionPayload {
  id?: string;
  name: string;
  base_url: string;
  api_key?: string;
  model?: string;
  provider?: string;
}

export async function GET() {
  try {
    const res = await fetch(`${RAG_BASE}/api/rag/connections`, {
      method: "GET",
      headers: { "Content-Type": "application/json" },
    });
    if (!res.ok) {
      const text = await res.text();
      return NextResponse.json({ error: text }, { status: res.status });
    }
    return NextResponse.json(await res.json());
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: msg }, { status: 502 });
  }
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as ConnectionPayload;
    const res = await fetch(`${RAG_BASE}/api/rag/connections`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const text = await res.text();
      return NextResponse.json({ error: text }, { status: res.status });
    }
    return NextResponse.json(await res.json());
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: msg }, { status: 502 });
  }
}

export async function PUT(request: Request) {
  try {
    const body = (await request.json()) as ConnectionPayload;
    const { id, ...rest } = body;
    if (!id) {
      return NextResponse.json({ error: "Connection id is required" }, { status: 400 });
    }
    const res = await fetch(`${RAG_BASE}/api/rag/connections/${encodeURIComponent(id)}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(rest),
    });
    if (!res.ok) {
      const text = await res.text();
      return NextResponse.json({ error: text }, { status: res.status });
    }
    return NextResponse.json(await res.json());
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: msg }, { status: 502 });
  }
}

export async function DELETE(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");
    if (!id) {
      return NextResponse.json({ error: "Connection id is required" }, { status: 400 });
    }
    const res = await fetch(`${RAG_BASE}/api/rag/connections/${encodeURIComponent(id)}`, {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
    });
    if (!res.ok) {
      const text = await res.text();
      return NextResponse.json({ error: text }, { status: res.status });
    }
    return NextResponse.json(await res.json());
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: msg }, { status: 502 });
  }
}
