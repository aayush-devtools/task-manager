import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/db";

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { teamId } = await req.json();
  if (!teamId) {
    return NextResponse.json({ error: "teamId is required" }, { status: 400 });
  }

  // Verify the user is actually a member of this workspace
  const membership = await prisma.userWorkspace.findUnique({
    where: { userId_teamId: { userId: session.user.id, teamId } },
  });

  if (!membership) {
    return NextResponse.json({ error: "You are not a member of this workspace" }, { status: 403 });
  }

  // Persist the new active workspace
  await prisma.user.update({
    where: { id: session.user.id },
    data: { teamId },
  });

  return NextResponse.json({ ok: true });
}
