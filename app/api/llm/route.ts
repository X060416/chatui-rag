import { NextResponse } from "next/server";
import { APP_CONFIG } from "../../chat.config";

// ============================================================================
// LLM PROXY ROUTE — Routes to different backends per chatOption (streaming)
// Supports: azure-openai, openai, ollama, custom
// NEW: RAG context injection — queries the Python RAG server before LLM call
// ============================================================================

interface EndpointConfig {
  url: string;
  type: string;
  model?: string;
  stream?: boolean;
}

const RAG_BASE = "http://localhost:8000";

interface EndpointConfigWithKey extends EndpointConfig {
  apiKey?: string;
}

function resolveStaticConfig(chatOption: string): EndpointConfigWithKey | null {
  const raw = APP_CONFIG.endpoints[chatOption];
  if (!raw) return null;

  const keys = APP_CONFIG.apiKeys ?? {};
  const apiKey = keys[chatOption] ?? keys["*"] ?? process.env.LLM_API_KEY ?? undefined;

  if (typeof raw === "string") {
    let type = "openai";
    if (raw.includes("openai.azure.com") || raw.includes("cognitiveservices.azure.com")) {
      type = "azure-openai";
    } else if (raw.includes("11434") || raw.includes("/api/chat") || raw.includes("/api/generate")) {
      type = "ollama";
    }
    return { url: raw, type, apiKey };
  }

  return {
    url: raw.url,
    type: raw.type ?? "openai",
    model: raw.model,
    stream: raw.stream ?? true,
    apiKey,
  };
}

async function resolveDynamicConnection(connId: string): Promise<EndpointConfigWithKey | null> {
  try {
    const res = await fetch(
      `${RAG_BASE}/api/rag/connections/${encodeURIComponent(connId)}?include_key=true`,
      {
        method: "GET",
        headers: { "Content-Type": "application/json" },
      }
    );
    if (!res.ok) return null;
    const conn = await res.json();
    const provider = (conn.provider || "openai").toLowerCase();
    const baseUrl = String(conn.base_url || "").replace(/\/+$/, "");
    if (!baseUrl) return null;
    return {
      url: `${baseUrl}/chat/completions`,
      type: provider,
      model: conn.model || undefined,
      stream: true,
      apiKey: conn.api_key || undefined,
    };
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "Unknown error";
    console.warn("[/api/llm] Failed to resolve dynamic connection:", msg);
    return null;
  }
}

async function resolveEndpointAndKey(chatOption: string): Promise<EndpointConfigWithKey> {
  // 1. Exact static endpoint mapping
  let config = resolveStaticConfig(chatOption);
  // 2. Saved external connection
  if (!config) {
    config = await resolveDynamicConnection(chatOption);
  }
  // 3. Fallback to LM Studio default
  if (!config) {
    config = resolveStaticConfig("lm-studio") || {
      url: "http://localhost:1234/v1/chat/completions",
      type: "openai",
      stream: true,
    };
  }
  return config;
}

interface RagChunkInfo {
  source: string;
  section: string;
  score: number;
}

// NEW: Query RAG server for relevant context
async function queryRagContext(message: string, kbId: string): Promise<{ systemPrompt: string; sources: RagChunkInfo[] } | null> {
  try {
    const res = await fetch("http://localhost:8000/api/rag/query", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        kb_id: kbId,
        query: message,
        top_k: APP_CONFIG.rag?.topK ?? 5,
      }),
    });

    if (!res.ok) {
      console.error("[/api/llm] RAG query failed:", res.status);
      return null;
    }

    const data = await res.json();
    if (data.system_prompt) {
      console.log(`[/api/llm] RAG retrieved ${data.chunk_count} chunks from sources: ${data.sources?.join(", ")}`);
      // Extract per-chunk source details (file name, section, relevance score)
      const rawSources: RagChunkInfo[] = (data.chunks ?? []).map((c: { source: string; section: string; score: number }) => ({
        source: c.source,
        section: c.section,
        score: c.score,
      }));
      // Deduplicate by source file name — keep the highest-scoring chunk per file
      const seen = new Map<string, RagChunkInfo>();
      for (const chunk of rawSources) {
        const existing = seen.get(chunk.source);
        if (!existing || chunk.score > existing.score) {
          seen.set(chunk.source, chunk);
        }
      }
      const sources = Array.from(seen.values());
      return { systemPrompt: data.system_prompt, sources };
    }
    return null;
  } catch (error) {
    console.error("[/api/llm] RAG query error:", error);
    return null;
  }
}

export async function POST(request: Request) {
    const body = await request.json();
    const chatOption = body.chatOption ?? "";
    console.log("[/api/llm] chatOption:", chatOption, "body.model:", body.model);
    const endpointConfig = await resolveEndpointAndKey(chatOption);
    const { url: backendUrl, type: providerType, model, stream: shouldStream = true, apiKey } = endpointConfig;
    console.log("[/api/llm] resolved backend:", backendUrl, "type:", providerType, "model:", model);

  try {
    const headers: Record<string, string> = { "Content-Type": "application/json" };

    if (apiKey && (providerType === "azure-openai" || providerType === "openai")) {
      if (providerType === "azure-openai") {
        headers["api-key"] = apiKey;
      } else {
        headers["Authorization"] = `Bearer ${apiKey}`;
      }
    }

    // Build messages array
    // Content can be a string OR an array (for vision/image messages)
    const messages: Array<{ role: string; content: string | Array<{ type: string; text?: string; image_url?: { url: string } }> }> = [];

    // Determine system prompt (fallback to first chat option if no exact match)
    const chatOptionConfig = APP_CONFIG.chatOptions.find((o: { value: string }) => o.value === chatOption)
      ?? APP_CONFIG.chatOptions[0];
    let systemPrompt = body.systemPrompt || (chatOptionConfig as { systemPrompt?: string })?.systemPrompt || "";

    // NEW: RAG context injection
    // If RAG is enabled for this chat option and a KB is selected, query for context
    const ragConfig = APP_CONFIG.rag;
    let ragSources: RagChunkInfo[] = [];
    if (ragConfig?.enabled && (ragConfig.enabledChatOptions?.includes("*") || ragConfig.enabledChatOptions?.includes(chatOption)) && body.kbId) {
      const ragResult = await queryRagContext(body.message, body.kbId);
      if (ragResult) {
        // Use the RAG system prompt (which includes retrieved context)
        systemPrompt = ragResult.systemPrompt;
        ragSources = ragResult.sources;
      }
    }

    // NEW: Document attachments — inject extracted text into system prompt
    if (Array.isArray(body.docAttachments) && body.docAttachments.length > 0) {
      let docContext = "\n\n--- Attached Documents ---\n";
      for (const doc of body.docAttachments) {
        docContext += `\n[File: ${doc.name}]\n${doc.text}\n`;
      }
      docContext += "--- End of Attached Documents ---\n";
      systemPrompt = (systemPrompt || "You are a helpful assistant.") + docContext;
    }

    if (systemPrompt) {
      messages.push({ role: "system", content: systemPrompt });
    }

    if (Array.isArray(body.history)) {
      for (const msg of body.history) {
        messages.push({ role: msg.role, content: msg.content });
      }
    }

    // Build user message — if images are attached, use OpenAI vision format (content array)
    if (Array.isArray(body.images) && body.images.length > 0) {
      const contentParts: Array<{ type: string; text?: string; image_url?: { url: string } }> = [];
      if (body.message) {
        contentParts.push({ type: "text", text: body.message });
      }
      for (const img of body.images) {
        contentParts.push({ type: "image_url", image_url: { url: img.dataUrl } });
      }
      messages.push({ role: "user", content: contentParts });
    } else {
      messages.push({ role: "user", content: body.message });
    }

    // Build request body based on provider type
    let reqBody: Record<string, unknown>;

    if (providerType === "ollama") {
      reqBody = {
        model: model ?? "llama3",
        messages,
        stream: shouldStream,
      };
    } else {
      // Use model from endpoint config first (external connections store the real
      // model name there; body.model may only be a connection id / chat option id),
      // then fall back to request body or chatOption itself.
      const effectiveModel = model || body.model || chatOption;
      console.log("[/api/llm] effectiveModel:", effectiveModel);
      reqBody = {
        model: effectiveModel,
        messages,
        stream: shouldStream,
      };
    }

    const backendRes = await fetch(backendUrl, {
      method: "POST",
      headers,
      body: JSON.stringify(reqBody),
    });

    if (!backendRes.ok) {
      const errText = await backendRes.text();
      console.error(`[/api/llm] Backend returned ${backendRes.status}:`, errText);
      return NextResponse.json(
        { response: `Backend error (${backendRes.status}): ${errText}` },
        { status: 502 }
      );
    }

    // Non-streaming response
    if (!shouldStream) {
      const data = await backendRes.json();
      let content = "";
      if (providerType === "ollama") {
        content = data.message?.content ?? "";
      } else {
        content = data.choices?.[0]?.message?.content ?? "";
      }
      const ssePayload = `data: ${JSON.stringify({ sources: ragSources })}\n\ndata: ${JSON.stringify({ content })}\n\ndata: [DONE]\n\n`;
      return new Response(ssePayload, {
        headers: { "Content-Type": "text/event-stream", "Cache-Control": "no-cache", Connection: "keep-alive" },
      });
    }

    // Streaming response
    const stream = new ReadableStream({
      async start(controller) {
        // Send RAG sources as the first SSE event so frontend can display file origins
        if (ragSources.length > 0) {
          controller.enqueue(new TextEncoder().encode(
            `data: ${JSON.stringify({ sources: ragSources })}\n\n`
          ));
        }

        const reader = backendRes.body!.getReader();
        const decoder = new TextDecoder();
        let buffer = "";

        try {
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            buffer += decoder.decode(value, { stream: true });

            if (providerType === "ollama") {
              const lines = buffer.split("\n");
              buffer = lines.pop() ?? "";

              for (const line of lines) {
                const trimmed = line.trim();
                if (!trimmed) continue;
                try {
                  const parsed = JSON.parse(trimmed);
                  const content = parsed.message?.content ?? "";
                  if (content) {
                    controller.enqueue(new TextEncoder().encode(`data: ${JSON.stringify({ content })}\n\n`));
                  }
                  if (parsed.done) {
                    controller.enqueue(new TextEncoder().encode("data: [DONE]\n\n"));
                  }
                } catch {
                  // skip malformed
                }
              }
            } else {
              // OpenAI / Azure OpenAI / LM Studio SSE format
              const lines = buffer.split("\n");
              buffer = lines.pop() ?? "";

              for (const line of lines) {
                const trimmed = line.trim();
                if (!trimmed || !trimmed.startsWith("data: ")) continue;
                const data = trimmed.slice(6);
                if (data === "[DONE]") {
                  controller.enqueue(new TextEncoder().encode("data: [DONE]\n\n"));
                  continue;
                }
                try {
                  const parsed = JSON.parse(data);
                  const delta = parsed.choices?.[0]?.delta ?? {};

                  // thinking 内容
                  if (delta.reasoning_content) {
                    controller.enqueue(new TextEncoder().encode(
                      `data: ${JSON.stringify({ thinking: delta.reasoning_content })}\n\n`
                    ));
                  }

                  // 正式回复
                  if (delta.content) {
                    controller.enqueue(new TextEncoder().encode(
                      `data: ${JSON.stringify({ content: delta.content })}\n\n`
                    ));
                  }
                } catch {
                  // skip malformed chunks
                }
              }
            }
          }
        } catch (err) {
          const msg = err instanceof Error ? err.message : "Stream error";
          controller.enqueue(new TextEncoder().encode(`data: ${JSON.stringify({ error: msg })}\n\n`));
        } finally {
          controller.close();
        }
      },
    });

    return new Response(stream, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
      },
    });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "Unknown error";
    console.error(`[/api/llm] Backend unreachable (${backendUrl}):`, msg);

    return NextResponse.json({
      response:
        `Could not reach backend at \`${backendUrl}\`\n` +
        `(chatOption: **${chatOption}**, type: **${providerType}**)\n\n` +
        `Configure endpoints in \`app/chat.config.ts -> endpoints\`\n\n` +
        `Error: ${msg}`,
    });
  }
}
