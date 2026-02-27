import { NextRequest, NextResponse } from "next/server";
import { verifySlackSignature } from "@/lib/slack-verify";
import { getUserInfo } from "@/lib/slack-client";
import prisma from "@/lib/db";

export const runtime = "nodejs";

export async function GET() {
  return new Response("Slack Events Endpoint", { status: 200 });
}

export async function HEAD() {
  return new Response(null, { status: 200 });
}

export async function POST(req: NextRequest) {
  const rawBody = await req.text();
  console.log("Slack Events Request received:", rawBody);

  let payload: any;
  try {
    payload = JSON.parse(rawBody);
  } catch (err) {
    console.error("Failed to parse JSON:", err);
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  // Handle URL verification first to simplify Slack setup
  if (payload.type === "url_verification") {
    console.log("URL Verification challenge received");
    return new Response(payload.challenge, { 
      status: 200, 
      headers: { "Content-Type": "text/plain" } 
    });
  }

  // Verify Slack signature for all other events
  const signingSecret = process.env.SLACK_SIGNING_SECRET;
  if (!signingSecret) {
    console.error("SLACK_SIGNING_SECRET is missing");
    return NextResponse.json({ error: "Server misconfigured" }, { status: 500 });
  }

  const timestamp = req.headers.get("x-slack-request-timestamp") ?? "";
  const signature = req.headers.get("x-slack-signature") ?? "";

  if (!verifySlackSignature(signingSecret, rawBody, timestamp, signature)) {
    console.error("Invalid signature");
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  }

  const event = payload.event;
  if (payload.type !== "event_callback" || !event || event.type !== "app_mention") {
    return NextResponse.json({ ok: true });
  }

  const messageText = (event.text as string) ?? "";
  const channel = (event.channel as string) ?? "";
  const creatorSlackId = (event.user as string) ?? "";
  const ts = (event.ts as string) ?? "";
  const teamId = payload.team_id;

  // Build link
  const slackPermalink = teamId
    ? `https://slack.com/archives/${channel}/p${ts.replace(".", "")}`
    : undefined;

  // Clean text
  const title = messageText.replace(/<@[A-Z0-9]+>/g, "").trim() || "Slack task";

  try {
    const creator = await upsertUser(creatorSlackId);
    
    // Automatically assign to the creator for app_mentions by default
    await prisma.task.create({
      data: {
        title,
        status: "TODO",
        priority: "p4",
        creatorId: creator.id,
        assigneeId: creator.id,
        slackChannelId: channel,
        slackMessageTs: ts,
        slackPermalink,
      },
    });
  } catch (err) {
    console.error("Failed to process app_mention:", err);
  }

  return NextResponse.json({ ok: true });
}

async function upsertUser(slackId: string) {
  let user = await prisma.user.findUnique({
    where: { slackId },
  });

  if (!user) {
    try {
      const slackUser = await getUserInfo(slackId);
      user = await prisma.user.create({
        data: {
          slackId,
          name: slackUser.real_name || slackUser.name,
          avatarUrl: slackUser.profile?.image_512 || slackUser.profile?.image_192,
        },
      });
    } catch {
      // fallback
      user = await prisma.user.create({
        data: {
          slackId,
          name: "Unknown Slack User",
        },
      });
    }
  }

  return user;
}
