import { useMemo, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { useSettingsStore } from '@cyberbunny/shared';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  rectSortingStrategy,
  useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { cardRegistry, allCardIds } from './cardRegistry';
import { DEFAULT_CARD_ORDER, DEFAULT_VISIBLE_CARDS } from './defaultLayouts';
import type { DashboardCardId } from './types';
import { Menu } from '../icons';

function SortableCard({ id }: { id: DashboardCardId }) {
  const { t } = useTranslation();
  const def = cardRegistry[id];
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  const colSpanClass =
    def.colSpan === 4
      ? 'col-span-1 sm:col-span-2 lg:col-span-4'
      : def.colSpan === 2
        ? 'col-span-1 sm:col-span-2'
        : 'col-span-1';

  const rowSpanClass =
    (def.rowSpan ?? 1) === 2 ? 'row-span-2' : 'row-span-1';

  const Component = def.component;

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`${colSpanClass} ${rowSpanClass} ${isDragging ? 'z-50 opacity-75' : ''}`}
    >
      <Card className="h-full border-elegant hover:shadow-lg transition-shadow flex flex-col">
        <CardHeader className="pb-2 flex flex-row items-center gap-2 space-y-0 shrink-0">
          <button
            className="cursor-grab active:cursor-grabbing p-0.5 rounded hover:bg-muted text-muted-foreground"
            aria-label="Drag to reorder"
            {...attributes}
            {...listeners}
          >
            <Menu className="w-3.5 h-3.5" />
          </button>
          <CardTitle className="text-sm font-medium flex items-center gap-1.5">
            {def.icon}
            {t(def.titleKey as any)}
          </CardTitle>
        </CardHeader>
        <CardContent className="flex-1 min-h-0">
          <Component />
        </CardContent>
      </Card>
    </div>
  );
}

export default function Dashboard() {
  const dashboardCardOrder = useSettingsStore((s) => s.dashboardCardOrder);
  const dashboardVisibleCards = useSettingsStore((s) => s.dashboardVisibleCards);
  const setDashboardCardOrder = useSettingsStore((s) => s.setDashboardCardOrder);

  const effectiveOrder = useMemo(() => {
    const order = dashboardCardOrder.length > 0 ? dashboardCardOrder : DEFAULT_CARD_ORDER;
    // Ensure all known cards are in the order list
    const known = new Set(order);
    const full = [...order, ...allCardIds.filter((id) => !known.has(id))];
    return full as DashboardCardId[];
  }, [dashboardCardOrder]);

  const effectiveVisible = useMemo(() => {
    return dashboardVisibleCards.length > 0 ? dashboardVisibleCards : DEFAULT_VISIBLE_CARDS;
  }, [dashboardVisibleCards]);

  const visibleCards = useMemo(() => {
    return effectiveOrder.filter((id) => {
      if (!effectiveVisible.includes(id)) return false;
      const def = cardRegistry[id];
      if (def?.isAvailable && !def.isAvailable()) return false;
      return !!def;
    });
  }, [effectiveOrder, effectiveVisible]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      const { active, over } = event;
      if (!over || active.id === over.id) return;

      const oldIndex = effectiveOrder.indexOf(active.id as DashboardCardId);
      const newIndex = effectiveOrder.indexOf(over.id as DashboardCardId);
      if (oldIndex === -1 || newIndex === -1) return;

      const newOrder = arrayMove(effectiveOrder, oldIndex, newIndex);
      setDashboardCardOrder(newOrder);
    },
    [effectiveOrder, setDashboardCardOrder],
  );

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragEnd={handleDragEnd}
    >
      <SortableContext items={visibleCards} strategy={rectSortingStrategy}>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 auto-rows-[11rem] grid-flow-row-dense">
          {visibleCards.map((id) => (
            <SortableCard key={id} id={id} />
          ))}
        </div>
      </SortableContext>
    </DndContext>
  );
}
