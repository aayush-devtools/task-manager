"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { TaskItem, Task } from "./task-item";
import { TaskDetailSheet } from "./task-detail-sheet";

interface TaskListProps {
  initialTasks: Task[];
  users?: { id: string; name: string; email: string }[];
  projects?: { id: string; name: string }[];
}

export function TaskList({ initialTasks, users = [], projects = [] }: TaskListProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);

  const handleToggle = (taskId: string, newStatus: string) => {
    startTransition(async () => {
      await fetch(`/api/tasks/${taskId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      });
      router.refresh();
    });
  };

  return (
    <>
      <div className={`flex flex-col ${isPending ? "opacity-70 pointer-events-none" : ""}`}>
        {initialTasks.map(task => (
          <TaskItem
            key={task.id}
            task={task}
            onToggle={status => handleToggle(task.id, status)}
            onClick={() => { setSelectedTask(task); setSheetOpen(true); }}
          />
        ))}
      </div>

      <TaskDetailSheet
        task={selectedTask}
        open={sheetOpen}
        onOpenChange={open => { setSheetOpen(open); if (!open) setSelectedTask(null); }}
        users={users}
        projects={projects}
      />
    </>
  );
}
