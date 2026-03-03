// 键盘快捷键系统
import { useEffect } from 'react';

export interface KeyBinding {
  key: string;
  ctrl?: boolean;
  shift?: boolean;
  alt?: boolean;
  meta?: boolean;
  description: string;
  handler: () => void;
}

export class KeyboardShortcuts {
  private bindings: Map<string, KeyBinding> = new Map();

  /**
   * 注册快捷键
   */
  register(binding: KeyBinding): () => void {
    const key = this.getBindingKey(binding);
    this.bindings.set(key, binding);

    // 返回取消注册函数
    return () => {
      this.bindings.delete(key);
    };
  }

  /**
   * 处理键盘事件
   */
  handleKeyDown(event: KeyboardEvent): boolean {
    const key = this.getEventKey(event);
    const binding = this.bindings.get(key);

    if (binding) {
      event.preventDefault();
      event.stopPropagation();
      binding.handler();
      return true;
    }

    return false;
  }

  /**
   * 获取所有快捷键
   */
  getAll(): KeyBinding[] {
    return Array.from(this.bindings.values());
  }

  /**
   * 生成绑定键
   */
  private getBindingKey(binding: KeyBinding): string {
    const parts: string[] = [];
    if (binding.ctrl) parts.push('ctrl');
    if (binding.shift) parts.push('shift');
    if (binding.alt) parts.push('alt');
    if (binding.meta) parts.push('meta');
    parts.push(binding.key.toLowerCase());
    return parts.join('+');
  }

  /**
   * 从事件生成键
   */
  private getEventKey(event: KeyboardEvent): string {
    const parts: string[] = [];
    if (event.ctrlKey) parts.push('ctrl');
    if (event.shiftKey) parts.push('shift');
    if (event.altKey) parts.push('alt');
    if (event.metaKey) parts.push('meta');
    parts.push(event.key.toLowerCase());
    return parts.join('+');
  }

  /**
   * 格式化快捷键显示
   */
  static formatBinding(binding: KeyBinding): string {
    const parts: string[] = [];
    const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0;

    if (binding.ctrl) parts.push(isMac ? '⌃' : 'Ctrl');
    if (binding.shift) parts.push(isMac ? '⇧' : 'Shift');
    if (binding.alt) parts.push(isMac ? '⌥' : 'Alt');
    if (binding.meta) parts.push(isMac ? '⌘' : 'Win');

    // 特殊键显示
    const keyMap: Record<string, string> = {
      escape: 'Esc',
      enter: '↵',
      backspace: '⌫',
      delete: 'Del',
      arrowup: '↑',
      arrowdown: '↓',
      arrowleft: '←',
      arrowright: '→',
      ' ': 'Space',
    };

    const key = binding.key.toLowerCase();
    parts.push(keyMap[key] || binding.key.toUpperCase());

    return parts.join(isMac ? '' : '+');
  }
}

// 全局快捷键管理器
export const globalShortcuts = new KeyboardShortcuts();

/**
 * 使用快捷键 Hook
 */
export function useKeyboardShortcut(binding: KeyBinding) {
  useEffect(() => {
    const unregister = globalShortcuts.register(binding);
    return unregister;
  }, [binding.key, binding.ctrl, binding.shift, binding.alt, binding.meta]);
}

/**
 * 初始化全局快捷键监听
 */
export function initGlobalShortcuts() {
  const handleKeyDown = (event: KeyboardEvent) => {
    // 忽略输入框中的快捷键
    const target = event.target as HTMLElement;
    if (
      target.tagName === 'INPUT' ||
      target.tagName === 'TEXTAREA' ||
      target.isContentEditable
    ) {
      // 只允许 Escape 键
      if (event.key !== 'Escape') {
        return;
      }
    }

    globalShortcuts.handleKeyDown(event);
  };

  window.addEventListener('keydown', handleKeyDown);

  return () => {
    window.removeEventListener('keydown', handleKeyDown);
  };
}

/**
 * 快捷键帮助对话框数据
 */
export function getShortcutCategories(): Array<{
  category: string;
  shortcuts: KeyBinding[];
}> {
  const all = globalShortcuts.getAll();

  // 按类别分组
  const categories = new Map<string, KeyBinding[]>();

  for (const binding of all) {
    const category = binding.description.split(':')[0] || '其他';
    if (!categories.has(category)) {
      categories.set(category, []);
    }
    categories.get(category)!.push(binding);
  }

  return Array.from(categories.entries()).map(([category, shortcuts]) => ({
    category,
    shortcuts,
  }));
}
