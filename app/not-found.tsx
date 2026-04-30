"use client";
import { useRouter } from "next/navigation";

export default function NotFoundPage() {
  const router = useRouter();

  function handleGoToLogin() {
    localStorage.removeItem("authToken");
    router.push("/login");
  }

  return (
    <div
      style={{
        margin: 0,
        fontFamily: "Arial, sans-serif",
        background: "radial-gradient(circle at top, #123ebf 0%, #061f7f 36%, #020a2e 100%)",
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
        padding: "30px 10px",
        minHeight: "100vh",
      }}
    >
      <div
        style={{
          width: "100%",
          maxWidth: 420,
          borderRadius: 20,
          border: "2px solid rgba(255, 210, 0, 0.85)",
          boxShadow: "0 0 40px rgba(255, 192, 0, 0.35)",
          background: "rgba(4,22,51,0.85)",
          backdropFilter: "blur(10px)",
          padding: "48px 36px",
          textAlign: "center",
        }}
      >
        <p
          style={{
            fontSize: 72,
            fontWeight: 900,
            color: "#ffe48a",
            margin: 0,
            lineHeight: 1,
            textShadow: "0 0 24px rgba(255,210,0,0.6)",
          }}
        >
          404
        </p>
        <p
          style={{
            fontSize: 18,
            fontWeight: 700,
            color: "#fff",
            margin: "16px 0 8px",
            letterSpacing: "0.05em",
          }}
        >
          Pagina non trovata
        </p>
        <p style={{ fontSize: 13, color: "rgba(255,230,150,0.7)", marginBottom: 32 }}>
          La pagina che stai cercando non esiste o è stata rimossa.
        </p>
        <button
          onClick={handleGoToLogin}
          style={{
            display: "inline-block",
            padding: "10px 32px",
            borderRadius: 9999,
            background: "linear-gradient(to bottom right, #ffe48a, #ffcc33)",
            color: "#1a1204",
            fontWeight: 700,
            fontSize: 14,
            textTransform: "uppercase",
            letterSpacing: "0.18em",
            boxShadow: "0 0 18px rgba(255,210,0,0.8)",
            textDecoration: "none",
            border: "none",
            cursor: "pointer",
          }}
        >
          Torna alla Login
        </button>
      </div>
    </div>
  );
}
