import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { verifySlackSignature } from "@/lib/slack-verify";
import { buildTaskModal } from "@/lib/slack-modal";
import { openModal, getUserInfo, getPermalink, postMessage, respondToUrl } from "@/lib/slack-client";
import prisma from "@/lib/db";

export const runtime = "nodejs";

export async function GET() {
  return new Response("Slack Interactivity Endpoint", { status: 200 });
}

export async function POST(req: NextRequest) {
  let rawBody = "";
  try {
    rawBody = await req.text();
  } catch (err) {
    console.error("Error reading request text:", err);
    return NextResponse.json({ error: "Failed to read body" }, { status: 400 });
  }

  // 1. Verify Slack signature
  const signingSecret = process.env.SLACK_SIGNING_SECRET;
  if (!signingSecret) {
    return NextResponse.json({ error: "Server misconfigured" }, { status: 500 });
  }

  const timestamp = req.headers.get("x-slack-request-timestamp") ?? "";
  const signature = req.headers.get("x-slack-signature") ?? "";

  if (!verifySlackSignature(signingSecret, rawBody, timestamp, signature)) {
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  }

  // 2. Parse payload
  const params = new URLSearchParams(rawBody);
  const payloadStr = params.get("payload");

  // 3. Handle Slash Commands — respond fast, open modal async
  if (!payloadStr) {
    const command = params.get("command");
    const responseUrl = params.get("response_url");
    const teamId = params.get("team_id");

    let botToken: string | undefined;
    if (teamId) {
      const installation = await prisma.slackInstallation.findUnique({ where: { teamId } });
      botToken = installation?.botToken;
    }

    if (command === "/task") {
      const triggerId = params.get("trigger_id");
      const text = params.get("text") || "";
      const channelId = params.get("channel_id");

      if (triggerId) {
        // Fetch projects for this workspace to show in the modal
        const projects = teamId
          ? await prisma.project.findMany({ where: { teamId }, orderBy: { name: "asc" }, select: { id: true, name: true } })
          : [];

        openModal(
          triggerId,
          buildTaskModal(text, undefined, channelId || undefined, responseUrl || undefined, projects),
          botToken
        ).catch(err => console.error("Error opening /task modal:", err));
      }
      return new Response("", { status: 200 });
    }

    if (command === "/tasks") {
      const channelId = params.get("channel_id") || "";

      const tasks = await prisma.task.findMany({
        where: { teamId: teamId || "__NONE__" },
        take: 10,
        orderBy: { createdAt: "desc" },
        include: { assignee: true },
      });

      const message = tasks.length === 0
        ? { text: "No tasks found! Use `/task` to create one." }
        : {
          text: "*Current Tasks (Last 10):*",
          blocks: [
            { type: "section", text: { type: "mrkdwn", text: "*Current Tasks (Last 10):*" } },
            {
              type: "section",
              text: {
                type: "mrkdwn",
                text: tasks.map(t => {
                  const statusEmoji = t.status === "DONE" ? "✅" : "⏳";
                  const dateStr = t.dueDate ? ` (Due: ${new Date(t.dueDate).toLocaleDateString()})` : "";
                  return `${statusEmoji} *${t.title}* — ${t.assignee?.name || "Unassigned"}${dateStr}`;
                }).join("\n"),
              },
            },
          ],
        };

      if (responseUrl) {
        respondToUrl(responseUrl, message).catch(e => console.error("respondToUrl /tasks:", e));
      } else {
        postMessage(channelId, (message as { text: string }).text, undefined, botToken).catch(e => console.error("postMessage /tasks:", e));
      }
      return new Response("", { status: 200 });
    }

    return new Response("", { status: 200 });
  }

  // 4. Handle interactivity payloads
  let payload: Record<string, unknown>;
  try {
    payload = JSON.parse(payloadStr);
  } catch (err) {
    console.error("Failed to parse payload:", err);
    return NextResponse.json({ ok: true });
  }

  const teamId = (payload.team as Record<string, string>)?.id || (payload.team_id as string);
  let botToken: string | undefined;
  if (teamId) {
    const installation = await prisma.slackInstallation.findUnique({ where: { teamId } });
    botToken = installation?.botToken;
  }

  if (payload.type === "message_action") {
    const message = payload.message as Record<string, string>;
    const channel = (payload.channel as Record<string, string>).id;
    const triggerId = payload.trigger_id as string;
    const responseUrl = payload.response_url as string;

    const projects = teamId
      ? await prisma.project.findMany({ where: { teamId }, orderBy: { name: "asc" }, select: { id: true, name: true } })
      : [];

    const permalink = await getPermalink(channel, message.ts, botToken);
    const modal = buildTaskModal(message.text, permalink, channel, responseUrl, projects);
    await openModal(triggerId, modal, botToken);
  }
  else if (payload.type === "shortcut") {
    const triggerId = payload.trigger_id as string;
    const projects = teamId
      ? await prisma.project.findMany({ where: { teamId }, orderBy: { name: "asc" }, select: { id: true, name: true } })
      : [];
    const modal = buildTaskModal(undefined, undefined, undefined, undefined, projects);
    await openModal(triggerId, modal, botToken);
  }
  else if (payload.type === "view_submission") {
    const values = (payload.view as Record<string, Record<string, Record<string, Record<string, string>>>>).state.values;
    const privateMetadata = JSON.parse((payload.view as Record<string, string>).private_metadata || "{}");
    const creatorSlackId = (payload.user as Record<string, string>).id;

    const title = values.title_block.title_input.value;
    const description = values.description_block?.description_input?.value || null;
    const assigneeSlackId = values.assignee_block.assignee_select.selected_user;
    const dueDateStr = values.due_date_block?.due_date_select?.selected_date || null;
    const priority = values.priority_block.priority_select.selected_option?.value || "p4";
    const projectId = values.project_block?.project_select?.selected_option?.value || null;

    if (!assigneeSlackId) {
      return NextResponse.json({
        response_action: "errors",
        errors: { assignee_block: "Please select an assignee" },
      });
    }

    try {
      // Ensure users exist in DB
      let creator, assignee;
      if (creatorSlackId === assigneeSlackId) {
        creator = await upsertUser(creatorSlackId, teamId, botToken);
        assignee = creator;
      } else {
        [creator, assignee] = await Promise.all([
          upsertUser(creatorSlackId, teamId, botToken),
          upsertUser(assigneeSlackId, teamId, botToken),
        ]);
      }

      // Save task
      await prisma.task.create({
        data: {
          title,
          description,
          status: "TODO",
          priority,
          dueDate: dueDateStr ? new Date(dueDateStr + "T12:00:00Z") : null,
          assigneeId: assignee.id,
          creatorId: creator.id,
          slackPermalink: privateMetadata.slackLink || null,
          projectId: projectId || null,
          teamId,
        },
      });

      // Revalidate dashboard
      revalidatePath("/");

      // Fire confirmation asynchronously — don't block the response
      const confirmationText = `✅ *Task Created:* "${title}"\n👤 *Assigned to:* ${assignee.name || "someone"}${dueDateStr ? `\n📅 *Due:* ${dueDateStr}` : ""}${projectId ? `\n📁 *Project:* ${values.project_block?.project_select?.selected_option?.text?.text || ""}` : ""}`;

      if (privateMetadata.responseUrl) {
        respondToUrl(privateMetadata.responseUrl, {
          text: confirmationText,
          replace_original: false,
          response_type: "in_channel",
        }).catch(err => {
          console.error("responseUrl failed, trying postMessage:", err);
          if (privateMetadata.channelId && botToken) {
            postMessage(privateMetadata.channelId, confirmationText, undefined, botToken)
              .catch(e => console.error("postMessage fallback failed:", e));
          }
        });
      } else if (privateMetadata.channelId) {
        postMessage(privateMetadata.channelId, confirmationText, undefined, botToken)
          .catch(e => console.error("postMessage confirmation failed:", e));
      }
    } catch (err) {
      console.error("Error processing view_submission:", err);
    }

    // Respond immediately to close the modal — Slack requires this within 3s
    return NextResponse.json({ response_action: "clear" });
  }

  return NextResponse.json({ ok: true });
}

async function upsertUser(slackId: string, teamId: string, botToken?: string) {
  try {
    const existingUser = await prisma.user.findUnique({ where: { slackId } });
    if (existingUser) return existingUser;

    const slackUser = await getUserInfo(slackId, botToken);
    return await prisma.user.upsert({
      where: { slackId },
      update: {
        name: slackUser?.real_name || slackUser?.name || "Unknown User",
        avatarUrl: slackUser?.profile?.image_512 || slackUser?.profile?.image_192 || null,
      },
      create: {
        slackId,
        name: slackUser?.real_name || slackUser?.name || "Unknown User",
        avatarUrl: slackUser?.profile?.image_512 || slackUser?.profile?.image_192 || null,
        teamId,
      },
    });
  } catch (err) {
    console.error(`Error in upsertUser for ${slackId}:`, err);
    return await prisma.user.upsert({
      where: { slackId },
      update: {},
      create: { slackId, name: "Slack User " + slackId, teamId },
    });
  }
}
