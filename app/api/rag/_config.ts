// ============================================================================
// RAG SERVICE PROXY ROUTES
// All RAG requests are proxied to the Python RAG backend (default: localhost:8000)
// ============================================================================

export const RAG_SERVER_URL =
  process.env.RAG_SERVER_URL || "http://localhost:8000";
