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
    const { title, assigneeId, dueDate, priority } = await req.json();

    if (!title || !assigneeId) {
      return NextResponse.json({ error: "Title and assignee are required" }, { status: 400 });
    }

    const task = await prisma.task.create({
      data: {
        title,
        assigneeId,
        priority: priority || "p4",
        dueDate: dueDate ? new Date(dueDate) : null,
        creatorId: session.user.id,
        status: "TODO"
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
