import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/db";

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    const body = await req.json();
    const { status } = body;

    try {
        // Verify the task belongs to the user's workspace or is assigned to them
        const task = await prisma.task.findUnique({ where: { id } });
        if (!task) {
            return NextResponse.json({ error: "Task not found" }, { status: 404 });
        }

        const userTeamId = session.user.teamId || null;
        const isAssignee = task.assigneeId === session.user.id;
        const sameWorkspace = userTeamId && task.teamId === userTeamId;

        if (!isAssignee && !sameWorkspace) {
            return NextResponse.json({ error: "Forbidden" }, { status: 403 });
        }

        const updated = await prisma.task.update({
            where: { id },
            data: { status },
        });
        return NextResponse.json(updated);
    } catch (error) {
        console.error("Failed to update task:", error);
        return NextResponse.json({ error: "Failed to update task" }, { status: 500 });
    }
}
