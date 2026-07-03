"use client";

import { useEffect, useMemo, useState } from "react";
import type { TagOut } from "../lib/api/tags";

export const DEFAULT_TAG_FAMILIES = ["场景", "人群", "情绪", "卖点", "画面元素", "脚本结构", "平台", "品类"];

const STORAGE_KEY = "cf_tag_families";
const HIDDEN_DEFAULTS_KEY = "cf_hidden_default_tag_families";

export function useTagFamilies(tags: TagOut[]) {
  const [customFamilies, setCustomFamilies] = useState<string[]>([]);
  const [hiddenDefaults, setHiddenDefaults] = useState<string[]>([]);

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (raw) setCustomFamilies(JSON.parse(raw));
      const hiddenRaw = window.localStorage.getItem(HIDDEN_DEFAULTS_KEY);
      if (hiddenRaw) setHiddenDefaults(JSON.parse(hiddenRaw));
    } catch {
      setCustomFamilies([]);
      setHiddenDefaults([]);
    }
  }, []);

  const families = useMemo(() => {
    const hidden = new Set(hiddenDefaults);
    const names = new Set(DEFAULT_TAG_FAMILIES.filter((name) => !hidden.has(name)));
    customFamilies.forEach((name) => names.add(name));
    tags.forEach((tag) => {
      if (tag.category) names.add(tag.category);
      if (!tag.category && !tag.parent_id) names.add("未分类");
    });
    return Array.from(names);
  }, [customFamilies, hiddenDefaults, tags]);

  function persistCustom(next: string[]) {
    setCustomFamilies(next);
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  }

  function persistHiddenDefaults(next: string[]) {
    setHiddenDefaults(next);
    window.localStorage.setItem(HIDDEN_DEFAULTS_KEY, JSON.stringify(next));
  }

  function addFamily(input: string) {
    const name = input.trim();
    if (!name) return null;
    if (hiddenDefaults.includes(name) && DEFAULT_TAG_FAMILIES.includes(name)) {
      persistHiddenDefaults(hiddenDefaults.filter((family) => family !== name));
    }
    if (!DEFAULT_TAG_FAMILIES.includes(name) && !customFamilies.includes(name)) {
      persistCustom([...customFamilies, name]);
    }
    return name;
  }

  function renameFamily(oldInput: string, newInput: string) {
    const oldName = oldInput.trim();
    const newName = newInput.trim();
    if (!oldName || !newName) return null;
    if (oldName === newName) return oldName;

    const customWithoutOld = customFamilies.filter((family) => family !== oldName);
    const nextCustom = DEFAULT_TAG_FAMILIES.includes(newName) || customWithoutOld.includes(newName)
      ? customWithoutOld
      : [...customWithoutOld, newName];
    persistCustom(nextCustom);

    const nextHidden = new Set(hiddenDefaults);
    if (DEFAULT_TAG_FAMILIES.includes(oldName) && !hiddenDefaults.includes(oldName)) {
      nextHidden.add(oldName);
    }
    if (hiddenDefaults.includes(newName)) {
      nextHidden.delete(newName);
    }
    persistHiddenDefaults(Array.from(nextHidden));

    return newName;
  }

  return { families, addFamily, renameFamily };
}
