import prisma from "@/lib/db";
import { TaskList } from "@/components/dashboard/task-list";
import { Calendar } from "lucide-react";
import { Task } from "@/components/dashboard/task-item";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

export const dynamic = "force-dynamic";

async function getTasks(userId: string, teamIds: string[]): Promise<Task[]> {
  if (teamIds.length === 0) return [];

  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);

  const endOfDay = new Date();
  endOfDay.setHours(23, 59, 59, 999);

  const tasks = await prisma.task.findMany({
    where: {
      status: "TODO",
      assigneeId: userId,
      teamId: { in: teamIds },
      dueDate: {
        gte: startOfDay,
        lte: endOfDay
      }
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

export default async function TodayPage() {
  const session = await getServerSession(authOptions);
  // Support either single teamId or array of teamIds captured from JWT
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const activeTeams = (session?.user as any)?.teamIds || (session?.user?.teamId ? [session.user.teamId] : []);
  const tasks = session?.user?.id ? await getTasks(session.user.id, activeTeams) : [];

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-1.5 border-b pb-4">
        <h1 className="text-xl font-bold tracking-tight">Today</h1>
        <p className="text-sm text-muted-foreground">Tasks due today</p>
      </header>

      <div className="flex flex-col">
        {tasks.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-3 py-16 text-center">
            <div className="h-12 w-12 rounded-full bg-muted flex items-center justify-center text-green-500/40">
              <Calendar className="h-6 w-6" />
            </div>
            <div>
              <p className="text-sm font-medium text-foreground">No tasks due today</p>
              <p className="mt-1 text-xs text-muted-foreground">
                Enjoy your day!
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