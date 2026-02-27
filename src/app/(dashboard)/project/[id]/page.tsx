import prisma from "@/lib/db";
import { TaskList } from "@/components/dashboard/task-list";
import { Hash } from "lucide-react";
import { Task } from "@/components/dashboard/task-item";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

export const dynamic = "force-dynamic";

async function getTasks(projectId: string, teamId: string | undefined): Promise<Task[]> {
  // If no teamId is connected to the session, we should not leak tasks
  if (!teamId) return [];

  const tasks = await prisma.task.findMany({
    where: {
      projectId: projectId === "slack-tasks" ? null : projectId,
      teamId,
    },
    include: { assignee: true },
    orderBy: { createdAt: "desc" },
  });

  return tasks.map(t => ({
    id: t.id,
    title: t.title,
    description: t.description,
    status: t.status,
    priority: t.priority,
    dueDate: t.dueDate,
    assigneeName: t.assignee.name,
    assigneeAvatar: t.assignee.avatarUrl || undefined,
    slackPermalink: t.slackPermalink || undefined,
  }));
}

export default async function ProjectPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await getServerSession(authOptions);

  // Right now, 'slack-tasks' is a pseudo-project for all tasks not strictly assigned a project ID
  const tasks = session?.user?.id ? await getTasks(id, session.user.teamId || undefined) : [];

  const todoTasks = tasks.filter((t) => t.status === "TODO");
  const doneTasks = tasks.filter((t) => t.status === "DONE");

  const projectName = id === "slack-tasks" ? "Slack Tasks" : "Project " + id;

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-1.5 border-b pb-4">
        <h1 className="text-xl font-bold tracking-tight">{projectName}</h1>
        <p className="text-sm text-muted-foreground">Tasks for this project</p>
      </header>

      <div className="flex flex-col gap-8">
        <section>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold">To Do <span className="text-muted-foreground text-sm font-normal items-center ml-2 border rounded-full px-2 py-0.5 bg-muted/50">{todoTasks.length}</span></h2>
          </div>
          {todoTasks.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-3 py-16 text-center border rounded-lg bg-card border-dashed">
              <div className="h-10 w-10 rounded-full bg-muted flex items-center justify-center text-muted-foreground/40">
                <Hash className="h-5 w-5" />
              </div>
              <div>
                <p className="text-sm font-medium text-foreground">No pending tasks</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Tasks created in related channels will appear here.
                </p>
              </div>
            </div>
          ) : (
            <TaskList initialTasks={todoTasks} />
          )}
        </section>

        {doneTasks.length > 0 && (
          <section>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold">Completed <span className="text-muted-foreground text-sm font-normal items-center ml-2 border rounded-full px-2 py-0.5 bg-muted/50">{doneTasks.length}</span></h2>
            </div>
            <TaskList initialTasks={doneTasks} />
          </section>
        )}
      </div>
    </div>
  );
}