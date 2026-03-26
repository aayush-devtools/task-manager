import prisma from "@/lib/db";
import { TaskList } from "@/components/dashboard/task-list";
import { Hash } from "lucide-react";
import { Task } from "@/components/dashboard/task-item";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { CreateTaskModal } from "@/components/dashboard/create-task-modal";
import { notFound } from "next/navigation";

export const dynamic = "force-dynamic";

async function getTasks(projectId: string, teamId: string): Promise<Task[]> {
  const tasks = await prisma.task.findMany({
    where: { projectId, teamId },
    include: { assignee: true, creator: true, project: true },
    orderBy: { createdAt: "desc" },
  });
  return tasks.map(t => ({
    id: t.id, title: t.title, description: t.description, url: t.url,
    status: t.status, priority: t.priority, dueDate: t.dueDate,
    assigneeId: t.assigneeId, assigneeName: t.assignee.name, assigneeAvatar: t.assignee.avatarUrl || undefined,
    creatorName: t.creator.name, projectId: t.projectId, projectName: t.project?.name || null,
    slackPermalink: t.slackPermalink || undefined,
  }));
}

export default async function ProjectPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await getServerSession(authOptions);

  const teamId = session?.user?.teamId;
  if (!teamId) {
    return (
      <div className="flex flex-col gap-6">
        <header className="flex flex-col gap-1.5 border-b pb-4">
          <h1 className="text-xl font-bold tracking-tight">Project</h1>
          <p className="text-sm text-muted-foreground">Connect a Slack workspace to see workspace projects.</p>
        </header>
      </div>
    );
  }

  const project = await prisma.project.findFirst({
    where: { id, teamId },
  });

  if (!project) {
    notFound();
  }

  const [projects, users, tasks] = await Promise.all([
    prisma.project.findMany({ where: { teamId }, orderBy: { name: "asc" } }),
    prisma.user.findMany({ where: { teamId }, select: { id: true, name: true, email: true } }),
    getTasks(id, teamId),
  ]);
  const todoTasks = tasks.filter((t) => t.status === "TODO");
  const doneTasks = tasks.filter((t) => t.status === "DONE");

  return (
    <div className="flex flex-col gap-6">
      <header className="flex items-center justify-between border-b pb-4">
        <div className="flex flex-col gap-1.5">
          <h1 className="text-xl font-bold tracking-tight">{project.name}</h1>
          <p className="text-sm text-muted-foreground">Tasks for this project</p>
        </div>
        <CreateTaskModal
          projects={projects.map(p => ({ id: p.id, name: p.name }))}
          defaultProjectId={id}
        />
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
                  Create a task to get started.
                </p>
              </div>
            </div>
          ) : (
            <TaskList initialTasks={todoTasks} users={users} projects={projects.map(p => ({ id: p.id, name: p.name }))} />
          )}
        </section>

        {doneTasks.length > 0 && (
          <section>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold">Completed <span className="text-muted-foreground text-sm font-normal items-center ml-2 border rounded-full px-2 py-0.5 bg-muted/50">{doneTasks.length}</span></h2>
            </div>
            <TaskList initialTasks={doneTasks} users={users} projects={projects.map(p => ({ id: p.id, name: p.name }))} />
          </section>
        )}
      </div>
    </div>
  );
}
