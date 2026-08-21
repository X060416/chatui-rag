import { NextResponse } from "next/server";

// ============================================================================
// EXTRACT PROXY — Extracts text from a document via the Python RAG server.
// Used for chat-level file attachments (not stored in any KB).
// ============================================================================

const RAG_SERVER_URL = "http://localhost:8000";

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const file = formData.get("file");

    if (!file || !(file instanceof File)) {
      return NextResponse.json(
        { error: "No file provided" },
        { status: 400 }
      );
    }

    const forwardData = new FormData();
    forwardData.append("file", file, file.name);

    const res = await fetch(`${RAG_SERVER_URL}/api/rag/extract`, {
      method: "POST",
      body: forwardData,
    });

    if (!res.ok) {
      const text = await res.text();
      console.error("[/api/rag/extract] RAG server returned:", res.status, text);
      return NextResponse.json(
        { error: `RAG server error (${res.status}): ${text}` },
        { status: res.status }
      );
    }

    const data = await res.json();
    return NextResponse.json(data);
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "Unknown error";
    console.error("[/api/rag/extract] Error:", msg);
    return NextResponse.json(
      { error: `Could not reach RAG server: ${msg}` },
      { status: 502 }
    );
  }
}
