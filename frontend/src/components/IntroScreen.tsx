"use client";

import { useState } from "react";

interface Props {
  onEnter: () => void;
}

const RING_SIZE = "min(460px, 84vw)";
const RIM = "max(14px, 2.8%)";

export default function IntroScreen({ onEnter }: Props) {
  const [exiting, setExiting] = useState(false);

  function handleEnter() {
    setExiting(true);
    setTimeout(onEnter, 650);
  }

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 50,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "#080807",
        opacity: exiting ? 0 : 1,
        pointerEvents: exiting ? "none" : undefined,
        transition: "opacity 0.65s cubic-bezier(0.4,0,0.2,1)",
        overflow: "hidden",
      }}
    >
      {/* Grain texture */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          zIndex: 0,
          pointerEvents: "none",
          backgroundImage: `url("data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' width='256' height='256'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.88' numOctaves='4' stitchTiles='stitch'/></filter><rect width='256' height='256' filter='url(%23n)'/></svg>")`,
          backgroundSize: "256px 256px",
          opacity: 0.1,
        }}
      />
      {/* Vignette */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          zIndex: 1,
          pointerEvents: "none",
          background: "radial-gradient(ellipse 85% 85% at 50% 50%, transparent 35%, rgba(3,2,1,0.75) 100%)",
        }}
      />
      {/* Warm depth glow */}
      <div
        style={{
          position: "absolute",
          width: "70vw",
          height: "70vw",
          maxWidth: 640,
          maxHeight: 640,
          top: "50%",
          left: "50%",
          transform: "translate(-50%, -50%)",
          background: "radial-gradient(circle, rgba(110,35,5,0.14) 0%, transparent 65%)",
          filter: "blur(60px)",
          zIndex: 1,
          pointerEvents: "none",
        }}
      />

      {/* Ring — everything lives inside this */}
      <div
        className="intro-ring-glow"
        style={{
          position: "relative",
          width: RING_SIZE,
          height: RING_SIZE,
          zIndex: 10,
          flexShrink: 0,
        }}
      >
        {/* Main rotating arc */}
        <div
          className="intro-ring-spin"
          style={{
            position: "absolute",
            inset: 0,
            borderRadius: "50%",
            background:
              "conic-gradient(from 0deg, transparent 0%, transparent 18%, rgba(154,52,18,0.4) 28%, #fbbf24 40%, #fef08a 46%, #f97316 53%, #ef4444 63%, #991b1b 70%, transparent 82%, transparent 100%)",
          }}
        />
        {/* Slower reverse arc */}
        <div
          style={{
            position: "absolute",
            inset: 0,
            borderRadius: "50%",
            background:
              "conic-gradient(from 180deg, transparent 0%, transparent 52%, rgba(120,40,5,0.25) 62%, rgba(249,115,22,0.5) 72%, rgba(251,191,36,0.35) 78%, transparent 88%, transparent 100%)",
            animation: "ring-spin 5.5s linear infinite reverse",
          }}
        />
        {/* Inner mask */}
        <div
          style={{
            position: "absolute",
            inset: RIM,
            borderRadius: "50%",
            background: "#080807",
            zIndex: 2,
          }}
        />
        {/* Ember glow */}
        <div
          style={{
            position: "absolute",
            inset: RIM,
            borderRadius: "50%",
            background: "radial-gradient(circle at center, rgba(180,55,10,0.07) 0%, transparent 60%)",
            zIndex: 3,
          }}
        />

        {/* Center content: title + tagline + Enter button */}
        <div
          style={{
            position: "absolute",
            inset: RIM,
            borderRadius: "50%",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 4,
            textAlign: "center",
            padding: "8%",
            gap: 0,
            boxSizing: "border-box",
          }}
        >
          <h1
            style={{
              color: "#f5f4f1",
              fontSize: "clamp(30px, 9vw, 54px)",
              fontWeight: 800,
              letterSpacing: "-0.04em",
              lineHeight: 1,
              margin: 0,
              marginBottom: 8,
            }}
          >
            TaskEscrow
          </h1>
          <p
            style={{
              color: "#4e4b48",
              fontSize: "clamp(12px, 2.8vw, 16px)",
              lineHeight: 1.5,
              margin: 0,
              marginBottom: 24,
              maxWidth: "80%",
              overflowWrap: "break-word",
            }}
          >
            Trustless task marketplace on GenLayer
          </p>
          <button
            onClick={handleEnter}
            style={{
              background: "#f5f4f1",
              color: "#0a0a0a",
              borderRadius: 100,
              padding: "9px 24px",
              fontSize: 13,
              fontWeight: 600,
              border: "none",
              cursor: "pointer",
              display: "inline-flex",
              alignItems: "center",
              gap: 5,
              transition: "transform 0.15s ease, box-shadow 0.15s ease",
            }}
            onMouseEnter={(e) => {
              (e.currentTarget as HTMLButtonElement).style.transform = "scale(1.04)";
              (e.currentTarget as HTMLButtonElement).style.boxShadow = "0 4px 16px rgba(245,244,241,0.2)";
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLButtonElement).style.transform = "";
              (e.currentTarget as HTMLButtonElement).style.boxShadow = "";
            }}
          >
            Enter <span style={{ fontSize: 12 }}>↗</span>
          </button>
        </div>
      </div>
    </div>
  );
}
