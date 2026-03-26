import { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import GoogleProvider from "next-auth/providers/google";
import bcrypt from "bcryptjs";
import prisma from "@/lib/db";
import { WebClient } from "@slack/web-api";

export const authOptions: NextAuthOptions = {
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID || "",
      clientSecret: process.env.GOOGLE_CLIENT_SECRET || "",
    }),
    CredentialsProvider({
      name: "Credentials",
      credentials: {
        email: { label: "Email", type: "email", placeholder: "you@example.com" },
        password: { label: "Password", type: "password" }
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) {
          throw new Error("Missing email or password");
        }

        const user = await prisma.user.findUnique({
          where: { email: credentials.email }
        });

        if (!user || !user.password) {
          throw new Error("User not found or no password set");
        }

        const isValid = await bcrypt.compare(credentials.password, user.password);

        if (!isValid) {
          throw new Error("Invalid password");
        }

        return {
          id: user.id,
          email: user.email,
          name: user.name,
          image: user.avatarUrl,
          teamId: user.teamId,
          teamIds: user.teamId ? [user.teamId] : [],
        };
      }
    })
  ],
  session: {
    strategy: "jwt"
  },
  callbacks: {
    async signIn({ user, account }) {
      if (account?.provider === "google") {
        if (!user.email) return false;

        let dbUser = await prisma.user.findUnique({
          where: { email: user.email }
        });

        // Try to link with Slack if user doesn't exist yet, or exists but isn't linked
        const needsSlackLink = !dbUser || (!dbUser.slackId && !dbUser.teamId);

        if (needsSlackLink) {
          let slackId: string | null = null;
          let avatarUrl = user.image || dbUser?.avatarUrl || null;
          let teamId: string | null = null;

          const installations = await prisma.slackInstallation.findMany();

          for (const install of installations) {
            try {
              const slackClient = new WebClient(install.botToken);
              // Requires users:read.email scope — silently skipped if missing
              const lookupRes = await slackClient.users.lookupByEmail({ email: user.email as string });
              if (lookupRes.ok && lookupRes.user?.id) {
                slackId = lookupRes.user.id;
                avatarUrl = lookupRes.user.profile?.image_512 || lookupRes.user.profile?.image_192 || avatarUrl;
                teamId = install.teamId;
                break;
              }
            } catch (err) {
              console.log(`Could not find Slack user in team ${install.teamId}:`, (err as Error).message);
            }
          }

          if (slackId) {
            // Check if there's an existing Slack-only user record to merge with
            const existingSlackUser = await prisma.user.findUnique({ where: { slackId } });

            if (existingSlackUser) {
              // Merge: update the Slack user record with the Google email and use it as primary
              dbUser = await prisma.user.update({
                where: { slackId },
                data: {
                  email: user.email,
                  name: user.name || existingSlackUser.name,
                  avatarUrl: avatarUrl || existingSlackUser.avatarUrl,
                  teamId: teamId || existingSlackUser.teamId,
                }
              });
              // Clean up the orphaned email-only user record if one exists
              await prisma.user.deleteMany({
                where: { email: user.email, slackId: null, id: { not: dbUser.id } }
              });
            } else if (dbUser) {
              // Update existing Google user with Slack identity
              dbUser = await prisma.user.update({
                where: { id: dbUser.id },
                data: { slackId, teamId, avatarUrl: avatarUrl || dbUser.avatarUrl }
              });
            } else {
              dbUser = await prisma.user.create({
                data: { email: user.email, name: user.name || "Google User", avatarUrl, slackId, teamId }
              });
            }
          } else if (!dbUser) {
            dbUser = await prisma.user.create({
              data: { email: user.email, name: user.name || "Google User", avatarUrl: user.image || null }
            });
          }
        }

        // Set session user id to our DB record id
        if (dbUser) {
          user.id = dbUser.id;
        }

        return true;
      }
      return true;
    },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    async session({ session, token }: { session: any, token: any }) {
      if (session.user && token.sub) {
        session.user.id = token.sub;
        session.user.teamId = token.teamId || null;
        // Always a single-workspace array to prevent cross-workspace data leakage
        session.user.teamIds = token.teamId ? [token.teamId] : [];
      }
      return session;
    },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    async jwt({ token, user }: { token: any, user: any }) {
      if (user) {
        token.sub = user.id;
        token.teamId = user.teamId || null;
      }

      // Resolve DB user and workspace on first token creation or when teamId is missing
      if (token.email && !token.teamId) {
        const dbUser = await prisma.user.findUnique({
          where: { email: token.email }
        });

        if (dbUser) {
          token.sub = dbUser.id;

          if (dbUser.teamId) {
            // Use the workspace already stored in DB
            token.teamId = dbUser.teamId;
          } else {
            // Try to find the user's workspace via Slack — stop at the first match
            const installations = await prisma.slackInstallation.findMany();
            for (const install of installations) {
              try {
                const slackClient = new WebClient(install.botToken);
                const lookupRes = await slackClient.users.lookupByEmail({ email: token.email });
                if (lookupRes.ok && lookupRes.user?.id) {
                  token.teamId = install.teamId;
                  // Persist so we don't re-query Slack on every token refresh
                  await prisma.user.update({
                    where: { id: dbUser.id },
                    data: { teamId: install.teamId }
                  });
                  break;
                }
              } catch { }
            }
          }
        }
      }
      return token;
    }
  },
  pages: {
    signIn: "/login",
  },
};
