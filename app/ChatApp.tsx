"use client";

import { useState, useRef, useEffect, useCallback, type KeyboardEvent, type ChangeEvent } from "react";
import { useRouter } from "next/navigation";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { APP_CONFIG } from "./chat.config";

// ---- Copy Button Component ----
function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  const handleCopy = async () => {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  return (
    <button
      onClick={handleCopy}
      className="opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded hover:bg-gray-700 text-gray-400 hover:text-gray-200"
      title="Copy to clipboard"
    >
      {copied ? (
        <svg className="w-4 h-4 text-green-400" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
        </svg>
      ) : (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="M15.666 3.888A2.25 2.25 0 0013.5 2.25h-3a2.25 2.25 0 00-2.166 1.638m7.332 0c.055.194.084.4.084.612v0a.75.75 0 01-.75.75H9.75a.75.75 0 01-.75-.75v0c0-.212.03-.418.084-.612m7.332 0c.646.049 1.288.11 1.927.184 1.1.128 1.907 1.077 1.907 2.185V19.5a2.25 2.25 0 01-2.25 2.25H6.75A2.25 2.25 0 014.5 19.5V6.257c0-1.108.806-2.057 1.907-2.185a48.208 48.208 0 011.927-.184" />
        </svg>
      )}
    </button>
  );
}

// ---- Code Block with Copy Button ----
function CodeBlock({ children, className }: { children?: React.ReactNode; className?: string }) {
  const [copied, setCopied] = useState(false);
  const codeText = String(children).replace(/\n$/, "");
  const language = className?.replace(/^language-/, "") ?? "";

  const handleCopy = async () => {
    await navigator.clipboard.writeText(codeText);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="relative group/code">
      <div className="flex items-center justify-between bg-[#1a1a2e] rounded-t-lg px-4 py-1.5 text-xs text-gray-400 border-b border-gray-700/50">
        <span>{language}</span>
        <button
          onClick={handleCopy}
          className="flex items-center gap-1 px-2 py-1 rounded hover:bg-gray-700/50 transition-colors text-gray-400 hover:text-gray-200"
        >
          {copied ? (
            <>
              <svg className="w-3.5 h-3.5 text-green-400" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
              </svg>
              Copied!
            </>
          ) : (
            <>
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M15.666 3.888A2.25 2.25 0 0013.5 2.25h-3a2.25 2.25 0 00-2.166 1.638m7.332 0c.055.194.084.4.084.612v0a.75.75 0 01-.75.75H9.75a.75.75 0 01-.75-.75v0c0-.212.03-.418.084-.612m7.332 0c.646.049 1.288.11 1.927.184 1.1.128 1.907 1.077 1.907 2.185V19.5a2.25 2.25 0 01-2.25 2.25H6.75A2.25 2.25 0 014.5 19.5V6.257c0-1.108.806-2.057 1.907-2.185a48.208 48.208 0 011.927-.184" />
              </svg>
              Copy
            </>
          )}
        </button>
      </div>
      <pre className="!mt-0 !rounded-t-none">
        <code className={className}>{children}</code>
      </pre>
    </div>
  );
}

const markdownComponents = {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  code({ className, children, ...props }: any) {
    const isBlock = className?.startsWith("language-");
    if (isBlock) {
      return <CodeBlock className={className}>{children}</CodeBlock>;
    }
    return <code className={className} {...props}>{children}</code>;
  },
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  pre({ children }: any) {
    return <>{children}</>;
  },
};

// ---- Types ----
interface SourceInfo {
  source: string;
  section: string;
  score: number;
}

interface Message {
  role: "user" | "assistant";
  content: string;
  timestamp?: number;
  thinking?: string;
  sources?: SourceInfo[];
  attachments?: string[];
}

interface ChatAttachment {
  id: string;
  name: string;
  type: "image" | "document";
  size: number;
  // For images: base64 data URL
  dataUrl?: string;
  // For documents: extracted text
  extractedText?: string;
  status: "uploading" | "ready" | "error";
}

interface Chat {
  id: string;
  title: string;
  messages: Message[];
  chatOption: string;
  createdAt: number;
  updatedAt: number;
}

interface KnowledgeBase {
  id: string;
  name: string;
  description: string;
  document_count: number;
  chunk_count: number;
  created_at: number;
}

interface KbDocument {
  id: string;
  kb_id: string;
  filename: string;
  file_size: number;
  chunk_count: number;
  created_at: number;
}

interface ExternalConnection {
  id: string;
  name: string;
  base_url: string;
  api_key: string;
  model: string;
  provider: string;
}

const SUGGESTIONS = APP_CONFIG.suggestions;
const CHAT_OPTIONS = APP_CONFIG.chatOptions;
const RAG_CONFIG = APP_CONFIG.rag;

// ---- API Helpers ----
async function apiGetChats(userId: string): Promise<Chat[]> {
  const res = await fetch(`/api/chats?userId=${encodeURIComponent(userId)}`);
  const data = await res.json();
  return data.map((c: Chat) => ({ ...c, messages: c.messages ?? [] }));
}

async function apiGetChat(userId: string, id: string): Promise<Chat> {
  const res = await fetch(`/api/chats/${id}?userId=${encodeURIComponent(userId)}`);
  return res.json();
}

async function apiCreateChat(userId: string, chatOption: string): Promise<Chat> {
  const res = await fetch("/api/chats", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ userId, title: "New Chat", chatOption }),
  });
  return res.json();
}

async function apiDeleteChat(userId: string, id: string): Promise<void> {
  await fetch(`/api/chats/${id}?userId=${encodeURIComponent(userId)}`, { method: "DELETE" });
}

async function apiRenameChat(userId: string, id: string, title: string): Promise<void> {
  await fetch(`/api/chats/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ userId, title }),
  });
}

async function apiAddMessage(
  userId: string,
  chatId: string,
  role: string,
  content: string,
  extra?: { thinking?: string; sources?: SourceInfo[]; timestamp?: number; attachments?: string[] }
): Promise<Chat> {
  const res = await fetch(`/api/chats/${chatId}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ userId, role, content, ...extra }),
  });
  return res.json();
}

async function apiDeleteMessage(userId: string, chatId: string, messageIndex: number): Promise<Chat> {
  const res = await fetch(
    `/api/chats/${chatId}?userId=${encodeURIComponent(userId)}&messageIndex=${messageIndex}`,
    { method: "DELETE" }
  );
  return res.json();
}

async function apiListConnections(): Promise<ExternalConnection[]> {
  const res = await fetch("/api/connections");
  if (!res.ok) return [];
  const data = await res.json();
  return data.connections ?? [];
}

async function apiCreateConnection(conn: Omit<ExternalConnection, "id">): Promise<ExternalConnection | null> {
  const res = await fetch("/api/connections", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(conn),
  });
  if (!res.ok) return null;
  const data = await res.json();
  return data.connection ?? null;
}

async function apiUpdateConnection(conn: ExternalConnection): Promise<ExternalConnection | null> {
  const res = await fetch("/api/connections", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(conn),
  });
  if (!res.ok) return null;
  const data = await res.json();
  return data.connection ?? null;
}

async function apiDeleteConnection(id: string): Promise<boolean> {
  const res = await fetch(`/api/connections?id=${encodeURIComponent(id)}`, { method: "DELETE" });
  return res.ok;
}

// ---- Icon Components ----
function SparkleIcon({ className = "w-4 h-4" }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z"
      />
    </svg>
  );
}

function AssistantAvatar() {
  return (
    <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-full shrink-0 mt-0.5 overflow-hidden">
      <img src={APP_CONFIG.logo} alt={APP_CONFIG.name} className="w-full h-full object-contain" />
    </div>
  );
}

// ---- Confirm Modal Component ----
function ConfirmModal({ title, message, confirmLabel, confirmColor, onConfirm, onCancel }: {
  title: string;
  message: string;
  confirmLabel?: string;
  confirmColor?: string;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/60" onClick={onCancel} />
      <div className="relative bg-sidebar border border-gray-700 rounded-2xl p-6 max-w-sm w-full mx-4 shadow-xl">
        <h3 className="text-lg font-semibold text-white mb-2">{title}</h3>
        <p className="text-sm text-gray-400 mb-5">{message}</p>
        <div className="flex justify-end gap-3">
          <button
            onClick={onCancel}
            className="px-4 py-2 rounded-lg text-sm text-gray-300 hover:bg-hover transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            className={`px-4 py-2 rounded-lg text-sm font-medium text-white transition-colors ${confirmColor ?? "bg-red-600 hover:bg-red-700"}`}
          >
            {confirmLabel ?? "Confirm"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ---- Main Component ----
interface ChatAppProps {
  userId: string;
  displayName: string;
  onLogout: () => void;
}

export default function ChatApp({ userId, displayName, onLogout }: ChatAppProps) {
  const [chats, setChats] = useState<Chat[]>([]);
  const [activeChatId, setActiveChatId] = useState<string | null>(null);
  const [selectedChatOption, setSelectedChatOption] = useState(APP_CONFIG.defaultChatOption);
  const [input, setInput] = useState("");
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [isStreaming, setIsStreaming] = useState(false);
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const [confirmAction, setConfirmAction] = useState<{ type: "delete" | "logout"; chatId?: string } | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  // --- View state: "chat" or "workspace" ---
  const [view, setView] = useState<"chat" | "workspace">("chat");

  // --- RAG / Knowledge Base state ---
  const [knowledgeBases, setKnowledgeBases] = useState<KnowledgeBase[]>([]);
  const [selectedKbId, setSelectedKbId] = useState<string>("");
  const [ragEnabled, setRagEnabled] = useState<boolean>(false);
  const [kbDocuments, setKbDocuments] = useState<KbDocument[]>([]);
  const [uploading, setUploading] = useState(false);
  const [creatingKb, setCreatingKb] = useState(false);
  const [newKbName, setNewKbName] = useState("");
  const [renamingKbId, setRenamingKbId] = useState<string | null>(null);
  const [renameKbValue, setRenameKbValue] = useState("");

  // --- Document preview / download state ---
  const [previewDoc, setPreviewDoc] = useState<KbDocument | null>(null);
  const [previewData, setPreviewData] = useState<{
    type: string;
    text?: string;
    imageUrl?: string;
    charCount?: number;
    truncated?: boolean;
  } | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);

  // --- Models state (fetched from LM Studio) ---
  const [availableModels, setAvailableModels] = useState<{ id: string; label: string }[]>([]);

  // --- External model connections state ---
  const [connections, setConnections] = useState<ExternalConnection[]>([]);
  const [showConnectionsModal, setShowConnectionsModal] = useState(false);
  const [editingConnectionId, setEditingConnectionId] = useState<string | null>(null);
  const [connForm, setConnForm] = useState<ExternalConnection>({
    id: "",
    name: "",
    base_url: "",
    api_key: "",
    model: "",
    provider: "openai",
  });

  // --- Chat attachments state ---
  const [attachments, setAttachments] = useState<ChatAttachment[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const router = useRouter();

  // Fetch knowledge bases on mount
  useEffect(() => {
    if (!RAG_CONFIG?.enabled) return;
    fetchKnowledgeBases();
  }, []);

  // Fetch available models from LM Studio on mount
  useEffect(() => {
    fetchModels();
  }, []);

  // Fetch external model connections on mount
  useEffect(() => {
    fetchConnections();
  }, []);

  async function fetchModels() {
    try {
      const res = await fetch("/api/models");
      if (res.ok) {
        const data = await res.json();
        const models = (data.models ?? []).map((m: { id: string; label?: string }) => ({
          id: m.id,
          label: m.label || m.id,
        }));
        if (models.length > 0) {
          setAvailableModels(models);
          // Auto-select first model if current selection is not in the list
          const currentValid = models.some((m: { id: string }) => m.id === selectedChatOption);
          if (!currentValid) {
            setSelectedChatOption(models[0].id);
          }
        }
      }
    } catch (e) {
      console.error("Failed to fetch models:", e);
    }
  }

  async function fetchConnections() {
    try {
      const conns = await apiListConnections();
      setConnections(conns);
    } catch (e) {
      console.error("Failed to fetch connections:", e);
    }
  }

  // Fetch documents when KB changes in workspace view
  useEffect(() => {
    if (view === "workspace" && selectedKbId) {
      fetchKbDocuments(selectedKbId);
    }
  }, [view, selectedKbId]);

  async function fetchKnowledgeBases() {
    try {
      const res = await fetch(RAG_CONFIG.kbEndpoint);
      if (res.ok) {
        const kbs = await res.json();
        setKnowledgeBases(kbs);
        if (RAG_CONFIG.defaultKbId && !selectedKbId) {
          setSelectedKbId(RAG_CONFIG.defaultKbId);
          setRagEnabled(true);
        }
      }
    } catch (e) {
      console.error("Failed to fetch knowledge bases:", e);
    }
  }

  async function fetchKbDocuments(kbId: string) {
    try {
      const res = await fetch(`${RAG_CONFIG.documentsEndpoint}?kbId=${encodeURIComponent(kbId)}`);
      if (res.ok) {
        setKbDocuments(await res.json());
      }
    } catch (e) {
      console.error("Failed to fetch documents:", e);
    }
  }

  async function createKnowledgeBase() {
    if (!newKbName.trim()) return;
    try {
      const res = await fetch(RAG_CONFIG.kbEndpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newKbName.trim(), description: "" }),
      });
      if (res.ok) {
        const kb = await res.json();
        setKnowledgeBases((prev) => [...prev, kb]);
        setSelectedKbId(kb.id);
        setNewKbName("");
        setCreatingKb(false);
        setRagEnabled(true);
      }
    } catch (e) {
      console.error("Failed to create KB:", e);
    }
  }

  async function deleteKnowledgeBase(kbId: string) {
    try {
      await fetch(`${RAG_CONFIG.kbEndpoint}?kbId=${encodeURIComponent(kbId)}`, { method: "DELETE" });
      setKnowledgeBases((prev) => prev.filter((kb) => kb.id !== kbId));
      if (selectedKbId === kbId) {
        setSelectedKbId("");
        setRagEnabled(false);
        setKbDocuments([]);
      }
    } catch (e) {
      console.error("Failed to delete KB:", e);
    }
  }

  function startRenameKb(kbId: string, currentName: string) {
    setRenamingKbId(kbId);
    setRenameKbValue(currentName);
  }

  async function commitRenameKb() {
    if (!renamingKbId) return;
    const trimmed = renameKbValue.trim();
    if (trimmed) {
      try {
        const res = await fetch(`${RAG_CONFIG.kbEndpoint}?kbId=${encodeURIComponent(renamingKbId)}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name: trimmed }),
        });
        if (res.ok) {
          const updated = await res.json();
          setKnowledgeBases((prev) =>
            prev.map((kb) => (kb.id === renamingKbId ? { ...kb, name: updated.name } : kb))
          );
        }
      } catch (e) {
        console.error("Failed to rename KB:", e);
      }
    }
    setRenamingKbId(null);
    setRenameKbValue("");
  }

  async function deleteKbDocument(docId: string) {
    try {
      await fetch(`${RAG_CONFIG.documentsEndpoint}?docId=${encodeURIComponent(docId)}`, { method: "DELETE" });
      setKbDocuments((prev) => prev.filter((doc) => doc.id !== docId));
      fetchKnowledgeBases();
    } catch (e) {
      console.error("Failed to delete document:", e);
    }
  }

  async function uploadFileToKb(file: File) {
    if (!selectedKbId) {
      alert("Please select or create a knowledge base first.");
      return;
    }
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("kb_id", selectedKbId);

      const res = await fetch(RAG_CONFIG.uploadEndpoint, {
        method: "POST",
        body: formData,
      });

      if (res.ok) {
        fetchKbDocuments(selectedKbId);
        fetchKnowledgeBases();
      } else {
        const err = await res.json().catch(() => null);
        alert(`Upload failed: ${err?.detail ?? res.statusText}`);
      }
    } catch (e) {
      console.error("Upload error:", e);
      alert("Upload failed. Is the RAG server running?");
    } finally {
      setUploading(false);
    }
  }

  function formatFileSize(bytes: number): string {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }

  // --- Document preview & download ---
  async function handlePreview(doc: KbDocument) {
    setPreviewDoc(doc);
    setPreviewData(null);
    setPreviewLoading(true);
    try {
      const res = await fetch(`${RAG_CONFIG.documentsEndpoint}/${encodeURIComponent(doc.id)}/preview`);
      if (!res.ok) {
        const err = await res.json().catch(() => null);
        const detail: string = err?.detail ?? err?.error ?? `Preview failed (${res.status})`;
        const friendly =
          detail.includes("Original file not found")
            ? "该文件是旧版上传的，没有保留原始文件。请删除后重新上传，即可预览和下载。"
            : detail;
        setPreviewData({ type: "error", text: friendly });
      } else {
        setPreviewData(await res.json());
      }
    } catch (e) {
      console.error("Preview error:", e);
      setPreviewData({ type: "error", text: "Preview failed. Is the RAG server running?" });
    } finally {
      setPreviewLoading(false);
    }
  }

  function handleDownload(doc: KbDocument) {
    const url = `${RAG_CONFIG.documentsEndpoint}/${encodeURIComponent(doc.id)}/download`;
    // Use fetch -> blob so we can set the original filename and show errors
    fetch(url)
      .then(async (res) => {
        if (!res.ok) {
          const err = await res.json().catch(() => null);
          alert(`Download failed: ${err?.error ?? err?.detail ?? res.statusText}`);
          return;
        }
        const blob = await res.blob();
        const objectUrl = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = objectUrl;
        a.download = doc.filename;
        document.body.appendChild(a);
        a.click();
        a.remove();
        setTimeout(() => URL.revokeObjectURL(objectUrl), 5000);
      })
      .catch((e) => {
        console.error("Download error:", e);
        alert("Download failed. Is the RAG server running?");
      });
  }

  function closePreview() {
    setPreviewDoc(null);
    setPreviewData(null);
  }

  // --- External model connection handlers ---
  function resetConnForm(conn?: ExternalConnection) {
    if (conn) {
      setEditingConnectionId(conn.id);
      setConnForm({ ...conn });
    } else {
      setEditingConnectionId(null);
      setConnForm({ id: "", name: "", base_url: "", api_key: "", model: "", provider: "openai" });
    }
  }

  async function saveConnection() {
    const payload = {
      name: connForm.name,
      base_url: connForm.base_url,
      api_key: connForm.api_key,
      model: connForm.model,
      provider: connForm.provider,
    };

    let ok = false;
    if (editingConnectionId) {
      const updated = await apiUpdateConnection({ ...payload, id: editingConnectionId });
      ok = !!updated;
    } else {
      const created = await apiCreateConnection(payload);
      ok = !!created;
    }

    if (ok) {
      resetConnForm();
      await fetchConnections();
      await fetchModels();
    } else {
      alert("Failed to save connection.");
    }
  }

  async function removeConnection(id: string) {
    if (!confirm("Delete this connection?")) return;
    if (await apiDeleteConnection(id)) {
      await fetchConnections();
      await fetchModels();
      // Reset selection if the deleted connection was selected
      if (selectedChatOption === id) {
        const first = availableModels.find((m) => m.id !== id);
        if (first) setSelectedChatOption(first.id);
      }
    } else {
      alert("Failed to delete connection.");
    }
  }

  // --- Chat attachment handlers ---
  const IMAGE_EXTENSIONS = [".png", ".jpg", ".jpeg", ".gif", ".webp", ".bmp"];
  const DOC_EXTENSIONS = [".pdf", ".docx", ".doc", ".pptx", ".ppt", ".xlsx", ".xls", ".csv", ".md", ".txt", ".html", ".htm", ".json", ".xml", ".py", ".js", ".ts", ".java", ".go", ".rs", ".cpp", ".c", ".h", ".cs", ".rb", ".php", ".swift", ".kt", ".sh", ".sql"];

  function handleFileSelect(e: ChangeEvent<HTMLInputElement>) {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    for (const file of Array.from(files)) {
      addAttachment(file);
    }
    // Reset input so same file can be selected again
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  async function addAttachment(file: File) {
    const ext = "." + file.name.split(".").pop()?.toLowerCase();
    const isImage = IMAGE_EXTENSIONS.includes(ext);
    const isDoc = DOC_EXTENSIONS.includes(ext);
    if (!isImage && !isDoc) {
      alert(`Unsupported file type: ${ext}\nSupported: images (png, jpg, gif, webp) and documents (pdf, docx, txt, md, code, etc.)`);
      return;
    }

    const id = `att-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const attachment: ChatAttachment = {
      id,
      name: file.name,
      type: isImage ? "image" : "document",
      size: file.size,
      status: "uploading",
    };
    setAttachments((prev) => [...prev, attachment]);

    try {
      if (isImage) {
        // Convert image to base64 data URL
        const dataUrl = await fileToBase64(file);
        setAttachments((prev) => prev.map((a) => a.id === id ? { ...a, dataUrl, status: "ready" } : a));
      } else {
        // Extract text from document via RAG server
        const formData = new FormData();
        formData.append("file", file);
        const res = await fetch("/api/rag/extract", {
          method: "POST",
          body: formData,
        });
        if (!res.ok) {
          const err = await res.json().catch(() => null);
          throw new Error(err?.error ?? `Server error (${res.status})`);
        }
        const data = await res.json();
        setAttachments((prev) => prev.map((a) => a.id === id ? { ...a, extractedText: data.text, status: "ready" } : a));
      }
    } catch (e) {
      console.error("Attachment error:", e);
      setAttachments((prev) => prev.map((a) => a.id === id ? { ...a, status: "error" } : a));
      alert(`Failed to process ${file.name}: ${e instanceof Error ? e.message : "Unknown error"}`);
    }
  }

  function removeAttachment(id: string) {
    setAttachments((prev) => prev.filter((a) => a.id !== id));
  }

  function fileToBase64(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Load from API on mount
  useEffect(() => {
    apiGetChats(userId).then((stored) => {
      setChats(stored);
      if (stored.length > 0) {
        setActiveChatId(stored[0].id);
        apiGetChat(userId, stored[0].id).then((full) => {
          setChats((prev) => prev.map((c) => (c.id === full.id ? full : c)));
        });
      }
    });
  }, [userId]);

  const activeChat = chats.find((c) => c.id === activeChatId) ?? null;
  const isNewChat = !activeChat || (activeChat.messages ?? []).length === 0;
  const sortedChats = [...chats].sort((a, b) => b.updatedAt - a.updatedAt);

  const ragAvailable = RAG_CONFIG?.enabled && (RAG_CONFIG.enabledChatOptions?.includes("*") || RAG_CONFIG.enabledChatOptions?.includes(selectedChatOption));

  const scrollToBottom = useCallback(() => {
    requestAnimationFrame(() => {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    });
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [activeChat?.messages?.length, isStreaming, scrollToBottom]);

  // ---- Chat CRUD ----
  async function createNewChat() {
    setView("chat");
    const chat = await apiCreateChat(userId, selectedChatOption);
    setChats((prev) => [chat, ...prev]);
    setActiveChatId(chat.id);
    textareaRef.current?.focus();
  }

  async function loadChatById(id: string) {
    setView("chat");
    setActiveChatId(id);
    const existing = chats.find((c) => c.id === id);
    if (existing?.chatOption) {
      setSelectedChatOption(existing.chatOption);
    }
    if (!existing?.messages || existing.messages.length === 0) {
      const full = await apiGetChat(userId, id);
      setChats((prev) => prev.map((c) => (c.id === id ? full : c)));
      if (full.chatOption) {
        setSelectedChatOption(full.chatOption);
      }
    }
  }

  async function deleteChatById(id: string) {
    await apiDeleteChat(userId, id);
    const next = chats.filter((c) => c.id !== id);
    setChats(next);
    if (activeChatId === id) {
      setActiveChatId(next.length > 0 ? next[0].id : null);
    }
  }

  async function deleteMessageById(chatId: string, messageIndex: number) {
    const updated = await apiDeleteMessage(userId, chatId, messageIndex);
    setChats((prev) =>
      prev.map((c) => (c.id === chatId ? { ...c, messages: updated.messages ?? [] } : c))
    );
  }

  function startRename(id: string, currentTitle: string) {
    setRenamingId(id);
    setRenameValue(currentTitle);
  }

  async function commitRename() {
    if (!renamingId) return;
    const trimmed = renameValue.trim();
    if (trimmed) {
      await apiRenameChat(userId, renamingId, trimmed);
      setChats((prev) =>
        prev.map((c) => (c.id === renamingId ? { ...c, title: trimmed } : c))
      );
    }
    setRenamingId(null);
    setRenameValue("");
  }

  // ---- Send Message ----
  async function sendMessage(text?: string) {
    const content = (text ?? input).trim();
    if (!content && attachments.length === 0) return;
    // Block sending if any attachment is still uploading
    if (attachments.some((a) => a.status === "uploading")) {
      alert("Please wait for file(s) to finish uploading.");
      return;
    }

    // Collect attachment info for the message
    const attachmentNames = attachments.filter((a) => a.status === "ready").map((a) => a.name);
    // Build the display content (what the user sees in chat)
    const displayContent = attachmentNames.length > 0
      ? `${content}\n\n📎 Attached: ${attachmentNames.join(", ")}`
      : content;

    let chatId = activeChatId;

    if (!chatId) {
      const newChat = await apiCreateChat(userId, selectedChatOption);
      setChats((prev) => [newChat, ...prev]);
      chatId = newChat.id;
      setActiveChatId(chatId);
    }

    setChats((prev) =>
      prev.map((c) => {
        if (c.id !== chatId) return c;
        const isFirst = (c.messages ?? []).length === 0;
        const title = isFirst
            ? content.length > 40
              ? content.substring(0, 40) + "..."
              : content
            : c.title;
        return {
          ...c,
          title,
          chatOption: isFirst ? selectedChatOption : c.chatOption,
          messages: [...(c.messages ?? []), { role: "user" as const, content: displayContent, timestamp: Date.now(), attachments: attachmentNames }],
          updatedAt: Date.now(),
        };
      })
    );
    setInput("");
    setAttachments([]);

    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
    }

    const existingChat = chats.find((c) => c.id === chatId);
    if (existingChat && (existingChat.messages ?? []).length === 0 && existingChat.chatOption !== selectedChatOption) {
      await fetch(`/api/chats/${chatId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, chatOption: selectedChatOption }),
      });
    }

    const updatedChat = await apiAddMessage(userId, chatId, "user", content, {
      timestamp: Date.now(),
      attachments: attachmentNames.length > 0 ? attachmentNames : undefined,
    });
    setChats((prev) => prev.map((c) => {
      if (c.id !== chatId) return c;
      const mergedMessages = (updatedChat.messages ?? []).map((msg: Message, idx: number) => ({
        ...msg,
        timestamp: c.messages?.[idx]?.timestamp ?? msg.timestamp,
        // Preserve assistant message metadata that might not be in the persisted response
        thinking: msg.role === "assistant" ? (msg.thinking ?? c.messages?.[idx]?.thinking) : undefined,
        sources: msg.role === "assistant" ? (msg.sources ?? c.messages?.[idx]?.sources) : undefined,
        attachments: msg.role === "user" ? (msg.attachments ?? c.messages?.[idx]?.attachments) : undefined,
      }));
      return { ...updatedChat, chatOption: selectedChatOption, messages: mergedMessages };
    }));

    try {
      setChats((prev) =>
        prev.map((c) => {
          if (c.id !== chatId) return c;
          return {
            ...c,
            messages: [...(c.messages ?? []), { role: "assistant" as const, content: "", timestamp: Date.now() }],
          };
        })
      );

      const abortController = new AbortController();
      abortControllerRef.current = abortController;
      setIsStreaming(true);

      const requestBody: Record<string, unknown> = {
        message: content,
        chatOption: selectedChatOption,
        model: selectedChatOption,
        history: activeChat?.messages ?? [],
      };

      // Add attachments to the request
      const readyAttachments = attachments.filter((a) => a.status === "ready");
      if (readyAttachments.length > 0) {
        // Images: send as base64 for vision models
        const images = readyAttachments
          .filter((a) => a.type === "image" && a.dataUrl)
          .map((a) => ({ name: a.name, dataUrl: a.dataUrl }));
        // Documents: send extracted text as context
        const docTexts = readyAttachments
          .filter((a) => a.type === "document" && a.extractedText)
          .map((a) => ({ name: a.name, text: a.extractedText }));

        if (images.length > 0) requestBody.images = images;
        if (docTexts.length > 0) requestBody.docAttachments = docTexts;
      }

      if (ragAvailable && ragEnabled && selectedKbId) {
        requestBody.kbId = selectedKbId;
      }

      const llmRes = await fetch(APP_CONFIG.llmEndpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(requestBody),
        signal: abortControllerRef.current?.signal,
      });

      if (!llmRes.ok) {
        const errData = await llmRes.json().catch(() => null);
        const errMsg = errData?.response ?? `Backend error (${llmRes.status})`;
        setChats((prev) =>
          prev.map((c) => {
            if (c.id !== chatId) return c;
            const msgs = [...(c.messages ?? [])];
            msgs[msgs.length - 1] = { role: "assistant", content: `⚠️ ${errMsg}` };
            return { ...c, messages: msgs };
          })
        );
        await apiAddMessage(userId, chatId!, "assistant", `⚠️ ${errMsg}`);
        return;
      }

      const reader = llmRes.body!.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let fullThinking = "";  // 新增一个变量
      let fullReply = "";
      let msgSources: SourceInfo[] = [];

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed || !trimmed.startsWith("data: ")) continue;
          const data = trimmed.slice(6);
          if (data === "[DONE]") continue;
          try {
            const parsed = JSON.parse(data);
            if (parsed.error) {
              fullReply += `\n⚠️ ${parsed.error}`;
            } else if (parsed.sources) {
              msgSources = parsed.sources as SourceInfo[];
            } else if (parsed.thinking) {
                fullThinking += parsed.thinking;  // 新增一个变量
            } else if (parsed.content) {
                fullReply += parsed.content;
            }
          } catch {
            continue;
          }
        }

        const currentReply = fullReply;
        setChats((prev) =>
          prev.map((c) => {
            if (c.id !== chatId) return c;
            const msgs = [...(c.messages ?? [])];
            msgs[msgs.length - 1] = { role: "assistant", content: currentReply, thinking: fullThinking, sources: msgSources.length > 0 ? msgSources : undefined, timestamp: msgs[msgs.length - 1]?.timestamp };
            return { ...c, messages: msgs };
          })
        );
      }

      setIsStreaming(false);
      abortControllerRef.current = null;
      const withReply = await apiAddMessage(userId, chatId!, "assistant", fullReply || "No response from backend.", {
        thinking: fullThinking || undefined,
        sources: msgSources.length > 0 ? msgSources : undefined,
        timestamp: Date.now(),
      });
      setChats((prev) => prev.map((c) => {
        if (c.id !== chatId) return c;
        const mergedMessages = (withReply.messages ?? []).map((msg: Message, idx: number) => ({
          ...msg,
          timestamp: c.messages?.[idx]?.timestamp ?? msg.timestamp,
          thinking: c.messages?.[idx]?.thinking,
          sources: c.messages?.[idx]?.sources,
        }));
        return { ...withReply, chatOption: c.chatOption, messages: mergedMessages };
      }));
    } catch (err) {
      setIsStreaming(false);
      abortControllerRef.current = null;

      if (err instanceof DOMException && err.name === "AbortError") {
        const currentChats = chats;
        const currentChat = currentChats.find((c) => c.id === chatId);
        const lastMsg = currentChat?.messages?.[currentChat.messages.length - 1];
        const partialContent = lastMsg?.role === "assistant" ? lastMsg.content : "";
        if (partialContent) {
          const withPartial = await apiAddMessage(userId, chatId!, "assistant", partialContent + "\n\n*— Generation stopped*", {
            thinking: lastMsg?.thinking,
            sources: lastMsg?.sources,
            timestamp: Date.now(),
          });
          setChats((prev) => prev.map((c) => {
            if (c.id !== chatId) return c;
            const msgs = [...(c.messages ?? [])];
            msgs[msgs.length - 1] = {
              role: "assistant",
              content: partialContent + "\n\n*— Generation stopped*",
              thinking: lastMsg?.thinking,
              sources: lastMsg?.sources,
              timestamp: msgs[msgs.length - 1]?.timestamp,
            };
            return { ...c, messages: msgs };
          }));
        }
        return;
      }

      const errMsg = err instanceof Error ? err.message : "Unknown error";
      const withErr = await apiAddMessage(userId, chatId!, "assistant", `⚠️ Error: ${errMsg}`);
      setChats((prev) => prev.map((c) => {
        if (c.id !== chatId) return c;
        const mergedMessages = (withErr.messages ?? []).map((msg: Message, idx: number) => ({
          ...msg,
          timestamp: c.messages?.[idx]?.timestamp ?? msg.timestamp,
        }));
        return { ...withErr, chatOption: c.chatOption, messages: mergedMessages };
      }));
    }
  }

  // ---- Input Handling ----
  function handleKeyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  }

  function handleInput(e: ChangeEvent<HTMLTextAreaElement>) {
    setInput(e.target.value);
    const el = e.target;
    el.style.height = "auto";
    el.style.height = Math.min(el.scrollHeight, 200) + "px";
  }

  function handleFileDrop(e: React.DragEvent) {
    e.preventDefault();
    const files = Array.from(e.dataTransfer.files);
    if (files.length > 0 && selectedKbId) {
      files.forEach(uploadFileToKb);
    }
  }

  return (
    <div className="flex h-screen bg-main text-white overflow-hidden">
      {/* Sidebar Backdrop (mobile) */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-20 md:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}
      {/* Sidebar */}
      <aside
        className={`w-64 bg-sidebar flex flex-col h-full shrink-0 transition-transform duration-200 fixed md:relative z-30 ${
          sidebarOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        {/* Logo */}
        <div className="px-4 pt-4 pb-2 flex items-center gap-2.5">
          <img src={APP_CONFIG.logo} alt={APP_CONFIG.name} className="w-12 h-12 shrink-0" />
          <span className="text-lg font-semibold text-gray-200 truncate">{APP_CONFIG.name}</span>
        </div>

        {/* New Chat */}
        <div className="p-3 pt-1">
          <button
            onClick={createNewChat}
            className="w-full flex items-center gap-2 px-3 py-2.5 rounded-lg hover:bg-hover text-sm text-gray-200 transition-colors border border-gray-700"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
            </svg>
            New Chat
          </button>
        </div>

        {/* Chat List */}
        <div className="flex-1 overflow-y-auto scrollbar-thin px-2 space-y-0.5">
          {sortedChats.map((chat) => (
            <button
              key={chat.id}
              onClick={() => loadChatById(chat.id)}
              onDoubleClick={(e) => {
                e.preventDefault();
                startRename(chat.id, chat.title);
              }}
              className={`w-full group flex items-center justify-between gap-2 px-3 py-2 rounded-lg text-sm truncate transition-colors ${
                chat.id === activeChatId && view === "chat"
                  ? "bg-hover text-white"
                  : "text-gray-400 hover:bg-hover hover:text-gray-200"
              }`}
            >
              {renamingId === chat.id ? (
                <input
                  autoFocus
                  value={renameValue}
                  onChange={(e) => setRenameValue(e.target.value)}
                  onBlur={commitRename}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") commitRename();
                    if (e.key === "Escape") { setRenamingId(null); setRenameValue(""); }
                  }}
                  onClick={(e) => e.stopPropagation()}
                  className="flex-1 min-w-0 bg-transparent text-white text-sm outline-none border-b border-gray-500"
                />
              ) : (
                <span className="truncate">{chat.title}</span>
              )}
              {renamingId !== chat.id && (
                <div className="flex md:hidden md:group-hover:flex items-center gap-0.5 shrink-0">
                  <span
                    onClick={(e) => {
                      e.stopPropagation();
                      startRename(chat.id, chat.title);
                    }}
                    className="p-1 rounded hover:bg-gray-600/30 text-gray-600 hover:text-gray-300 transition-colors"
                  >
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="m16.862 4.487 1.687-1.688a1.875 1.875 0 1 1 2.652 2.652L6.832 19.82a4.5 4.5 0 0 1-1.897 1.13l-2.685.8.8-2.685a4.5 4.5 0 0 1 1.13-1.897L16.863 4.487Zm0 0L19.5 7.125"
                      />
                    </svg>
                  </span>
                  <span
                    onClick={(e) => {
                      e.stopPropagation();
                      setConfirmAction({ type: "delete", chatId: chat.id });
                    }}
                    className="p-1 rounded hover:bg-red-500/20 hover:text-red-400 text-gray-600 transition-colors"
                  >
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="m14.74 9-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 0 1-2.244 2.077H8.084a2.25 2.25 0 0 1-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 0 0-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 0 1 3.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 0 0-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 0 0-7.5 0"
                      />
                    </svg>
                  </span>
                </div>
              )}
            </button>
          ))}
        </div>

        {/* Sidebar Footer */}
        <div className="p-3 border-t border-gray-800">
          {/* Workspace Button — like Open WebUI */}
          {RAG_CONFIG?.enabled && (
            <button
              onClick={() => setView(view === "workspace" ? "chat" : "workspace")}
              className={`w-full flex items-center gap-2 px-3 py-2 mb-2 rounded-lg text-sm transition-colors border ${
                view === "workspace"
                  ? "bg-accent/10 text-accent border-accent/30"
                  : "text-gray-300 hover:bg-hover border-gray-700"
              }`}
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.042A8.967 8.967 0 0 0 6 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 0 1 6 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 0 1 6-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0 0 18 18a8.967 8.967 0 0 0-6 2.292m0-14.25v14.25" />
              </svg>
              Workspace
              {selectedKbId && view === "chat" && (
                <span className="ml-auto text-xs text-accent bg-accent/10 px-1.5 py-0.5 rounded">
                  {knowledgeBases.find((kb) => kb.id === selectedKbId)?.name ?? "Active"}
                </span>
              )}
            </button>
          )}
          <button
            onClick={() => {
              setShowConnectionsModal(true);
              fetchConnections();
            }}
            className="w-full flex items-center gap-2 px-3 py-2 mb-2 rounded-lg text-sm transition-colors border text-gray-300 hover:bg-hover border-gray-700"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 10.5V6.75a4.5 4.5 0 1 1 9 0v3.75M3.75 21.75h10.5a2.25 2.25 0 0 0 2.25-2.25v-6.75a2.25 2.25 0 0 0-2.25-2.25H3.75a2.25 2.25 0 0 0-2.25 2.25v6.75a2.25 2.25 0 0 0 2.25 2.25Z" />
            </svg>
            外部连接
          </button>
          <div className="flex items-center gap-2 px-2 py-1.5">
            <div className="w-7 h-7 rounded-full bg-shell-red/20 flex items-center justify-center text-shell-yellow text-xs font-bold uppercase shrink-0">
              {displayName.charAt(0)}
            </div>
            <span className="text-sm text-gray-300 truncate flex-1">{displayName}</span>
            <button
              onClick={() => setConfirmAction({ type: "logout" })}
              title="Logout"
              className="p-1.5 rounded-lg hover:bg-hover text-gray-500 hover:text-gray-300 transition-colors"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 9V5.25A2.25 2.25 0 0 0 13.5 3h-6a2.25 2.25 0 0 0-2.25 2.25v13.5A2.25 2.25 0 0 0 7.5 21h6a2.25 2.25 0 0 0 2.25-2.25V15m3-3h-9m9 0-3-3m3 3-3 3" />
              </svg>
            </button>
          </div>
        </div>
      </aside>

      {/* ====== WORKSPACE VIEW ====== */}
      {view === "workspace" ? (
        <main className="flex-1 flex flex-col h-full min-w-0">
          {/* Workspace Header */}
          <header className="flex items-center gap-3 px-6 py-4 border-b border-gray-800/50">
            <button
              onClick={() => setView("chat")}
              className="p-1.5 rounded-lg hover:bg-hover transition-colors text-gray-400"
              title="Back to Chat"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 15L3 12m0 0l6-3m-6 3h18" />
              </svg>
            </button>
            <svg className="w-5 h-5 text-accent" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.042A8.967 8.967 0 0 0 6 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 0 1 6 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 0 1 6-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0 0 18 18a8.967 8.967 0 0 0-6 2.292m0-14.25v14.25" />
            </svg>
            <h1 className="text-lg font-semibold text-gray-100">Workspace</h1>
            <span className="text-xs text-gray-500 bg-gray-800 rounded-md px-2 py-0.5">Knowledge Bases</span>
          </header>

          {/* Workspace Content: Two-panel layout */}
          <div className="flex-1 flex overflow-hidden">
            {/* Left Panel: KB List */}
            <div className="w-72 border-r border-gray-800/50 flex flex-col">
              <div className="p-4">
                {creatingKb ? (
                  <div className="flex gap-2">
                    <input
                      autoFocus
                      value={newKbName}
                      onChange={(e) => setNewKbName(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") createKnowledgeBase();
                        if (e.key === "Escape") { setCreatingKb(false); setNewKbName(""); }
                      }}
                      placeholder="Knowledge base name..."
                      className="flex-1 bg-input text-white text-sm border border-gray-600 rounded-lg px-3 py-2 outline-none focus:border-accent"
                    />
                    <button
                      onClick={createKnowledgeBase}
                      className="px-3 py-2 rounded-lg bg-accent text-white text-sm font-medium hover:opacity-90"
                    >
                      Create
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={() => setCreatingKb(true)}
                    className="w-full flex items-center justify-center gap-2 px-3 py-2.5 rounded-lg border border-gray-700 hover:bg-hover text-sm text-gray-300 transition-colors"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                    </svg>
                    Create New Knowledge Base
                  </button>
                )}
              </div>

              <div className="flex-1 overflow-y-auto scrollbar-thin px-2 pb-2 space-y-1">
                {knowledgeBases.length === 0 && !creatingKb && (
                  <div className="text-center py-12 px-4">
                    <svg className="w-12 h-12 text-gray-700 mx-auto mb-3" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.042A8.967 8.967 0 0 0 6 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 0 1 6 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 0 1 6-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0 0 18 18a8.967 8.967 0 0 0-6 2.292m0-14.25v14.25" />
                    </svg>
                    <p className="text-sm text-gray-500">No knowledge bases yet</p>
                    <p className="text-xs text-gray-600 mt-1">Create one to get started</p>
                  </div>
                )}
                {knowledgeBases.map((kb) => (
                  <div
                    key={kb.id}
                    className={`w-full text-left p-3 rounded-lg transition-colors border ${
                      selectedKbId === kb.id
                        ? "border-accent bg-accent/5"
                        : "border-gray-700/50 hover:border-gray-600 hover:bg-hover"
                    } group/kb`}
                  >
                    {renamingKbId === kb.id ? (
                      <div className="flex gap-1.5">
                        <input
                          autoFocus
                          value={renameKbValue}
                          onChange={(e) => setRenameKbValue(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") commitRenameKb();
                            if (e.key === "Escape") { setRenamingKbId(null); setRenameKbValue(""); }
                          }}
                          onBlur={commitRenameKb}
                          placeholder="New name..."
                          className="flex-1 bg-input text-white text-sm border border-gray-600 rounded-lg px-2.5 py-1.5 outline-none focus:border-accent"
                        />
                        <button
                          onClick={commitRenameKb}
                          className="px-2 py-1.5 rounded-lg bg-accent text-white text-xs font-medium hover:opacity-90"
                        >
                          OK
                        </button>
                      </div>
                    ) : (
                      <div className="flex items-center justify-between" onClick={() => setSelectedKbId(kb.id)}>
                        <div className="flex-1 min-w-0 cursor-pointer">
                          <div className="flex items-center gap-2">
                            <svg className="w-4 h-4 text-gray-500 shrink-0" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 12.75V12A2.25 2.25 0 0 1 4.5 9.75h15A2.25 2.25 0 0 1 21.75 12v.75m-8.69-6.44-2.12-2.12a1.5 1.5 0 0 0-1.061-.44H4.5A2.25 2.25 0 0 0 2.25 6v12a2.25 2.25 0 0 0 2.25 2.25h15A2.25 2.25 0 0 0 21.75 18V9a2.25 2.25 0 0 0-2.25-2.25h-5.379a1.5 1.5 0 0 1-1.06-.44Z" />
                            </svg>
                            <span className="text-sm font-medium text-white truncate">{kb.name}</span>
                          </div>
                          <div className="text-xs text-gray-500 mt-1 ml-6">
                            {kb.document_count} docs · {kb.chunk_count} chunks
                          </div>
                        </div>
                        <div className="flex items-center gap-0.5 shrink-0">
                          <button
                            onClick={(e) => { e.stopPropagation(); startRenameKb(kb.id, kb.name); }}
                            className="opacity-0 group-hover/kb:opacity-100 transition-opacity p-1 rounded hover:bg-gray-600/50 text-gray-400 hover:text-gray-200"
                            title="Rename"
                          >
                            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" d="m16.862 4.487 1.687-1.688a1.875 1.875 0 1 1 2.652 2.652L10.582 16.07a4.5 4.5 0 0 1-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 0 1 1.13-1.897l8.932-8.931Zm0 0L19.5 7.125" />
                            </svg>
                          </button>
                          {selectedKbId === kb.id && (
                            <svg className="w-4 h-4 text-accent" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                            </svg>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* Right Panel: Documents */}
            <div className="flex-1 flex flex-col overflow-hidden">
              {selectedKbId ? (
                <>
                  <div className="flex items-center justify-between px-6 py-4 border-b border-gray-800/50">
                    <div>
                      <h2 className="text-lg font-semibold text-gray-100">
                        {knowledgeBases.find((kb) => kb.id === selectedKbId)?.name ?? "Unknown"}
                      </h2>
                      <p className="text-xs text-gray-500 mt-0.5">
                        {kbDocuments.length} document(s) · {knowledgeBases.find((kb) => kb.id === selectedKbId)?.chunk_count ?? 0} chunks
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => fileInputRef.current?.click()}
                        disabled={uploading}
                        className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-accent text-white text-sm font-medium hover:opacity-90 disabled:opacity-50"
                      >
                        {uploading ? (
                          <>
                            <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 0 1 8-8V0C5.373 0 0 5.373 0 12h4z" />
                            </svg>
                            Uploading...
                          </>
                        ) : (
                          <>
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5m-13.5-9L12 3m0 0 4.5 4.5M12 3v13.5" />
                            </svg>
                            Upload File
                          </>
                        )}
                      </button>
                      <input
                        ref={fileInputRef}
                        type="file"
                        className="hidden"
                        multiple
                        accept=".pdf,.docx,.doc,.pptx,.ppt,.xlsx,.xls,.csv,.md,.txt,.html,.htm,.json,.xml,.py,.js,.ts,.java,.go,.rs,.cpp,.c,.h,.cs,.rb,.php,.swift,.kt,.scala,.sh,.sql,.png,.jpg,.jpeg,.bmp,.webp,.tiff"
                        onChange={(e) => {
                          if (e.target.files) {
                            Array.from(e.target.files).forEach(uploadFileToKb);
                          }
                          e.target.value = "";
                        }}
                      />
                      <button
                        onClick={() => {
                          const kb = knowledgeBases.find((k) => k.id === selectedKbId);
                          if (kb) startRenameKb(kb.id, kb.name);
                        }}
                        className="p-2 rounded-lg text-gray-500 hover:bg-gray-700 hover:text-gray-300 transition-colors"
                        title="Rename Knowledge Base"
                      >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" d="m16.862 4.487 1.687-1.688a1.875 1.875 0 1 1 2.652 2.652L10.582 16.07a4.5 4.5 0 0 1-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 0 1 1.13-1.897l8.932-8.931Zm0 0L19.5 7.125" />
                        </svg>
                      </button>
                      <button
                        onClick={() => {
                          if (confirm(`Delete knowledge base "${knowledgeBases.find((kb) => kb.id === selectedKbId)?.name}"? This cannot be undone.`)) {
                            deleteKnowledgeBase(selectedKbId);
                          }
                        }}
                        className="p-2 rounded-lg text-gray-500 hover:bg-red-500/20 hover:text-red-400 transition-colors"
                        title="Delete Knowledge Base"
                      >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" d="m14.74 9-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 0 1-2.244 2.077H8.084a2.25 2.25 0 0 1-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 0 0-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 0 1 3.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 0 0-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 0 0-7.5 0" />
                        </svg>
                      </button>
                    </div>
                  </div>

                  {/* Document List / Drop Zone */}
                  <div
                    className="flex-1 overflow-y-auto scrollbar-thin p-6"
                    onDragOver={(e) => e.preventDefault()}
                    onDrop={handleFileDrop}
                  >
                    {kbDocuments.length === 0 ? (
                      <div className="flex flex-col items-center justify-center h-full text-center border-2 border-dashed border-gray-700 rounded-xl">
                        <svg className="w-16 h-16 text-gray-700 mb-4" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5m-13.5-9L12 3m0 0 4.5 4.5M12 3v13.5" />
                        </svg>
                        <p className="text-sm text-gray-400">Drag and drop files here</p>
                        <p className="text-xs text-gray-600 mt-1">or click "Upload File" above</p>
                        <p className="text-xs text-gray-700 mt-3">Supports: PDF, DOCX, PPTX, XLSX, MD, TXT, HTML, code files</p>
                      </div>
                    ) : (
                      <div className="space-y-2 max-w-3xl">
                        {kbDocuments.map((doc) => (
                          <div key={doc.id} className="flex items-center justify-between bg-input rounded-lg px-4 py-3 border border-gray-700/50 hover:border-gray-600 transition-colors">
                            <div className="flex items-center gap-3 flex-1 min-w-0">
                              <svg className="w-8 h-8 text-gray-500 shrink-0" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z" />
                              </svg>
                              <div className="flex-1 min-w-0">
                                <div className="text-sm text-gray-200 truncate">{doc.filename}</div>
                                <div className="text-xs text-gray-500 mt-0.5">
                                  {formatFileSize(doc.file_size)} · {doc.chunk_count} chunks
                                </div>
                              </div>
                            </div>
                            <div className="flex items-center gap-1 shrink-0">
                              <button
                                onClick={() => handlePreview(doc)}
                                className="p-1.5 rounded hover:bg-gray-600/50 hover:text-gray-200 text-gray-500 transition-colors"
                                title={`Preview ${doc.filename}`}
                              >
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 0 1 0-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178Z" />
                                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" />
                                </svg>
                              </button>
                              <button
                                onClick={() => handleDownload(doc)}
                                className="p-1.5 rounded hover:bg-gray-600/50 hover:text-gray-200 text-gray-500 transition-colors"
                                title={`Download ${doc.filename}`}
                              >
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5M16.5 12 12 16.5m0 0L7.5 12m4.5 4.5V3" />
                                </svg>
                              </button>
                              <button
                                onClick={() => deleteKbDocument(doc.id)}
                                className="p-1.5 rounded hover:bg-red-500/20 hover:text-red-400 text-gray-600 transition-colors"
                                title="Delete document"
                              >
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                                </svg>
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </>
              ) : (
                <div className="flex flex-col items-center justify-center h-full text-center">
                  <svg className="w-16 h-16 text-gray-700 mb-4" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.042A8.967 8.967 0 0 0 6 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 0 1 6 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 0 1 6-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0 0 18 18a8.967 8.967 0 0 0-6 2.292m0-14.25v14.25" />
                  </svg>
                  <p className="text-sm text-gray-400">Select a knowledge base from the left</p>
                  <p className="text-xs text-gray-600 mt-1">or create a new one to get started</p>
                </div>
              )}
            </div>
          </div>
        </main>
      ) : (
        /* ====== CHAT VIEW ====== */
        <main className="flex-1 flex flex-col h-full min-w-0 relative">
          {/* Top Bar — with model selector like Open WebUI */}
          <header className="flex items-center gap-3 px-4 py-3 border-b border-gray-800/50">
            <button
              onClick={() => setSidebarOpen((v) => !v)}
              className="p-1.5 rounded-lg hover:bg-hover transition-colors text-gray-400"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5" />
              </svg>
            </button>

            {/* Model Selector in top bar */}
            <select
              value={selectedChatOption}
              onChange={(e) => setSelectedChatOption(e.target.value)}
              className="model-dropdown bg-input text-sm text-gray-200 border border-gray-700 rounded-lg px-3 py-1.5 outline-none cursor-pointer hover:border-gray-500 focus:border-accent transition-colors"
            >
              {availableModels.length > 0
                ? availableModels.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.label}
                    </option>
                  ))
                : CHAT_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
            </select>

            <h1 className="text-sm font-medium text-gray-300 truncate flex-1">
              {activeChat?.title ?? "New Chat"}
            </h1>

            {/* RAG Status Indicator */}
            {ragAvailable && ragEnabled && selectedKbId && (
              <span className="text-xs text-green-400 bg-green-400/10 rounded-md px-2 py-0.5 shrink-0 flex items-center gap-1">
                <svg className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75 11.25 15 15 9.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
                </svg>
                RAG: {knowledgeBases.find((kb) => kb.id === selectedKbId)?.name ?? "Active"}
              </span>
            )}
          </header>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto scrollbar-thin">
            {isNewChat ? (
              /* Welcome Screen */
              <div className="flex flex-col items-center justify-center h-full text-center px-4">
                <div className="mb-6">
                  <div className={`${APP_CONFIG.welcomeScreen?.heroImageSize ?? "w-25 h-25"} rounded-full flex items-center justify-center mx-auto mb-4`}>
                    <img
                      src={APP_CONFIG.welcomeScreen?.heroImage || APP_CONFIG.logo}
                      alt={APP_CONFIG.name}
                      className="w-full h-full object-contain"
                    />
                  </div>
                  <h2 className="text-2xl font-semibold text-gray-100 mb-2">{APP_CONFIG.welcomeHeading}</h2>
                  <p className="text-gray-500 text-sm max-w-md">
                    {APP_CONFIG.welcomeSubtext}
                  </p>
                </div>
                {(APP_CONFIG.welcomeScreen?.showSuggestions ?? true) && (
                  <div className={`grid gap-2 max-w-lg w-full`} style={{ gridTemplateColumns: `repeat(${APP_CONFIG.welcomeScreen?.suggestionColumns ?? 2}, minmax(0, 1fr))` }}>
                    {SUGGESTIONS.map((s) => (
                      <button
                        key={s}
                        onClick={() => sendMessage(s)}
                        className="text-left p-3 rounded-xl border border-gray-700 hover:bg-hover text-sm text-gray-400 transition-colors"
                      >
                        {s}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            ) : (
              /* Messages List */
              <div className="max-w-3xl mx-auto px-2 sm:px-4 py-4 sm:py-6 space-y-4 sm:space-y-6">
                {(activeChat?.messages ?? []).map((msg, i) =>
                  msg.role === "user" ? (
                    <div key={`${activeChatId}-${i}`} className="flex justify-end group">
                      <div className="flex items-start gap-1">
                        <button
                          onClick={() => deleteMessageById(activeChatId!, i)}
                          className="opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded hover:bg-red-500/20 text-gray-400 hover:text-red-400"
                          title="Delete message"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" d="m14.74 9-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 0 1-2.244 2.077H8.084a2.25 2.25 0 0 1-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 0 0-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 0 1 3.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 0 0-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 0 0-7.5 0" />
                          </svg>
                        </button>
                        {APP_CONFIG.showCopyButton && <CopyButton text={msg.content} />}
                        <div className="bg-input rounded-2xl px-3 sm:px-4 py-2 sm:py-2.5 max-w-[95%] sm:max-w-[85%] text-sm leading-relaxed whitespace-pre-wrap">
                          {msg.content}
                          {APP_CONFIG.showTimestamps && msg.timestamp && (
                            <div className="text-[10px] text-gray-500 mt-1 text-right">
                              {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div key={`${activeChatId}-${i}`} className="flex gap-2 sm:gap-3 group">
                      <AssistantAvatar />
                      <div className="message-content prose prose-invert prose-sm max-w-[95%] sm:max-w-[85%] text-gray-200">
                        {msg.thinking && (
                          <details className="mb-2">
                            <summary className="text-xs text-gray-500 cursor-pointer hover:text-gray-400">💭 Thinking</summary>
                            <div className="mt-1 p-2 bg-gray-800/50 rounded text-xs text-gray-400 whitespace-pre-wrap max-h-60 overflow-y-auto">
                              {msg.thinking}
                            </div>
                          </details>
                        )}
                        <ReactMarkdown remarkPlugins={[remarkGfm]} components={markdownComponents}>{msg.content}</ReactMarkdown>
                        {msg.sources && msg.sources.length > 0 && RAG_CONFIG?.showSources && (
                          <div className="mt-2 pt-2 border-t border-gray-700/50">
                            <div className="text-xs text-gray-500 mb-1">📎 引用文档来源</div>
                            <div className="flex flex-wrap gap-1.5">
                              {msg.sources.map((src, idx) => (
                                <span key={idx} className="text-xs bg-accent/10 border border-accent/20 rounded-md px-2 py-1" title={`Section: ${src.section} | Relevance: ${(src.score * 100).toFixed(0)}%`}>
                                  <span className="text-accent font-medium">{src.source}</span>
                                  <span className="text-gray-500 ml-1">· {src.section}</span>
                                  <span className="text-gray-600 ml-1">({(src.score * 100).toFixed(0)}%)</span>
                                </span>
                              ))}
                            </div>
                          </div>
                        )}
                        {APP_CONFIG.showTimestamps && msg.timestamp && (
                          <div className="text-[10px] text-gray-500 mt-1">
                            {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </div>
                        )}
                      </div>
                      {APP_CONFIG.showCopyButton && <CopyButton text={msg.content} />}
                      <button
                        onClick={() => deleteMessageById(activeChatId!, i)}
                        className="opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded hover:bg-red-500/20 text-gray-400 hover:text-red-400"
                        title="Delete message"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" d="m14.74 9-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 0 1-2.244 2.077H8.084a2.25 2.25 0 0 1-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 0 0-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 0 1 3.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 0 0-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 0 0-7.5 0" />
                        </svg>
                      </button>
                    </div>
                  )
                )}
                <div ref={messagesEndRef} />
              </div>
            )}
          </div>

          {/* Input Area */}
          <div className="px-2 sm:px-4 pb-3 sm:pb-4 pt-2">
            <div className="max-w-3xl mx-auto">
              <div className="relative bg-input rounded-2xl border border-gray-700 focus-within:border-gray-500 transition-colors">
                {/* Hidden file input */}
                <input
                  ref={fileInputRef}
                  type="file"
                  multiple
                  accept=".png,.jpg,.jpeg,.gif,.webp,.bmp,.pdf,.docx,.doc,.pptx,.ppt,.xlsx,.xls,.csv,.md,.txt,.html,.htm,.json,.xml,.py,.js,.ts,.java,.go,.rs,.cpp,.c,.h,.cs,.rb,.php,.swift,.kt,.sh,.sql"
                  onChange={handleFileSelect}
                  className="hidden"
                />

                {/* Attachment Previews */}
                {attachments.length > 0 && (
                  <div className="flex flex-wrap gap-2 px-3 pt-2.5 pb-0">
                    {attachments.map((att) => (
                      <div
                        key={att.id}
                        className="relative group flex items-center gap-2 bg-gray-800 border border-gray-600 rounded-lg px-2.5 py-1.5 max-w-[200px]"
                      >
                        {att.type === "image" && att.dataUrl ? (
                          <img src={att.dataUrl} alt={att.name} className="w-8 h-8 object-cover rounded shrink-0" />
                        ) : (
                          <svg className="w-4 h-4 text-gray-400 shrink-0" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z" />
                          </svg>
                        )}
                        <div className="flex-1 min-w-0">
                          <p className="text-xs text-gray-300 truncate">{att.name}</p>
                          <p className="text-[10px] text-gray-500">
                            {att.status === "uploading" ? "Processing..." : att.status === "error" ? "Failed" : formatFileSize(att.size)}
                          </p>
                        </div>
                        {att.status === "uploading" ? (
                          <svg className="w-3.5 h-3.5 text-gray-400 animate-spin shrink-0" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 0 1 8-8V0C5.373 0 0 5.373 0 12h4Z" />
                          </svg>
                        ) : (
                          <button
                            onClick={() => removeAttachment(att.id)}
                            className="p-0.5 rounded hover:bg-gray-700 text-gray-400 hover:text-gray-200 shrink-0"
                            title="Remove"
                          >
                            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                            </svg>
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                )}

                {/* KB Selector — like Open WebUI's # shortcut */}
                {ragAvailable && knowledgeBases.length > 0 && (
                  <div className="flex items-center gap-2 px-3 pt-2.5 pb-0">
                    <select
                      value={selectedKbId}
                      onChange={(e) => {
                        setSelectedKbId(e.target.value);
                        setRagEnabled(!!e.target.value);
                      }}
                      className="bg-input text-xs text-gray-300 border border-gray-700 rounded-lg px-2.5 py-1.5 outline-none cursor-pointer hover:border-gray-500 transition-colors"
                    >
                      <option value="">No KB (Plain Chat)</option>
                      {knowledgeBases.map((kb) => (
                        <option key={kb.id} value={kb.id}>
                          {kb.name} ({kb.chunk_count} chunks)
                        </option>
                      ))}
                    </select>
                  </div>
                )}
                <div className="relative">
                  <textarea
                    ref={textareaRef}
                    rows={1}
                    value={input}
                    placeholder={ragEnabled && selectedKbId ? `Ask about your documents...` : APP_CONFIG.inputPlaceholder}
                    className="w-full bg-transparent text-white placeholder-gray-500 text-sm px-4 py-3 pl-12 pr-12 resize-none outline-none scrollbar-thin rounded-2xl"
                    style={{ maxHeight: 200 }}
                    onKeyDown={handleKeyDown}
                    onChange={handleInput}
                  />
                  {/* Attachment Button */}
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    className="absolute left-2 bottom-2 p-1.5 rounded-lg text-gray-400 hover:text-gray-200 hover:bg-gray-700/50 transition-colors"
                    title="Attach file or image"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="m18.375 12.739-7.693 7.693a4.5 4.5 0 0 1-6.364-6.364l10.94-10.94A3 3 0 1 1 19.5 7.372L8.552 18.32m.009-.01-.01.01m5.699-9.941-7.077 7.077" />
                    </svg>
                  </button>
                  <button
                    onClick={() => sendMessage()}
                    disabled={!input.trim() && attachments.length === 0}
                    className={`absolute right-2 bottom-2 p-1.5 rounded-lg bg-white text-black hover:bg-gray-200 transition-colors disabled:opacity-30 disabled:cursor-not-allowed ${isStreaming ? "hidden" : ""}`}
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 10.5L12 3m0 0l7.5 7.5M12 3v18" />
                    </svg>
                  </button>
                  {isStreaming && (
                    <button
                      onClick={() => abortControllerRef.current?.abort()}
                      className="absolute right-2 bottom-2 p-1.5 rounded-lg bg-red-600 text-white hover:bg-red-700 transition-colors"
                      title="Stop generating"
                    >
                      <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                        <rect x="6" y="6" width="12" height="12" rx="2" />
                      </svg>
                    </button>
                  )}
                </div>
              </div>
              <p className="text-xs text-gray-600 text-center mt-2">
                {APP_CONFIG.footerDisclaimer}
              </p>
            </div>
          </div>
        </main>
      )}

      {/* Confirmation Modal */}
      {confirmAction && confirmAction.type === "delete" && (
        <ConfirmModal
          title="Delete Chat"
          message="Are you sure you want to delete this chat? This action cannot be undone."
          confirmLabel="Delete"
          confirmColor="bg-red-600 hover:bg-red-700"
          onConfirm={() => {
            if (confirmAction.chatId) deleteChatById(confirmAction.chatId);
            setConfirmAction(null);
          }}
          onCancel={() => setConfirmAction(null)}
        />
      )}
      {confirmAction && confirmAction.type === "logout" && (
        <ConfirmModal
          title="Log Out"
          message="Are you sure you want to log out?"
          confirmLabel="Log Out"
          confirmColor="bg-red-600 hover:bg-red-700"
          onConfirm={() => {
            setConfirmAction(null);
            onLogout();
          }}
          onCancel={() => setConfirmAction(null)}
        />
      )}

      {/* External Model Connections Modal */}
      {showConnectionsModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60"
          onClick={() => setShowConnectionsModal(false)}
        >
          <div
            className="bg-main border border-gray-700 rounded-xl shadow-2xl w-full max-w-xl max-h-[85vh] flex flex-col overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-5 py-3 border-b border-gray-700/60 shrink-0">
              <h3 className="text-base font-medium text-gray-100">外部连接</h3>
              <button
                onClick={() => setShowConnectionsModal(false)}
                className="p-1.5 rounded-lg hover:bg-gray-600/50 text-gray-400 transition-colors"
                title="Close"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-5 space-y-4">
              <p className="text-sm text-gray-400">Add OpenAI-compatible endpoints (base URL + API key + model).</p>

              {/* Add / edit form */}
              <div className="space-y-3 bg-input/50 border border-gray-700/60 rounded-lg p-4">
                <input
                  type="text"
                  placeholder="Connection name"
                  value={connForm.name}
                  onChange={(e) => setConnForm((f) => ({ ...f, name: e.target.value }))}
                  className="w-full bg-input text-sm text-gray-200 border border-gray-700 rounded-lg px-3 py-2 outline-none focus:border-accent"
                />
                <input
                  type="text"
                  placeholder="Base URL, e.g. https://api.openai.com/v1"
                  value={connForm.base_url}
                  onChange={(e) => setConnForm((f) => ({ ...f, base_url: e.target.value }))}
                  className="w-full bg-input text-sm text-gray-200 border border-gray-700 rounded-lg px-3 py-2 outline-none focus:border-accent"
                />
                <input
                  type="password"
                  placeholder="API Key (optional)"
                  value={connForm.api_key}
                  onChange={(e) => setConnForm((f) => ({ ...f, api_key: e.target.value }))}
                  className="w-full bg-input text-sm text-gray-200 border border-gray-700 rounded-lg px-3 py-2 outline-none focus:border-accent"
                />
                <div className="flex gap-3">
                  <input
                    type="text"
                    placeholder="Model name (optional)"
                    value={connForm.model}
                    onChange={(e) => setConnForm((f) => ({ ...f, model: e.target.value }))}
                    className="flex-1 bg-input text-sm text-gray-200 border border-gray-700 rounded-lg px-3 py-2 outline-none focus:border-accent"
                  />
                  <select
                    value={connForm.provider}
                    onChange={(e) => setConnForm((f) => ({ ...f, provider: e.target.value }))}
                    className="bg-input text-sm text-gray-200 border border-gray-700 rounded-lg px-3 py-2 outline-none focus:border-accent"
                  >
                    <option value="openai">OpenAI</option>
                    <option value="azure-openai">Azure</option>
                    <option value="ollama">Ollama</option>
                  </select>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={saveConnection}
                    disabled={!connForm.name.trim() || !connForm.base_url.trim()}
                    className="px-4 py-2 rounded-lg text-sm font-medium text-white bg-accent hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    {editingConnectionId ? "Save Changes" : "Add Connection"}
                  </button>
                  {editingConnectionId && (
                    <button
                      onClick={() => resetConnForm()}
                      className="px-4 py-2 rounded-lg text-sm font-medium text-gray-300 hover:bg-hover transition-colors"
                    >
                      Cancel
                    </button>
                  )}
                </div>
              </div>

              {/* Saved connections list */}
              <div className="space-y-2">
                {connections.length === 0 ? (
                  <p className="text-sm text-gray-500">No external connections yet.</p>
                ) : (
                  connections.map((conn) => (
                    <div
                      key={conn.id}
                      className="flex items-center justify-between gap-3 p-3 border border-gray-700/60 rounded-lg bg-input/30"
                    >
                      <div className="min-w-0">
                        <div className="text-sm font-medium text-gray-200 truncate">{conn.name}</div>
                        <div className="text-xs text-gray-500 truncate">{conn.base_url}</div>
                        {conn.model && <div className="text-xs text-gray-500">model: {conn.model}</div>}
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        <button
                          onClick={() => resetConnForm(conn)}
                          className="p-1.5 rounded hover:bg-hover text-gray-400 transition-colors"
                          title="Edit"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" d="m16.862 4.487 1.687-1.688a1.875 1.875 0 1 1 2.652 2.652L6.832 19.82a4.5 4.5 0 0 1-1.897 1.13l-2.679.8.8-2.679a4.5 4.5 0 0 1 1.13-1.897L16.863 4.487Z" />
                          </svg>
                        </button>
                        <button
                          onClick={() => removeConnection(conn.id)}
                          className="p-1.5 rounded hover:bg-red-500/20 hover:text-red-400 text-gray-400 transition-colors"
                          title="Delete"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" d="m14.74 9-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.166L18.16 19.673a2.25 2.25 0 0 1-2.244 2.077H8.084a2.25 2.25 0 0 1-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 0 0-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 0 1 3.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 0 0-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 0 0-7.5 0" />
                          </svg>
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Document Preview Modal */}
      {previewDoc && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60"
          onClick={closePreview}
        >
          <div
            className="bg-main border border-gray-700 rounded-xl shadow-2xl w-full max-w-3xl h-[80vh] flex flex-col overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between px-5 py-3 border-b border-gray-700/60 shrink-0">
              <div className="flex items-center gap-2 min-w-0">
                <svg className="w-4 h-4 text-gray-400 shrink-0" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z" />
                </svg>
                <span className="text-sm font-medium text-gray-200 truncate">{previewDoc.filename}</span>
                <span className="text-xs text-gray-500 shrink-0">
                  {formatFileSize(previewDoc.file_size)}
                </span>
                {previewData?.type === "text" && (
                  <span className="text-xs text-gray-500 shrink-0">
                    · {previewData.charCount?.toLocaleString()} chars
                    {previewData.truncated ? " (truncated)" : ""}
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <button
                  onClick={() => handleDownload(previewDoc)}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-accent text-white text-xs font-medium hover:opacity-90"
                >
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5M16.5 12 12 16.5m0 0L7.5 12m4.5 4.5V3" />
                  </svg>
                  Download
                </button>
                <button
                  onClick={closePreview}
                  className="p-1.5 rounded-lg hover:bg-gray-600/50 text-gray-400 transition-colors"
                  title="Close"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>

            {/* Body */}
            <div className="flex-1 overflow-auto scrollbar-thin bg-black/20">
              {previewLoading ? (
                <div className="flex items-center justify-center h-full">
                  <svg className="w-8 h-8 animate-spin text-accent" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 0 1 8-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                </div>
              ) : previewData?.type === "image" && previewData.imageUrl ? (
                <div className="flex items-center justify-center p-4 min-h-full">
                  <img
                    src={`${RAG_CONFIG.documentsEndpoint}/${encodeURIComponent(previewDoc.id)}/download`}
                    alt={previewDoc.filename}
                    className="max-w-full max-h-[calc(80vh-110px)] object-contain rounded"
                  />
                </div>
              ) : (
                <pre className="p-5 text-sm text-gray-200 whitespace-pre-wrap break-words font-mono leading-relaxed">
                  {previewData?.text ?? "No content"}
                </pre>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
