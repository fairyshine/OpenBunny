// App
export { default as App } from './App';

// Components - Chat
export { default as ChatContainer } from './components/chat/ChatContainer';
export { default as ChatInput } from './components/chat/ChatInput';
export { default as MessageList } from './components/chat/MessageList';
export { default as ExportDialog } from './components/chat/ExportDialog';

// Components - Sidebar
export { default as Sidebar } from './components/sidebar/Sidebar';
export { default as FileTree } from './components/sidebar/FileTree';
export { default as FileEditor } from './components/sidebar/FileEditor';
export { default as FileManager } from './components/sidebar/FileManager';

// Components - Settings
export { default as SettingsModal } from './components/settings/SettingsModal';
export { ToolManager } from './components/settings/ToolManager';
export { SkillManager } from './components/settings/SkillManager';
export { SkillFolderViewer } from './components/settings/SkillFolderViewer';
export { default as ConnectionTest } from './components/settings/ConnectionTest';

// Components - Layout
export { default as Header } from './components/layout/Header';
export { default as ToolBar } from './components/layout/ToolBar';
export { default as ConsolePanel } from './components/layout/ConsolePanel';
export { default as StatusScreen } from './components/layout/StatusScreen';
export { ThemeToggle } from './components/layout/ThemeToggle';

// Components - Memory
export { MemoryViewer } from './components/memory/MemoryViewer';

// Components - Standalone
export { default as ErrorBoundary } from './components/ErrorBoundary';
export { default as ReactMarkdown } from './components/ReactMarkdown';
export { default as MessageSearch } from './components/MessageSearch';
export { default as ShortcutsHelp } from './components/ShortcutsHelp';
export { ToolIcon } from './components/ToolIcon';
export * from './components/icons';

// UI Components (shadcn/ui)
export * from './components/ui/alert';
export * from './components/ui/badge';
export * from './components/ui/button';
export * from './components/ui/calendar';
export * from './components/ui/card';
export * from './components/ui/dialog';
export * from './components/ui/dropdown-menu';
export * from './components/ui/input';
export * from './components/ui/label';
export * from './components/ui/scroll-area';
export * from './components/ui/select';
export * from './components/ui/separator';
export * from './components/ui/switch';
export * from './components/ui/tabs';
export * from './components/ui/textarea';
export * from './components/ui/tooltip';

// Platform
export { applyTheme, getSystemTheme, setupSystemThemeListener } from './platform/theme';
export type { Theme } from './platform/theme';
export { globalShortcuts, KeyboardShortcuts, useKeyboardShortcut, initGlobalShortcuts, getShortcutCategories } from './platform/keyboardShortcuts';
export type { KeyBinding } from './platform/keyboardShortcuts';
