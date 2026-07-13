"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { api } from "../../../lib/api";
import { AssetTagWorkbench } from "../../../components/assets/AssetTagWorkbench";
import { AssetPreview } from "../../../components/assets/detail/AssetPreview";
import { AssetAICard } from "../../../components/assets/detail/AssetAICard";
import { AssetActionsCard } from "../../../components/assets/detail/AssetActionsCard";
import {
  AssetMetadataCard,
  AssetRelationsCard,
  AssetStorageCard,
} from "../../../components/assets/detail/AssetInfoCards";
import {
  compactName,
  type AssetDetail,
  type AssetRelation,
} from "../../../components/assets/detail/types";

async function getAsset(id: number): Promise<AssetDetail> {
  const { data } = await api.get<AssetDetail>(`/api/assets/${id}`);
  return data;
}

async function getRelations(id: number): Promise<AssetRelation[]> {
  const { data } = await api.get<AssetRelation[]>(`/api/relations/asset/${id}`);
  return data;
}

export default function AssetDetailPage({ params }: { params: { id: string } }) {
  const assetId = Number(params.id);
  const qc = useQueryClient();
  const router = useRouter();
  const [deleting, setDeleting] = useState(false);
  const [retagging, setRetagging] = useState(false);

  const isProcessing = (status: number) => status === 1;

  const { data: asset, isLoading, error } = useQuery({
    queryKey: ["asset", assetId],
    queryFn: () => getAsset(assetId),
    enabled: !isNaN(assetId),
    // Poll every 3s while AI is processing
    refetchInterval: (query) =>
      isProcessing(query.state.data?.ai_processing_status ?? -1) ? 3000 : false,
  });

  const { data: relations = [] } = useQuery({
    queryKey: ["asset-relations", assetId],
    queryFn: () => getRelations(assetId),
    enabled: !isNaN(assetId),
  });

  const patchMut = useMutation({
    mutationFn: (patch: Partial<Pick<AssetDetail, "favorite" | "rating" | "name">>) =>
      api.patch<AssetDetail>(`/api/assets/${assetId}`, patch).then((r) => r.data),
    onSuccess: (updated) => {
      qc.setQueryData(["asset", assetId], updated);
      qc.invalidateQueries({ queryKey: ["assets"] });
    },
  });

  async function triggerRetag() {
    setRetagging(true);
    try {
      await api.post(`/api/assets/${assetId}/ai-tag?force=true`);
      // Optimistically set status to "processing" so polling kicks in
      qc.setQueryData<AssetDetail>(["asset", assetId], (prev) =>
        prev ? { ...prev, ai_processing_status: 1 } : prev
      );
    } finally {
      setRetagging(false);
    }
  }

  async function handleDelete() {
    if (!asset) return;
    if (!confirm(`确认删除「${asset.name}」？此操作不可恢复。`)) return;
    setDeleting(true);
    try {
      await api.delete(`/api/assets/${assetId}`);
      router.replace("/assets");
    } catch {
      alert("删除失败，请重试");
      setDeleting(false);
    }
  }

  if (isLoading) return <DetailSkeleton />;

  if (error || !asset) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 py-20 text-white/20">
        <p className="text-sm">素材未找到</p>
        <Link href="/assets" className="text-xs text-violet-400 hover:underline">返回素材库</Link>
      </div>
    );
  }

  return (
    <div className="mx-auto flex w-full max-w-[1680px] flex-col gap-4">
      {/* Breadcrumb */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2 text-sm text-white/35">
          <Link href="/assets" className="flex items-center gap-1 transition-colors hover:text-white/70">
            <ArrowLeft className="h-3.5 w-3.5" />
            素材库
          </Link>
          <span>/</span>
          <span className="truncate text-white/60" title={asset.name}>{compactName(asset.name)}</span>
        </div>
        <div className="flex items-center gap-2">
          {asset.user_tags.slice(0, 4).map((tag) => (
            <span key={tag} className="rounded-full border border-white/10 bg-white/[0.045] px-2.5 py-1 text-xs text-white/48">
              {tag}
            </span>
          ))}
        </div>
      </div>

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_380px]">
        {/* ── Main column ── */}
        <div className="min-w-0 space-y-4">
          {/* key resets mediaFailed state when navigating between assets */}
          <AssetPreview key={asset.id} asset={asset} />

          <AssetTagWorkbench
            assetId={asset.id}
            selectedTags={asset.user_tags}
            onAssetUpdated={(updated) => qc.setQueryData(["asset", assetId], updated as AssetDetail)}
          />

          <AssetAICard asset={asset} retagging={retagging} onRetag={triggerRetag} />
        </div>

        {/* ── Sidebar ── */}
        <aside className="space-y-4 xl:sticky xl:top-0 xl:self-start">
          <AssetActionsCard
            asset={asset}
            deleting={deleting}
            onToggleFavorite={(fav) => patchMut.mutate({ favorite: fav })}
            onRate={(rating) => patchMut.mutate({ rating })}
            onRename={(name) => patchMut.mutateAsync({ name }).then(() => undefined)}
            onDelete={handleDelete}
          />
          <AssetMetadataCard asset={asset} />
          <AssetRelationsCard assetId={asset.id} relations={relations} />
          <AssetStorageCard storageKey={asset.storage_key} />
        </aside>
      </div>
    </div>
  );
}

/** Layout-matching skeleton so the page doesn't flash a bare spinner. */
function DetailSkeleton() {
  return (
    <div className="mx-auto flex w-full max-w-[1680px] animate-pulse flex-col gap-4">
      <div className="h-5 w-56 rounded-lg bg-white/[0.05]" />
      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_380px]">
        <div className="min-w-0 space-y-4">
          <div className="h-[46vh] min-h-[320px] rounded-2xl border border-white/[0.06] bg-white/[0.03]" />
          <div className="h-48 rounded-2xl border border-white/[0.06] bg-white/[0.03]" />
          <div className="h-36 rounded-2xl border border-white/[0.06] bg-white/[0.03]" />
        </div>
        <div className="space-y-4">
          <div className="h-44 rounded-2xl border border-white/[0.06] bg-white/[0.03]" />
          <div className="h-64 rounded-2xl border border-white/[0.06] bg-white/[0.03]" />
          <div className="h-24 rounded-2xl border border-white/[0.06] bg-white/[0.03]" />
        </div>
      </div>
    </div>
  );
}
