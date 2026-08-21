import { NextRequest, NextResponse } from "next/server";
import { RAG_SERVER_URL } from "../_config";

// GET: List all knowledge bases
export async function GET() {
  try {
    const res = await fetch(`${RAG_SERVER_URL}/api/rag/kb`);
    const data = await res.json();
    return NextResponse.json(data);
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Unknown error";
    console.error("[/api/rag/kb] GET Error:", msg);
    return NextResponse.json(
      { error: `RAG server unreachable: ${msg}` },
      { status: 502 }
    );
  }
}

// POST: Create a new knowledge base
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    const res = await fetch(`${RAG_SERVER_URL}/api/rag/kb`, {
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
    console.error("[/api/rag/kb] POST Error:", msg);
    return NextResponse.json(
      { error: `RAG server unreachable: ${msg}` },
      { status: 502 }
    );
  }
}

// DELETE: Delete a knowledge base
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const kbId = searchParams.get("kbId");

    if (!kbId) {
      return NextResponse.json({ error: "kbId is required" }, { status: 400 });
    }

    const res = await fetch(`${RAG_SERVER_URL}/api/rag/kb/${kbId}`, {
      method: "DELETE",
    });

    const data = await res.json();
    if (!res.ok) {
      return NextResponse.json(data, { status: res.status });
    }
    return NextResponse.json(data);
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Unknown error";
    console.error("[/api/rag/kb] DELETE Error:", msg);
    return NextResponse.json(
      { error: `RAG server unreachable: ${msg}` },
      { status: 502 }
    );
  }
}

// PATCH: Rename / update a knowledge base
export async function PATCH(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const kbId = searchParams.get("kbId");

    if (!kbId) {
      return NextResponse.json({ error: "kbId is required" }, { status: 400 });
    }

    const body = await request.json();

    const res = await fetch(`${RAG_SERVER_URL}/api/rag/kb/${kbId}`, {
      method: "PATCH",
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
    console.error("[/api/rag/kb] PATCH Error:", msg);
    return NextResponse.json(
      { error: `RAG server unreachable: ${msg}` },
      { status: 502 }
    );
  }
}
