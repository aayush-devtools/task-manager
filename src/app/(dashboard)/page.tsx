import prisma from "@/lib/db";
import { TaskList } from "@/components/dashboard/task-list";
import { Inbox } from "lucide-react";
import { Task } from "@/components/dashboard/task-item";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

export const dynamic = "force-dynamic";

async function getTasks(userId: string, teamId: string | undefined): Promise<Task[]> {
  const tasks = await prisma.task.findMany({
    where: {
      status: "TODO",
      assigneeId: userId,
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

export default async function InboxPage() {
  const session = await getServerSession(authOptions);
  const tasks = session?.user?.id ? await getTasks(session.user.id, session.user.teamId || undefined) : [];

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-1.5 border-b pb-4">
        <h1 className="text-xl font-bold tracking-tight">Inbox</h1>
        <p className="text-sm text-muted-foreground">Tasks assigned to you</p>
      </header>

      <div className="flex flex-col">
        {tasks.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-3 py-16 text-center">
            <div className="h-12 w-12 rounded-full bg-muted flex items-center justify-center text-muted-foreground/40">
              <Inbox className="h-6 w-6" />
            </div>
            <div>
              <p className="text-sm font-medium text-foreground">No tasks in your Inbox</p>
              <p className="mt-1 text-xs text-muted-foreground">
                Everything is clear. Mention your bot or use shortcuts in Slack to create tasks.
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
