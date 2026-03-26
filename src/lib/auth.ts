import { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import GoogleProvider from "next-auth/providers/google";
import bcrypt from "bcryptjs";
import prisma from "@/lib/db";
import { WebClient } from "@slack/web-api";

/**
 * Scans ALL Slack installations for the given email and upserts a UserWorkspace
 * record for every workspace where the user is found.
 * Returns the teamId of the first workspace found (for use as primary).
 */
async function syncUserWorkspaces(userId: string, email: string): Promise<void> {
  const installations = await prisma.slackInstallation.findMany();

  for (const install of installations) {
    try {
      const slackClient = new WebClient(install.botToken);
      const lookupRes = await slackClient.users.lookupByEmail({ email });
      if (lookupRes.ok && lookupRes.user?.id) {
        await prisma.userWorkspace.upsert({
          where: { userId_teamId: { userId, teamId: install.teamId } },
          update: {},
          create: { userId, teamId: install.teamId },
        });
      }
    } catch {
      // Missing scope or user not in workspace — skip silently
    }
  }
}

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
          where: { email: credentials.email },
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

        // --- Identity linking: only needed if user has no Slack identity yet ---
        if (!dbUser?.slackId || !dbUser?.teamId) {
          let slackId: string | null = null;
          let avatarUrl = user.image || dbUser?.avatarUrl || null;
          let primaryTeamId: string | null = null;

          const installations = await prisma.slackInstallation.findMany();

          // Find the first workspace to use as the primary Slack identity
          for (const install of installations) {
            try {
              const slackClient = new WebClient(install.botToken);
              const lookupRes = await slackClient.users.lookupByEmail({ email: user.email as string });
              if (lookupRes.ok && lookupRes.user?.id) {
                slackId = lookupRes.user.id;
                avatarUrl = lookupRes.user.profile?.image_512 || lookupRes.user.profile?.image_192 || avatarUrl;
                primaryTeamId = install.teamId;
                break;
              }
            } catch (err) {
              console.log(`Could not find Slack user in team ${install.teamId}:`, (err as Error).message);
            }
          }

          if (slackId) {
            const existingSlackUser = await prisma.user.findUnique({ where: { slackId } });

            if (existingSlackUser) {
              dbUser = await prisma.user.update({
                where: { slackId },
                data: {
                  email: user.email,
                  name: user.name || existingSlackUser.name,
                  avatarUrl: avatarUrl || existingSlackUser.avatarUrl,
                  teamId: primaryTeamId || existingSlackUser.teamId,
                }
              });
              await prisma.user.deleteMany({
                where: { email: user.email, slackId: null, id: { not: dbUser.id } }
              });
            } else if (dbUser) {
              dbUser = await prisma.user.update({
                where: { id: dbUser.id },
                data: { slackId, teamId: primaryTeamId, avatarUrl: avatarUrl || dbUser.avatarUrl }
              });
            } else {
              dbUser = await prisma.user.create({
                data: { email: user.email, name: user.name || "Google User", avatarUrl, slackId, teamId: primaryTeamId }
              });
            }
          } else if (!dbUser) {
            dbUser = await prisma.user.create({
              data: { email: user.email, name: user.name || "Google User", avatarUrl: user.image || null }
            });
          }
        }

        if (dbUser) {
          user.id = dbUser.id;
          // Scan ALL workspaces and populate UserWorkspace for every one the user belongs to
          await syncUserWorkspaces(dbUser.id, user.email);
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
        session.user.workspaces = token.workspaces || [];
      }
      return session;
    },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    async jwt({ token, user, trigger, session }: { token: any, user: any, trigger?: string, session?: any }) {
      // Handle workspace switch: client calls useSession().update({ teamId: newTeamId })
      if (trigger === "update" && session?.teamId) {
        token.teamId = session.teamId;
        if (token.sub) {
          await prisma.user.update({
            where: { id: token.sub },
            data: { teamId: session.teamId },
          });
        }
        return token;
      }

      if (user) {
        token.sub = user.id;
        token.teamId = user.teamId || null;
      }

      // Resolve DB user and all workspace memberships on first token creation
      if (token.sub && (!token.teamId || !token.workspaces)) {
        const dbUser = await prisma.user.findUnique({
          where: { id: token.sub },
          include: { workspaces: true }
        });

        if (dbUser) {
          token.sub = dbUser.id;

          if (dbUser.teamId) {
            token.teamId = dbUser.teamId;
          } else if (!token.teamId && token.email) {
            // No teamId yet — scan all workspaces to find one and persist it
            const installations = await prisma.slackInstallation.findMany();
            for (const install of installations) {
              try {
                const slackClient = new WebClient(install.botToken);
                const lookupRes = await slackClient.users.lookupByEmail({ email: token.email });
                if (lookupRes.ok && lookupRes.user?.id) {
                  token.teamId = install.teamId;
                  await prisma.user.update({
                    where: { id: dbUser.id },
                    data: { teamId: install.teamId }
                  });
                  // Don't break — let syncUserWorkspaces handle all workspaces
                  break;
                }
              } catch { }
            }

            if (token.email) {
              await syncUserWorkspaces(dbUser.id, token.email);
            }
          }

          // Re-fetch workspaces after potential sync
          const freshWorkspaces = await prisma.userWorkspace.findMany({
            where: { userId: dbUser.id },
            select: { teamId: true },
          });
          const workspaceIds = freshWorkspaces.map(w => w.teamId);

          if (workspaceIds.length > 0) {
            const installations = await prisma.slackInstallation.findMany({
              where: { teamId: { in: workspaceIds } },
              select: { teamId: true, teamName: true },
            });
            token.workspaces = installations;
          } else {
            token.workspaces = [];
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
