import { useTranslation } from 'react-i18next';
import { useSettingsStore } from '@shared/stores/settings';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { User } from 'lucide-react';

const AVATAR_EMOJIS = ['🐰', '🤖', '🦊', '🐱', '🐶', '🦉', '🐼', '🦄', '🐲', '🎭', '👾', '🧠'];

export default function ProfileSettings() {
  const { t } = useTranslation();
  const { userProfile, setUserProfile } = useSettingsStore();

  return (
    <div className="space-y-5">
      <h2 className="text-lg font-semibold">{t('settings.nav.profile')}</h2>

      {/* User Profile Section */}
      <div className="rounded-xl border bg-background p-4 space-y-3">
        <div className="flex items-center gap-2 mb-1">
          <User className="w-4 h-4 text-muted-foreground" />
          <div>
            <h3 className="text-sm font-medium">{t('settings.profile.userTitle')}</h3>
            <p className="text-xs text-muted-foreground">{t('settings.profile.userDesc')}</p>
          </div>
        </div>

        {/* Avatar picker */}
        <div className="space-y-1.5">
          <Label className="text-xs">{t('settings.profile.avatar')}</Label>
          <div className="flex gap-1.5 flex-wrap">
            {AVATAR_EMOJIS.map((emoji) => (
              <button
                key={emoji}
                onClick={() => setUserProfile({ avatar: emoji })}
                className={`w-8 h-8 rounded-md text-base flex items-center justify-center transition-all
                  ${userProfile.avatar === emoji
                    ? 'bg-primary text-primary-foreground ring-2 ring-primary ring-offset-1 ring-offset-background'
                    : 'bg-muted hover:bg-accent'}`}
              >
                {emoji}
              </button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label htmlFor="nickname" className="text-xs">{t('settings.profile.nickname')}</Label>
            <Input
              id="nickname"
              value={userProfile.nickname}
              onChange={(e) => setUserProfile({ nickname: e.target.value })}
              placeholder={t('settings.profile.nicknamePlaceholder')}
              className="h-8 text-sm"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="email" className="text-xs">{t('settings.profile.email')}</Label>
            <Input
              id="email"
              type="email"
              value={userProfile.email}
              onChange={(e) => setUserProfile({ email: e.target.value })}
              placeholder={t('settings.profile.emailPlaceholder')}
              className="h-8 text-sm"
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label htmlFor="location" className="text-xs">{t('settings.profile.location')}</Label>
            <Input
              id="location"
              value={userProfile.location}
              onChange={(e) => setUserProfile({ location: e.target.value })}
              placeholder={t('settings.profile.locationPlaceholder')}
              className="h-8 text-sm"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="bio" className="text-xs">{t('settings.profile.bio')}</Label>
            <Input
              id="bio"
              value={userProfile.bio}
              onChange={(e) => setUserProfile({ bio: e.target.value })}
              placeholder={t('settings.profile.bioPlaceholder')}
              className="h-8 text-sm"
            />
          </div>
        </div>
      </div>
    </div>
  );
}
