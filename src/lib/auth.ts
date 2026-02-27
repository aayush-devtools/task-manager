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

        // Upsert user to DB
        let dbUser = await prisma.user.findUnique({
          where: { email: user.email }
        });

        if (!dbUser) {
          // Try to link with Slack
          let slackId = null;
          let avatarUrl = user.image || null;
          let teamId = null;

          const installations = await prisma.slackInstallation.findMany();

          for (const install of installations) {
            try {
              const slackClient = new WebClient(install.botToken);
              const lookupRes = await slackClient.users.lookupByEmail({ email: user.email as string });
              if (lookupRes.ok && lookupRes.user?.id) {
                slackId = lookupRes.user.id;
                avatarUrl = lookupRes.user.profile?.image_512 || lookupRes.user.profile?.image_192 || avatarUrl;
                teamId = install.teamId;
                break;
              }
            } catch (err) {
              console.log(`Could not find Slack user in team ${install.teamId}`, err);
            }
          }

          if (slackId) {
            // Check if this slack ID already exists in DB
            const existingSlackUser = await prisma.user.findUnique({
              where: { slackId }
            });

            if (existingSlackUser) {
              dbUser = await prisma.user.update({
                where: { slackId },
                data: {
                  email: user.email,
                  name: user.name || existingSlackUser.name,
                  avatarUrl: avatarUrl || existingSlackUser.avatarUrl,
                  teamId: teamId || existingSlackUser.teamId,
                }
              });
            } else {
              dbUser = await prisma.user.create({
                data: {
                  email: user.email,
                  name: user.name || "Google User",
                  avatarUrl,
                  slackId,
                  teamId
                }
              });
            }
          } else {
            dbUser = await prisma.user.create({
              data: {
                email: user.email,
                name: user.name || "Google User",
                avatarUrl,
              }
            });
          }
        }

        // Update user id to be our DB id, so the JWT token gets the right id
        if (dbUser) {
          user.id = dbUser.id;
          // We can't mutate 'user' safely here (it is frozen by NextAuth)
          // We'll generate teamIds dynamically per JWT refresh inside the jwt() callback
        }

        return true;
      }
      return true;
    },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    async session({ session, token }: { session: any, token: any }) {
      if (session.user && token.sub) {
        session.user.id = token.sub;
        session.user.teamId = token.teamId;
        session.user.teamIds = token.teamIds || (token.teamId ? [token.teamId] : []);
      }
      return session;
    },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    async jwt({ token, user }: { token: any, user: any }) {
      if (user) {
        token.sub = user.id;
        token.teamId = user.teamId;
        token.teamIds = user.teamIds || (user.teamId ? [user.teamId] : []);
      }

      // If we don't have teamIds, let's load them securely now since token is extensible
      if (token.email && (!token.teamIds || token.teamIds.length === 0)) {
        const dbUser = await prisma.user.findUnique({
          where: { email: token.email }
        });

        let initialTeamId = dbUser?.teamId || null;
        const teamIds: string[] = initialTeamId ? [initialTeamId] : [];

        const installations = await prisma.slackInstallation.findMany();
        for (const install of installations) {
          if (teamIds.includes(install.teamId)) continue;
          try {
            const slackClient = new WebClient(install.botToken);
            const lookupRes = await slackClient.users.lookupByEmail({ email: token.email });
            if (lookupRes.ok && lookupRes.user?.id) {
              teamIds.push(install.teamId);
              if (!initialTeamId) initialTeamId = install.teamId;
            }
          } catch { }
        }

        if (dbUser) {
          token.sub = dbUser.id;
        }
        token.teamId = initialTeamId;
        token.teamIds = teamIds;
      }
      return token;
    }
  },
  pages: {
    signIn: "/login",
  },
};
