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
  console.log("Interactivity request received at", new Date().toISOString());
  let rawBody = "";
  try {
    rawBody = await req.text();
    console.log("Raw body length:", rawBody.length);
  } catch (err) {
    console.error("Error reading request text:", err);
    return NextResponse.json({ error: "Failed to read body" }, { status: 400 });
  }

  // 1. Verify Slack signature
  const signingSecret = process.env.SLACK_SIGNING_SECRET;
  if (!signingSecret) {
    console.error("SLACK_SIGNING_SECRET is missing");
    return NextResponse.json({ error: "Server misconfigured" }, { status: 500 });
  }

  const timestamp = req.headers.get("x-slack-request-timestamp") ?? "";
  const signature = req.headers.get("x-slack-signature") ?? "";

  if (!verifySlackSignature(signingSecret, rawBody, timestamp, signature)) {
    console.error("Signature verification failed for request", { timestamp, signature });
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  }

  // 2. Parse payload
  const params = new URLSearchParams(rawBody);
  const payloadStr = params.get("payload");

  // 3. Handle Slash Commands separately to respond as fast as possible
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
      console.log("Slash command /task received", { triggerId, text, channelId });

      if (triggerId) {
        try {
          const modal = buildTaskModal(text, undefined, channelId || undefined, responseUrl || undefined);
          await openModal(triggerId, modal, botToken);
          console.log("Modal opened successfully for /task");
        } catch (err) {
          console.error("Error opening modal for /task:", err);
        }
      }
      return new Response("", { status: 200 });
    }

    if (command === "/tasks") {
      const channelId = params.get("channel_id") || "";
      const userId = params.get("user_id") || "";
      console.log("Slash command /tasks received", { channelId, userId, responseUrl });

      try {
        // Fetch last 10 tasks from DB
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
              {
                type: "section",
                text: {
                  type: "mrkdwn",
                  text: "*Current Tasks (Last 10):*"
                }
              },
              {
                type: "section",
                text: {
                  type: "mrkdwn",
                  text: tasks.map(t => {
                    const statusEmoji = t.status === "DONE" ? "✅" : "⏳";
                    const assigneeName = t.assignee?.name || "Unassigned";
                    const dateStr = t.dueDate ? ` (Due: ${new Date(t.dueDate).toLocaleDateString()})` : "";
                    return `${statusEmoji} *${t.title}* - assigned to ${assigneeName}${dateStr}`;
                  }).join("\n")
                }
              }
            ]
          };

        if (responseUrl) {
          await respondToUrl(responseUrl, message);
        } else {
          await postMessage(channelId, message.text, undefined, botToken);
        }
      } catch (err) {
        console.error("Error listing tasks for /tasks:", err);
        if (responseUrl) {
          await respondToUrl(responseUrl, { text: "Sorry, I had trouble fetching the task list." });
        } else {
          await postMessage(channelId, "Sorry, I had trouble fetching the task list.", undefined, botToken);
        }
      }
      return new Response("", { status: 200 });
    }

    return new Response("", { status: 200 });
  }

  // 4. Handle specific interactivity types from payload
  try {
    const payload = JSON.parse(payloadStr);
    console.log("Payload type received:", payload.type);

    const teamId = payload.team?.id || payload.team_id;
    let botToken: string | undefined;
    if (teamId) {
      const installation = await prisma.slackInstallation.findUnique({ where: { teamId } });
      botToken = installation?.botToken;
    }

    if (payload.type === "message_action") {
      const message = payload.message;
      const channel = payload.channel.id;
      const triggerId = payload.trigger_id;
      const responseUrl = payload.response_url;

      const permalink = await getPermalink(channel, message.ts, botToken);
      const modal = buildTaskModal(message.text, permalink, channel, responseUrl);
      await openModal(triggerId, modal, botToken);
    }
    else if (payload.type === "shortcut") {
      const triggerId = payload.trigger_id;
      const modal = buildTaskModal();
      await openModal(triggerId, modal, botToken);
    }
    else if (payload.type === "view_submission") {
      const values = payload.view.state.values;
      console.log("Form submission values:", JSON.stringify(values, null, 2));

      const title = values.title_block.title_input.value;
      const description = values.description_block?.description_input?.value || null;
      const assigneeSlackId = values.assignee_block.assignee_select.selected_user;
      const dueDateStr = values.due_date_block.due_date_select.selected_date;
      const priority = values.priority_block.priority_select.selected_option.value;
      const privateMetadata = JSON.parse(payload.view.private_metadata || "{}");

      const creatorSlackId = payload.user.id;

      console.log("Processing submission:", { creatorSlackId, assigneeSlackId, title });

      if (!assigneeSlackId) {
        return NextResponse.json({
          response_action: "errors",
          errors: {
            assignee_block: "Please select an assignee"
          }
        });
      }

      // Ensure users exist in DB
      let creator, assignee;
      if (creatorSlackId === assigneeSlackId) {
        creator = await upsertUser(creatorSlackId, teamId, botToken);
        assignee = creator;
      } else {
        [creator, assignee] = await Promise.all([
          upsertUser(creatorSlackId, teamId, botToken),
          upsertUser(assigneeSlackId, teamId, botToken)
        ]);
      }

      console.log("Users verified in DB:", { creator: creator.id, assignee: assignee.id });

      // Save task
      const task = await prisma.task.create({
        data: {
          title,
          description,
          status: "TODO",
          priority,
          dueDate: dueDateStr ? new Date(dueDateStr + "T12:00:00Z") : null,
          assigneeId: assignee.id,
          creatorId: creator.id,
          slackPermalink: privateMetadata.slackLink,
          teamId,
        },
      });
      console.log("Task created successfully:", task.id);

      // Send confirmation message to Slack
      const confirmationText = `✅ *Task Created:* "${title}"\n👤 *Assigned to:* ${assignee.name || "someone"}${dueDateStr ? `\n📅 *Due:* ${dueDateStr}` : ""}`;

      if (privateMetadata.responseUrl) {
        try {
          await respondToUrl(privateMetadata.responseUrl, {
            text: confirmationText,
            replace_original: false,
            response_type: "in_channel"
          });
        } catch (respErr) {
          console.error("Error sending Slack confirmation via responseUrl:", respErr);
          // Fallback to postMessage
          if (privateMetadata.channelId) {
            await postMessage(privateMetadata.channelId, confirmationText, undefined, botToken).catch(e => console.error("Fallback postMessage failed:", e));
          }
        }
      } else if (privateMetadata.channelId) {
        await postMessage(privateMetadata.channelId, confirmationText, undefined, botToken).catch(e => console.error("Confirmation postMessage failed:", e));
      }

      // Revalidate the dashboard page so the new task appears immediately
      revalidatePath("/");

      return NextResponse.json({
        response_action: "clear",
      });
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("Slack Interactivity Error:", err);
    return NextResponse.json({ ok: true });
  }
}

async function upsertUser(slackId: string, teamId: string, botToken?: string) {
  try {
    // First try to find the user
    const existingUser = await prisma.user.findUnique({
      where: { slackId },
    });

    if (existingUser) {
      return existingUser;
    }

    // If not found, fetch from Slack
    console.log(`User ${slackId} not found in DB, fetching from Slack...`);
    const slackUser = await getUserInfo(slackId, botToken);

    // Use upsert to avoid race conditions during creation
    const user = await prisma.user.upsert({
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

    console.log(`User ${slackId} upserted in DB with ID ${user.id}`);
    return user;
  } catch (err) {
    console.error(`Error in upsertUser for ${slackId}:`, err);
    // Fallback if Slack API fails
    return await prisma.user.upsert({
      where: { slackId },
      update: {},
      create: {
        slackId,
        name: "Slack User " + slackId,
        teamId,
      }
    });
  }
}
