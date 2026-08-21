// File-based chat storage using JSON metadata + MD message files.
//
// Structure (per-user):
//   data/chats/{userId}/index.json    — array of ChatMeta
//   data/chats/{userId}/{id}.md       — markdown file with messages
//
// MD format per message:
//   ## user
//   message content here
//
//   ## assistant
//   response content here

import { readFile, writeFile, unlink, mkdir } from "fs/promises";
import { existsSync } from "fs";
import path from "path";

// ---- Types ----
export interface ChatMeta {
  id: string;
  title: string;
  project: string;
  mode: string;
  chatOption?: string;
  createdAt: number;
  updatedAt: number;
}

export interface MessageSource {
  source: string;
  section: string;
  score: number;
}

export interface Message {
  role: "user" | "assistant";
  content: string;
  timestamp?: number;
  thinking?: string;
  sources?: MessageSource[];
  attachments?: string[];
}

export interface Chat extends ChatMeta {
  messages: Message[];
}

// ---- Paths ----
const DATA_DIR = path.join(process.cwd(), "data", "chats");

function safeUserId(userId: string) {
  return userId.replace(/[^a-zA-Z0-9_-]/g, "");
}

function userDir(userId: string) {
  return path.join(DATA_DIR, safeUserId(userId));
}

function indexPath(userId: string) {
  return path.join(userDir(userId), "index.json");
}

function mdPath(userId: string, id: string) {
  const safe = id.replace(/[^a-zA-Z0-9-]/g, "");
  return path.join(userDir(userId), `${safe}.md`);
}

async function ensureUserDir(userId: string) {
  const dir = userDir(userId);
  if (!existsSync(dir)) {
    await mkdir(dir, { recursive: true });
  }
}

// ---- Index (JSON) ----
async function readIndex(userId: string): Promise<ChatMeta[]> {
  try {
    const raw = await readFile(indexPath(userId), "utf-8");
    return JSON.parse(raw);
  } catch {
    return [];
  }
}

async function writeIndex(userId: string, index: ChatMeta[]) {
  await ensureUserDir(userId);
  await writeFile(indexPath(userId), JSON.stringify(index, null, 2), "utf-8");
}

// ---- Messages (MD) ----
const MSG_SEPARATOR = "\n\n<!-- MSG_SEP -->\n\n";

// Metadata (thinking / sources / timestamp / attachments) is stored as an HTML
// comment on the first line of each message block:
//   ## assistant
//
//   <!-- META {"thinking":"...","sources":[...],"timestamp":123} -->
//
//   content here
function messagesToMd(messages: Message[]): string {
  return messages
    .map((m) => {
      const meta: Record<string, unknown> = {};
      if (m.thinking) meta.thinking = m.thinking;
      if (m.sources && m.sources.length > 0) meta.sources = m.sources;
      if (m.timestamp) meta.timestamp = m.timestamp;
      if (m.attachments && m.attachments.length > 0) meta.attachments = m.attachments;

      const metaLine = Object.keys(meta).length > 0
        ? `<!-- META ${JSON.stringify(meta)} -->\n\n`
        : "";
      return `## ${m.role}\n\n${metaLine}${m.content}`;
    })
    .join(MSG_SEPARATOR);
}

function mdToMessages(md: string): Message[] {
  if (!md.trim()) return [];
  // Split by our unique separator
  const blocks = md.split(MSG_SEPARATOR);
  const messages: Message[] = [];
  for (const block of blocks) {
    const match = block.match(/^## (user|assistant)\n\n([\s\S]*)$/);
    if (match) {
      const role = match[1] as "user" | "assistant";
      const body = match[2];
      const message: Message = { role, content: body.trimEnd() };

      // Parse optional metadata comment on the first line: <!-- META {...} -->
      const firstLineEnd = body.indexOf("\n");
      const firstLine = firstLineEnd === -1 ? body : body.slice(0, firstLineEnd);
      const metaMatch = firstLine.match(/^<!-- META (\{.*\}) -->\s*$/);
      if (metaMatch) {
        try {
          const meta = JSON.parse(metaMatch[1]);
          if (typeof meta.thinking === "string") message.thinking = meta.thinking;
          if (Array.isArray(meta.sources)) message.sources = meta.sources;
          if (typeof meta.timestamp === "number") message.timestamp = meta.timestamp;
          if (Array.isArray(meta.attachments)) message.attachments = meta.attachments;
          // Strip the metadata comment line from the content
          const rest = firstLineEnd === -1 ? "" : body.slice(firstLineEnd + 1);
          message.content = rest.replace(/^\n+/, "").trimEnd();
        } catch {
          // Invalid JSON — treat whole body as plain content
        }
      }
      messages.push(message);
    }
  }
  return messages;
}

async function readMessages(userId: string, id: string): Promise<Message[]> {
  const fp = mdPath(userId, id);
  if (!existsSync(fp)) return [];
  const md = await readFile(fp, "utf-8");
  return mdToMessages(md);
}

async function writeMessages(userId: string, id: string, messages: Message[]) {
  await ensureUserDir(userId);
  await writeFile(mdPath(userId, id), messagesToMd(messages), "utf-8");
}

// ---- Public API ----

export async function getAllChats(userId: string): Promise<ChatMeta[]> {
  const index = await readIndex(userId);
  return index.sort((a, b) => b.updatedAt - a.updatedAt);
}

export async function getChatWithMessages(userId: string, id: string): Promise<Chat | null> {
  const index = await readIndex(userId);
  const meta = index.find((c) => c.id === id);
  if (!meta) return null;
  const messages = await readMessages(userId, id);
  return { ...meta, messages };
}

export async function createChat(userId: string, data: { title: string; project?: string; mode?: string; chatOption?: string }): Promise<Chat> {
  const index = await readIndex(userId);
  const chat: ChatMeta = {
    id: crypto.randomUUID(),
    title: data.title,
    project: data.project ?? "",
    mode: data.mode ?? "",
    chatOption: data.chatOption,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };
  index.push(chat);
  await writeIndex(userId, index);
  await writeMessages(userId, chat.id, []);
  return { ...chat, messages: [] };
}

export async function updateChat(
  userId: string,
  id: string,
  updates: Partial<Pick<ChatMeta, "title" | "project" | "mode" | "chatOption">>
): Promise<ChatMeta | null> {
  const index = await readIndex(userId);
  const i = index.findIndex((c) => c.id === id);
  if (i === -1) return null;
  index[i] = { ...index[i], ...updates, updatedAt: Date.now() };
  await writeIndex(userId, index);
  return index[i];
}

export async function deleteChat(userId: string, id: string): Promise<boolean> {
  const index = await readIndex(userId);
  const filtered = index.filter((c) => c.id !== id);
  if (filtered.length === index.length) return false;
  await writeIndex(userId, filtered);
  const fp = mdPath(userId, id);
  if (existsSync(fp)) await unlink(fp);
  return true;
}

export async function deleteMessage(
  userId: string,
  id: string,
  messageIndex: number
): Promise<Chat | null> {
  const index = await readIndex(userId);
  const i = index.findIndex((c) => c.id === id);
  if (i === -1) return null;

  const messages = await readMessages(userId, id);
  if (messageIndex < 0 || messageIndex >= messages.length) return null;

  messages.splice(messageIndex, 1);
  index[i].updatedAt = Date.now();

  await writeIndex(userId, index);
  await writeMessages(userId, id, messages);

  return { ...index[i], messages };
}

export async function addMessage(
  userId: string,
  id: string,
  message: Message
): Promise<Chat | null> {
  const index = await readIndex(userId);
  const i = index.findIndex((c) => c.id === id);
  if (i === -1) return null;

  const messages = await readMessages(userId, id);
  messages.push(message);

  // Update title from first user message
  if (messages.length === 1 && message.role === "user") {
    index[i].title =
      message.content.length > 40
        ? message.content.substring(0, 40) + "..."
        : message.content;
  }
  index[i].updatedAt = Date.now();

  await writeIndex(userId, index);
  await writeMessages(userId, id, messages);

  return { ...index[i], messages };
}
