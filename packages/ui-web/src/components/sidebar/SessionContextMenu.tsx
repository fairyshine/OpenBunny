// Session context menu with move to project functionality
import { useTranslation } from 'react-i18next';
import { useSessionStore } from '@openbunny/shared/stores/session';
import type { Session } from '@openbunny/shared/types';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from '../ui/dropdown-menu';
import { Edit2, Trash, FolderInput, MessagesSquare, getProjectIcon } from '../icons';

interface SessionContextMenuProps {
  session: Session;
  children: React.ReactNode;
  onRename?: () => void;
  onDelete: () => void;
  allowRename?: boolean;
  allowMoveToProject?: boolean;
}

export function SessionContextMenu({
  session,
  children,
  onRename,
  onDelete,
  allowRename = true,
  allowMoveToProject = true,
}: SessionContextMenuProps) {
  const { t } = useTranslation();
  const { projects, moveSessionToProject } = useSessionStore();

  const handleMoveToProject = (projectId: string | null) => {
    moveSessionToProject(session.id, projectId);
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        {children}
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-48">
        {allowRename && onRename && (
          <DropdownMenuItem onClick={onRename}>
            <Edit2 className="w-4 h-4 mr-2" />
            {t('common.rename')}
          </DropdownMenuItem>
        )}

        {allowMoveToProject && (
          <DropdownMenuSub>
            <DropdownMenuSubTrigger>
              <FolderInput className="w-4 h-4 mr-2" />
              {t('sidebar.moveToProject')}
            </DropdownMenuSubTrigger>
            <DropdownMenuSubContent>
              <DropdownMenuItem
                onClick={() => handleMoveToProject(null)}
                disabled={!session.projectId}
              >
                <MessagesSquare className="w-4 h-4 mr-2" />
                {t('sidebar.noProject')}
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              {projects.map((project) => {
                const ProjectIcon = getProjectIcon(project.icon || '');
                return (
                  <DropdownMenuItem
                    key={project.id}
                    onClick={() => handleMoveToProject(project.id)}
                    disabled={session.projectId === project.id}
                  >
                    <ProjectIcon className="w-4 h-4 mr-2" style={project.color ? { color: project.color } : undefined} />
                    {project.name}
                  </DropdownMenuItem>
                );
              })}
            </DropdownMenuSubContent>
          </DropdownMenuSub>
        )}

        {(allowRename || allowMoveToProject) && <DropdownMenuSeparator />}

        <DropdownMenuItem onClick={onDelete} className="text-destructive">
          <Trash className="w-4 h-4 mr-2" />
          {t('common.delete')}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
