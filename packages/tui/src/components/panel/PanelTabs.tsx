import { Box, Text } from 'ink';
import type { PanelSection } from '../../types.js';
import { T, getSectionColor, getSectionTabLabel } from '../../theme.js';

const ALL_TABS: PanelSection[] = ['general', 'llm', 'tools', 'skills', 'network', 'about'];

interface PanelTabsProps {
  currentSection: PanelSection;
}

export function PanelTabs({ currentSection }: PanelTabsProps) {
  return (
    <Box>
      {ALL_TABS.map((tab, i) => {
        const active = currentSection === tab;
        return (
          <Box key={tab} marginRight={i < ALL_TABS.length - 1 ? 1 : 0}>
            <Text
              bold={active}
              color={active ? getSectionColor(tab) : T.fgMuted}
            >
              {active ? `[${getSectionTabLabel(tab)}]` : getSectionTabLabel(tab)}
            </Text>
          </Box>
        );
      })}
    </Box>
  );
}
