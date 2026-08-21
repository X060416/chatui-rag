import { NextRequest, NextResponse } from "next/server";
import { RAG_SERVER_URL } from "../_config";

// Proxy file upload to Python RAG server
export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get("file") as File | null;
    const kbId = formData.get("kb_id") as string | null;

    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }
    if (!kbId) {
      return NextResponse.json({ error: "kb_id is required" }, { status: 400 });
    }

    // Forward to Python RAG server
    const forwardForm = new FormData();
    forwardForm.append("file", file);
    forwardForm.append("kb_id", kbId);

    const res = await fetch(`${RAG_SERVER_URL}/api/rag/upload`, {
      method: "POST",
      body: forwardForm,
    });

    const data = await res.json();

    if (!res.ok) {
      return NextResponse.json(data, { status: res.status });
    }

    return NextResponse.json(data);
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Unknown error";
    console.error("[/api/rag/upload] Error:", msg);
    return NextResponse.json(
      { error: `RAG server unreachable: ${msg}` },
      { status: 502 }
    );
  }
}
