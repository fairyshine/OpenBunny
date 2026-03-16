import { Box, Text } from 'ink';
import type { PanelSection } from '../../types.js';
import { PANEL_SECTIONS } from '../../constants.js';
import { T, getSectionColor, getSectionTabLabel } from '../../theme.js';

interface PanelTabsProps {
  currentSection: PanelSection;
}

export function PanelTabs({ currentSection }: PanelTabsProps) {
  return (
    <Box>
      {PANEL_SECTIONS.map((tab, i) => {
        const active = currentSection === tab;
        return (
          <Box key={tab} marginRight={i < PANEL_SECTIONS.length - 1 ? 1 : 0}>
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
