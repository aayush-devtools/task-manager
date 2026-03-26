import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/db";

const taskInclude = {
  assignee: true,
  creator: true,
  project: true,
  coAssignees: { include: { user: true } },
  subtasks: {
    include: { assignee: true, coAssignees: { include: { user: true } } },
    orderBy: { createdAt: "asc" as const },
  },
};

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const task = await prisma.task.findUnique({ where: { id }, include: taskInclude });

  if (!task) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const userTeamId = session.user.teamId || null;
  if (task.assigneeId !== session.user.id && task.teamId !== userTeamId) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  return NextResponse.json(task);
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const body = await req.json();

  try {
    const task = await prisma.task.findUnique({ where: { id } });
    if (!task) return NextResponse.json({ error: "Task not found" }, { status: 404 });

    const userTeamId = session.user.teamId || null;
    const isAssignee = task.assigneeId === session.user.id;
    const sameWorkspace = userTeamId && task.teamId === userTeamId;
    if (!isAssignee && !sameWorkspace) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { status, title, description, url, priority, dueDate, assigneeId, projectId, coAssigneeIds } = body;

    if (coAssigneeIds !== undefined) {
      await prisma.taskAssignee.deleteMany({ where: { taskId: id } });
      if (coAssigneeIds.length > 0) {
        await prisma.taskAssignee.createMany({
          data: coAssigneeIds.map((uid: string) => ({ taskId: id, userId: uid })),
          skipDuplicates: true,
        });
      }
    }

    const updated = await prisma.task.update({
      where: { id },
      data: {
        ...(status !== undefined && { status }),
        ...(title !== undefined && { title }),
        ...(description !== undefined && { description }),
        ...(url !== undefined && { url }),
        ...(priority !== undefined && { priority }),
        ...(dueDate !== undefined && { dueDate: dueDate ? new Date(dueDate) : null }),
        ...(assigneeId !== undefined && { assigneeId }),
        ...(projectId !== undefined && { projectId: projectId || null }),
      },
      include: taskInclude,
    });

    return NextResponse.json(updated);
  } catch (error) {
    console.error("Failed to update task:", error);
    return NextResponse.json({ error: "Failed to update task" }, { status: 500 });
  }
}
