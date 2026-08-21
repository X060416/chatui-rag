import { NextRequest, NextResponse } from "next/server";
import { getAllChats, createChat } from "./store";

// GET /api/chats?userId=xxx — list all chats for a user
export async function GET(request: NextRequest) {
  const userId = request.nextUrl.searchParams.get("userId");
  if (!userId) return NextResponse.json({ error: "userId required" }, { status: 400 });
  const chats = await getAllChats(userId);
  return NextResponse.json(chats);
}

// POST /api/chats — create a new chat
export async function POST(request: Request) {
  const body = await request.json();
  const userId = body.userId;
  if (!userId) return NextResponse.json({ error: "userId required" }, { status: 400 });
  const chat = await createChat(userId, {
    title: body.title ?? "New Chat",
    project: body.project ?? "",
    mode: body.mode ?? "",
    chatOption: body.chatOption ?? "",
  });
  return NextResponse.json(chat, { status: 201 });
}
