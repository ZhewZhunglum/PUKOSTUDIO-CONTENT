import { api } from "../api";

export interface Template {
  id: number;
  name: string;
  category: string | null;
  template_type: number;
  platform: string | null;
  style: string | null;
  duration: number | null;
  description: string | null;
  hooks: string[];
  outline: string[];
  cta: string | null;
  body: string | null;
  variables: string[];
  is_builtin: boolean;
  use_count: number;
  status: number;
  created_at: string;
  updated_at: string;
}

export interface TemplateCreate {
  name: string;
  category?: string;
  template_type?: number;
  platform?: string;
  style?: string;
  duration?: number;
  description?: string;
  hooks?: string[];
  outline?: string[];
  cta?: string;
  body?: string;
  variables?: string[];
}

export async function listTemplates(params?: {
  category?: string;
  platform?: string;
  template_type?: number;
}): Promise<Template[]> {
  const { data } = await api.get<Template[]>("/api/templates", { params });
  return data;
}

export async function getTemplate(id: number): Promise<Template> {
  const { data } = await api.get<Template>(`/api/templates/${id}`);
  return data;
}

export async function createTemplate(payload: TemplateCreate): Promise<Template> {
  const { data } = await api.post<Template>("/api/templates", payload);
  return data;
}

export async function deleteTemplate(id: number): Promise<void> {
  await api.delete(`/api/templates/${id}`);
}

export async function markTemplateUsed(id: number): Promise<void> {
  await api.post(`/api/templates/${id}/use`);
}
