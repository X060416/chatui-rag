import { NextResponse } from "next/server";
import { APP_CONFIG } from "../../chat.config";

// ============================================================================
// MODELS PROXY — Fetches available models from LM Studio + external connections
// ============================================================================

const RAG_BASE = "http://localhost:8000";

export async function GET() {
  let models: { id: string; label: string; object?: string; external?: boolean }[] = [];

  // 1. Statically configured chat options (from chat.config.ts)
  for (const opt of APP_CONFIG.chatOptions) {
    models.push({ id: opt.value, label: opt.label, object: "model" });
  }

  // 2. Fetch live models from LM Studio (if reachable)
  try {
    const baseUrl = APP_CONFIG.endpoints["lm-studio"] && typeof APP_CONFIG.endpoints["lm-studio"] === "object"
      ? (APP_CONFIG.endpoints["lm-studio"] as { url: string }).url.replace("/chat/completions", "")
      : "http://localhost:1234/v1";

    const res = await fetch(`${baseUrl}/models`, {
      method: "GET",
      headers: { "Content-Type": "application/json" },
    });

    if (res.ok) {
      const data = await res.json();
      const lmModels = (data.data ?? [])
        .filter((m: { id: string }) => !/embed/i.test(m.id))
        .map((m: { id: string; object?: string }) => ({
          id: m.id,
          label: m.id,
          object: m.object ?? "model",
        }));
      // Add LM Studio live models, but avoid duplicates of static options
      // (a static option may use value="lm-studio" and label=real model id)
      for (const m of lmModels) {
        if (!models.some((existing) => existing.id === m.id || existing.label === m.id)) {
          models.push(m);
        }
      }
    }
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "Unknown error";
    console.warn("[/api/models] Could not fetch LM Studio models:", msg);
  }

  // 3. Merge saved external connections
  try {
    const connRes = await fetch(`${RAG_BASE}/api/rag/connections`, {
      method: "GET",
      headers: { "Content-Type": "application/json" },
    });
    if (connRes.ok) {
      const connData = await connRes.json();
      const connections = connData.connections ?? [];
      for (const c of connections) {
        const label = `${c.name}${c.model ? ` (${c.model})` : ""}`;
        if (!models.some((existing) => existing.id === c.id)) {
          models.push({ id: c.id, label, object: "model", external: true });
        }
      }
    }
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "Unknown error";
    console.warn("[/api/models] Could not fetch external connections:", msg);
  }

  return NextResponse.json({ models });
}
