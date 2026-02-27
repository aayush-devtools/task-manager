"use client";

import { TaskItem, Task } from "./task-item";
import { completeTaskAction } from "@/app/actions/task";
import { useOptimistic, useTransition } from "react";

export function TaskList({ initialTasks }: { initialTasks: Task[] }) {
  const [, startTransition] = useTransition();
  const [optimisticTasks, setOptimisticTasks] = useOptimistic(
    initialTasks,
    (state, taskId: string) => state.filter((t) => t.id !== taskId)
  );

  const handleComplete = (taskId: string) => {
    startTransition(async () => {
      setOptimisticTasks(taskId);
      await completeTaskAction(taskId);
    });
  };

  return (
    <div className="flex flex-col">
      {optimisticTasks.map((task) => (
        <TaskItem
          key={task.id}
          task={task}
          onComplete={handleComplete}
        />
      ))}
    </div>
  );
}
