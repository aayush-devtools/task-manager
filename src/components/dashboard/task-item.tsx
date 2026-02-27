"use client";

import { Check, MessageSquare, ExternalLink, Calendar, User } from "lucide-react";
import { cn } from "@/lib/utils";
import { format } from "date-fns";

export interface Task {
  id: string;
  title: string;
  status: string;
  priority: string;
  dueDate: Date | null;
  assigneeName?: string;
  assigneeAvatar?: string;
  slackPermalink?: string;
}

interface TaskItemProps {
  task: Task;
  onComplete: (id: string) => void;
}

const priorityBorderColors = {
  p1: "border-red-500",
  p2: "border-orange-500",
  p3: "border-blue-500",
  p4: "border-gray-400",
};

export function TaskItem({ task, onComplete }: TaskItemProps) {
  const isDone = task.status === "DONE";

  return (
    <div className="group flex items-start gap-3 border-b border-border py-3 px-1 hover:bg-muted/30 transition-colors">
      <button
        onClick={() => onComplete(task.id)}
        className={cn(
          "mt-1 flex h-4 w-4 shrink-0 items-center justify-center rounded-full border transition-all hover:bg-muted/80",
          priorityBorderColors[task.priority as keyof typeof priorityBorderColors] || "border-gray-400",
          isDone && "bg-muted border-muted text-muted-foreground"
        )}
      >
        {isDone ? (
          <Check className="h-2.5 w-2.5" />
        ) : (
          <Check className="h-2.5 w-2.5 opacity-0 group-hover:opacity-100 text-muted-foreground" />
        )}
      </button>

      <div className="flex flex-1 flex-col gap-1.5 min-w-0">
        <div className="flex items-start justify-between gap-3">
          <p className={cn(
            "text-sm font-medium leading-tight",
            isDone && "text-muted-foreground line-through decoration-muted-foreground/50"
          )}>
            {task.title}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
          {task.dueDate && (
            <div className="flex items-center gap-1 text-green-600 font-medium">
              <Calendar className="h-3 w-3" />
              {format(task.dueDate, "MMM d")}
            </div>
          )}
          
          <div className="flex items-center gap-1">
            <User className="h-3 w-3" />
            {task.assigneeName || "Unassigned"}
          </div>

          {task.slackPermalink && (
            <a
              href={task.slackPermalink}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1 hover:text-foreground transition-colors"
            >
              <MessageSquare className="h-3 w-3" />
              From Slack
              <ExternalLink className="h-2.5 w-2.5 ml-0.5" />
            </a>
          )}
        </div>
      </div>
    </div>
  );
}
