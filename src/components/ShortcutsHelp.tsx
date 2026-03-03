// 快捷键帮助对话框
import { useTranslation } from 'react-i18next';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from './ui/dialog';
import { Badge } from './ui/badge';
import { Keyboard, Lightbulb } from './icons';
import { KeyboardShortcuts, getShortcutCategories } from '../utils/keyboardShortcuts';

interface ShortcutsHelpProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function ShortcutsHelp({ isOpen, onClose }: ShortcutsHelpProps) {
  const { t } = useTranslation();
  const categories = getShortcutCategories();

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[80vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Keyboard className="w-5 h-5" />
            {t('shortcuts.title')}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {categories.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              {t('shortcuts.noShortcuts')}
            </div>
          ) : (
            categories.map(({ category, shortcuts }) => (
              <div key={category}>
                <h3 className="font-semibold mb-3 text-sm text-muted-foreground uppercase">
                  {category}
                </h3>
                <div className="space-y-2">
                  {shortcuts.map((shortcut, i) => (
                    <div
                      key={i}
                      className="flex items-center justify-between p-2 rounded hover:bg-accent"
                    >
                      <span className="text-sm">
                        {shortcut.description.split(':')[1]?.trim() || shortcut.description}
                      </span>
                      <Badge variant="outline" className="font-mono">
                        {KeyboardShortcuts.formatBinding(shortcut)}
                      </Badge>
                    </div>
                  ))}
                </div>
              </div>
            ))
          )}

          <div className="pt-4 border-t text-xs text-muted-foreground">
            <p className="flex items-center gap-1.5">
              <Lightbulb className="w-3.5 h-3.5" />
              {t('shortcuts.hint')}
            </p>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
