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
        };
      }
    })
  ],
  session: {
    strategy: "jwt"
  },
  callbacks: {
    async signIn({ user, account, profile }) {
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

          const slackToken = process.env.SLACK_BOT_TOKEN;
          if (slackToken) {
            try {
              const slackClient = new WebClient(slackToken);
              const lookupRes = await slackClient.users.lookupByEmail({ email: user.email });
              if (lookupRes.ok && lookupRes.user?.id) {
                slackId = lookupRes.user.id;
                avatarUrl = lookupRes.user.profile?.image_512 || lookupRes.user.profile?.image_192 || avatarUrl;
              }
            } catch (err) {
              console.log("Could not find Slack user for Google auth:", err);
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
                }
              });
            } else {
              dbUser = await prisma.user.create({
                data: {
                  email: user.email,
                  name: user.name || "Google User",
                  avatarUrl,
                  slackId
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
        user.id = dbUser.id;
        return true;
      }
      return true;
    },
    async session({ session, token }) {
      if (session.user && token.sub) {
        session.user.id = token.sub;
      }
      return session;
    },
    async jwt({ token, user, trigger, session }) {
      if (user) {
        token.sub = user.id;
      }
      if (token.email) {
        const dbUser = await prisma.user.findUnique({
          where: { email: token.email }
        });
        if (dbUser) {
          token.sub = dbUser.id;
        }
      }
      return token;
    }
  },
  pages: {
    signIn: "/login",
  },
};
