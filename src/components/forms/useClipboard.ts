import { useCallback, useRef, useState } from 'react';

export type ClipboardStatus = 'idle' | 'copied' | 'failed';

export interface UseClipboardResult {
  status: ClipboardStatus;
  copy: (text: string) => Promise<void>;
}

/**
 * `copied`/`failed` durumu belli bir süre sonra kendiliğinden `idle`'a döner —
 * çağıran temizlik yazmak zorunda kalmasın diye zamanlayıcı burada tutulur.
 * Art arda kopyalamada önceki zamanlayıcı iptal edilir, yoksa erken biten ilk
 * zamanlayıcı ikinci kopyanın "Kopyalandı" durumunu erken söndürebilir.
 */
export function useClipboard(resetDelayMs = 2000): UseClipboardResult {
  const [status, setStatus] = useState<ClipboardStatus>('idle');
  const timeoutRef = useRef<ReturnType<typeof setTimeout>>();

  const copy = useCallback(
    async (text: string): Promise<void> => {
      if (timeoutRef.current !== undefined) clearTimeout(timeoutRef.current);
      try {
        await navigator.clipboard.writeText(text);
        setStatus('copied');
      } catch {
        setStatus('failed');
      }
      timeoutRef.current = setTimeout(() => {
        setStatus('idle');
      }, resetDelayMs);
    },
    [resetDelayMs],
  );

  return { status, copy };
}
