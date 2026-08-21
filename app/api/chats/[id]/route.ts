import { NextRequest, NextResponse } from "next/server";
import { getChatWithMessages, updateChat, deleteChat, addMessage, deleteMessage } from "../store";

type Params = { params: Promise<{ id: string }> };

// GET /api/chats/[id]?userId=xxx
export async function GET(request: NextRequest, { params }: Params) {
  const userId = request.nextUrl.searchParams.get("userId");
  if (!userId) return NextResponse.json({ error: "userId required" }, { status: 400 });
  const { id } = await params;
  const chat = await getChatWithMessages(userId, id);
  if (!chat) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(chat);
}

// PATCH /api/chats/[id]
export async function PATCH(request: Request, { params }: Params) {
  const { id } = await params;
  const body = await request.json();
  const userId = body.userId;
  if (!userId) return NextResponse.json({ error: "userId required" }, { status: 400 });
  const { userId: _, ...updates } = body;
  const updated = await updateChat(userId, id, updates);
  if (!updated) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(updated);
}

// DELETE /api/chats/[id]?userId=xxx              — delete entire chat
// DELETE /api/chats/[id]?userId=xxx&messageIndex=N — delete a single message
export async function DELETE(request: NextRequest, { params }: Params) {
  const userId = request.nextUrl.searchParams.get("userId");
  if (!userId) return NextResponse.json({ error: "userId required" }, { status: 400 });
  const { id } = await params;
  const messageIndexParam = request.nextUrl.searchParams.get("messageIndex");

  // If messageIndex is provided, delete only that message
  if (messageIndexParam !== null) {
    const messageIndex = parseInt(messageIndexParam, 10);
    if (isNaN(messageIndex)) {
      return NextResponse.json({ error: "Invalid messageIndex" }, { status: 400 });
    }
    const chat = await deleteMessage(userId, id, messageIndex);
    if (!chat) return NextResponse.json({ error: "Not found" }, { status: 404 });
    return NextResponse.json(chat);
  }

  // Otherwise delete the entire chat
  const ok = await deleteChat(userId, id);
  if (!ok) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ ok: true });
}

// POST /api/chats/[id] — add a message
export async function POST(request: Request, { params }: Params) {
  const { id } = await params;
  const body = await request.json();
  const { userId, role, content, thinking, sources, timestamp, attachments } = body;
  if (!userId) return NextResponse.json({ error: "userId required" }, { status: 400 });
  if (!role || !content) {
    return NextResponse.json({ error: "role and content required" }, { status: 400 });
  }
  const chat = await addMessage(userId, id, { role, content, thinking, sources, timestamp, attachments });
  if (!chat) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(chat);
}
