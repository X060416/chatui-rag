"use client";

import { useState, useEffect } from "react";
import dynamic from "next/dynamic";
import { APP_CONFIG } from "./chat.config";

const ChatApp = dynamic(() => import("./ChatApp"), { ssr: false });

interface AuthUser {
  username: string;
  displayName: string;
}

function LoginPage({ onLogin }: { onLogin: (user: AuthUser) => void }) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const found = APP_CONFIG.users.find(
      (u) => u.username === username && u.password === password
    );
    if (found) {
      onLogin({ username: found.username, displayName: found.displayName });
    } else {
      setError("Invalid username or password");
    }
  }

  return (
    <div className="flex items-center justify-center min-h-screen bg-main">
      <div className="w-full max-w-sm p-8 rounded-2xl bg-sidebar border border-gray-800">
        <div className="flex flex-col items-center mb-6">
          <img src={APP_CONFIG.logo} alt={APP_CONFIG.name} className="w-16 h-16 mb-3" />
          <h1 className="text-xl font-semibold text-white">{APP_CONFIG.name}</h1>
          <p className="text-sm text-gray-500 mt-1">Sign in to continue</p>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs text-gray-400 mb-1.5">Username</label>
            <input
              type="text"
              value={username}
              onChange={(e) => { setUsername(e.target.value); setError(""); }}
              className="w-full px-3 py-2.5 rounded-lg bg-input border border-gray-700 text-white text-sm outline-none focus:border-shell-yellow transition-colors"
              autoFocus
            />
          </div>
          <div>
            <label className="block text-xs text-gray-400 mb-1.5">Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => { setPassword(e.target.value); setError(""); }}
              className="w-full px-3 py-2.5 rounded-lg bg-input border border-gray-700 text-white text-sm outline-none focus:border-shell-yellow transition-colors"
            />
          </div>
          {error && (
            <p className="text-xs text-red-400">{error}</p>
          )}
          <button
            type="submit"
            className="w-full py-2.5 rounded-lg bg-shell-red text-white text-sm font-medium hover:bg-shell-red/90 transition-colors"
          >
            Sign In
          </button>
        </form>
      </div>
    </div>
  );
}

export default function Home() {
  const [user, setUser] = useState<AuthUser | null>(null);

  // Load user from localStorage on mount
  useEffect(() => {
    const stored = localStorage.getItem("prismui_user");
    if (stored) {
      try {
        setUser(JSON.parse(stored));
      } catch {}
    }
  }, []);

  // Save user to localStorage on login
  function handleLogin(u: AuthUser) {
    setUser(u);
    localStorage.setItem("prismui_user", JSON.stringify(u));
  }

  // Clear user from localStorage on logout
  function handleLogout() {
    setUser(null);
    localStorage.removeItem("prismui_user");
  }

  if (!user) {
    return <LoginPage onLogin={handleLogin} />;
  }

  return (
    <ChatApp
      userId={user.username}
      displayName={user.displayName}
      onLogout={handleLogout}
    />
  );
}