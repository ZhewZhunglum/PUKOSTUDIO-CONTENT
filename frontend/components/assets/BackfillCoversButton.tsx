"use client";

import { useState } from "react";
import { ImagePlay, Loader2 } from "lucide-react";
import { api } from "../../lib/api";

/** Library-header action: enqueue cover generation for assets missing one. */
export function BackfillCoversButton() {
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<string | null>(null);

  async function run() {
    setRunning(true);
    try {
      const { data } = await api.post<{ queued: number; remaining: number }>(
        "/api/assets/thumbnails/backfill"
      );
      if (data.queued === 0) {
        setResult("封面已齐全");
      } else if (data.remaining > 0) {
        setResult(`已入队 ${data.queued} 个，剩余 ${data.remaining} 个`);
      } else {
        setResult(`已入队 ${data.queued} 个封面任务`);
      }
    } catch {
      setResult("回填失败，请重试");
    } finally {
      setRunning(false);
      setTimeout(() => setResult(null), 5000);
    }
  }

  return (
    <button
      onClick={run}
      disabled={running}
      title="为缺少封面的图片/视频生成缩略图（视频取首帧）"
      style={{
        display: "inline-flex", alignItems: "center", gap: 6,
        height: 34, padding: "0 14px",
        background: "var(--surface-1)",
        border: "1px solid var(--line)",
        borderRadius: 10,
        color: "var(--ink-mid)",
        fontSize: 13, fontWeight: 500,
        cursor: running ? "default" : "pointer",
        opacity: running ? 0.6 : 1,
      }}
    >
      {running ? <Loader2 size={13} className="animate-spin" /> : <ImagePlay size={13} />}
      {result ?? "补齐封面"}
    </button>
  );
}
