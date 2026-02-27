import { NextResponse } from "next/server";
import prisma from "@/lib/db";

export const runtime = "nodejs";

export async function GET() {
  const tasks = await prisma.task.findMany({
    include: { assignee: true, creator: true, project: true },
    orderBy: { createdAt: "desc" },
  });
  return NextResponse.json({ tasks });
}
