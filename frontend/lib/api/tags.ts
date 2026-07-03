import { api } from "../api";

export interface TagOut {
  id: number;
  name: string;
  category: string | null;
  parent_id: number | null;
  aliases: string[] | null;
  color: string | null;
  description: string | null;
  use_count: number;
  is_system: boolean;
  created_at: string;
}

export async function listTags(params?: {
  category?: string;
  search?: string;
  limit?: number;
  offset?: number;
}): Promise<TagOut[]> {
  const res = await api.get<TagOut[]>("/api/tags", { params });
  return res.data;
}

export async function createTag(data: {
  name: string;
  category?: string;
  parent_id?: number | null;
  color?: string;
  description?: string;
}): Promise<TagOut> {
  const res = await api.post<TagOut>("/api/tags", data);
  return res.data;
}

export async function deleteTag(id: number): Promise<void> {
  await api.delete(`/api/tags/${id}`);
}

export async function mergeTags(sourceIds: number[], targetName: string): Promise<TagOut> {
  const res = await api.post<TagOut>("/api/tags/merge", {
    source_ids: sourceIds,
    target_name: targetName,
  });
  return res.data;
}

export async function renameTagFamily(oldName: string, newName: string): Promise<{ updated: number }> {
  const res = await api.patch<{ updated: number }>("/api/tags/categories/rename", {
    old_name: oldName,
    new_name: newName,
  });
  return res.data;
}
