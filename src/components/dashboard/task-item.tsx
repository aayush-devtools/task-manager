"use client";

import { Check, MessageSquare, ExternalLink, Calendar, Flag, GitBranch } from "lucide-react";
import { cn } from "@/lib/utils";
import { format } from "date-fns";

export interface Task {
  id: string;
  title: string;
  description?: string | null;
  url?: string | null;
  status: string;
  priority: string;
  dueDate: Date | null;
  assigneeId?: string;
  assigneeName?: string;
  assigneeAvatar?: string;
  coAssignees?: { id: string; name: string; avatarUrl?: string }[];
  creatorName?: string;
  projectId?: string | null;
  projectName?: string | null;
  slackPermalink?: string;
  subtaskCount?: number;
}

interface TaskItemProps {
  task: Task;
  onToggle: (status: string) => void;
  onClick?: () => void;
}

const priorityDot: Record<string, string> = {
  p1: "bg-red-500",
  p2: "bg-orange-500",
  p3: "bg-yellow-400",
  p4: "bg-green-500",
};

const priorityBorder: Record<string, string> = {
  p1: "border-red-500",
  p2: "border-orange-500",
  p3: "border-yellow-400",
  p4: "border-green-500",
};

function AssigneeAvatars({ primary, coAssignees }: {
  primary?: { name: string; avatarUrl?: string };
  coAssignees?: { id: string; name: string; avatarUrl?: string }[];
}) {
  const all = [
    ...(primary ? [primary] : []),
    ...(coAssignees || []),
  ].slice(0, 4);

  if (all.length === 0) return null;

  return (
    <div className="flex items-center">
      {all.map((u, i) => (
        <div
          key={i}
          title={u.name}
          className={cn(
            "h-5 w-5 rounded-full border-2 border-background flex items-center justify-center text-[9px] font-medium bg-muted text-muted-foreground overflow-hidden",
            i > 0 && "-ml-1.5"
          )}
          style={u.avatarUrl ? { backgroundImage: `url(${u.avatarUrl})`, backgroundSize: "cover" } : undefined}
        >
          {!u.avatarUrl && u.name[0]?.toUpperCase()}
        </div>
      ))}
      {(coAssignees?.length ?? 0) + 1 > 4 && (
        <span className="ml-1 text-[10px] text-muted-foreground">+{(coAssignees?.length ?? 0) + 1 - 4}</span>
      )}
    </div>
  );
}

export function TaskItem({ task, onToggle, onClick }: TaskItemProps) {
  const isDone = task.status === "DONE";

  return (
    <div
      className="group flex items-start gap-3 border-b border-border py-3 px-2 hover:bg-muted/40 transition-colors cursor-pointer rounded-sm"
      onClick={onClick}
    >
      <button
        onClick={e => { e.stopPropagation(); onToggle(isDone ? "TODO" : "DONE"); }}
        className={cn(
          "mt-0.5 flex shrink-0 items-center justify-center rounded-full border-2 transition-all hover:scale-110",
          priorityBorder[task.priority] || "border-muted-foreground",
          isDone && "bg-green-500 border-green-500 text-white"
        )}
        style={{ width: 18, height: 18 }}
      >
        {isDone
          ? <Check className="h-2.5 w-2.5" />
          : <Check className="h-2.5 w-2.5 opacity-0 group-hover:opacity-40" />
        }
      </button>

      <div className="flex flex-1 flex-col gap-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className={cn("h-1.5 w-1.5 rounded-full shrink-0 mt-0.5", priorityDot[task.priority] || "bg-muted-foreground")} />
          <p className={cn(
            "text-sm font-medium leading-snug truncate",
            isDone && "text-muted-foreground line-through decoration-muted-foreground/40"
          )}>
            {task.title}
          </p>
        </div>

        {task.description && (
          <p className={cn("text-xs text-muted-foreground line-clamp-1 ml-3.5", isDone && "opacity-60")}>
            {task.description}
          </p>
        )}

        <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-muted-foreground ml-3.5">
          {task.dueDate && (
            <span className={cn(
              "flex items-center gap-1",
              new Date(task.dueDate) < new Date() && !isDone ? "text-red-500 font-medium" : "text-muted-foreground"
            )}>
              <Calendar className="h-3 w-3" />
              {format(new Date(task.dueDate), "MMM d")}
            </span>
          )}

          <AssigneeAvatars
            primary={task.assigneeName ? { name: task.assigneeName, avatarUrl: task.assigneeAvatar } : undefined}
            coAssignees={task.coAssignees}
          />

          {task.projectName && (
            <span className="flex items-center gap-1">
              <Flag className="h-3 w-3" />
              {task.projectName}
            </span>
          )}

          {(task.subtaskCount ?? 0) > 0 && (
            <span className="flex items-center gap-1">
              <GitBranch className="h-3 w-3" />
              {task.subtaskCount}
            </span>
          )}

          {task.url && (
            <a href={task.url} target="_blank" rel="noopener noreferrer"
              onClick={e => e.stopPropagation()}
              className="flex items-center gap-1 hover:text-foreground transition-colors">
              <ExternalLink className="h-3 w-3" />
              Link
            </a>
          )}

          {task.slackPermalink && (
            <a href={task.slackPermalink} target="_blank" rel="noopener noreferrer"
              onClick={e => e.stopPropagation()}
              className="flex items-center gap-1 hover:text-foreground transition-colors">
              <MessageSquare className="h-3 w-3" />
              Slack
            </a>
          )}
        </div>
      </div>
    </div>
  );
}
