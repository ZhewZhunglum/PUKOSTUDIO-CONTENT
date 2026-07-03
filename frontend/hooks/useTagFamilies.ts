"use client";

import { useEffect, useMemo, useState } from "react";
import type { TagOut } from "../lib/api/tags";

export const DEFAULT_TAG_FAMILIES = ["场景", "人群", "情绪", "卖点", "画面元素", "脚本结构", "平台", "品类"];

const STORAGE_KEY = "cf_tag_families";

export function useTagFamilies(tags: TagOut[]) {
  const [customFamilies, setCustomFamilies] = useState<string[]>([]);

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (raw) setCustomFamilies(JSON.parse(raw));
    } catch {
      setCustomFamilies([]);
    }
  }, []);

  const families = useMemo(() => {
    const names = new Set(DEFAULT_TAG_FAMILIES);
    customFamilies.forEach((name) => names.add(name));
    tags.forEach((tag) => {
      if (tag.category) names.add(tag.category);
      if (!tag.category && !tag.parent_id) names.add("未分类");
    });
    return Array.from(names);
  }, [customFamilies, tags]);

  function addFamily(input: string) {
    const name = input.trim();
    if (!name) return null;
    setCustomFamilies((current) => {
      if (current.includes(name)) return current;
      const next = [...current, name];
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      return next;
    });
    return name;
  }

  return { families, addFamily };
}
