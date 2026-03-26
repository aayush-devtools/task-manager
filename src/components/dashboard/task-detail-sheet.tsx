"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import { format } from "date-fns";
import {
  Sheet, SheetContent, SheetHeader, SheetTitle,
} from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Calendar, Link2, Hash, MessageSquare, ExternalLink, Check,
  Clock, Flag, AlignLeft, GitBranch, Plus, X, Users,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Task } from "./task-item";
import { toast } from "sonner";

interface FullTask extends Task {
  url?: string | null;
  creatorName?: string;
  projectName?: string | null;
  projectId?: string | null;
  coAssignees?: { id: string; name: string; avatarUrl?: string }[];
  subtasks?: SubTask[];
}

interface SubTask {
  id: string;
  title: string;
  status: string;
  assigneeId: string;
  assigneeName?: string;
  coAssignees?: { id: string; name: string; avatarUrl?: string }[];
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
  p2: { label: "High", color: "text-orange-500", bg: "bg-orange-500/10 border-orange-500/20" },
  p3: { label: "Medium", color: "text-yellow-500", bg: "bg-yellow-500/10 border-yellow-500/20" },
  p4: { label: "Low", color: "text-green-500", bg: "bg-green-500/10 border-green-500/20" },
};

export function TaskDetailSheet({ task, open, onOpenChange, users = [], projects = [] }: TaskDetailSheetProps) {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [url, setUrl] = useState("");
  const [priority, setPriority] = useState("p4");
  const [status, setStatus] = useState("TODO");
  const [dueDate, setDueDate] = useState("");
  const [assigneeId, setAssigneeId] = useState("");
  const [projectId, setProjectId] = useState("none");
  const [coAssigneeIds, setCoAssigneeIds] = useState<string[]>([]);
  const [subtasks, setSubtasks] = useState<SubTask[]>([]);
  const [newSubtaskTitle, setNewSubtaskTitle] = useState("");
  const [newSubtaskAssignee, setNewSubtaskAssignee] = useState("");
  const [addingSubtask, setAddingSubtask] = useState(false);
  const [creatingSubtask, setCreatingSubtask] = useState(false);

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
      setCoAssigneeIds(task.coAssignees?.map(ca => ca.id) || []);
      setSubtasks(task.subtasks || []);
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

  const debouncedSave = useCallback((patch: Record<string, unknown>) => {
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => save(patch), 600);
  }, [save]);

  const toggleCoAssignee = (uid: string) => {
    const next = coAssigneeIds.includes(uid)
      ? coAssigneeIds.filter(id => id !== uid)
      : [...coAssigneeIds, uid];
    setCoAssigneeIds(next);
    save({ coAssigneeIds: next });
  };

  const toggleSubtask = async (subtaskId: string, newStatus: string) => {
    setSubtasks(prev => prev.map(s => s.id === subtaskId ? { ...s, status: newStatus } : s));
    await fetch(`/api/tasks/${subtaskId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: newStatus }),
    });
    router.refresh();
  };

  const createSubtask = async () => {
    if (!newSubtaskTitle.trim() || !newSubtaskAssignee || !task) return;
    setCreatingSubtask(true);
    try {
      const res = await fetch("/api/tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: newSubtaskTitle.trim(),
          assigneeId: newSubtaskAssignee,
          priority: "p4",
          parentId: task.id,
        }),
      });
      if (!res.ok) throw new Error();
      const created = await res.json();
      const assignee = users.find(u => u.id === newSubtaskAssignee);
      setSubtasks(prev => [...prev, {
        id: created.id,
        title: created.title,
        status: created.status,
        assigneeId: created.assigneeId,
        assigneeName: assignee?.name,
      }]);
      setNewSubtaskTitle("");
      setNewSubtaskAssignee(assigneeId || "");
      setAddingSubtask(false);
      router.refresh();
    } catch {
      toast.error("Failed to create subtask");
    } finally {
      setCreatingSubtask(false);
    }
  };

  if (!task) return null;

  const isDone = status === "DONE";
  const pCfg = priorityConfig[priority as keyof typeof priorityConfig] || priorityConfig.p4;
  const coAssigneeUsers = users.filter(u => coAssigneeIds.includes(u.id));
  const availableForCoAssign = users.filter(u => u.id !== assigneeId);
  const doneSubtasks = subtasks.filter(s => s.status === "DONE").length;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-2xl overflow-y-auto flex flex-col gap-0 p-0">
        {/* Header bar */}
        <div className="flex items-center justify-between px-6 py-3 border-b bg-muted/30">
          <div className="flex items-center gap-2">
            <button
              onClick={() => { const s = isDone ? "TODO" : "DONE"; setStatus(s); save({ status: s }); }}
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
                <MessageSquare className="h-3.5 w-3.5" /><span>Slack</span><ExternalLink className="h-3 w-3" />
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

            {/* Primary assignee */}
            <div className="flex items-center gap-3">
              <div className="w-28 flex items-center gap-2 text-muted-foreground shrink-0">
                <Users className="h-3.5 w-3.5" /> Assignee
              </div>
              {users.length > 0 ? (
                <Select value={assigneeId} onValueChange={v => { setAssigneeId(v); save({ assigneeId: v }); }}>
                  <SelectTrigger className="h-7 w-auto border-0 bg-muted/50 hover:bg-muted px-2 text-sm">
                    <SelectValue placeholder="Unassigned" />
                  </SelectTrigger>
                  <SelectContent>
                    {users.map(u => (
                      <SelectItem key={u.id} value={u.id}>{u.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : (
                <span className="text-sm">{task.assigneeName || "Unassigned"}</span>
              )}
            </div>

            {/* Co-assignees */}
            {availableForCoAssign.length > 0 && (
              <div className="flex items-start gap-3">
                <div className="w-28 flex items-center gap-2 text-muted-foreground shrink-0 pt-1">
                  <Users className="h-3.5 w-3.5" /> Also assign
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {coAssigneeUsers.map(u => (
                    <button
                      key={u.id}
                      onClick={() => toggleCoAssignee(u.id)}
                      className="flex items-center gap-1 rounded-full bg-primary/10 text-primary text-xs px-2 py-0.5 hover:bg-primary/20 transition-colors"
                    >
                      {u.name}
                      <X className="h-3 w-3" />
                    </button>
                  ))}
                  {availableForCoAssign
                    .filter(u => !coAssigneeIds.includes(u.id))
                    .map(u => (
                      <button
                        key={u.id}
                        onClick={() => toggleCoAssignee(u.id)}
                        className="flex items-center gap-1 rounded-full bg-muted text-muted-foreground text-xs px-2 py-0.5 hover:bg-muted/80 transition-colors"
                      >
                        <Plus className="h-3 w-3" />
                        {u.name}
                      </button>
                    ))}
                </div>
              </div>
            )}

            {/* Due date */}
            <div className="flex items-center gap-3">
              <div className="w-28 flex items-center gap-2 text-muted-foreground shrink-0">
                <Calendar className="h-3.5 w-3.5" /> Due date
              </div>
              <input
                type="date"
                value={dueDate}
                onChange={e => { setDueDate(e.target.value); save({ dueDate: e.target.value || null }); }}
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
              rows={4}
              placeholder="Add a description…"
              className="w-full resize-none bg-muted/30 hover:bg-muted/50 focus:bg-muted/50 rounded-lg p-3 text-sm leading-relaxed focus:outline-none focus:ring-1 focus:ring-ring transition-colors"
            />
          </div>

          <div className="border-t" />

          {/* Subtasks */}
          <div className="flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground uppercase tracking-wider">
                <GitBranch className="h-3.5 w-3.5" /> Subtasks
                {subtasks.length > 0 && (
                  <span className="text-muted-foreground normal-case font-normal">
                    {doneSubtasks}/{subtasks.length}
                  </span>
                )}
              </div>
              <button
                onClick={() => { setAddingSubtask(true); setNewSubtaskAssignee(assigneeId || ""); }}
                className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
              >
                <Plus className="h-3.5 w-3.5" /> Add
              </button>
            </div>

            {subtasks.length > 0 && (
              <div className="flex flex-col gap-1">
                {subtasks.map(sub => (
                  <div key={sub.id} className="flex items-center gap-2 py-1.5 px-2 rounded-md hover:bg-muted/40 group">
                    <button
                      onClick={() => toggleSubtask(sub.id, sub.status === "DONE" ? "TODO" : "DONE")}
                      className={cn(
                        "flex h-4 w-4 shrink-0 items-center justify-center rounded-full border-2 transition-all",
                        sub.status === "DONE" ? "bg-green-500 border-green-500 text-white" : "border-muted-foreground hover:border-primary"
                      )}
                    >
                      {sub.status === "DONE" && <Check className="h-2.5 w-2.5" />}
                    </button>
                    <span className={cn(
                      "flex-1 text-sm",
                      sub.status === "DONE" && "line-through text-muted-foreground"
                    )}>
                      {sub.title}
                    </span>
                    {sub.assigneeName && (
                      <span className="text-xs text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity">
                        {sub.assigneeName}
                      </span>
                    )}
                  </div>
                ))}
              </div>
            )}

            {addingSubtask && (
              <div className="flex flex-col gap-2 p-3 bg-muted/30 rounded-lg border">
                <input
                  autoFocus
                  type="text"
                  value={newSubtaskTitle}
                  onChange={e => setNewSubtaskTitle(e.target.value)}
                  onKeyDown={e => { if (e.key === "Enter") createSubtask(); if (e.key === "Escape") setAddingSubtask(false); }}
                  placeholder="Subtask title…"
                  className="w-full bg-transparent text-sm focus:outline-none"
                />
                {users.length > 0 && (
                  <Select value={newSubtaskAssignee} onValueChange={setNewSubtaskAssignee}>
                    <SelectTrigger className="h-7 text-xs border-0 bg-muted/50">
                      <SelectValue placeholder="Assign to…" />
                    </SelectTrigger>
                    <SelectContent>
                      {users.map(u => (
                        <SelectItem key={u.id} value={u.id}>{u.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
                <div className="flex gap-2">
                  <button
                    onClick={createSubtask}
                    disabled={creatingSubtask || !newSubtaskTitle.trim() || !newSubtaskAssignee}
                    className="text-xs bg-primary text-primary-foreground rounded px-2 py-1 disabled:opacity-50"
                  >
                    {creatingSubtask ? "Adding…" : "Add subtask"}
                  </button>
                  <button
                    onClick={() => setAddingSubtask(false)}
                    className="text-xs text-muted-foreground hover:text-foreground"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}

            {subtasks.length === 0 && !addingSubtask && (
              <p className="text-xs text-muted-foreground">No subtasks yet.</p>
            )}
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
