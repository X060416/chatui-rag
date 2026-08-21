import { NextRequest, NextResponse } from "next/server";
import { RAG_SERVER_URL } from "../_config";

// GET: List documents in a knowledge base
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const kbId = searchParams.get("kbId");

    if (!kbId) {
      return NextResponse.json({ error: "kbId is required" }, { status: 400 });
    }

    const res = await fetch(
      `${RAG_SERVER_URL}/api/rag/documents?kb_id=${encodeURIComponent(kbId)}`
    );
    const data = await res.json();
    return NextResponse.json(data);
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Unknown error";
    console.error("[/api/rag/documents] GET Error:", msg);
    return NextResponse.json(
      { error: `RAG server unreachable: ${msg}` },
      { status: 502 }
    );
  }
}

// DELETE: Delete a document by doc_id
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const docId = searchParams.get("docId");

    if (!docId) {
      return NextResponse.json({ error: "docId is required" }, { status: 400 });
    }

    const res = await fetch(
      `${RAG_SERVER_URL}/api/rag/documents/${docId}`,
      { method: "DELETE" }
    );

    const data = await res.json();
    if (!res.ok) {
      return NextResponse.json(data, { status: res.status });
    }
    return NextResponse.json(data);
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Unknown error";
    console.error("[/api/rag/documents] DELETE Error:", msg);
    return NextResponse.json(
      { error: `RAG server unreachable: ${msg}` },
      { status: 502 }
    );
  }
}
