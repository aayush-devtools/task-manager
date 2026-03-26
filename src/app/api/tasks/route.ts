import { NextResponse } from "next/server";
import prisma from "@/lib/db";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { title, assigneeId, dueDate, priority, projectId } = await req.json();

    if (!title || !assigneeId) {
      return NextResponse.json({ error: "Title and assignee are required" }, { status: 400 });
    }

    const teamId = session.user.teamId || null;

    // If a projectId is provided, verify it belongs to the user's workspace
    if (projectId) {
      if (!teamId) {
        return NextResponse.json({ error: "You must be in a workspace to assign tasks to projects" }, { status: 403 });
      }
      const project = await prisma.project.findFirst({ where: { id: projectId, teamId } });
      if (!project) {
        return NextResponse.json({ error: "Project not found" }, { status: 404 });
      }
    }

    const task = await prisma.task.create({
      data: {
        title,
        assigneeId,
        priority: priority || "p4",
        dueDate: dueDate ? new Date(dueDate) : null,
        creatorId: session.user.id,
        teamId,
        status: "TODO",
        projectId: projectId || null,
      },
      include: {
        assignee: true
      }
    });

    return NextResponse.json(task, { status: 201 });
  } catch (error) {
    console.error("Failed to create task:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
