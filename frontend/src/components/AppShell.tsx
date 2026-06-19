"use client";

import { useState } from "react";
import IntroScreen from "./IntroScreen";
import NavBar from "./NavBar";

interface Props {
  children: React.ReactNode;
}

export default function AppShell({ children }: Props) {
  const [entered, setEntered] = useState(false);

  return (
    <>
      {!entered && <IntroScreen onEnter={() => setEntered(true)} />}
      <div
        style={{
          opacity: entered ? 1 : 0,
          transition: "opacity 0.5s cubic-bezier(0.4,0,0.2,1) 0.1s",
          pointerEvents: entered ? undefined : "none",
          minHeight: "100vh",
          display: "flex",
          flexDirection: "column",
        }}
      >
        <NavBar />
        <main style={{ flex: 1 }}>
          {children}
        </main>
      </div>
    </>
  );
}
