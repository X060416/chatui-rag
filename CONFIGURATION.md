# Configuration Guide

This document covers all configuration options for ChatUI. All settings live in a single file: **`app/chat.config.ts`**.

---

## Table of Contents

1. [UI Toggles](#ui-toggles)
2. [Theme / Colors](#theme--colors)
3. [Branding](#branding)
4. [Welcome Screen Layout](#welcome-screen-layout)
5. [Chat Options & System Prompts](#chat-options--system-prompts)
6. [Suggestion Chips](#suggestion-chips)
7. [Endpoint Routing](#endpoint-routing)
8. [API Keys](#api-keys)
9. [Users & Authentication](#users--authentication)
10. [Environment Variables](#environment-variables)
11. [Connecting to LLM Backends](#connecting-to-llm-backends)
12. [Adding a New Backend](#adding-a-new-backend)
13. [Data Storage](#data-storage)
14. [Streaming Architecture](#streaming-architecture)

---

## UI Toggles

Control which UI features are visible:

```ts
showFilesPanel: true,    // Show/hide the right-side files panel
showTimestamps: true,    // Show timestamps on each message
showCopyButton: true,    // Show copy-to-clipboard button on messages
```

Additional built-in features (always available):
- **Stop generation** — Red stop button appears during streaming to abort the response
- **Code block copy** — Every fenced code block gets a copy button in its header
- **Confirmation modals** — Delete chat and logout require confirmation
- **Responsive layout** — Sidebar overlays on mobile with backdrop, messages adapt width

---

## Theme / Colors

Customize the color palette without touching CSS. All values are CSS color strings:

```ts
theme: {
  sidebar: "#171717",          // Sidebar background
  main: "#212121",             // Main chat area background
  input: "#2f2f2f",            // Input box & user message bubble
  hover: "#2a2a2a",            // Hover state background
  border: "#374151",           // Border color
  accent: "#FFC600",           // Accent color (focus rings, highlights)
  userBubble: "#2f2f2f",       // User message bubble background
  assistantText: "#e5e7eb",    // Assistant message text
  textPrimary: "#ffffff",      // Primary text
  textSecondary: "#9ca3af",    // Secondary text (sidebar, labels)
  textMuted: "#6b7280",        // Muted text (disclaimers, timestamps)
  codeBackground: "#1a1a2e",   // Code block background
},
```

---

## Branding

Customize the app's appearance:

```ts
name: "ChatUI",                              // Sidebar title
logo: "/favicon.ico",                        // Logo in /public folder
welcomeHeading: "How can I help you today?", // Welcome screen heading
welcomeSubtext: "Start a conversation...",   // Welcome screen subtitle
inputPlaceholder: "Message Chat...",         // Textarea placeholder
footerDisclaimer: "ChatUI can make mistakes...", // Below input
```

To change the logo, place your image in the `public/` folder and update the `logo` path.

---

## Welcome Screen Layout

Configure the welcome screen without touching component code:

```ts
welcomeScreen: {
  showSuggestions: true,        // Set to false to hide suggestion chips
  suggestionColumns: 2,         // Grid columns for chips (1, 2, 3, or 4)
  heroImage: "",                // Custom hero image URL. Leave empty to use logo.
  heroImageSize: "w-30 h-30",  // Tailwind size classes for the hero image
},
```

---

## Chat Options & System Prompts

Define dropdown options users can select before sending their first message. Each option routes to a different backend endpoint and can have its own system prompt:

```ts
chatOptions: [
  { value: "project-a", label: "Project A (GPT)", link: "/api/gpt", systemPrompt: "You are a helpful assistant." },
  { value: "project-b", label: "Project B (Ollama)", link: "/api/ollama", systemPrompt: "You are a code expert." },
],
defaultChatOption: "project-a",
```

| Field | Description |
|-------|-------------|
| `value` | Internal identifier (used as key for endpoints/apiKeys) |
| `label` | Display name shown in the dropdown |
| `link` | (Optional) Display reference |
| `systemPrompt` | (Optional) System message prepended to every LLM request |
| `defaultChatOption` | Which option is selected by default |

---

## Suggestion Chips

Shown on the welcome screen. Clicking one sends it as the first message:

```ts
suggestions: [
  "What can you help me with?",
  "How do I get started?",
  "Can you explain this topic?",
  "What are some best practices?",
],
```

Hide them entirely via `welcomeScreen.showSuggestions: false`.

---

## Endpoint Routing

Map each chat option to a backend configuration. Each entry can be a URL string (auto-detected) or an object:

```ts
endpoints: {
  "project-a": {
    url: "https://your-resource.openai.azure.com/openai/deployments/gpt-4/chat/completions?api-version=2025-01-01-preview",
    type: "azure-openai",
  },
  "project-b": {
    url: "http://localhost:11434/api/chat",
    type: "ollama",
    model: "llama3",
  },
  "project-c": {
    url: "https://api.openai.com/v1/chat/completions",
    type: "openai",
    model: "gpt-4o",
  },
  "*": {
    url: "http://localhost:3000/api/mock",
    type: "custom",
  },
},
```

### Endpoint object fields

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `url` | string | required | Backend URL |
| `type` | string | `"openai"` | `"azure-openai"` \| `"openai"` \| `"ollama"` \| `"custom"` |
| `model` | string | — | Override model name sent to backend |
| `stream` | boolean | `true` | Set to `false` for non-streaming backends |

### Provider types

| Type | Auth | Request Format | Response Format |
|------|------|---------------|-----------------|
| `azure-openai` | `api-key` header | OpenAI messages | SSE streaming |
| `openai` | `Bearer` token | OpenAI messages | SSE streaming |
| `ollama` | None | `{ model, messages, stream }` | Newline-delimited JSON |
| `custom` | None | OpenAI messages | SSE streaming |

### Auto-detection (string URLs)

If you pass a plain URL string instead of an object, the type is auto-detected:
- URLs with `openai.azure.com` or `cognitiveservices.azure.com` → `azure-openai`
- URLs with `11434` or `/api/chat` → `ollama`
- Everything else → `openai`

### Resolution order
1. Exact match by chatOption value
2. Fallback: `"*"`
3. Environment variable: `LLM_BACKEND_URL`
4. Default: `http://localhost:8000/chat`

---

## API Keys

Map chat options to API keys. Only needed for `azure-openai` and `openai` types. Local LLMs (`ollama`, `custom`) don't need keys — just leave them out.

```ts
apiKeys: {
  "project-a": "your-azure-api-key",
  "project-c": "sk-your-openai-key",
  // "*": "sk-fallback-key",
},
```

Keys are sent server-side only — never exposed to the browser.

**Resolution order:**
1. Exact match by chatOption value
2. Fallback: `"*"`
3. Environment variable: `LLM_API_KEY`

---

## Users & Authentication

Simple hardcoded credentials for login:

```ts
users: [
  { username: "admin", password: "admin123", displayName: "Admin" },
  { username: "user",  password: "user123",  displayName: "User" },
],
```

Each user gets their own chat storage directory under `data/chats/{username}/`.

---

## Environment Variables

Optional overrides (can be set in `.env.local`):

| Variable | Description | Used when |
|----------|-------------|-----------|
| `LLM_BACKEND_URL` | Fallback backend URL | No endpoint match found |
| `LLM_API_KEY` | Fallback API key | No apiKey match found |

---

## Connecting to LLM Backends

### Azure OpenAI

```ts
chatOptions: [
  { value: "azure-gpt4", label: "GPT-4 (Azure)", systemPrompt: "You are a helpful assistant." },
],
endpoints: {
  "azure-gpt4": {
    url: "https://<resource>.openai.azure.com/openai/deployments/<deployment>/chat/completions?api-version=2025-01-01-preview",
    type: "azure-openai",
  },
},
apiKeys: {
  "azure-gpt4": "<your-azure-api-key>",
},
```

### OpenAI Direct

```ts
endpoints: {
  "openai": {
    url: "https://api.openai.com/v1/chat/completions",
    type: "openai",
    model: "gpt-4o",
  },
},
apiKeys: {
  "openai": "sk-...",
},
```

### Ollama (Local)

```ts
endpoints: {
  "ollama": {
    url: "http://localhost:11434/api/chat",
    type: "ollama",
    model: "llama3",
  },
},
// No API key needed
```

### LM Studio / llama.cpp (Local)

```ts
endpoints: {
  "lm-studio": {
    url: "http://localhost:1234/v1/chat/completions",
    type: "openai",
  },
},
// No API key needed for local — type "openai" for format, auth skipped when no key
```

### Custom Backend

Your backend must:
1. Accept POST with `{ messages: [{role, content}...], stream: true }`
2. Return SSE stream with OpenAI-compatible format:
   ```
   data: {"choices":[{"delta":{"content":"token"}}]}
   data: [DONE]
   ```

---

## Adding a New Backend

1. **Add a chat option:**
   ```ts
   chatOptions: [
     ...existing,
     { value: "my-backend", label: "My Model", systemPrompt: "You are helpful." },
   ],
   ```

2. **Add the endpoint:**
   ```ts
   endpoints: {
     ...existing,
     "my-backend": {
       url: "https://my-api.example.com/v1/chat/completions",
       type: "openai",     // or "azure-openai", "ollama", "custom"
       model: "my-model",  // optional
     },
   },
   ```

3. **Add the API key (if needed):**
   ```ts
   apiKeys: {
     ...existing,
     "my-backend": "my-secret-key",
   },
   ```

4. Restart the dev server. The new option appears in the dropdown immediately.

---

## Data Storage

Chat data is stored on the filesystem:

```
data/chats/{userId}/
├── index.json          # Chat metadata (titles, timestamps, options)
├── {chat-id}.md        # Messages in markdown format
```

Messages use this format:
```markdown
## user

Hello, how are you?

<!-- MSG_SEP -->

## assistant

I'm doing well! How can I help you today?
```

---

## Streaming Architecture

```
Browser → /api/llm (Next.js proxy) → LLM Backend (Azure/OpenAI/Ollama/Custom)
         ← SSE stream ←              ← SSE or NDJSON stream ←
```

The proxy:
1. Resolves endpoint config + API key from `chat.config.ts`
2. Detects provider type and builds the appropriate request format
3. Adds auth headers only for providers that need them
4. Sends request with `stream: true` (configurable)
5. Parses response based on provider type (SSE for OpenAI, NDJSON for Ollama)
6. Forwards simplified `data: {"content": "..."}` events to the browser
7. The frontend updates the message in real-time as tokens arrive
8. User can stop generation at any time with the stop button
9. After streaming completes (or is stopped), the reply is persisted to file storage

---

## Mock Backend

A built-in mock at `/api/mock` returns a test response. Use it for development:

```ts
endpoints: {
  "*": "http://localhost:3000/api/mock",
},
```
