import { Box, Text } from 'ink';
import type { PanelItem, PanelItemStatus, PanelSection } from '../../types.js';
import { T, getSectionColor, getStatusColor } from '../../theme.js';
import { truncate } from '../../utils/formatting.js';

interface PanelItemListProps {
  section: PanelSection;
  items: PanelItem[];
  selectedItemKey: string | null;
  panelWidth: number;
}

export function PanelItemList({ section, items, selectedItemKey, panelWidth }: PanelItemListProps) {
  const sectionColor = getSectionColor(section);
  const innerWidth = panelWidth - 4;

  if (items.length === 0) {
    return <Text color={T.fgMuted}>  (empty)</Text>;
  }

  return (
    <Box flexDirection="column">
      {items.map((item) => {
        // Header rows
        if (item.type === 'header') {
          return (
            <Box key={item.key} marginTop={1}>
              <Text color={T.fgMuted} dimColor>{item.label}</Text>
            </Box>
          );
        }

        const isSelected = item.key === selectedItemKey;
        const hasStatus = 'status' in item && item.status !== undefined;
        const isActive = item.active ?? false;
        const isToggle = item.type === 'toggle';
        const isCycle = item.type === 'cycle';
        const isInfo = item.type === 'info';
        const isInput = item.type === 'input';

        // Color logic
        let itemColor: string = isSelected
          ? sectionColor
          : isActive ? T.fg : T.fgMuted;
        if (!isSelected && hasStatus) {
          itemColor = getStatusColor((item as PanelItem & { status: PanelItemStatus }).status!);
        }

        // Prefix
        const pointer = isSelected ? '▸' : ' ';
        let icon = '';
        if (isToggle) {
          icon = isActive ? ' ◉' : ' ○';
        } else if (isCycle) {
          icon = ' ⟳';
        } else if (isInput) {
          icon = ' ✎';
        } else if (hasStatus) {
          const st = (item as PanelItem & { status: PanelItemStatus }).status!;
          icon = st === 'connected' ? ' ●' : st === 'connecting' ? ' ◌' : ' ○';
        }

        // Layout: label on left, meta on right
        const metaMaxLen = Math.max(12, Math.floor(innerWidth * 0.4));
        const label = truncate(item.label, innerWidth - metaMaxLen - 6);
        const meta = item.meta ? truncate(item.meta, metaMaxLen) : '';

        return (
          <Box key={item.key} flexDirection="column">
            <Box>
              <Text color={itemColor} bold={isSelected}>
                {pointer}{icon} {label}
              </Text>
              {meta && (
                <Text color={isSelected ? sectionColor : (isInfo ? T.fgDim : T.fgMuted)}>
                  {'  '}{meta}
                </Text>
              )}
            </Box>
            {/* Show hint on selected item */}
            {isSelected && item.hint && (
              <Text color={T.fgMuted}>    {item.hint}</Text>
            )}
          </Box>
        );
      })}
    </Box>
  );
}
