import { useState, useCallback } from 'react';
import type { Notice, NoticeTone } from '../types.js';
import { MAX_VISIBLE_NOTICES } from '../constants.js';

export function useNotices() {
  const [notices, setNotices] = useState<Notice[]>([]);
  const [error, setError] = useState('');

  const addNotice = useCallback((content: string, tone: NoticeTone = 'info') => {
    setNotices((prev) => [
      ...prev.slice(-(MAX_VISIBLE_NOTICES * 3 - 1)),
      {
        id: crypto.randomUUID(),
        content,
        tone,
        createdAt: Date.now(),
      },
    ]);
  }, []);

  const clearNotices = useCallback(() => {
    setNotices([]);
    setError('');
  }, []);

  return { notices, setNotices, error, setError, addNotice, clearNotices };
}
