"use client";

import { TaskItem, Task } from "./task-item";
import { useRouter } from "next/navigation";
import { useTransition } from "react";

export function TaskList({ initialTasks }: { initialTasks: Task[] }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

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
    <div className={`flex flex-col ${isPending ? "opacity-70 pointer-events-none" : ""}`}>
      {initialTasks.map((task) => (
        <TaskItem
          key={task.id}
          task={task}
          onToggle={(status) => handleToggle(task.id, status)}
        />
      ))}
    </div>
  );
}
