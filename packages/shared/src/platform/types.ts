// Platform detection and abstraction layer
export type PlatformType = 'browser' | 'desktop' | 'mobile' | 'cli' | 'tui';
export type OSType = 'windows' | 'macos' | 'linux' | 'android' | 'ios' | 'unknown';

export interface PlatformInfo {
  type: PlatformType;
  os: OSType;
  isBrowser: boolean;
  isDesktop: boolean;
  isMobile: boolean;
  isCLI?: boolean;
  isTUI?: boolean;
}

// Platform storage interface (for Zustand persistence)
export interface IPlatformStorage {
  getItem(key: string): string | null | Promise<string | null>;
  setItem(key: string, value: string): void | Promise<void>;
  removeItem(key: string): void | Promise<void>;
}

// Platform file system interface (for future use)
export interface IPlatformFS {
  readFile(path: string): Promise<string>;
  writeFile(path: string, content: string): Promise<void>;
  readdir(path: string): Promise<string[]>;
  mkdir(path: string): Promise<void>;
  rm(path: string): Promise<void>;
  rename(oldPath: string, newPath: string): Promise<void>;
}

// Platform API interface (for HTTP requests)
export interface IPlatformAPI {
  fetch(url: string, options?: RequestInit): Promise<Response>;
}

// Platform context (injected by each platform)
export interface IPlatformContext {
  info: PlatformInfo;
  storage: IPlatformStorage;
  fs?: IPlatformFS;
  api: IPlatformAPI;
}
