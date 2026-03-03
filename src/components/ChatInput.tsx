import { useState, useRef, useEffect } from 'react';
import { Send, Loader, Code, X } from './icons';
import { Button } from './ui/button';
import { Textarea } from './ui/textarea';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from './ui/tooltip';

interface ChatInputProps {
  onSend: (message: string) => void;
  onStop?: () => void;
  isLoading: boolean;
  disabled?: boolean;
  placeholder?: string;
}

export default function ChatInput({ onSend, onStop, isLoading, disabled, placeholder }: ChatInputProps) {
  const [input, setInput] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // 自动调整高度
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
    <div className="border-t border-border bg-background p-3 md:p-4 pb-safe">
      <div className="max-w-3xl mx-auto">
        <div className="relative flex items-end gap-2 bg-secondary/50 border border-border rounded-2xl p-2">
          <TooltipProvider>
            {/* 工具按钮 */}
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  onClick={insertCodeBlock}
                  variant="ghost"
                  size="icon"
                  className="flex-shrink-0"
                >
                  <Code className="w-5 h-5" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>插入 Python 代码块</TooltipContent>
            </Tooltip>

            {/* 输入框 */}
            <Textarea
              ref={textareaRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={placeholder || (disabled ? '处理中...' : '输入消息...')}
              disabled={disabled}
              className="flex-1 bg-transparent border-none resize-none outline-none min-h-[24px] max-h-[200px] focus-visible:ring-0"
              rows={1}
            />

            {/* 发送/停止按钮 */}
            {isLoading && onStop ? (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    onClick={onStop}
                    variant="destructive"
                    size="icon"
                    className="flex-shrink-0 h-10 w-10"
                  >
                    <X className="w-5 h-5" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>停止生成</TooltipContent>
              </Tooltip>
            ) : (
              <Button
                onClick={handleSubmit}
                disabled={!input.trim() || disabled || isLoading}
                size="icon"
                className="flex-shrink-0 h-10 w-10"
              >
                {isLoading ? (
                  <Loader className="w-5 h-5" />
                ) : (
                  <Send className="w-5 h-5" />
                )}
              </Button>
            )}
          </TooltipProvider>
        </div>

        {/* 提示文字 */}
        <div className="text-center text-xs text-muted-foreground mt-2">
          按 Enter 发送，Shift + Enter 换行
        </div>
      </div>
    </div>
  );
}
