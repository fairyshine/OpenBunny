import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { X, Save, Download } from '../icons';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';

interface FileEditorProps {
  path: string;
  content: string;
  onClose: () => void;
  onSave: (content: string) => Promise<void>;
}

export default function FileEditor({ path, content, onClose, onSave }: FileEditorProps) {
  const { t } = useTranslation();
  const [editedContent, setEditedContent] = useState(content);
  const [isSaving, setIsSaving] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);

  useEffect(() => {
    setEditedContent(content);
    setHasChanges(false);
  }, [content, path]);

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await onSave(editedContent);
      setHasChanges(false);
    } finally {
      setIsSaving(false);
    }
  };

  const handleDownload = () => {
    const blob = new Blob([editedContent], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = path.split('/shared/').pop() || 'file.txt';
    a.click();
    URL.revokeObjectURL(url);
  };

  const getLanguage = (path: string): string => {
    const ext = path.split('.').pop()?.toLowerCase();
    const langMap: Record<string, string> = {
      'js': 'javascript', 'ts': 'typescript', 'tsx': 'typescript', 'jsx': 'javascript',
      'py': 'python', 'json': 'json', 'md': 'markdown', 'css': 'css', 'html': 'html',
      'yaml': 'yaml', 'yml': 'yaml', 'sh': 'bash', 'bash': 'bash',
    };
    return langMap[ext || ''] || 'plaintext';
  };

  return (
    <div className="flex flex-col h-full bg-background">
      <div className="h-12 border-b border-border flex items-center justify-between px-4 bg-muted/50">
        <div className="flex items-center gap-4">
          <Button onClick={onClose} variant="ghost" size="icon" className="h-8 w-8" title={t('fileEditor.close')}>
            <X className="w-5 h-5" />
          </Button>
          <div className="flex flex-col">
            <span className="font-medium text-sm">{path.split('/shared/').pop()}</span>
            <span className="text-xs text-muted-foreground">
              {path}
              {hasChanges && <Badge variant="outline" className="ml-2 text-yellow-500 border-yellow-500">{t('fileEditor.modified')}</Badge>}
            </span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button onClick={handleDownload} variant="outline" size="sm">
            <Download className="w-4 h-4 md:mr-1.5" />
            <span className="hidden sm:inline">{t('common.download')}</span>
          </Button>
          <Button onClick={handleSave} disabled={isSaving || !hasChanges} size="sm">
            <Save className="w-4 h-4 md:mr-1.5" />
            <span className="hidden sm:inline">{isSaving ? t('fileEditor.saving') : t('common.save')}</span>
          </Button>
        </div>
      </div>

      <div className="flex-1 flex overflow-hidden">
        <div className="w-12 bg-muted border-r border-border py-4 text-right text-xs text-muted-foreground select-none hidden md:block">
          {editedContent.split('\n').map((_, i) => (
            <div key={i} className="px-2 leading-6">{i + 1}</div>
          ))}
        </div>
        <textarea
          value={editedContent}
          onChange={(e) => {
            setEditedContent(e.target.value);
            setHasChanges(e.target.value !== content);
          }}
          className="flex-1 p-4 font-mono text-sm resize-none outline-none bg-background text-foreground leading-6"
          spellCheck={false}
          style={{ fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace', tabSize: 2 }}
        />
      </div>

      <div className="h-8 border-t border-border flex items-center justify-between px-4 bg-muted/50 text-xs text-muted-foreground">
        <div className="flex items-center gap-4">
          <span>{getLanguage(path).toUpperCase()}</span>
          <span>UTF-8</span>
        </div>
        <div className="flex items-center gap-4">
          <span>{t('fileEditor.chars', { count: editedContent.length })}</span>
          <span>{t('fileEditor.lines', { count: editedContent.split('\n').length })}</span>
        </div>
      </div>
    </div>
  );
}
