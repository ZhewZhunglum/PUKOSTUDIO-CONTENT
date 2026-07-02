"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { isAuthenticated, setToken } from "@/lib/auth";

type Mode = "checking" | "login" | "register";

export default function LoginPage() {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>("checking");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  // Redirect if already authenticated; detect first-run vs normal mode
  useEffect(() => {
    if (isAuthenticated()) {
      router.replace("/");
      return;
    }
    fetch("/api/auth/status")
      .then((r) => r.json())
      .then((d: { registered: boolean; admin_configured?: boolean }) => {
        // If no one is registered yet, go straight to register; otherwise login
        setMode(d.registered ? "login" : "register");
      })
      .catch(() => setMode("login"));
  }, [router]);

  function switchMode(next: "login" | "register") {
    setError("");
    setUsername("");
    setPassword("");
    setConfirmPassword("");
    setMode(next);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    if (mode === "register") {
      if (username.trim().length < 2) {
        setError("用户名至少需要 2 个字符");
        return;
      }
      if (password.length < 6) {
        setError("密码至少需要 6 位");
        return;
      }
      if (password !== confirmPassword) {
        setError("两次输入的密码不一致");
        return;
      }
    }

    setLoading(true);
    const endpoint = mode === "register" ? "/api/auth/register" : "/api/auth/login";
    try {
      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: username.trim(), password }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.detail || "操作失败，请重试");
      } else {
        setToken(data.access_token);
        router.replace("/");
      }
    } catch {
      setError("网络错误，请重试");
    } finally {
      setLoading(false);
    }
  }

  if (mode === "checking") {
    return (
      <div className="flex h-screen items-center justify-center" style={{ background: "var(--surface-0)" }}>
        <div style={{ fontSize: 13, color: "var(--ink-lo)" }}>加载中…</div>
      </div>
    );
  }

  const isRegister = mode === "register";

  // ── Shared input style ────────────────────────────────────────────────────
  const inputStyle: React.CSSProperties = {
    width: "100%", boxSizing: "border-box",
    background: "var(--surface-0)", border: "1px solid var(--line)",
    borderRadius: 10, padding: "10px 14px",
    fontSize: 13, color: "var(--ink)", outline: "none",
  };

  return (
    <div
      className="flex h-screen items-center justify-center"
      style={{ background: "var(--surface-0)" }}
    >
      <div
        style={{
          width: 400,
          background: "var(--surface-1)",
          border: "1px solid var(--line)",
          borderRadius: 20,
          padding: "40px 36px 36px",
        }}
      >
        {/* Logo */}
        <div className="flex items-center gap-2 mb-8">
          <div
            style={{
              width: 32, height: 32, borderRadius: 8,
              background: "var(--accent)",
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: 14, fontWeight: 700, color: "#fff",
            }}
          >
            CF
          </div>
          <span style={{ fontSize: 15, fontWeight: 600, color: "var(--ink-hi)", fontFamily: "var(--font-display)" }}>
            ContentForge
          </span>
        </div>

        {/* Title */}
        <h1 style={{ margin: "0 0 6px", fontSize: 22, fontWeight: 600, color: "var(--ink-hi)" }}>
          {isRegister ? "创建账号" : "欢迎回来"}
        </h1>
        <p style={{ margin: "0 0 28px", fontSize: 13, color: "var(--ink-lo)" }}>
          {isRegister ? "注册你的 ContentForge 账号" : "登录你的 ContentForge 工作台"}
        </p>

        <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          {/* Username */}
          <div>
            <label style={{ display: "block", fontSize: 12, color: "var(--ink-lo)", marginBottom: 6, fontWeight: 500 }}>
              用户名
            </label>
            <input
              type="text"
              autoComplete="username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              required
              minLength={2}
              placeholder="输入用户名"
              style={inputStyle}
            />
          </div>

          {/* Password */}
          <div>
            <label style={{ display: "block", fontSize: 12, color: "var(--ink-lo)", marginBottom: 6, fontWeight: 500 }}>
              密码
            </label>
            <input
              type="password"
              autoComplete={isRegister ? "new-password" : "current-password"}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={6}
              placeholder={isRegister ? "至少 6 位" : "输入密码"}
              style={inputStyle}
            />
          </div>

          {/* Confirm password — register only */}
          {isRegister && (
            <div>
              <label style={{ display: "block", fontSize: 12, color: "var(--ink-lo)", marginBottom: 6, fontWeight: 500 }}>
                确认密码
              </label>
              <input
                type="password"
                autoComplete="new-password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
                minLength={6}
                placeholder="再次输入密码"
                style={{
                  ...inputStyle,
                  borderColor: confirmPassword && confirmPassword !== password
                    ? "#f87171"
                    : "var(--line)",
                }}
              />
              {confirmPassword && confirmPassword !== password && (
                <p style={{ margin: "4px 0 0", fontSize: 11, color: "#f87171" }}>
                  两次密码不一致
                </p>
              )}
            </div>
          )}

          {/* Error message */}
          {error && (
            <div style={{
              fontSize: 12, color: "#f87171",
              padding: "8px 12px",
              background: "rgba(248,113,113,0.1)",
              borderRadius: 8,
            }}>
              {error}
            </div>
          )}

          {/* Submit button */}
          <button
            type="submit"
            disabled={loading || (isRegister && !!confirmPassword && confirmPassword !== password)}
            style={{
              marginTop: 6,
              background: loading ? "var(--surface-2)" : "var(--accent)",
              color: "#fff", border: "none",
              borderRadius: 10, padding: "11px 0",
              fontSize: 14, fontWeight: 600,
              cursor: loading ? "not-allowed" : "pointer",
              opacity: (isRegister && !!confirmPassword && confirmPassword !== password) ? 0.5 : 1,
              transition: "opacity 0.15s",
            }}
          >
            {loading ? "处理中…" : isRegister ? "创建账号" : "登录"}
          </button>
        </form>

        {/* Toggle between login ↔ register */}
        <p style={{ marginTop: 20, textAlign: "center", fontSize: 12, color: "var(--ink-lo)" }}>
          {isRegister ? "已有账号？" : "没有账号？"}
          <button
            type="button"
            onClick={() => switchMode(isRegister ? "login" : "register")}
            style={{
              background: "none", border: "none", padding: "0 0 0 4px",
              color: "var(--accent)", fontSize: 12, fontWeight: 600,
              cursor: "pointer", textDecoration: "underline",
            }}
          >
            {isRegister ? "去登录" : "立即注册"}
          </button>
        </p>
      </div>
    </div>
  );
}
