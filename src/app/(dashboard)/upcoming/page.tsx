import prisma from "@/lib/db";
import { TaskList } from "@/components/dashboard/task-list";
import { CalendarDays } from "lucide-react";
import { Task } from "@/components/dashboard/task-item";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

export const dynamic = "force-dynamic";

async function getTasks(userId: string, teamIds: string[]): Promise<Task[]> {
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  tomorrow.setHours(0, 0, 0, 0);

  const tasks = await prisma.task.findMany({
    where: {
      status: "TODO",
      assigneeId: userId,
      OR: [
        ...(teamIds.length > 0 ? [{ teamId: { in: teamIds } }] : []),
        { teamId: null }
      ],
      dueDate: {
        gte: tomorrow
      }
    },
    include: { assignee: true },
    orderBy: { dueDate: "asc" },
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

export default async function UpcomingPage() {
  const session = await getServerSession(authOptions);
  // Support either single teamId or array of teamIds captured from JWT
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const activeTeams = (session?.user as any)?.teamIds || (session?.user?.teamId ? [session.user.teamId] : []);
  const tasks = session?.user?.id ? await getTasks(session.user.id, activeTeams) : [];

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-1.5 border-b pb-4">
        <h1 className="text-xl font-bold tracking-tight">Upcoming</h1>
        <p className="text-sm text-muted-foreground">Tasks due in the future</p>
      </header>

      <div className="flex flex-col">
        {tasks.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-3 py-16 text-center">
            <div className="h-12 w-12 rounded-full bg-muted flex items-center justify-center text-purple-500/40">
              <CalendarDays className="h-6 w-6" />
            </div>
            <div>
              <p className="text-sm font-medium text-foreground">No upcoming tasks</p>
              <p className="mt-1 text-xs text-muted-foreground">
                You are all caught up for the future!
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