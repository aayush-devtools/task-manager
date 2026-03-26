import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY);
const FROM = process.env.FROM_EMAIL || "notifications@yourdomain.com";
const APP_URL = process.env.NEXTAUTH_URL || "https://task-manager-fawn-delta.vercel.app";

function priorityLabel(p: string) {
  return { p1: "🔴 Urgent", p2: "🟠 High", p3: "🟡 Medium", p4: "🟢 Low" }[p] ?? p;
}

function dueDateStr(d: Date | null | undefined) {
  if (!d) return "No due date";
  return new Date(d).toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" });
}

function baseHtml(body: string) {
  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;background:#0a0a0a;color:#e5e5e5;margin:0;padding:24px">
  <div style="max-width:540px;margin:0 auto;background:#141414;border:1px solid #262626;border-radius:12px;overflow:hidden">
    <div style="background:#1a1a1a;padding:20px 28px;border-bottom:1px solid #262626">
      <span style="font-size:16px;font-weight:700;color:#fff">SlackTask</span>
    </div>
    <div style="padding:28px">
      ${body}
    </div>
    <div style="padding:16px 28px;border-top:1px solid #1a1a1a;text-align:center">
      <a href="${APP_URL}" style="font-size:12px;color:#666;text-decoration:none">Open app</a>
    </div>
  </div>
</body>
</html>`;
}

// ─── Assignment notification ─────────────────────────────────────────────────

export async function sendTaskAssignedEmail({
  to,
  taskId,
  taskTitle,
  assigneeName,
  creatorName,
  priority,
  dueDate,
  projectName,
  url,
}: {
  to: string;
  taskId: string;
  taskTitle: string;
  assigneeName: string;
  creatorName: string;
  priority: string;
  dueDate?: Date | null;
  projectName?: string | null;
  url?: string | null;
}) {
  if (!process.env.RESEND_API_KEY) return;

  const taskLink = `${APP_URL}/`;
  const html = baseHtml(`
    <h2 style="margin:0 0 6px;font-size:20px;color:#fff">New task assigned to you</h2>
    <p style="margin:0 0 20px;font-size:14px;color:#999">Hi ${assigneeName}, ${creatorName} has assigned you a task.</p>
    <div style="background:#1a1a1a;border:1px solid #262626;border-radius:8px;padding:16px 20px;margin-bottom:20px">
      <p style="margin:0 0 4px;font-size:18px;font-weight:600;color:#fff">${taskTitle}</p>
      <p style="margin:4px 0;font-size:13px;color:#999">${priorityLabel(priority)} &nbsp;·&nbsp; Due: ${dueDateStr(dueDate)}${projectName ? ` &nbsp;·&nbsp; ${projectName}` : ""}</p>
      ${url ? `<p style="margin:8px 0 0;font-size:13px"><a href="${url}" style="color:#3b82f6">${url}</a></p>` : ""}
    </div>
    <a href="${taskLink}" style="display:inline-block;background:#fff;color:#000;font-size:14px;font-weight:600;padding:10px 20px;border-radius:8px;text-decoration:none">View Task</a>
  `);

  await resend.emails.send({
    from: FROM,
    to,
    subject: `Task assigned: ${taskTitle}`,
    html,
  }).catch(err => console.error("sendTaskAssignedEmail failed:", err));
}

// ─── Deadline reminder ────────────────────────────────────────────────────────

export async function sendDeadlineReminderEmail({
  to,
  taskTitle,
  assigneeName,
  daysLeft,
  dueDate,
  priority,
  projectName,
}: {
  to: string;
  taskTitle: string;
  assigneeName: string;
  daysLeft: 1 | 7;
  dueDate: Date;
  priority: string;
  projectName?: string | null;
}) {
  if (!process.env.RESEND_API_KEY) return;

  const urgency = daysLeft === 1 ? "due tomorrow" : "due in 1 week";
  const subject = daysLeft === 1
    ? `⏰ Due tomorrow: ${taskTitle}`
    : `📅 Due in 1 week: ${taskTitle}`;

  const html = baseHtml(`
    <h2 style="margin:0 0 6px;font-size:20px;color:#fff">Task ${urgency}</h2>
    <p style="margin:0 0 20px;font-size:14px;color:#999">Hi ${assigneeName}, a task assigned to you ${urgency}.</p>
    <div style="background:#1a1a1a;border:1px solid ${daysLeft === 1 ? "#dc2626" : "#ca8a04"};border-radius:8px;padding:16px 20px;margin-bottom:20px">
      <p style="margin:0 0 4px;font-size:18px;font-weight:600;color:#fff">${taskTitle}</p>
      <p style="margin:4px 0;font-size:13px;color:#999">${priorityLabel(priority)} &nbsp;·&nbsp; Due: ${dueDateStr(dueDate)}${projectName ? ` &nbsp;·&nbsp; ${projectName}` : ""}</p>
    </div>
    <a href="${APP_URL}/" style="display:inline-block;background:#fff;color:#000;font-size:14px;font-weight:600;padding:10px 20px;border-radius:8px;text-decoration:none">View Task</a>
  `);

  await resend.emails.send({
    from: FROM,
    to,
    subject,
    html,
  }).catch(err => console.error("sendDeadlineReminderEmail failed:", err));
}
