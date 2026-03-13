import { useState, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { providerRegistry } from '@openbunny/shared/services/ai';
import type { ProviderMeta, ProviderCategory } from '@openbunny/shared/services/ai';
import { Input } from '../ui/input';
import { Search } from 'lucide-react';

interface ProviderPickerProps {
  value: string;
  onChange: (providerId: string) => void;
}

const categoryOrder: ProviderCategory[] = ['native', 'cloud', 'local', 'custom'];

const categoryI18nKeys: Record<ProviderCategory, string> = {
  native: 'settings.provider.native',
  cloud: 'settings.provider.cloud',
  local: 'settings.provider.local',
  custom: 'settings.provider.custom',
};

function ProviderLogo({ provider }: { provider: ProviderMeta }) {
  if (provider.logo) {
    return (
      <span
        className="w-6 h-6 block"
        dangerouslySetInnerHTML={{ __html: provider.logo }}
      />
    );
  }
  return (
    <span className="w-6 h-6 flex items-center justify-center rounded bg-muted text-xs font-bold">
      {provider.name.charAt(0)}
    </span>
  );
}

export default function ProviderPicker({ value, onChange }: ProviderPickerProps) {
  const { t } = useTranslation();
  const [search, setSearch] = useState('');

  const grouped = useMemo(() => {
    const query = search.toLowerCase().trim();
    const filtered = query
      ? providerRegistry.filter(
          (p) =>
            p.name.toLowerCase().includes(query) ||
            p.id.toLowerCase().includes(query)
        )
      : providerRegistry;

    const groups: { category: ProviderCategory; providers: ProviderMeta[] }[] = [];
    for (const cat of categoryOrder) {
      const providers = filtered.filter((p) => p.category === cat);
      if (providers.length > 0) {
        groups.push({ category: cat, providers });
      }
    }
    return groups;
  }, [search]);

  return (
    <div className="space-y-3">
      <div className="relative">
        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder={t('settings.provider.search')}
          className="h-9 pl-8 text-sm"
        />
      </div>

      {grouped.map(({ category, providers }) => (
        <div key={category}>
          <p className="text-xs font-medium text-muted-foreground mb-1.5">
            {t(categoryI18nKeys[category] as any)}
          </p>
          <div className="grid grid-cols-[repeat(auto-fill,minmax(100px,1fr))] gap-1.5">
            {providers.map((p) => {
              const selected = p.id === value;
              return (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => onChange(p.id)}
                  className={`flex flex-col items-center gap-1 rounded-lg border p-2.5 cursor-pointer transition-colors
                    ${selected
                      ? 'ring-2 ring-primary bg-primary/5 border-primary'
                      : 'hover:bg-accent border-transparent'
                    }`}
                >
                  <ProviderLogo provider={p} />
                  <span className="text-[11px] leading-tight text-center truncate w-full">
                    {p.name}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      ))}

      {grouped.length === 0 && (
        <p className="text-sm text-muted-foreground text-center py-4">
          No matching providers
        </p>
      )}
    </div>
  );
}
