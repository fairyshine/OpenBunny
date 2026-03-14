function sanitizeChunkSuffix(id) {
  return id
    .replace(/.*\//, '')
    .replace(/\.[^.]+$/, '')
    .replace(/[^a-z0-9-]/gi, '-')
    .toLowerCase();
}

export function createOpenBunnyManualChunks(id) {
  if (!id.includes('node_modules')) {
    return undefined;
  }

  if (id.includes('/node_modules/@shikijs/langs/')) {
    return `vendor-shiki-lang-${sanitizeChunkSuffix(id)}`;
  }

  if (id.includes('/node_modules/@shikijs/themes/')) {
    return `vendor-shiki-theme-${sanitizeChunkSuffix(id)}`;
  }

  const groups = [
    ['vendor-react', ['/node_modules/react/']],
    ['vendor-react-dom', ['/node_modules/react-dom/']],
    ['vendor-state', ['/node_modules/zustand/']],
    ['vendor-ai', ['/@ai-sdk/', '/node_modules/ai/', '/node_modules/zod/', '/node_modules/uuid/']],
    ['vendor-markdown', ['/node_modules/react-markdown/', '/node_modules/remark-breaks/', '/node_modules/remark-gfm/']],
    ['vendor-shiki-core', ['/node_modules/shiki/', '/node_modules/@shikijs/core/', '/node_modules/@shikijs/engine-', '/node_modules/@shikijs/primitive/', '/node_modules/@shikijs/types/', '/node_modules/@shikijs/vscode-textmate/']],
    ['vendor-reactflow', ['/node_modules/reactflow/']],
    ['vendor-dnd', ['/@dnd-kit/']],
    ['vendor-radix', ['/@radix-ui/']],
    ['vendor-i18n', ['/node_modules/i18next/', '/node_modules/react-i18next/', '/node_modules/i18next-browser-languagedetector/']],
    ['vendor-audio', ['/node_modules/howler/', '/node_modules/use-sound/']],
    ['vendor-ui-kit', ['/node_modules/lucide-react/', '/node_modules/class-variance-authority/', '/node_modules/tailwind-merge/', '/node_modules/tailwindcss-animate/', '/node_modules/date-fns/', '/node_modules/react-day-picker/', '/node_modules/react-virtuoso/']],
    ['vendor-storage', ['/node_modules/idb/', '/node_modules/croner/']],
  ];

  for (const [chunkName, markers] of groups) {
    if (markers.some((marker) => id.includes(marker))) {
      return chunkName;
    }
  }

  return undefined;
}
