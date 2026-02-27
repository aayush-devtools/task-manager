import { App, ExpressReceiver } from '@slack/bolt';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// Custom store for multi-workspace
const installStore = {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    storeInstallation: async (_install: unknown) => {
        // Already handled in callback, but can add here if needed
    },
    fetchInstallation: async (query: { teamId?: string }) => {
        if (!query.teamId) throw new Error("No teamId provided");
        const installation = await prisma.slackInstallation.findUnique({
            where: { teamId: query.teamId },
        });
        if (!installation) throw new Error('No installation found');
        return {
            team: { id: installation.teamId, name: installation.teamName },
            token: installation.botToken,
            bot: { id: installation.botId, user_id: installation.botUserId },
        };
    },
};

// Use ExpressReceiver for Next.js integration
const receiver = new ExpressReceiver({
    signingSecret: process.env.SLACK_SIGNING_SECRET || '',
    endpoints: '/api/slack/events', // Mount this in your Next.js app
    clientId: process.env.SLACK_CLIENT_ID,
    clientSecret: process.env.SLACK_CLIENT_SECRET,
    stateSecret: 'your-state-secret', // For security
    installerOptions: {
        installPath: '/api/slack/install', // Optional separate install route if needed
        redirectUriPath: '/api/slack/oauth/callback',
    },
    // @ts-expect-error - Bolt typings mismatch
    installationStore: installStore,
});

// Initialize App
const app = new App({ receiver });

// Add your event listeners, commands, etc.
app.message('hello', async ({ say }) => {
    await say('Hi there!');
});

// Export receiver.app for mounting in Next.js (e.g., in a custom server or API route)
export const slackHandler = receiver.app;
