// 消息导出功能组件
import { useState } from 'react';
import { Message } from '../types';
import { MessageHistoryManager } from '../utils/messageHistory';
import { Button } from './ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from './ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';
import { Download } from './icons';

interface ExportDialogProps {
  messages: Message[];
  isOpen: boolean;
  onClose: () => void;
}

export default function ExportDialog({ messages, isOpen, onClose }: ExportDialogProps) {
  const [format, setFormat] = useState<'json' | 'markdown' | 'text'>('markdown');

  const handleExport = () => {
    let content: string;
    let filename: string;
    let mimeType: string;

    switch (format) {
      case 'json':
        content = MessageHistoryManager.exportToJSON(messages);
        filename = `conversation-${Date.now()}.json`;
        mimeType = 'application/json';
        break;
      case 'markdown':
        content = MessageHistoryManager.exportToMarkdown(messages);
        filename = `conversation-${Date.now()}.md`;
        mimeType = 'text/markdown';
        break;
      case 'text':
        content = MessageHistoryManager.exportToText(messages);
        filename = `conversation-${Date.now()}.txt`;
        mimeType = 'text/plain';
        break;
    }

    // 创建下载
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);

    onClose();
  };

  const getPreview = () => {
    switch (format) {
      case 'json':
        return MessageHistoryManager.exportToJSON(messages).slice(0, 500);
      case 'markdown':
        return MessageHistoryManager.exportToMarkdown(messages).slice(0, 500);
      case 'text':
        return MessageHistoryManager.exportToText(messages).slice(0, 500);
    }
  };

  const stats = MessageHistoryManager.getMessageStats(messages);

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-3xl max-h-[80vh]">
        <DialogHeader>
          <DialogTitle>导出对话历史</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* 统计信息 */}
          <div className="grid grid-cols-4 gap-4 p-4 bg-muted rounded-lg">
            <div>
              <div className="text-sm text-muted-foreground">总消息数</div>
              <div className="text-2xl font-bold">{stats.total}</div>
            </div>
            <div>
              <div className="text-sm text-muted-foreground">工具调用</div>
              <div className="text-2xl font-bold">{stats.toolCalls}</div>
            </div>
            <div>
              <div className="text-sm text-muted-foreground">估算 Tokens</div>
              <div className="text-2xl font-bold">{stats.tokens}</div>
            </div>
            <div>
              <div className="text-sm text-muted-foreground">对话轮次</div>
              <div className="text-2xl font-bold">
                {MessageHistoryManager.getConversationTurns(messages).length}
              </div>
            </div>
          </div>

          {/* 格式选择 */}
          <Tabs value={format} onValueChange={(v) => setFormat(v as any)}>
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="markdown">Markdown</TabsTrigger>
              <TabsTrigger value="json">JSON</TabsTrigger>
              <TabsTrigger value="text">纯文本</TabsTrigger>
            </TabsList>

            <TabsContent value="markdown" className="space-y-2">
              <p className="text-sm text-muted-foreground">
                导出为 Markdown 格式，适合阅读和分享
              </p>
              <pre className="p-4 bg-muted rounded-lg text-xs overflow-auto max-h-64">
                {getPreview()}...
              </pre>
            </TabsContent>

            <TabsContent value="json" className="space-y-2">
              <p className="text-sm text-muted-foreground">
                导出为 JSON 格式，包含完整的消息数据
              </p>
              <pre className="p-4 bg-muted rounded-lg text-xs overflow-auto max-h-64">
                {getPreview()}...
              </pre>
            </TabsContent>

            <TabsContent value="text" className="space-y-2">
              <p className="text-sm text-muted-foreground">
                导出为纯文本格式，简单易读
              </p>
              <pre className="p-4 bg-muted rounded-lg text-xs overflow-auto max-h-64">
                {getPreview()}...
              </pre>
            </TabsContent>
          </Tabs>

          {/* 操作按钮 */}
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={onClose}>
              取消
            </Button>
            <Button onClick={handleExport}>
              <Download className="w-4 h-4 mr-2" />
              下载
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
