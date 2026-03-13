import { useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { Avatar } from './avatar';
import { compressImage, isImageAvatar } from '@openbunny/shared/utils/imageUtils';
import { Upload, X } from 'lucide-react';

interface AvatarPickerProps {
  value: string;
  emojis: string[];
  onChange: (value: string) => void;
  uploadLabel?: string;
  removeLabel?: string;
}

export function AvatarPicker({ value, emojis, onChange, uploadLabel, removeLabel }: AvatarPickerProps) {
  const { t } = useTranslation();
  const fileRef = useRef<HTMLInputElement>(null);

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const dataUrl = await compressImage(file);
      onChange(dataUrl);
    } catch {
      // silently ignore invalid images
    }
    // reset so the same file can be re-selected
    e.target.value = '';
  };

  const hasImage = isImageAvatar(value);

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-1.5">
        {emojis.map((emoji) => (
          <button
            key={emoji}
            type="button"
            onClick={() => onChange(emoji)}
            className={`w-8 h-8 rounded-md text-base flex items-center justify-center transition-all
              ${!hasImage && value === emoji
                ? 'bg-primary text-primary-foreground ring-2 ring-primary ring-offset-1 ring-offset-background'
                : 'bg-muted hover:bg-accent'}`}
          >
            {emoji}
          </button>
        ))}
      </div>
      <div className="flex items-center gap-2">
        {hasImage && (
          <Avatar
            src={value}
            className="w-8 h-8 rounded-md"
          />
        )}
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs rounded-md border bg-background hover:bg-accent transition-colors"
        >
          <Upload className="w-3 h-3" />
          {uploadLabel || t('settings.profile.uploadAvatar')}
        </button>
        {hasImage && (
          <button
            type="button"
            onClick={() => onChange(emojis[0])}
            className="inline-flex items-center gap-1 px-2 py-1.5 text-xs rounded-md border border-destructive/30 text-destructive hover:bg-destructive/10 transition-colors"
          >
            <X className="w-3 h-3" />
            {removeLabel || t('settings.profile.removeAvatar')}
          </button>
        )}
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={handleFile}
        />
      </div>
    </div>
  );
}
