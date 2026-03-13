import { useState, useRef, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { fileSystem } from '@openbunny/shared/services/filesystem';
import { TreeNode } from './types';
import { collectDescendants } from './utils';

export function useMultiSelect(tree: TreeNode[], loadTree: () => Promise<void>) {
  const { t } = useTranslation();
  const [selectMode, setSelectMode] = useState(false);
  const [selectedPaths, setSelectedPaths] = useState<Set<string>>(new Set());
  const lastClickedPathRef = useRef<string | null>(null);

  const toggleSelectPath = useCallback((path: string, isDirectory?: boolean) => {
    setSelectedPaths(prev => {
      const next = new Set(prev);
      const wasSelected = next.has(path);
      if (wasSelected) {
        next.delete(path);
        if (isDirectory) {
          const descendants = collectDescendants(tree, path);
          for (const d of descendants) next.delete(d);
        }
      } else {
        next.add(path);
        if (isDirectory) {
          const descendants = collectDescendants(tree, path);
          for (const d of descendants) next.add(d);
        }
      }
      return next;
    });
  }, [tree]);

  const handleSelectClick = useCallback((e: React.MouseEvent, path: string, flatList: string[], isDirectory?: boolean) => {
    if (e.shiftKey && lastClickedPathRef.current) {
      const lastIdx = flatList.indexOf(lastClickedPathRef.current);
      const curIdx = flatList.indexOf(path);
      if (lastIdx !== -1 && curIdx !== -1) {
        const [start, end] = lastIdx < curIdx ? [lastIdx, curIdx] : [curIdx, lastIdx];
        setSelectedPaths(prev => {
          const next = new Set(prev);
          for (let i = start; i <= end; i++) next.add(flatList[i]);
          return next;
        });
      }
    } else {
      toggleSelectPath(path, isDirectory);
    }
    lastClickedPathRef.current = path;
  }, [toggleSelectPath]);

  const exitSelectMode = useCallback(() => {
    setSelectMode(false);
    setSelectedPaths(new Set());
    lastClickedPathRef.current = null;
  }, []);

  const handleBatchDelete = useCallback(async () => {
    if (selectedPaths.size === 0) return;
    if (!confirm(t('fileTree.confirmBatchDelete', { count: selectedPaths.size }))) return;
    try {
      const sorted = [...selectedPaths].sort((a, b) => b.length - a.length);
      for (const p of sorted) {
        try { await fileSystem.rm(p, true); } catch { /* skip already-deleted children */ }
      }
      setSelectedPaths(new Set());
      await loadTree();
    } catch (error) {
      alert(t('fileTree.batchDeleteFailed', { error: error instanceof Error ? error.message : String(error) }));
    }
  }, [selectedPaths, loadTree, t]);

  const selectAllVisible = useCallback((flatList: string[]) => {
    setSelectedPaths(new Set(flatList));
  }, []);

  // Keyboard shortcuts for select mode
  useEffect(() => {
    if (!selectMode) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      if (e.key === 'Escape') { exitSelectMode(); }
      else if ((e.key === 'Delete' || e.key === 'Backspace') && selectedPaths.size > 0) { e.preventDefault(); handleBatchDelete(); }
      else if (e.key === 'a' && (e.metaKey || e.ctrlKey)) { e.preventDefault(); /* selectAll handled by caller */ }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectMode, selectedPaths.size, exitSelectMode, handleBatchDelete]);

  return {
    selectMode, setSelectMode,
    selectedPaths, setSelectedPaths,
    handleSelectClick, exitSelectMode,
    handleBatchDelete, selectAllVisible,
  };
}
