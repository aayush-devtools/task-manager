import prisma from "@/lib/db";
import { TaskList } from "@/components/dashboard/task-list";
import { Hash } from "lucide-react";
import { Task } from "@/components/dashboard/task-item";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

export const dynamic = "force-dynamic";

async function getTasks(projectId: string): Promise<Task[]> {
  const tasks = await prisma.task.findMany({
    where: { 
      status: "TODO",
      projectId: projectId === "slack-tasks" ? undefined : projectId,
    },
    include: { assignee: true },
    orderBy: { createdAt: "desc" },
  });

  return tasks.map(t => ({
    id: t.id,
    title: t.title,
    status: t.status,
    priority: t.priority,
    dueDate: t.dueDate,
    assigneeName: t.assignee.name,
    assigneeAvatar: t.assignee.avatarUrl || undefined,
    slackPermalink: t.slackPermalink || undefined,
  }));
}

export default async function ProjectPage({ params }: { params: { id: string } }) {
  const { id } = await params;
  const session = await getServerSession(authOptions);
  
  // Right now, 'slack-tasks' is a pseudo-project for all tasks not strictly assigned a project ID
  const tasks = session?.user?.id ? await getTasks(id) : [];

  const projectName = id === "slack-tasks" ? "Slack Tasks" : "Project " + id;

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-1.5 border-b pb-4">
        <h1 className="text-xl font-bold tracking-tight">{projectName}</h1>
        <p className="text-sm text-muted-foreground">Tasks for this project</p>
      </header>

      <div className="flex flex-col">
        {tasks.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-3 py-16 text-center">
            <div className="h-12 w-12 rounded-full bg-muted flex items-center justify-center text-muted-foreground/40">
              <Hash className="h-6 w-6" />
            </div>
            <div>
              <p className="text-sm font-medium text-foreground">No tasks in this project</p>
              <p className="mt-1 text-xs text-muted-foreground">
                Tasks created in related channels will appear here.
              </p>
            </div>
          </div>
        ) : (
          <TaskList initialTasks={tasks} />
        )}
      </div>
    </div>
  );
}