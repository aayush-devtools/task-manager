"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import { format } from "date-fns";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Calendar,
  Link2,
  User,
  Hash,
  MessageSquare,
  ExternalLink,
  Check,
  Clock,
  Flag,
  AlignLeft,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Task } from "./task-item";
import { toast } from "sonner";

interface FullTask extends Task {
  url?: string | null;
  creatorName?: string;
  projectName?: string | null;
  projectId?: string | null;
}

interface TaskDetailSheetProps {
  task: FullTask | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  users?: { id: string; name: string; email: string }[];
  projects?: { id: string; name: string }[];
}

const priorityConfig = {
  p1: { label: "Urgent", color: "text-red-500", bg: "bg-red-500/10 border-red-500/20" },
  p2: { label: "High",   color: "text-orange-500", bg: "bg-orange-500/10 border-orange-500/20" },
  p3: { label: "Medium", color: "text-yellow-500", bg: "bg-yellow-500/10 border-yellow-500/20" },
  p4: { label: "Low",    color: "text-green-500", bg: "bg-green-500/10 border-green-500/20" },
};

export function TaskDetailSheet({ task, open, onOpenChange, users = [], projects = [] }: TaskDetailSheetProps) {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Local editable state — initialised from prop
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [url, setUrl] = useState("");
  const [priority, setPriority] = useState("p4");
  const [status, setStatus] = useState("TODO");
  const [dueDate, setDueDate] = useState("");
  const [assigneeId, setAssigneeId] = useState("");
  const [projectId, setProjectId] = useState("none");

  useEffect(() => {
    if (task) {
      setTitle(task.title);
      setDescription(task.description || "");
      setUrl(task.url || "");
      setPriority(task.priority);
      setStatus(task.status);
      setDueDate(task.dueDate ? format(new Date(task.dueDate), "yyyy-MM-dd") : "");
      setAssigneeId(task.assigneeId || "");
      setProjectId(task.projectId || "none");
    }
  }, [task]);

  const save = useCallback(async (patch: Record<string, unknown>) => {
    if (!task) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/tasks/${task.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patch),
      });
      if (!res.ok) throw new Error("save failed");
      router.refresh();
    } catch {
      toast.error("Failed to save");
    } finally {
      setSaving(false);
    }
  }, [task, router]);

  // Debounced save for text fields
  const debouncedSave = useCallback((patch: Record<string, unknown>) => {
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => save(patch), 600);
  }, [save]);

  if (!task) return null;

  const isDone = status === "DONE";
  const pCfg = priorityConfig[priority as keyof typeof priorityConfig] || priorityConfig.p4;
  const assignee = users.find(u => u.id === assigneeId);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-2xl overflow-y-auto flex flex-col gap-0 p-0">
        {/* Header bar */}
        <div className="flex items-center justify-between px-6 py-3 border-b bg-muted/30">
          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                const newStatus = isDone ? "TODO" : "DONE";
                setStatus(newStatus);
                save({ status: newStatus });
              }}
              className={cn(
                "flex h-5 w-5 items-center justify-center rounded-full border-2 transition-all",
                isDone ? "bg-green-500 border-green-500 text-white" : "border-muted-foreground hover:border-primary"
              )}
            >
              {isDone && <Check className="h-3 w-3" />}
            </button>
            <span className="text-xs text-muted-foreground">{isDone ? "Completed" : "In progress"}</span>
          </div>
          <div className="flex items-center gap-2">
            {saving && <span className="text-xs text-muted-foreground">Saving…</span>}
            {task.slackPermalink && (
              <a href={task.slackPermalink} target="_blank" rel="noopener noreferrer"
                className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
                <MessageSquare className="h-3.5 w-3.5" />
                <span>Slack</span>
                <ExternalLink className="h-3 w-3" />
              </a>
            )}
          </div>
        </div>

        <div className="flex-1 px-8 py-6 flex flex-col gap-6">
          {/* Title */}
          <SheetHeader>
            <SheetTitle asChild>
              <textarea
                value={title}
                onChange={e => { setTitle(e.target.value); debouncedSave({ title: e.target.value }); }}
                rows={2}
                className={cn(
                  "w-full resize-none bg-transparent text-2xl font-bold leading-snug focus:outline-none",
                  isDone && "line-through text-muted-foreground"
                )}
                placeholder="Task title"
              />
            </SheetTitle>
          </SheetHeader>

          {/* Properties grid */}
          <div className="grid gap-3 text-sm">
            {/* Status */}
            <div className="flex items-center gap-3">
              <div className="w-28 flex items-center gap-2 text-muted-foreground shrink-0">
                <Clock className="h-3.5 w-3.5" /> Status
              </div>
              <Select value={status} onValueChange={v => { setStatus(v); save({ status: v }); }}>
                <SelectTrigger className="h-7 w-auto border-0 bg-muted/50 hover:bg-muted px-2 text-sm font-medium">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="TODO">In Progress</SelectItem>
                  <SelectItem value="DONE">Completed</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Priority */}
            <div className="flex items-center gap-3">
              <div className="w-28 flex items-center gap-2 text-muted-foreground shrink-0">
                <Flag className="h-3.5 w-3.5" /> Priority
              </div>
              <Select value={priority} onValueChange={v => { setPriority(v); save({ priority: v }); }}>
                <SelectTrigger className="h-7 w-auto border-0 bg-muted/50 hover:bg-muted px-2 text-sm font-medium">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="p1">🔴 Urgent</SelectItem>
                  <SelectItem value="p2">🟠 High</SelectItem>
                  <SelectItem value="p3">🟡 Medium</SelectItem>
                  <SelectItem value="p4">🟢 Low</SelectItem>
                </SelectContent>
              </Select>
              <Badge variant="outline" className={cn("text-xs border", pCfg.bg, pCfg.color)}>
                {pCfg.label}
              </Badge>
            </div>

            {/* Assignee */}
            <div className="flex items-center gap-3">
              <div className="w-28 flex items-center gap-2 text-muted-foreground shrink-0">
                <User className="h-3.5 w-3.5" /> Assignee
              </div>
              {users.length > 0 ? (
                <Select value={assigneeId} onValueChange={v => { setAssigneeId(v); save({ assigneeId: v }); }}>
                  <SelectTrigger className="h-7 w-auto border-0 bg-muted/50 hover:bg-muted px-2 text-sm">
                    <div className="flex items-center gap-2">
                      {assignee && (
                        <Avatar className="h-4 w-4">
                          <AvatarFallback className="text-[9px]">{assignee.name[0]}</AvatarFallback>
                        </Avatar>
                      )}
                      <SelectValue placeholder="Unassigned" />
                    </div>
                  </SelectTrigger>
                  <SelectContent>
                    {users.map(u => (
                      <SelectItem key={u.id} value={u.id}>
                        <div className="flex items-center gap-2">
                          <Avatar className="h-4 w-4">
                            <AvatarFallback className="text-[9px]">{u.name[0]}</AvatarFallback>
                          </Avatar>
                          {u.name}
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : (
                <span className="text-sm">{task.assigneeName || "Unassigned"}</span>
              )}
            </div>

            {/* Due date */}
            <div className="flex items-center gap-3">
              <div className="w-28 flex items-center gap-2 text-muted-foreground shrink-0">
                <Calendar className="h-3.5 w-3.5" /> Due date
              </div>
              <input
                type="date"
                value={dueDate}
                onChange={e => {
                  setDueDate(e.target.value);
                  save({ dueDate: e.target.value || null });
                }}
                className="h-7 bg-muted/50 hover:bg-muted rounded-md px-2 text-sm border-0 focus:outline-none focus:ring-1 focus:ring-ring cursor-pointer"
              />
              {dueDate && (
                <button onClick={() => { setDueDate(""); save({ dueDate: null }); }}
                  className="text-xs text-muted-foreground hover:text-destructive">clear</button>
              )}
            </div>

            {/* Project */}
            {projects.length > 0 && (
              <div className="flex items-center gap-3">
                <div className="w-28 flex items-center gap-2 text-muted-foreground shrink-0">
                  <Hash className="h-3.5 w-3.5" /> Project
                </div>
                <Select value={projectId} onValueChange={v => { setProjectId(v); save({ projectId: v === "none" ? null : v }); }}>
                  <SelectTrigger className="h-7 w-auto border-0 bg-muted/50 hover:bg-muted px-2 text-sm">
                    <SelectValue placeholder="No project" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">No project</SelectItem>
                    {projects.map(p => (
                      <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {/* URL */}
            <div className="flex items-start gap-3">
              <div className="w-28 flex items-center gap-2 text-muted-foreground shrink-0 pt-1.5">
                <Link2 className="h-3.5 w-3.5" /> URL
              </div>
              <div className="flex-1 flex items-center gap-2">
                <input
                  type="url"
                  value={url}
                  onChange={e => { setUrl(e.target.value); debouncedSave({ url: e.target.value || null }); }}
                  placeholder="Add a link…"
                  className="flex-1 h-7 bg-muted/50 hover:bg-muted rounded-md px-2 text-sm border-0 focus:outline-none focus:ring-1 focus:ring-ring"
                />
                {url && (
                  <a href={url} target="_blank" rel="noopener noreferrer"
                    className="text-muted-foreground hover:text-foreground">
                    <ExternalLink className="h-3.5 w-3.5" />
                  </a>
                )}
              </div>
            </div>
          </div>

          <div className="border-t" />

          {/* Description */}
          <div className="flex flex-col gap-2">
            <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground uppercase tracking-wider">
              <AlignLeft className="h-3.5 w-3.5" /> Description
            </div>
            <textarea
              value={description}
              onChange={e => { setDescription(e.target.value); debouncedSave({ description: e.target.value || null }); }}
              rows={8}
              placeholder="Add a description… supports plain text, paste URLs, or jot notes"
              className="w-full resize-none bg-muted/30 hover:bg-muted/50 focus:bg-muted/50 rounded-lg p-3 text-sm leading-relaxed focus:outline-none focus:ring-1 focus:ring-ring transition-colors"
            />
          </div>

          {/* Meta footer */}
          <div className="flex items-center gap-4 text-xs text-muted-foreground border-t pt-4 mt-auto">
            {task.creatorName && <span>Created by {task.creatorName}</span>}
            {task.dueDate && <span>Due {format(new Date(task.dueDate), "MMM d, yyyy")}</span>}
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
