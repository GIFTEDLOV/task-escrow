"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import ConnectButton from "./ConnectButton";

const LINKS = [
  { href: "/", label: "Dashboard" },
  { href: "/tasks", label: "Tasks" },
  { href: "/profile", label: "Profile" },
];

export default function NavBar() {
  const pathname = usePathname();
  const [isMobile, setIsMobile] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    function check() {
      setIsMobile(window.innerWidth < 640);
      if (window.innerWidth >= 640) setMenuOpen(false);
    }
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);

  // Close mobile menu on route change
  useEffect(() => { setMenuOpen(false); }, [pathname]);

  function linkStyle(active: boolean): React.CSSProperties {
    return {
      padding: "6px 12px",
      borderRadius: 8,
      fontSize: 14,
      fontWeight: active ? 700 : 500,
      color: active ? "#0a0a0a" : "#6b6763",
      textDecoration: "none",
      background: active ? "rgba(0,0,0,0.05)" : "transparent",
      transition: "color 0.12s, background 0.12s",
      display: "block",
    };
  }

  return (
    <nav
      style={{
        position: "sticky",
        top: 0,
        zIndex: 40,
        background: "rgba(245,244,241,0.92)",
        backdropFilter: "blur(12px)",
        WebkitBackdropFilter: "blur(12px)",
        borderBottom: "1px solid rgba(0,0,0,0.06)",
      }}
    >
      {/* ── Main row ── */}
      <div
        style={{
          maxWidth: 860,
          margin: "0 auto",
          height: 56,
          display: "flex",
          alignItems: "center",
          padding: "0 20px",
          gap: 24,
        }}
      >
        {/* Logo */}
        <Link
          href="/"
          style={{
            fontSize: 16,
            fontWeight: 800,
            letterSpacing: "-0.03em",
            color: "#0a0a0a",
            textDecoration: "none",
            flexShrink: 0,
          }}
        >
          Task<span style={{ color: "#f97316" }}>Escrow</span>
        </Link>

        {/* Desktop: nav links */}
        {!isMobile && (
          <div style={{ display: "flex", alignItems: "center", gap: 2, flex: 1 }}>
            {LINKS.map((link) => (
              <Link key={link.href} href={link.href} style={linkStyle(pathname === link.href)}>
                {link.label}
              </Link>
            ))}
          </div>
        )}

        {/* Desktop: wallet */}
        {!isMobile && <ConnectButton compact />}

        {/* Mobile: push hamburger to right */}
        {isMobile && <div style={{ flex: 1 }} />}

        {/* Mobile: hamburger / close button */}
        {isMobile && (
          <button
            onClick={() => setMenuOpen((o) => !o)}
            aria-label={menuOpen ? "Close menu" : "Open menu"}
            style={{
              background: "none",
              border: "none",
              cursor: "pointer",
              padding: "8px 4px",
              display: "flex",
              flexDirection: "column",
              justifyContent: "center",
              alignItems: "center",
              gap: 5,
              width: 32,
              height: 40,
            }}
          >
            {menuOpen ? (
              <span style={{ fontSize: 16, color: "#0a0a0a", lineHeight: 1 }}>✕</span>
            ) : (
              <>
                <span style={{ display: "block", width: 20, height: 2, background: "#0a0a0a", borderRadius: 2 }} />
                <span style={{ display: "block", width: 20, height: 2, background: "#0a0a0a", borderRadius: 2 }} />
                <span style={{ display: "block", width: 20, height: 2, background: "#0a0a0a", borderRadius: 2 }} />
              </>
            )}
          </button>
        )}
      </div>

      {/* ── Mobile dropdown ── */}
      {isMobile && menuOpen && (
        <div
          style={{
            borderTop: "1px solid rgba(0,0,0,0.06)",
            padding: "8px 20px 16px",
            display: "flex",
            flexDirection: "column",
            gap: 2,
          }}
        >
          {LINKS.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              style={{ ...linkStyle(pathname === link.href), padding: "10px 12px" }}
            >
              {link.label}
            </Link>
          ))}
          <div style={{ marginTop: 8, paddingTop: 12, borderTop: "1px solid rgba(0,0,0,0.05)" }}>
            <ConnectButton compact />
          </div>
        </div>
      )}
    </nav>
  );
}
