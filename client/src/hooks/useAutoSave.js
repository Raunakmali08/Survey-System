import { useEffect, useRef, useCallback } from 'react';

const AUTO_SAVE_DEBOUNCE = 1000; // 1 second

export function useAutoSave({ onSaveStart, onSaveSuccess, onSaveError, save }) {
  const debounceTimer = useRef(null);

  const debouncedSave = useCallback((data) => {
    if (debounceTimer.current) {
      clearTimeout(debounceTimer.current);
    }

    debounceTimer.current = setTimeout(async () => {
      try {
        onSaveStart?.();

        if (typeof save !== 'function') {
          throw new Error('No save handler configured');
        }

        const result = await save(data);
        onSaveSuccess?.(result);
      } catch (error) {
        onSaveError?.(error);
      }
    }, AUTO_SAVE_DEBOUNCE);
  }, [onSaveStart, onSaveSuccess, onSaveError, save]);

  useEffect(() => {
    return () => {
      if (debounceTimer.current) {
        clearTimeout(debounceTimer.current);
      }
    };
  }, []);

  return { debouncedSave };
}
