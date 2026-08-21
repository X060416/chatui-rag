import { NextRequest, NextResponse } from "next/server";
import { RAG_SERVER_URL } from "../../../_config";

// GET /api/rag/documents/:docId/download — download the original file
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ docId: string }> }
) {
  try {
    const { docId } = await params;
    const res = await fetch(
      `${RAG_SERVER_URL}/api/rag/documents/${encodeURIComponent(docId)}/download`
    );

    if (!res.ok) {
      const data = await res.json().catch(() => null);
      return NextResponse.json(
        data ?? { error: `Download failed: ${res.status}` },
        { status: res.status }
      );
    }

    const blob = await res.arrayBuffer();
    return new NextResponse(blob, {
      status: 200,
      headers: {
        "Content-Type": res.headers.get("Content-Type") ?? "application/octet-stream",
        "Content-Disposition": res.headers.get("Content-Disposition") ?? "",
        "Content-Length": String(blob.byteLength),
      },
    });
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Unknown error";
    console.error("[/api/rag/documents/:id/download] Error:", msg);
    return NextResponse.json(
      { error: `RAG server unreachable: ${msg}` },
      { status: 502 }
    );
  }
}
