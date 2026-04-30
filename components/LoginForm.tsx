"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";

interface LoginFormProps {
  isRegister?: boolean;
}

export function LoginForm({ isRegister = false }: LoginFormProps) {
  const [showPassword, setShowPassword] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const router = useRouter();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    try {
      const res = await fetch("/api/auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password, action: isRegister ? "register" : "login" }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Errore durante l'accesso");
        return;
      }
      localStorage.setItem("authToken", data.token);
      router.push("/dashboard");
    } catch {
      setError("Errore di rete. Riprova.");
    }
  }

  return (
    <form onSubmit={handleSubmit}>
      {error && (
        <p style={{ color: "#ff6b6b", fontSize: 12, marginBottom: 10, textAlign: "center" }}>
          {error}
        </p>
      )}

      {/* EMAIL */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          padding: "2px 14px",
          marginBottom: 12,
          borderRadius: 9999,
          border: "1px solid rgba(255,210,0,0.65)",
          background: "rgba(4,22,51,0.70)",
          backdropFilter: "blur(6px)",
          boxShadow: "0 0 12px rgba(255,210,0,0.35)",
        }}
      >
        <Image
          src="/images/icon-email.png"
          alt="Email"
          width={28}
          height={28}
          style={{ marginRight: 2, filter: "drop-shadow(0 0 6px rgba(255,210,0,0.7))" }}
        />
        <input
          type="email"
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          autoComplete="email"
          style={{
            flex: 1,
            background: "transparent",
            border: "none",
            outline: "none",
            color: "#ffeeb0",
            fontSize: 14,
          }}
        />
      </div>

      {/* PASSWORD */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          padding: "6px 14px",
          marginBottom: 12,
          borderRadius: 9999,
          border: "1px solid rgba(255,210,0,0.65)",
          background: "rgba(4,22,51,0.70)",
          backdropFilter: "blur(6px)",
          boxShadow: "0 0 12px rgba(255,210,0,0.35)",
        }}
      >
        <Image
          src="/images/icon-password.png"
          alt="Password"
          width={28}
          height={28}
          style={{ marginRight: 2, filter: "drop-shadow(0 0 6px rgba(255,210,0,0.7))" }}
        />
        <input
          type={showPassword ? "text" : "password"}
          placeholder="Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          autoComplete={isRegister ? "new-password" : "current-password"}
          style={{
            flex: 1,
            background: "transparent",
            border: "none",
            outline: "none",
            color: "#ffeeb0",
            fontSize: 14,
          }}
        />
        <Image
          src={showPassword ? "/images/icon-eye-on.png" : "/images/icon-eye-off.png"}
          alt="Mostra password"
          width={28}
          height={28}
          onClick={() => setShowPassword(!showPassword)}
          style={{
            marginLeft: 2,
            cursor: "pointer",
            filter: "drop-shadow(0 0 6px rgba(255,210,0,0.7))",
          }}
        />
      </div>

      {/* BOTTONE */}
      <button
        type="submit"
        style={{
          width: "100%",
          padding: "10px 0",
          borderRadius: 9999,
          background: "linear-gradient(to bottom right, #ffe48a, #ffcc33)",
          color: "#1a1204",
          fontWeight: 700,
          fontSize: 14,
          textTransform: "uppercase",
          letterSpacing: "0.18em",
          boxShadow: "0 0 18px rgba(255,210,0,0.8)",
          border: "none",
          cursor: "pointer",
        }}
      >
        {isRegister ? "Registrati" : "Accedi"}
      </button>

      {/* LINK SECONDARI */}
      {!isRegister ? (
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            marginTop: 14,
            fontSize: 12,
            color: "#ffeeb0",
          }}
        >
          <a href="/register" style={{ color: "#ffeeb0", textDecoration: "underline" }}>
            Registrati
          </a>
          <a href="/forgot-password" style={{ color: "#ffeeb0", textDecoration: "underline" }}>
            Password dimenticata?
          </a>
        </div>
      ) : (
        <div style={{ display: "flex", justifyContent: "center", marginTop: 14, fontSize: 12 }}>
          <a href="/login" style={{ color: "#ffeeb0", textDecoration: "underline" }}>
            Torna alla login
          </a>
        </div>
      )}
    </form>
  );
}

