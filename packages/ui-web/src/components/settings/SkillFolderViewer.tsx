// Skill 文件夹查看器组件
// 显示完整的 skill 文件夹结构

import { useState, useEffect } from 'react';
import { fileSystem } from '@openbunny/shared/services/filesystem';
import { Button } from '../ui/button';
import { ScrollArea } from '../ui/scroll-area';
import { Badge } from '../ui/badge';
import {
  FileText,
  Folder,
  FolderOpen,
  ChevronRight,
  ChevronDown,
  Plus,
  Download,
  Upload
} from 'lucide-react';
import { cn } from '@openbunny/shared/lib/utils';

interface FileNode {
  name: string;
  path: string;
  type: 'file' | 'directory';
  children?: FileNode[];
  expanded?: boolean;
}

interface SkillFolderViewerProps {
  skillPath: string;
  onFileSelect: (filePath: string) => void;
  selectedFile?: string;
}

export function SkillFolderViewer({ skillPath, onFileSelect, selectedFile }: SkillFolderViewerProps) {
  const [fileTree, setFileTree] = useState<FileNode | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadFileTree();
  }, [skillPath]);

  const loadFileTree = async () => {
    setLoading(true);
    try {
      const tree = await buildFileTree(skillPath);
      setFileTree(tree);
    } catch (error) {
      console.error('Failed to load file tree:', error);
    } finally {
      setLoading(false);
    }
  };

  const buildFileTree = async (path: string): Promise<FileNode> => {
    const entries = await fileSystem.readdir(path);
    const name = path.split('/shared/').pop() || path;

    const node: FileNode = {
      name,
      path,
      type: 'directory',
      children: [],
      expanded: true,
    };

    for (const entry of entries) {
      const childPath = `${path}/${entry.name}`;

      if (entry.type === 'directory') {
        // 递归加载子目录
        const childNode = await buildFileTree(childPath);
        node.children!.push(childNode);
      } else {
        node.children!.push({
          name: entry.name,
          path: childPath,
          type: 'file',
        });
      }
    }

    // 排序: 目录在前,文件在后,按名称排序
    node.children!.sort((a, b) => {
      if (a.type !== b.type) {
        return a.type === 'directory' ? -1 : 1;
      }
      return a.name.localeCompare(b.name);
    });

    return node;
  };

  const toggleExpand = (node: FileNode) => {
    const updateNode = (n: FileNode): FileNode => {
      if (n.path === node.path) {
        return { ...n, expanded: !n.expanded };
      }
      if (n.children) {
        return { ...n, children: n.children.map(updateNode) };
      }
      return n;
    };

    if (fileTree) {
      setFileTree(updateNode(fileTree));
    }
  };

  const renderFileNode = (node: FileNode, level: number = 0) => {
    const isSelected = selectedFile === node.path;
    const isExpanded = node.expanded;

    return (
      <div key={node.path}>
        <div
          className={cn(
            'flex items-center gap-2 px-2 py-1.5 rounded cursor-pointer hover:bg-accent',
            isSelected && 'bg-accent',
            'transition-colors'
          )}
          style={{ paddingLeft: `${level * 16 + 8}px` }}
          onClick={() => {
            if (node.type === 'directory') {
              toggleExpand(node);
            } else {
              onFileSelect(node.path);
            }
          }}
        >
          {node.type === 'directory' && (
            <span className="flex-shrink-0">
              {isExpanded ? (
                <ChevronDown className="w-4 h-4" />
              ) : (
                <ChevronRight className="w-4 h-4" />
              )}
            </span>
          )}

          {node.type === 'directory' ? (
            isExpanded ? (
              <FolderOpen className="w-4 h-4 text-blue-500" />
            ) : (
              <Folder className="w-4 h-4 text-blue-500" />
            )
          ) : (
            <FileText className="w-4 h-4 text-gray-500" />
          )}

          <span className="text-sm flex-1 truncate">{node.name}</span>

          {node.name === 'SKILL.md' && (
            <Badge variant="secondary" className="text-xs">
              Required
            </Badge>
          )}
        </div>

        {node.type === 'directory' && isExpanded && node.children && (
          <div>
            {node.children.map(child => renderFileNode(child, level + 1))}
          </div>
        )}
      </div>
    );
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8 text-muted-foreground">
        Loading file tree...
      </div>
    );
  }

  if (!fileTree) {
    return (
      <div className="flex items-center justify-center p-8 text-muted-foreground">
        Failed to load file tree
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* 工具栏 */}
      <div className="flex items-center justify-between p-2 border-b">
        <span className="text-sm font-medium">File Structure</span>
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            title="Add file"
          >
            <Plus className="w-4 h-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            title="Upload file"
          >
            <Upload className="w-4 h-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            title="Download folder"
          >
            <Download className="w-4 h-4" />
          </Button>
        </div>
      </div>

      {/* 文件树 */}
      <ScrollArea className="flex-1">
        <div className="p-2">
          {renderFileNode(fileTree)}
        </div>
      </ScrollArea>
    </div>
  );
}
