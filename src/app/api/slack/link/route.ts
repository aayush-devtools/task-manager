import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/db";

// In-memory store for verification codes (keyed by userId)
// In production you'd store these in the DB with an expiry
const pendingVerifications = new Map<string, { code: string; slackUserId: string; teamId: string; expiresAt: number }>();

/**
 * POST /api/slack/link
 * Body: { slackUserId: string }
 * Looks up the Slack user, sends them a DM with a 6-digit code
 */
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { slackUserId } = await req.json();
  if (!slackUserId || typeof slackUserId !== "string") {
    return NextResponse.json({ error: "slackUserId is required" }, { status: 400 });
  }

  // Find which workspace this user belongs to
  const installations = await prisma.slackInstallation.findMany();
  let matchedInstall: typeof installations[0] | null = null;

  for (const install of installations) {
    try {
      const res = await fetch(`https://slack.com/api/users.info?user=${slackUserId}`, {
        headers: { Authorization: `Bearer ${install.botToken}` }
      });
      const data = await res.json();
      if (data.ok) {
        matchedInstall = install;
        break;
      }
    } catch { /* skip inactive installs */ }
  }

  if (!matchedInstall) {
    return NextResponse.json({ error: "Slack user not found in any connected workspace" }, { status: 404 });
  }

  // Check the Slack user isn't already linked to a different web account
  const existingLink = await prisma.user.findUnique({ where: { slackId: slackUserId } });
  if (existingLink && existingLink.id !== session.user.id) {
    return NextResponse.json({ error: "This Slack account is already linked to another user" }, { status: 409 });
  }

  // Generate 6-digit code
  const code = Math.floor(100000 + Math.random() * 900000).toString();
  const expiresAt = Date.now() + 10 * 60 * 1000; // 10 minutes

  pendingVerifications.set(session.user.id, { code, slackUserId, teamId: matchedInstall.teamId, expiresAt });

  // Send DM via Slack
  const dmRes = await fetch("https://slack.com/api/chat.postMessage", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${matchedInstall.botToken}`,
    },
    body: JSON.stringify({
      channel: slackUserId,
      text: `Your Task Manager verification code is: *${code}*\n\nThis code expires in 10 minutes.`,
    }),
  });

  const dmData = await dmRes.json();
  if (!dmData.ok) {
    console.error("Failed to send verification DM:", dmData.error);
    return NextResponse.json({ error: "Failed to send verification DM: " + dmData.error }, { status: 500 });
  }

  return NextResponse.json({ ok: true, message: "Verification code sent via Slack DM" });
}

/**
 * PATCH /api/slack/link
 * Body: { code: string }
 * Verifies the code and links the Slack account to the current user
 */
export async function PATCH(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { code } = await req.json();
  if (!code) {
    return NextResponse.json({ error: "code is required" }, { status: 400 });
  }

  const pending = pendingVerifications.get(session.user.id);
  if (!pending) {
    return NextResponse.json({ error: "No pending verification. Request a new code first." }, { status: 400 });
  }

  if (Date.now() > pending.expiresAt) {
    pendingVerifications.delete(session.user.id);
    return NextResponse.json({ error: "Verification code expired. Request a new one." }, { status: 400 });
  }

  if (pending.code !== code) {
    return NextResponse.json({ error: "Invalid verification code" }, { status: 400 });
  }

  pendingVerifications.delete(session.user.id);

  // Check if there's an existing Slack-only user record to merge
  const existingSlackUser = await prisma.user.findUnique({ where: { slackId: pending.slackUserId } });

  if (existingSlackUser && existingSlackUser.id !== session.user.id) {
    // Merge: re-point all tasks from the Slack-only user to current user
    await prisma.task.updateMany({ where: { assigneeId: existingSlackUser.id }, data: { assigneeId: session.user.id } });
    await prisma.task.updateMany({ where: { creatorId: existingSlackUser.id }, data: { creatorId: session.user.id } });
    await prisma.user.delete({ where: { id: existingSlackUser.id } });
  }

  // Link the Slack account to the current user
  await prisma.user.update({
    where: { id: session.user.id },
    data: {
      slackId: pending.slackUserId,
      teamId: pending.teamId,
    }
  });

  return NextResponse.json({ ok: true, message: "Slack account linked successfully! Please sign out and back in to refresh your session." });
}
