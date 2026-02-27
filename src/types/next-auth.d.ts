import type { DefaultSession } from "next-auth";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      teamId?: string | null;
    } & DefaultSession["user"];
  }

  interface User {
    teamId?: string | null;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id?: string;
    teamId?: string | null;
  }
}

