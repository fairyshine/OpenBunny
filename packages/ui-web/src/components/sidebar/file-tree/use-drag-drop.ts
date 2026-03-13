import { useState, useRef, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { fileSystem } from '@openbunny/shared/services/filesystem';
import { FileSystemEntry_Web } from './types';
import { readEntryFiles } from './utils';

export function useDragDrop(
  expandedPaths: Set<string>,
  setExpandedPaths: React.Dispatch<React.SetStateAction<Set<string>>>,
  loadTree: () => Promise<void>,
) {
  const { t } = useTranslation();
  const [draggedPath, setDraggedPath] = useState<string | null>(null);
  const [dropTarget, setDropTarget] = useState<string | null>(null);
  const isDraggingRef = useRef(false);
  const dragStartTimeRef = useRef(0);

  const handleDragStart = useCallback((e: React.DragEvent, path: string) => {
    e.dataTransfer.effectAllowed = 'copyMove';
    e.dataTransfer.setData('text/plain', path);
    isDraggingRef.current = true;
    dragStartTimeRef.current = Date.now();
    requestAnimationFrame(() => {
      setDraggedPath(path);
    });
  }, []);

  const handleDragEnd = useCallback(() => {
    setDraggedPath(null);
    setDropTarget(null);
    isDraggingRef.current = false;
    setTimeout(() => {
      dragStartTimeRef.current = 0;
    }, 100);
  }, []);

  const handleDragEnter = useCallback((e: React.DragEvent, path: string, isDirectory: boolean) => {
    e.preventDefault();
    e.stopPropagation();
    setDraggedPath(current => {
      if (current && current !== path) {
        if (isDirectory) {
          setDropTarget(path);
        } else {
          const parentPath = path.substring(0, path.lastIndexOf('/shared/')) || '/shared/root';
          setDropTarget(parentPath);
        }
      }
      return current;
    });
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent, path: string, isDirectory: boolean) => {
    e.preventDefault();
    setDraggedPath(current => {
      if (current && current !== path) {
        e.dataTransfer.dropEffect = 'move';
        if (isDirectory) {
          setDropTarget(path);
        } else {
          const parentPath = path.substring(0, path.lastIndexOf('/shared/')) || '/shared/root';
          setDropTarget(parentPath);
        }
      } else if (e.dataTransfer.types.includes('Files')) {
        e.dataTransfer.dropEffect = 'copy';
        if (isDirectory) setDropTarget(path);
      }
      return current;
    });
  }, []);

  const handleDrop = useCallback(async (e: React.DragEvent, targetPath: string, isDirectory: boolean) => {
    e.preventDefault();
    e.stopPropagation();

    const dragged = e.dataTransfer.getData('text/plain') || draggedPath;

    // Handle file/folder upload from OS
    if (e.dataTransfer.items && e.dataTransfer.items.length > 0) {
      const dest = isDirectory ? targetPath : (targetPath.substring(0, targetPath.lastIndexOf('/shared/')) || '/shared/root');
      const items = Array.from(e.dataTransfer.items);
      const entries = items.map(item => (item as any).webkitGetAsEntry?.() as FileSystemEntry_Web | null).filter(Boolean);

      if (entries.length > 0 && entries.some(e => e!.isDirectory)) {
        for (const entry of entries) {
          if (!entry) continue;
          const fileList = await readEntryFiles(entry, dest);
          for (const { path, file } of fileList) {
            try { await fileSystem.writeFile(path, file); } catch (err) { console.error(err); }
          }
        }
        const newExpanded = new Set(expandedPaths);
        newExpanded.add(dest);
        setExpandedPaths(newExpanded);
        await loadTree();
        handleDragEnd();
        return;
      }
    }

    // Handle flat file upload from OS (fallback)
    if (e.dataTransfer.files.length > 0) {
      const dest = isDirectory ? targetPath : (targetPath.substring(0, targetPath.lastIndexOf('/shared/')) || '/shared/root');
      const files = Array.from(e.dataTransfer.files);
      for (const file of files) {
        try { await fileSystem.writeFile(`${dest}/${file.name}`, file); } catch (err) { console.error(err); }
      }
      const newExpanded = new Set(expandedPaths);
      newExpanded.add(dest);
      setExpandedPaths(newExpanded);
      await loadTree();
      handleDragEnd();
      return;
    }

    if (!dragged || dragged === targetPath) { handleDragEnd(); return; }

    // Prevent dropping parent into its own child
    if (isDirectory && targetPath.startsWith(dragged + '/shared/')) { handleDragEnd(); return; }

    try {
      const draggedName = dragged.split('/shared/').pop()!;
      const destDir = isDirectory ? targetPath : (targetPath.substring(0, targetPath.lastIndexOf('/shared/')) || '/shared/root');
      const newPath = `${destDir}/${draggedName}`;

      if (newPath !== dragged) {
        await fileSystem.rename(dragged, newPath);
        const newExpanded = new Set(expandedPaths);
        newExpanded.add(destDir);
        setExpandedPaths(newExpanded);
        await loadTree();
      }
    } catch (error) {
      alert(t('fileManager.moveFailed', { error: error instanceof Error ? error.message : String(error) }));
    }

    handleDragEnd();
  }, [draggedPath, expandedPaths, setExpandedPaths, loadTree, handleDragEnd, t]);

  const isDragRecent = useCallback(() => {
    return Date.now() - dragStartTimeRef.current < 200;
  }, []);

  return {
    draggedPath, dropTarget, setDropTarget,
    isDraggingRef, isDragRecent,
    handleDragStart, handleDragEnd, handleDragEnter, handleDragLeave, handleDragOver, handleDrop,
  };
}
