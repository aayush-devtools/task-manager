"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Plus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter,
  DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";

interface CreateTaskModalProps {
  projects?: { id: string; name: string }[];
  defaultProjectId?: string;
}

export function CreateTaskModal({ projects = [], defaultProjectId }: CreateTaskModalProps) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [users, setUsers] = useState<{ id: string; name: string; email: string }[]>([]);
  const [primaryAssignee, setPrimaryAssignee] = useState("");
  const [coAssigneeIds, setCoAssigneeIds] = useState<string[]>([]);
  const router = useRouter();

  useEffect(() => {
    if (open && users.length === 0) {
      fetch("/api/users")
        .then(res => res.json())
        .then(data => setUsers(Array.isArray(data) ? data : []))
        .catch(err => console.error("Failed to fetch users", err));
    }
  }, [open, users.length]);

  // Reset state when modal closes
  useEffect(() => {
    if (!open) {
      setPrimaryAssignee("");
      setCoAssigneeIds([]);
    }
  }, [open]);

  const toggleCoAssignee = (uid: string) => {
    setCoAssigneeIds(prev =>
      prev.includes(uid) ? prev.filter(id => id !== uid) : [...prev, uid]
    );
  };

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);

    const formData = new FormData(e.currentTarget);
    const title = formData.get("title") as string;
    const priority = formData.get("priority") as string;
    const dueDateStr = formData.get("dueDate") as string;
    const dueDate = dueDateStr ? new Date(dueDateStr).toISOString() : null;
    const projectIdRaw = formData.get("projectId") as string;
    const projectId = projectIdRaw && projectIdRaw !== "none" ? projectIdRaw : null;
    const url = (formData.get("url") as string) || null;

    try {
      const res = await fetch("/api/tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title, assigneeId: primaryAssignee, priority, dueDate, projectId, url,
          coAssigneeIds: coAssigneeIds.filter(id => id !== primaryAssignee),
        }),
      });

      if (!res.ok) throw new Error("Failed to create task");

      toast.success("Task created");
      setOpen(false);
      router.refresh();
    } catch {
      toast.error("Failed to create task");
    } finally {
      setLoading(false);
    }
  }

  const availableForCoAssign = users.filter(u => u.id !== primaryAssignee);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="w-full justify-start gap-2" variant="default">
          <Plus className="h-4 w-4" />
          Create Task
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[440px]">
        <form onSubmit={onSubmit}>
          <DialogHeader>
            <DialogTitle>Create new task</DialogTitle>
            <DialogDescription>Add a new task and assign it to your team.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="title">Task title</Label>
              <Input id="title" name="title" placeholder="What needs to be done?" required autoFocus />
            </div>

            {/* Primary assignee */}
            <div className="grid gap-2">
              <Label>Assignee</Label>
              <Select value={primaryAssignee} onValueChange={setPrimaryAssignee} required>
                <SelectTrigger>
                  <SelectValue placeholder="Select primary assignee" />
                </SelectTrigger>
                <SelectContent>
                  {users.map(user => (
                    <SelectItem key={user.id} value={user.id}>
                      {user.name} {user.email ? `(${user.email})` : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Co-assignees */}
            {primaryAssignee && availableForCoAssign.length > 0 && (
              <div className="grid gap-2">
                <Label>Also assign to (optional)</Label>
                <div className="flex flex-wrap gap-1.5">
                  {availableForCoAssign.map(u => (
                    <button
                      type="button"
                      key={u.id}
                      onClick={() => toggleCoAssignee(u.id)}
                      className={
                        coAssigneeIds.includes(u.id)
                          ? "flex items-center gap-1 rounded-full bg-primary/10 text-primary text-xs px-2 py-1 border border-primary/30"
                          : "flex items-center gap-1 rounded-full bg-muted text-muted-foreground text-xs px-2 py-1 hover:bg-muted/80"
                      }
                    >
                      {coAssigneeIds.includes(u.id) ? <X className="h-3 w-3" /> : <Plus className="h-3 w-3" />}
                      {u.name}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {projects.length > 0 && (
              <div className="grid gap-2">
                <Label htmlFor="projectId">Project (optional)</Label>
                <Select name="projectId" defaultValue={defaultProjectId || "none"}>
                  <SelectTrigger>
                    <SelectValue placeholder="No project" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">No project</SelectItem>
                    {projects.map(project => (
                      <SelectItem key={project.id} value={project.id}>{project.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label htmlFor="priority">Priority</Label>
                <Select name="priority" defaultValue="p4">
                  <SelectTrigger>
                    <SelectValue placeholder="Priority" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="p1">🔴 P1 - Urgent</SelectItem>
                    <SelectItem value="p2">🟠 P2 - High</SelectItem>
                    <SelectItem value="p3">🟡 P3 - Medium</SelectItem>
                    <SelectItem value="p4">🟢 P4 - Low</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="dueDate">Due Date (Optional)</Label>
                <Input id="dueDate" name="dueDate" type="date" />
              </div>
            </div>

            <div className="grid gap-2">
              <Label htmlFor="url">URL (optional)</Label>
              <Input id="url" name="url" type="url" placeholder="https://..." />
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button type="submit" disabled={loading || !primaryAssignee}>
              {loading ? "Creating..." : "Create task"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
