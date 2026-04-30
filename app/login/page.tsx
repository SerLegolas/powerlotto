"use client";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { LoginForm } from "@/components/LoginForm";

export default function LoginPage() {
  const router = useRouter();

  useEffect(() => {
    const token = localStorage.getItem("authToken");
    if (token) {
      router.replace("/dashboard");
    }
  }, [router]);
  return (
    <div
      style={{
        margin: 0,
        fontFamily: "Arial, sans-serif",
        background: "radial-gradient(circle at top, #123ebf 0%, #061f7f 36%, #020a2e 100%)",
        display: "flex",
        justifyContent: "center",
        padding: "30px 10px",
        minHeight: "100vh",
      }}
    >
      <div style={{ width: "100%", maxWidth: 420 }}>
        <div
          style={{
            position: "relative",
            aspectRatio: "768 / 1366",
            borderRadius: 20,
            overflow: "hidden",
            border: "2px solid rgba(255, 210, 0, 0.85)",
            boxShadow: "0 0 40px rgba(255, 192, 0, 0.35)",
          }}
        >
          {/* Overlay gradiente */}
          <div
            style={{
              position: "absolute",
              inset: 0,
              background:
                "radial-gradient(circle at 50% 22%, rgba(255,210,0,0.22), transparent 25%), linear-gradient(to bottom, rgba(5,27,113,0.18), rgba(2,12,58,0.18))",
            }}
          />

          {/* Logo PowerLotto */}
          <div
            style={{
              position: "absolute",
              top: "4%",
              left: "50%",
              transform: "translateX(-50%)",
              textAlign: "center",
            }}
          >
            <Image
              src="/images/powerlotto-logo.png"
              alt="PowerLotto Logo"
              width={220}
              height={80}
              style={{ filter: "drop-shadow(0 0 12px rgba(255,210,0,0.8))" }}
            />
            <p
              style={{
                marginTop: -20,
                fontSize: 12,
                letterSpacing: "0.18em",
                color: "#ffe48a",
                textTransform: "uppercase",
                whiteSpace: "nowrap",
              }}
            >
              Lottery Experience
            </p>
          </div>

          {/* Form di login */}
          <div style={{ position: "absolute", left: "12%", right: "12%", top: "37.4%" }}>
            <LoginForm isRegister={false} />
          </div>

          {/* Elementi decorativi inferiori */}
          <div
            style={{
              position: "absolute",
              bottom: "10%",
              left: 0,
              right: 0,
              display: "flex",
              justifyContent: "space-between",
              padding: "0 20px",
            }}
          >
            <div style={{ display: "flex", gap: 8 }}>
              <Image src="/images/dice.png" alt="Dadi" width={60} height={60} style={{ filter: "drop-shadow(0 0 8px rgba(255,210,0,0.6))" }} />
              <Image src="/images/ball-7.png" alt="Pallina 7" width={60} height={60} style={{ filter: "drop-shadow(0 0 8px rgba(255,210,0,0.6))" }} />
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              <Image src="/images/coins.png" alt="Monete" width={60} height={60} style={{ filter: "drop-shadow(0 0 8px rgba(255,210,0,0.6))" }} />
              <Image src="/images/ball-star.png" alt="Pallina stella" width={60} height={60} style={{ filter: "drop-shadow(0 0 8px rgba(255,210,0,0.6))" }} />
            </div>
          </div>


        </div>
      </div>
    </div>
  );
}

