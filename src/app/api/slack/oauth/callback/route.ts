import { NextRequest, NextResponse } from 'next/server';
import { WebClient } from '@slack/web-api';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const code = searchParams.get('code');
  if (!code) {
    return NextResponse.json({ error: 'No code provided' }, { status: 400 });
  }

  const clientId = process.env.SLACK_CLIENT_ID;
  const clientSecret = process.env.SLACK_CLIENT_SECRET;
  const redirectUri = 'https://task-manager-fawn-delta.vercel.app/api/slack/oauth/callback'; // Match your registered URL in Slack dashboard

  if (!clientId || !clientSecret) {
    return NextResponse.json({ error: 'Missing Slack credentials' }, { status: 500 });
  }

  try {
    const client = new WebClient();
    const response = await client.oauth.v2.access({
      client_id: clientId,
      client_secret: clientSecret,
      code,
      redirect_uri: redirectUri,
    });

    if (response.ok) {
      // Store the installation in DB (see schema changes below)
      await prisma.slackInstallation.upsert({
        where: { teamId: response.team!.id as string },
        update: {
          teamName: response.team!.name,
          botToken: response.access_token!,
          botId: response.bot_user_id,
          botUserId: response.bot_user_id,
        },
        create: {
          teamId: response.team!.id as string,
          teamName: response.team!.name,
          botToken: response.access_token!,
          botId: response.bot_user_id,
          botUserId: response.bot_user_id,
        },
      });

      // Redirect to a success page or your app's dashboard
      return NextResponse.redirect(new URL('/success', req.url)); // Or return JSON: NextResponse.json({ success: true })
    } else {
      return NextResponse.json({ error: response.error }, { status: 500 });
    }
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  } finally {
    await prisma.$disconnect();
  }
}
