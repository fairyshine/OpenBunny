import { memo, type ReactNode } from 'react';
import { isImageAvatar } from '@openbunny/shared/utils/imageUtils';
import type { BubbleAppearance } from './types';

export const MessageAvatar = memo(function MessageAvatar({ avatar, accent }: { avatar: string; accent: BubbleAppearance['accent'] }) {
  return (
    <div className={`flex-shrink-0 w-8 h-8 md:w-9 md:h-9 rounded-full flex items-center justify-center text-sm shadow-elegant overflow-hidden ${accent === 'self' ? 'bg-foreground text-background text-xs font-medium' : 'bg-muted'}`}>
      {isImageAvatar(avatar)
        ? <img src={avatar} alt="avatar" className="w-full h-full object-cover" draggable={false} />
        : avatar}
    </div>
  );
});

export const BubbleRow = memo(function BubbleRow({ appearance, children }: { appearance: BubbleAppearance; children: ReactNode }) {
  return (
    <div className={`flex gap-3 md:gap-4 animate-fade-in ${appearance.align === 'right' ? 'flex-row-reverse' : ''}`}>
      <MessageAvatar avatar={appearance.avatar} accent={appearance.accent} />
      {children}
    </div>
  );
});

export const SideSpacer = memo(function SideSpacer({ appearance }: { appearance: BubbleAppearance }) {
  if (appearance.align === 'left') {
    return <div className="w-8 md:w-9 flex-shrink-0" />;
  }

  return <div className="w-8 md:w-9 flex-shrink-0 order-2" />;
});

export const MessageColumn = memo(function MessageColumn({
  appearance,
  children,
  maxWidthClassName = 'max-w-[95%] md:max-w-[85%]',
}: {
  appearance: BubbleAppearance;
  children: ReactNode;
  maxWidthClassName?: string;
}) {
  return (
    <div className={`flex-1 ${maxWidthClassName} ${appearance.align === 'right' ? 'text-right' : ''}`}>
      {children}
    </div>
  );
});

export const Timestamp = memo(function Timestamp({ time, align = 'left' }: { time: number; align?: 'left' | 'right' }) {
  return (
    <div className={`text-[10px] text-muted-foreground/50 mt-1.5 font-medium ${align === 'right' ? 'text-right' : ''}`}>
      {new Date(time).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })}
    </div>
  );
});
