import { useState, useRef, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Send, Loader, Code, X } from '../icons';
import { Button } from '../ui/button';
import { Textarea } from '../ui/textarea';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '../ui/tooltip';

interface ChatInputProps {
  onSend: (message: string) => void;
  onStop?: () => void;
  isLoading: boolean;
  disabled?: boolean;
  placeholder?: string;
}

export default function ChatInput({ onSend, onStop, isLoading, disabled, placeholder }: ChatInputProps) {
  const { t } = useTranslation();
  const [input, setInput] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    const textarea = textareaRef.current;
    if (textarea) {
      textarea.style.height = 'auto';
      textarea.style.height = `${Math.min(textarea.scrollHeight, 200)}px`;
    }
  }, [input]);

  const handleSubmit = () => {
    if (input.trim() && !disabled && !isLoading) {
      onSend(input);
      setInput('');
      if (textareaRef.current) {
        textareaRef.current.style.height = 'auto';
      }
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  const insertCodeBlock = () => {
    setInput((prev) => prev + '\n```python\n\n```\n');
    textareaRef.current?.focus();
  };

  return (
    <div className="border-t border-border bg-background p-4 md:p-6 pb-safe">
      <div className="max-w-4xl mx-auto">
        <div className="relative flex items-end gap-2 bg-muted/30 border border-border rounded-xl p-2 shadow-elegant">
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  onClick={insertCodeBlock}
                  variant="ghost"
                  size="icon"
                  className="flex-shrink-0 h-9 w-9"
                >
                  <Code className="w-4 h-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>{t('chat.input.insertCode')}</TooltipContent>
            </Tooltip>

            <Textarea
              ref={textareaRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={placeholder || (disabled ? t('chat.input.processing') : t('chat.input.placeholder'))}
              disabled={disabled}
              className="flex-1 bg-transparent border-none resize-none outline-none min-h-[24px] max-h-[200px] focus-visible:ring-0 text-sm"
              rows={1}
            />

            {isLoading && onStop ? (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    onClick={onStop}
                    variant="ghost"
                    size="icon"
                    className="flex-shrink-0 h-9 w-9"
                  >
                    <X className="w-4 h-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>{t('chat.input.stop')}</TooltipContent>
              </Tooltip>
            ) : (
              <Button
                onClick={handleSubmit}
                disabled={!input.trim() || disabled || isLoading}
                size="icon"
                className="flex-shrink-0 h-9 w-9 shadow-elegant"
              >
                {isLoading ? (
                  <Loader className="w-4 h-4 animate-spin" />
                ) : (
                  <Send className="w-4 h-4" />
                )}
              </Button>
            )}
          </TooltipProvider>
        </div>
      </div>
    </div>
  );
}
