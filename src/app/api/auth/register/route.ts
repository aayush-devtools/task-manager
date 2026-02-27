import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import prisma from "@/lib/db";
import { WebClient } from "@slack/web-api";

export async function POST(req: NextRequest) {
  try {
    const { email, password, name } = await req.json();

    if (!email || !password || !name) {
      return NextResponse.json({ error: "Missing fields" }, { status: 400 });
    }

    // Check if user exists
    const existingUser = await prisma.user.findUnique({
      where: { email }
    });

    if (existingUser) {
      return NextResponse.json({ error: "Email already registered" }, { status: 400 });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    // Try to find the user in Slack by email to link their Slack ID
    let slackId = null;
    let avatarUrl = null;

    const slackToken = process.env.SLACK_BOT_TOKEN;
    if (slackToken) {
      try {
        const slackClient = new WebClient(slackToken);
        const lookupRes = await slackClient.users.lookupByEmail({ email });
        if (lookupRes.ok && lookupRes.user?.id) {
          slackId = lookupRes.user.id;
          avatarUrl = lookupRes.user.profile?.image_512 || lookupRes.user.profile?.image_192 || null;
          console.log(`Matched user ${email} to Slack ID ${slackId}`);
        }
      } catch (err: unknown) {
        console.log(`Could not find Slack user for ${email}: ${err instanceof Error ? err.message : String(err)}`);
      }
    }

    // Create user
    // We do an upsert in case the slackId is already in the DB from a previous interaction
    let user;

    if (slackId) {
      const existingSlackUser = await prisma.user.findUnique({
        where: { slackId }
      });

      if (existingSlackUser) {
        user = await prisma.user.update({
          where: { slackId },
          data: {
            email,
            password: hashedPassword,
            name: name, // maybe override or keep existing
            ...(avatarUrl && { avatarUrl }),
          }
        });
      } else {
        user = await prisma.user.create({
          data: {
            email,
            password: hashedPassword,
            name,
            slackId,
            avatarUrl,
          }
        });
      }
    } else {
      user = await prisma.user.create({
        data: {
          email,
          password: hashedPassword,
          name,
        }
      });
    }

    return NextResponse.json({ message: "User registered successfully", user: { id: user.id, email: user.email } }, { status: 201 });
  } catch (error: unknown) {
    console.error("Registration error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
