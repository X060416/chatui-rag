import { NextRequest, NextResponse } from "next/server";
import { RAG_SERVER_URL } from "../../../_config";

// GET /api/rag/documents/:docId/preview — preview a document's content
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ docId: string }> }
) {
  try {
    const { docId } = await params;
    const res = await fetch(
      `${RAG_SERVER_URL}/api/rag/documents/${encodeURIComponent(docId)}/preview`
    );
    const data = await res.json();
    if (!res.ok) {
      return NextResponse.json(data, { status: res.status });
    }
    return NextResponse.json(data);
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Unknown error";
    console.error("[/api/rag/documents/:id/preview] Error:", msg);
    return NextResponse.json(
      { error: `RAG server unreachable: ${msg}` },
      { status: 502 }
    );
  }
}
