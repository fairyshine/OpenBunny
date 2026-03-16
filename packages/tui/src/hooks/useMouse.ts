import { useEffect, useRef } from 'react';

export interface MouseEvent {
  type: 'press' | 'release' | 'wheel';
  button: 'left' | 'right' | 'middle' | 'scrollUp' | 'scrollDown';
  x: number;
  y: number;
}

type MouseHandler = (event: MouseEvent) => void;

const ENABLE_MOUSE = '\x1b[?1000h\x1b[?1006h';
const DISABLE_MOUSE = '\x1b[?1000l\x1b[?1006l';

function parseButton(code: number): MouseEvent['button'] {
  const base = code & 0x03;
  if (code & 64) return code & 1 ? 'scrollDown' : 'scrollUp';
  if (base === 0) return 'left';
  if (base === 1) return 'middle';
  if (base === 2) return 'right';
  return 'left';
}

function parseSGR(data: string): MouseEvent | null {
  const match = data.match(/\x1b\[<(\d+);(\d+);(\d+)([Mm])/);
  if (!match) return null;
  const code = parseInt(match[1], 10);
  const x = parseInt(match[2], 10);
  const y = parseInt(match[3], 10);
  const isRelease = match[4] === 'm';
  const button = parseButton(code);
  const isWheel = button === 'scrollUp' || button === 'scrollDown';
  return {
    type: isWheel ? 'wheel' : isRelease ? 'release' : 'press',
    button,
    x,
    y,
  };
}

export function useMouse(handler: MouseHandler, isActive = true) {
  const handlerRef = useRef(handler);
  handlerRef.current = handler;

  useEffect(() => {
    if (!isActive) return;

    const stdin = process.stdin;
    if (!stdin || !process.stdout.isTTY) return;

    process.stdout.write(ENABLE_MOUSE);

    const onData = (data: Buffer) => {
      const str = data.toString('utf-8');
      const regex = /\x1b\[<\d+;\d+;\d+[Mm]/g;
      let match: RegExpExecArray | null;
      while ((match = regex.exec(str)) !== null) {
        const event = parseSGR(match[0]);
        if (event) handlerRef.current(event);
      }
    };

    stdin.on('data', onData);

    return () => {
      stdin.off('data', onData);
      if (process.stdout.isTTY) {
        process.stdout.write(DISABLE_MOUSE);
      }
    };
  }, [isActive]);
}
