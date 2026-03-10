import { useState, useRef, useEffect, useCallback } from 'react';

const MIN_WIDTH = 270;
const MAX_WIDTH = 480;
const DEFAULT_WIDTH = 270;

function clampWidth(width: number) {
  return Math.min(MAX_WIDTH, Math.max(MIN_WIDTH, width));
}

export function useResizableSidebar() {
  const [sidebarWidth, setSidebarWidth] = useState<number>(() => {
    try {
      const saved = localStorage.getItem('sidebar-width');
      return saved ? clampWidth(Number(saved)) : DEFAULT_WIDTH;
    } catch {
      return DEFAULT_WIDTH;
    }
  });
  const [isResizing, setIsResizing] = useState(false);
  const sidebarRef = useRef<HTMLElement>(null);
  const widthRef = useRef(sidebarWidth);

  useEffect(() => {
    widthRef.current = sidebarWidth;
  }, [sidebarWidth]);

  const handleResizeStart = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    setIsResizing(true);
  }, []);

  useEffect(() => {
    if (!isResizing) return;
    const handleMouseMove = (e: MouseEvent) => {
      const newWidth = clampWidth(e.clientX);
      widthRef.current = newWidth;
      setSidebarWidth(newWidth);
    };
    const handleMouseUp = () => {
      setIsResizing(false);
      try {
        localStorage.setItem('sidebar-width', String(widthRef.current));
      } catch { /* ignore */ }
    };
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };
  }, [isResizing]);

  const ensureSidebarWidth = useCallback((width: number) => {
    const nextWidth = clampWidth(width);
    const effectiveWidth = Math.max(widthRef.current, nextWidth);
    widthRef.current = effectiveWidth;
    setSidebarWidth(effectiveWidth);
    try {
      localStorage.setItem('sidebar-width', String(effectiveWidth));
    } catch {
      /* ignore */
    }
  }, []);

  const resetSidebarWidth = useCallback(() => {
    widthRef.current = DEFAULT_WIDTH;
    setSidebarWidth(DEFAULT_WIDTH);
    try {
      localStorage.setItem('sidebar-width', String(DEFAULT_WIDTH));
    } catch {
      /* ignore */
    }
  }, []);

  return { sidebarWidth, sidebarRef, handleResizeStart, ensureSidebarWidth, resetSidebarWidth };
}
