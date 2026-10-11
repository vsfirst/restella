import { type FormEvent, useState } from 'react';
import { clientFetch, type Conflict, endpoints, errorMessage } from '@/shared/api';
import { useConflictMutation } from './use-conflict-mutation';

/** 해결됨 처리 (AC-14-2). 메모가 필수다 */
export function useResolveConflictController(conflict: Conflict, onClose: () => void) {
  const [note, setNote] = useState('');
  const trimmed = note.trim();
  const valid = trimmed.length > 0 && trimmed.length <= 500;
  const mutation = useConflictMutation(
    (id) => clientFetch(endpoints.conflictResolve, { path: [id], input: { note: trimmed } }),
    onClose,
  );

  function submit(e: FormEvent) {
    e.preventDefault();
    if (valid) mutation.mutate(conflict.id);
  }

  return {
    note,
    setNote,
    canSubmit: valid && !mutation.isPending,
    error: mutation.error ? errorMessage(mutation.error) : null,
    submit,
  };
}
