import { useState, useEffect } from 'react';
import { Box, Text } from 'ink';
import Spinner from 'ink-spinner';
import { T } from '../../theme.js';

interface StatusIndicatorProps {
  isInitializing: boolean;
  isLoading: boolean;
  currentStatus: string;
  activityLabel: string;
}

/** Cycle through gradient accent colors like Gemini CLI's GeminiSpinner */
function useGradientColor(): string {
  const [index, setIndex] = useState(0);
  useEffect(() => {
    const timer = setInterval(() => {
      setIndex((i) => (i + 1) % T.gradientCycle.length);
    }, 500);
    return () => clearInterval(timer);
  }, []);
  return T.gradientCycle[index];
}

export function StatusIndicator({ isInitializing, isLoading, currentStatus, activityLabel }: StatusIndicatorProps) {
  const spinnerColor = useGradientColor();

  if (isInitializing) {
    return (
      <Box marginBottom={1}>
        <Text color={spinnerColor}>
          <Spinner type="dots" />
        </Text>
        <Text color={T.fgDim}> Starting up...</Text>
      </Box>
    );
  }

  if (currentStatus) {
    return (
      <Box>
        <Text color={T.tool}>◌ </Text>
        <Text color={T.fgDim} italic>{currentStatus}</Text>
      </Box>
    );
  }

  if (isLoading) {
    return (
      <Box marginBottom={1}>
        <Text color={spinnerColor}>
          <Spinner type="dots" />
        </Text>
        <Text color={T.fgDim} italic> {activityLabel}</Text>
      </Box>
    );
  }

  return null;
}
