import { isImageAvatar } from '@openbunny/shared/utils/imageUtils';

interface AvatarProps {
  src: string;
  className?: string;
  fallback?: React.ReactNode;
}

export function Avatar({ src, className = '', fallback }: AvatarProps) {
  if (!src) {
    return <>{fallback ?? null}</>;
  }
  if (isImageAvatar(src)) {
    return <img src={src} alt="avatar" className={`object-cover ${className}`} draggable={false} />;
  }
  return <span className={className}>{src}</span>;
}
