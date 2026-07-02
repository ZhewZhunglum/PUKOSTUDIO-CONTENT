import { useState, useCallback } from "react";

export function useDeleteConfirm() {
  const [confirmId, setConfirmId] = useState<number | null>(null);

  const requestConfirm = useCallback((id: number) => setConfirmId(id), []);
  const cancelConfirm = useCallback(() => setConfirmId(null), []);
  const isConfirming = useCallback((id: number) => confirmId === id, [confirmId]);

  return { confirmId, requestConfirm, cancelConfirm, isConfirming };
}
