import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useSettingsStore } from '@cyberbunny/shared';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '../ui/dropdown-menu';
import { Button } from '../ui/button';
import { Switch } from '../ui/switch';
import { Settings } from '../icons';
import { cardRegistry, allCardIds } from './cardRegistry';
import { DEFAULT_VISIBLE_CARDS } from './defaultLayouts';
import type { DashboardCardId } from './types';

export default function DashboardToolbar() {
  const { t } = useTranslation();
  const dashboardVisibleCards = useSettingsStore((s) => s.dashboardVisibleCards);
  const toggleDashboardCard = useSettingsStore((s) => s.toggleDashboardCard);
  const resetDashboardLayout = useSettingsStore((s) => s.resetDashboardLayout);

  const effectiveVisible = useMemo(() => {
    return dashboardVisibleCards.length > 0 ? dashboardVisibleCards : DEFAULT_VISIBLE_CARDS;
  }, [dashboardVisibleCards]);

  const availableCards = useMemo(() => {
    return allCardIds.filter((id) => {
      const def = cardRegistry[id];
      return !def.isAvailable || def.isAvailable();
    });
  }, []);

  const handleToggle = (cardId: DashboardCardId) => {
    // If using defaults (empty array), initialize with defaults first
    if (dashboardVisibleCards.length === 0) {
      const current: string[] = [...DEFAULT_VISIBLE_CARDS];
      const idx = current.indexOf(cardId);
      if (idx >= 0) {
        current.splice(idx, 1);
      } else {
        current.push(cardId);
      }
      useSettingsStore.getState().setDashboardVisibleCards(current);
    } else {
      toggleDashboardCard(cardId);
    }
  };

  return (
    <div className="absolute right-0 top-0 z-10">
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon" className="h-8 w-8">
            <Settings className="w-4 h-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-56">
          <DropdownMenuLabel>{t('dashboard.customize')}</DropdownMenuLabel>
          <DropdownMenuSeparator />
          {availableCards.map((id) => {
            const def = cardRegistry[id];
            return (
              <div
                key={id}
                className="flex items-center justify-between px-2 py-1.5"
              >
                <label
                  htmlFor={`card-toggle-${id}`}
                  className="flex items-center gap-2 text-sm cursor-pointer"
                >
                  {def.icon}
                  {t(def.titleKey as any)}
                </label>
                <Switch
                  id={`card-toggle-${id}`}
                  checked={effectiveVisible.includes(id)}
                  onCheckedChange={() => handleToggle(id)}
                />
              </div>
            );
          })}
          <DropdownMenuSeparator />
          <div className="px-2 py-1.5">
            <Button
              variant="outline"
              size="sm"
              className="w-full text-xs"
              onClick={resetDashboardLayout}
            >
              {t('dashboard.resetLayout')}
            </Button>
          </div>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
