export function buildTaskModal(
  initialTitle?: string,
  slackLink?: string,
  channelId?: string,
  responseUrl?: string,
  projects?: { id: string; name: string }[]
) {
  const blocks: object[] = [
    {
      type: "input",
      block_id: "title_block",
      element: {
        type: "plain_text_input",
        action_id: "title_input",
        placeholder: { type: "plain_text", text: "What needs to be done?" },
        initial_value: initialTitle || "",
      },
      label: { type: "plain_text", text: "Task Name", emoji: true },
    },
    {
      type: "input",
      block_id: "description_block",
      optional: true,
      element: {
        type: "plain_text_input",
        action_id: "description_input",
        multiline: true,
        placeholder: { type: "plain_text", text: "Add some details (optional)" },
      },
      label: { type: "plain_text", text: "Description", emoji: true },
    },
    {
      type: "input",
      block_id: "assignee_block",
      element: {
        type: "multi_users_select",
        action_id: "assignee_select",
        placeholder: { type: "plain_text", text: "Select assignees" },
      },
      label: { type: "plain_text", text: "Assignees", emoji: true },
    },
    {
      type: "input",
      block_id: "due_date_block",
      optional: true,
      element: {
        type: "datepicker",
        action_id: "due_date_select",
        placeholder: { type: "plain_text", text: "Select a date" },
      },
      label: { type: "plain_text", text: "Due Date", emoji: true },
    },
    {
      type: "input",
      block_id: "priority_block",
      element: {
        type: "static_select",
        action_id: "priority_select",
        initial_option: { text: { type: "plain_text", text: "P4 - Low" }, value: "p4" },
        options: [
          { text: { type: "plain_text", text: "P1 - Urgent" }, value: "p1" },
          { text: { type: "plain_text", text: "P2 - High" }, value: "p2" },
          { text: { type: "plain_text", text: "P3 - Medium" }, value: "p3" },
          { text: { type: "plain_text", text: "P4 - Low" }, value: "p4" },
        ],
      },
      label: { type: "plain_text", text: "Priority", emoji: true },
    },
    {
      type: "input",
      block_id: "url_block",
      optional: true,
      element: {
        type: "url_text_input",
        action_id: "url_input",
        placeholder: { type: "plain_text", text: "https://..." },
      },
      label: { type: "plain_text", text: "URL (optional)", emoji: true },
    },
  ];

  if (projects && projects.length > 0) {
    blocks.push({
      type: "input",
      block_id: "project_block",
      optional: true,
      element: {
        type: "static_select",
        action_id: "project_select",
        placeholder: { type: "plain_text", text: "No project" },
        options: projects.map(p => ({
          text: { type: "plain_text", text: p.name },
          value: p.id,
        })),
      },
      label: { type: "plain_text", text: "Project", emoji: true },
    });
  }

  blocks.push({
    type: "context",
    block_id: "context_block",
    elements: [
      {
        type: "mrkdwn",
        text: slackLink ? `Created from <${slackLink}|this message>` : "Manual task",
      },
    ],
  });

  return {
    type: "modal",
    callback_id: "create_task_modal",
    title: { type: "plain_text", text: "Create New Task", emoji: true },
    submit: { type: "plain_text", text: "Create", emoji: true },
    close: { type: "plain_text", text: "Cancel", emoji: true },
    blocks,
    private_metadata: JSON.stringify({ slackLink, channelId, responseUrl }),
  };
}
