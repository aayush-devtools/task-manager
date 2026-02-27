export async function slackPost(method: string, body: Record<string, unknown>) {
  const token = process.env.SLACK_BOT_TOKEN;
  if (!token) {
    throw new Error("SLACK_BOT_TOKEN is not set");
  }

  const response = await fetch(`https://slack.com/api/${method}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(body),
  });

  const data = (await response.json()) as { ok: boolean; error?: string; [key: string]: unknown };
  if (!data.ok) {
    throw new Error(`Slack API error (${method}): ${data.error}`);
  }

  return data;
}

export async function respondToUrl(url: string, body: Record<string, unknown>) {
  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Slack Response URL error: ${response.status} ${text}`);
  }

  return response;
}

export async function openModal(triggerId: string, view: Record<string, unknown>) {
  return slackPost("views.open", {
    trigger_id: triggerId,
    view,
  });
}

export async function postMessage(channel: string, text: string, threadTs?: string) {
  return slackPost("chat.postMessage", {
    channel,
    text,
    thread_ts: threadTs,
  });
}

export async function getPermalink(channel: string, messageTs: string) {
  const data = await slackPost("chat.getPermalink", {
    channel,
    message_ts: messageTs,
  });
  return data.permalink as string;
}

export async function getUserInfo(userId: string) {
  const token = process.env.SLACK_BOT_TOKEN;
  console.log(`Fetching user info for ${userId}...`);
  const response = await fetch(`https://slack.com/api/users.info?user=${userId}`, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  const data = (await response.json()) as { ok: boolean; user?: any; error?: string };
  if (!data.ok) {
    console.error(`Slack API error (users.info) for user ${userId}: ${data.error}`);
    throw new Error(`Slack API error (users.info): ${data.error}`);
  }
  console.log(`Successfully fetched user info for ${userId}: ${data.user?.name}`);
  return data.user;
}
