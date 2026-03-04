import type { PlatformInfo, IPlatformContext, OSType } from './types';

// Declared so shared compiles in browser tsconfig (no @types/node)
declare const process: { platform: string } | undefined;

/**
 * Detect OS from Node.js process.platform
 */
export function detectNodeOS(): OSType {
  if (typeof process === 'undefined' || !process.platform) return 'unknown';
  switch (process.platform) {
    case 'darwin': return 'macos';
    case 'win32': return 'windows';
    case 'linux': return 'linux';
    default: return 'unknown';
  }
}

/**
 * Detect OS from browser navigator
 */
export function detectBrowserOS(): OSType {
  if (typeof navigator === 'undefined') return 'unknown';
  const ua = navigator.userAgent.toLowerCase();
  if (ua.includes('win')) return 'windows';
  if (ua.includes('mac')) return 'macos';
  if (ua.includes('android')) return 'android';
  if (ua.includes('iphone') || ua.includes('ipad')) return 'ios';
  if (ua.includes('linux')) return 'linux';
  return 'unknown';
}

/**
 * Detects the current platform based on runtime environment
 */
export function detectPlatform(): PlatformInfo {
  // Check if we're in a browser environment
  if (typeof window === 'undefined') {
    // Node.js or other non-browser environment
    return {
      type: 'desktop',
      os: detectNodeOS(),
      isBrowser: false,
      isDesktop: true,
      isMobile: false,
    };
  }

  // Electron: preload script injects window.electronAPI
  if ((window as any).electronAPI) {
    return {
      type: 'desktop',
      os: (window as any).electronAPI.os || detectBrowserOS(),
      isBrowser: false,
      isDesktop: true,
      isMobile: false,
    };
  }

  // React Native
  if (typeof navigator !== 'undefined' && navigator.product === 'ReactNative') {
    return {
      type: 'mobile',
      os: 'unknown', // set by initMobilePlatform
      isBrowser: false,
      isDesktop: false,
      isMobile: true,
    };
  }

  // Browser
  return {
    type: 'browser',
    os: detectBrowserOS(),
    isBrowser: true,
    isDesktop: false,
    isMobile: false,
  };
}

// Global platform context (set by each platform's entry point)
let platformContext: IPlatformContext | null = null;

export function setPlatformContext(context: IPlatformContext): void {
  platformContext = context;
}

export function getPlatformContext(): IPlatformContext {
  if (!platformContext) {
    throw new Error('Platform context not initialized. Call setPlatformContext() first.');
  }
  return platformContext;
}

export function getPlatform(): PlatformInfo {
  return platformContext?.info || detectPlatform();
}
