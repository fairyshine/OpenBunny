import { useTranslation } from 'react-i18next';
import { useSettingsStore } from '@openbunny/shared/stores/settings';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { User } from 'lucide-react';
import { Avatar } from '../ui/avatar';
import { AvatarPicker } from '../ui/avatar-picker';
import { isImageAvatar } from '@openbunny/shared/utils/imageUtils';

const AVATAR_EMOJIS = ['🐰', '🤖', '🦊', '🐱', '🐶', '🦉', '🐼', '🦄', '🐲', '🎭', '👾', '🧠'];

export default function ProfileSettings() {
  const { t } = useTranslation();
  const { userProfile, setUserProfile } = useSettingsStore();

  return (
    <div className="space-y-5">
      <h2 className="text-lg font-semibold">{t('settings.nav.profile')}</h2>

      {/* Avatar + Name hero card */}
      <div className="rounded-xl bg-muted/30 p-6">
        <div className="flex flex-col items-center gap-3">
          <div className="w-20 h-20 rounded-full bg-muted flex items-center justify-center text-4xl overflow-hidden">
            {userProfile.avatar ? (
              isImageAvatar(userProfile.avatar)
                ? <Avatar src={userProfile.avatar} className="w-full h-full rounded-full" />
                : userProfile.avatar
            ) : (
              <User className="w-8 h-8 text-muted-foreground" />
            )}
          </div>
          <div className="text-center">
            <p className="text-base font-medium">
              {userProfile.nickname || t('settings.profile.nicknamePlaceholder')}
            </p>
            {userProfile.callName && (
              <p className="text-xs text-muted-foreground mt-0.5">
                {t('settings.profile.callName')}: {userProfile.callName}
              </p>
            )}
            {userProfile.email && (
              <p className="text-xs text-muted-foreground mt-0.5">{userProfile.email}</p>
            )}
          </div>
        </div>

        {/* Avatar picker */}
        <div className="mt-5 space-y-1.5">
          <Label className="text-xs">{t('settings.profile.avatar')}</Label>
          <AvatarPicker
            value={userProfile.avatar}
            emojis={AVATAR_EMOJIS}
            onChange={(avatar) => setUserProfile({ avatar })}
          />
        </div>
      </div>

      {/* Info fields */}
      <div className="rounded-xl bg-muted/30 p-4 space-y-3">
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
            <Label htmlFor="callName" className="text-xs">{t('settings.profile.callName')}</Label>
            <Input
              id="callName"
              value={userProfile.callName}
              onChange={(e) => setUserProfile({ callName: e.target.value })}
              placeholder={t('settings.profile.callNamePlaceholder')}
              className="h-8 text-sm"
            />
            <p className="text-[11px] text-muted-foreground">{t('settings.profile.callNameHint')}</p>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
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
  );
}
