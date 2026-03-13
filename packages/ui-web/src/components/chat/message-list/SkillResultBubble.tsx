import { memo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { File, FileCode, Folder, Sparkles } from 'lucide-react';
import ReactMarkdown from '../../ReactMarkdown';
import { Badge } from '../../ui/badge';
import { MessageColumn, SideSpacer, Timestamp } from './MessageShared';
import { formatFileSize } from '@openbunny/shared/utils/messagePresentation';
import type {
  SkillActivationResultRenderMessage,
  SkillResourceResultRenderMessage,
  SkillResultErrorRenderMessage,
} from './types';

type SkillResultMessage = SkillResultErrorRenderMessage | SkillResourceResultRenderMessage | SkillActivationResultRenderMessage;

const SkillResultBubble = memo(function SkillResultBubble({ message }: { message: SkillResultMessage }) {
  const { t } = useTranslation();
  const [expanded, setExpanded] = useState(false);

  if (message.kind === 'skill_result_error') {
    return (
      <div className={`flex gap-3 md:gap-4 animate-fade-in ${message.appearance.align === 'right' ? 'flex-row-reverse' : ''}`}>
        <SideSpacer appearance={message.appearance} />
        <MessageColumn appearance={message.appearance}>
          <div className="rounded-2xl border border-destructive/30 bg-destructive/5 px-4 py-3">
            <span className="text-xs text-destructive">{message.content}</span>
          </div>
          <Timestamp time={message.timestamp} align={message.appearance.align} />
        </MessageColumn>
      </div>
    );
  }

  if (message.kind === 'skill_resource_result') {
    return (
      <div className={`flex gap-3 md:gap-4 animate-fade-in ${message.appearance.align === 'right' ? 'flex-row-reverse' : ''}`}>
        <SideSpacer appearance={message.appearance} />
        <MessageColumn appearance={message.appearance}>
          <div className="rounded-2xl border border-border bg-muted/30 overflow-hidden">
            <button
              onClick={() => setExpanded(!expanded)}
              className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm hover:bg-muted/50 transition-colors"
            >
              <svg className={`w-3 h-3 transition-transform text-foreground/50 ${expanded ? 'rotate-90' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
              <FileCode className="w-3.5 h-3.5 text-foreground/50" />
              <Badge variant="outline" className="text-[10px] px-2 py-0 font-medium border-border text-foreground/60">
                {t('chat.skill.resourceLoaded')}
              </Badge>
              <code className="text-[10px] font-mono text-muted-foreground truncate">{message.resourcePath}</code>
            </button>
            {expanded && (
              <div className="px-4 pb-3 border-t border-border/30 animate-slide-in">
                {message.resourceFormat === 'image' ? (
                  message.imageFiles.map((file, index) => (
                    <img
                      key={`${file.mediaType}-${index}`}
                      src={`data:${file.mediaType};base64,${file.data}`}
                      alt={message.resourcePath}
                      className="mt-3 max-w-full max-h-80 rounded-md border-elegant shadow-elegant object-contain"
                    />
                  ))
                ) : message.resourceFormat === 'markdown' ? (
                  <div className="mt-3 text-sm max-h-64 overflow-y-auto">
                    <ReactMarkdown content={message.fileContent} />
                  </div>
                ) : (
                  <pre className="mt-3 text-xs bg-background/50 rounded-md p-3 overflow-x-auto font-mono text-foreground/80 whitespace-pre-wrap break-all max-h-64 overflow-y-auto border-elegant">
                    {message.fileContent}
                  </pre>
                )}
              </div>
            )}
          </div>
          <Timestamp time={message.timestamp} align={message.appearance.align} />
        </MessageColumn>
      </div>
    );
  }

  return (
    <div className={`flex gap-3 md:gap-4 animate-fade-in ${message.appearance.align === 'right' ? 'flex-row-reverse' : ''}`}>
      <SideSpacer appearance={message.appearance} />
      <MessageColumn appearance={message.appearance}>
        <div className="rounded-2xl border border-border bg-muted/30 overflow-hidden">
          <button
            onClick={() => setExpanded(!expanded)}
            className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm hover:bg-muted/50 transition-colors"
          >
            <svg className={`w-3 h-3 transition-transform text-foreground/50 ${expanded ? 'rotate-90' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
            <Sparkles className="w-3.5 h-3.5 text-foreground/50" />
            <Badge variant="outline" className="text-[10px] px-2 py-0 font-medium border-border text-foreground/60">
              {t('chat.skill.activated')}
            </Badge>
            {message.skillName && <span className="text-xs font-medium text-foreground/70">{message.skillName}</span>}
            {message.resources.length > 0 && (
              <span className="text-[10px] text-muted-foreground ml-auto">
                {message.resources.length} {t('chat.skill.resources')}
              </span>
            )}
          </button>
          {expanded && (
            <div className="border-t border-border/30 animate-slide-in">
              {message.skillBody && (
                <div className="px-4 py-3 text-sm max-h-64 overflow-y-auto">
                  <ReactMarkdown content={message.skillBody} />
                </div>
              )}
              {message.resources.length > 0 && (
                <div className={`px-4 py-3 ${message.skillBody ? 'border-t border-border/30' : ''}`}>
                  <div className="text-[10px] font-semibold text-muted-foreground mb-2 uppercase tracking-wider">
                    {t('chat.skill.resources')}
                  </div>
                  <div className="space-y-1">
                    {message.resources.map((resource) => (
                      <div key={resource.path} className="flex items-center gap-2 py-0.5">
                        {resource.type === 'directory'
                          ? <Folder className="w-3.5 h-3.5 text-foreground/40 flex-shrink-0" />
                          : <File className="w-3.5 h-3.5 text-foreground/40 flex-shrink-0" />}
                        <span className="text-[11px] font-mono text-foreground/70 break-all">{resource.path}</span>
                        {resource.type === 'file' && resource.size != null && (
                          <span className="text-[10px] text-muted-foreground/60 ml-auto flex-shrink-0">
                            {formatFileSize(resource.size)}
                          </span>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
        <Timestamp time={message.timestamp} align={message.appearance.align} />
      </MessageColumn>
    </div>
  );
});

export default SkillResultBubble;
