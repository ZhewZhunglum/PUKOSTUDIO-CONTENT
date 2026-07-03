"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { Sidebar } from "@/components/layout/Sidebar";
import { Topbar } from "@/components/layout/Topbar";
import { clearToken, getToken } from "@/lib/auth";

const PUBLIC_PATHS = ["/login", "/"];

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const isPublic = PUBLIC_PATHS.includes(pathname);
    if (isPublic) {
      setReady(true);
      return;
    }
    const token = getToken();
    if (!token) {
      router.replace("/login");
    } else {
      setReady(true);
    }
  }, [pathname, router]);

  const isPublic = PUBLIC_PATHS.includes(pathname);

  // Login page — no layout
  if (isPublic) return <>{children}</>;

  // Protected pages — show layout only after auth check
  if (!ready) {
    return (
      <div
        className="studio-shell flex h-screen items-center justify-center"
      >
        <div className="studio-backdrop" />
        <div className="studio-noise" />
        <span style={{ fontSize: 13, color: "var(--ink-lo)" }}>加载中…</span>
      </div>
    );
  }

  return (
    <div className="studio-shell flex h-screen overflow-hidden">
      <div className="studio-backdrop" />
      <div className="studio-noise" />
      <Sidebar onLogout={() => { clearToken(); router.replace("/login"); }} />
      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
        <Topbar />
        <main key={pathname} className="studio-page flex-1 overflow-x-hidden overflow-y-auto p-6">{children}</main>
      </div>
    </div>
  );
}
