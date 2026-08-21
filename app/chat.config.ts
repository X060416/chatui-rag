// ============================================================================
// CHAT TEMPLATE CONFIGURATION
// ============================================================================
// This is the ONLY file you need to edit to customize the chat UI.
// Update the values below to match your brand, models, and backend.
// ============================================================================

export const APP_CONFIG = {
  // ---- UI Toggles ----
  showFilesPanel: true,               // Set to false to hide the Files UI
  showTimestamps: true,               // Show timestamps on messages
  showCopyButton: true,               // Show copy-to-clipboard button on messages
  // 在 APP_CONFIG 里加
  showThinking: true,  // 是否显示推理过程

  // ---- Theme / Colors ----
  // Customize the color palette. All values are CSS color strings.
  // These override the defaults in globals.css — no need to touch CSS.
  theme: {
    sidebar: "#171717",               // Sidebar background
    main: "#212121",                  // Main chat area background
    input: "#2f2f2f",                 // Input box & user message bubble background
    hover: "#2a2a2a",                 // Hover state background
    border: "#374151",               // Border color (gray-700)
    accent: "#FFC600",               // Accent color (buttons, focus rings)
    userBubble: "#2f2f2f",           // User message bubble background
    assistantText: "#e5e7eb",        // Assistant message text color
    textPrimary: "#ffffff",          // Primary text (headings, user messages)
    textSecondary: "#9ca3af",        // Secondary text (sidebar items, labels)
    textMuted: "#6b7280",            // Muted text (disclaimers, timestamps)
    codeBackground: "#1a1a2e",       // Code block background
  },

  // ---- Branding ----
  name: "ChatUI",                       // App name shown in sidebar & footer
  logo: "/favicon.ico",               // Logo path (place file in /public)
  welcomeHeading: "How can I help you today?",
  welcomeSubtext: "Start a conversation by typing a message below.",
  inputPlaceholder: "Message Chat...",
  footerDisclaimer: "ChatUI can make mistakes. Verify important information.",

  // ---- Welcome Screen Layout ----
  welcomeScreen: {
    showSuggestions: true,            // Set to false to hide suggestion chips
    suggestionColumns: 2,             // Number of grid columns (1, 2, 3, or 4)
    heroImage: "",                    // Optional hero image URL (place in /public). Leave empty to use logo.
    heroImageSize: "w-30 h-30",       // Tailwind size classes for the hero image
  },

  // ---- Chat Options ----
  // Configure chat options as an array. Each option has value, label, link (endpoint), and optional systemPrompt.
  chatOptions: [
  { 
    value: "lm-studio", 
    label: "qwen3.6-27b-mlx", 
    systemPrompt: "你是一个有用的助手。请根据用户使用的语言来回复：如果用户用中文提问，就用简体中文回答；如果用户用英文提问，就用英文回答。You are a helpful assistant. Please respond in the same language the user uses: reply in Simplified Chinese if the user writes in Chinese, and reply in English if the user writes in English." 
  },
],
defaultChatOption: "lm-studio",


  // ---- Suggestion Chips ----
  // Shown on the welcome screen. Users click to send as first message.
  suggestions: [
    "What can you help me with?",
    "How do I get started?",
    "Can you explain this topic?",
    "What are some best practices?",
  ],

  // ---- Backend ----
  // The Next.js API route that proxies requests to your LLM / Python backend.
  // You should NOT change this unless you rename the proxy route file.
  llmEndpoint: "/api/llm",

  // ---- Endpoint Routing ----
  // Map each chatOption value to a backend configuration.
  // Each entry can be a URL string (defaults to openai-compatible) or an object with:
  //   url:    The backend URL
  //   type:   "azure-openai" | "openai" | "ollama" | "custom"
  //           - azure-openai: Azure OpenAI (api-key header, SSE streaming)
  //           - openai: OpenAI-compatible (Bearer token, SSE streaming)
  //           - ollama: Ollama local (no auth needed, JSON streaming)
  //           - custom: Any backend (no auth, raw SSE passthrough)
  //   model:  (optional) Override model name sent to the backend
  //   stream: (optional) Whether to stream responses (default: true)
  //
  // Use "*" as a fallback for any unmatched option.
  endpoints: {
    "lm-studio": {
      url: "http://localhost:1234/v1/chat/completions",
      type: "openai",
    },
    // Fallback: any model ID routes to LM Studio
    "*": {
      url: "http://localhost:1234/v1/chat/completions",
      type: "openai",
    },
  } as Record<string, string | { url: string; type?: string; model?: string; stream?: boolean }>,

  // ---- API Keys ----
  // Map chatOption values to API keys.
  // Only used for types that require auth ("azure-openai", "openai").
  // Local LLMs ("ollama", "custom") don't need keys — just leave them out.
  // You can also use the env var LLM_API_KEY as a global fallback.
  apiKeys: {
    //"project-a": process.env.AZURE_API_KEY || "", 
    // "*": "sk-fallback-key",
  } as Record<string, string>,

  // ---- Users ----
  // Hardcoded login credentials. Add/remove as needed.
  users: [
    { username: "admin", password: "admin123", displayName: "Admin" },
    { username: "user", password: "user123", displayName: "User" },
  ],

  // RAG (Retrieval-Augmented Generation) Configuration — NEW
  // ========================================================================
  rag: {
    // Enable RAG knowledge base feature in the UI
    enabled: true,

    // Which chat options should use RAG (when a KB is selected)
    // Use ["*"] to enable RAG for all models, or list specific model IDs.
    enabledChatOptions: ["*"],

    // API endpoints (proxied through Next.js to Python RAG server)
    uploadEndpoint: "/api/rag/upload",
    queryEndpoint: "/api/rag/query",
    kbEndpoint: "/api/rag/kb",
    documentsEndpoint: "/api/rag/documents",

    // Default knowledge base to auto-select (empty = none)
    defaultKbId: "",

    // Number of chunks to retrieve per query
    topK: 10,

    // Whether to show retrieved context sources in the UI
    showSources: true,
  },
};
