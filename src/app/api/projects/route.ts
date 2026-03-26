import { NextResponse } from "next/server";
import prisma from "@/lib/db";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const teamId = session.user.teamId;
  if (!teamId) {
    return NextResponse.json([], { status: 200 });
  }

  const projects = await prisma.project.findMany({
    where: { teamId },
    orderBy: { name: "asc" },
  });

  return NextResponse.json(projects);
}

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const teamId = session.user.teamId;
  if (!teamId) {
    return NextResponse.json({ error: "You must be in a workspace to create projects" }, { status: 403 });
  }

  const { name } = await req.json();
  if (!name?.trim()) {
    return NextResponse.json({ error: "Project name is required" }, { status: 400 });
  }

  const project = await prisma.project.create({
    data: { name: name.trim(), teamId },
  });

  return NextResponse.json(project, { status: 201 });
}
