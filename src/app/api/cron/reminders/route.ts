import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/db";
import { sendDeadlineReminderEmail } from "@/lib/email";

export const runtime = "nodejs";

// Called daily by Vercel Cron at 09:00 UTC
// Sends reminders for tasks due in exactly 7 days or exactly 1 day
export async function GET(req: NextRequest) {
  // Protect with CRON_SECRET so only Vercel can call this
  const secret = req.headers.get("authorization")?.replace("Bearer ", "");
  if (process.env.CRON_SECRET && secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const now = new Date();

  // Build date windows: today's date + N days, full day range
  function dayWindow(daysFromNow: number) {
    const start = new Date(now);
    start.setDate(start.getDate() + daysFromNow);
    start.setHours(0, 0, 0, 0);
    const end = new Date(start);
    end.setHours(23, 59, 59, 999);
    return { gte: start, lte: end };
  }

  const [weekTasks, tomorrowTasks] = await Promise.all([
    prisma.task.findMany({
      where: { status: "TODO", parentId: null, dueDate: dayWindow(7) },
      include: {
        assignee: true,
        coAssignees: { include: { user: true } },
        project: true,
      },
    }),
    prisma.task.findMany({
      where: { status: "TODO", parentId: null, dueDate: dayWindow(1) },
      include: {
        assignee: true,
        coAssignees: { include: { user: true } },
        project: true,
      },
    }),
  ]);

  let sent = 0;

  async function notifyTask(
    task: typeof weekTasks[number],
    daysLeft: 1 | 7
  ) {
    const recipients = [
      task.assignee,
      ...task.coAssignees.map(ca => ca.user),
    ].filter(u => !!u.email);

    await Promise.all(
      recipients.map(u =>
        sendDeadlineReminderEmail({
          to: u.email!,
          taskTitle: task.title,
          assigneeName: u.name,
          daysLeft,
          dueDate: task.dueDate!,
          priority: task.priority,
          projectName: task.project?.name ?? null,
        })
      )
    );

    sent += recipients.length;
  }

  await Promise.all([
    ...weekTasks.map(t => notifyTask(t, 7)),
    ...tomorrowTasks.map(t => notifyTask(t, 1)),
  ]);

  console.log(`Reminder emails sent: ${sent} (${weekTasks.length} week, ${tomorrowTasks.length} tomorrow)`);
  return NextResponse.json({ ok: true, sent, week: weekTasks.length, tomorrow: tomorrowTasks.length });
}
