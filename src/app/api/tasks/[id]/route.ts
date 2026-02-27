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
        const task = await prisma.task.update({
            where: { id },
            data: { status },
        });
        return NextResponse.json(task);
    } catch (error) {
        console.error("Failed to update task:", error);
        return NextResponse.json({ error: "Failed to update task" }, { status: 500 });
    }
}
