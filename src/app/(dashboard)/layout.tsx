import { Sidebar } from "@/components/dashboard/sidebar";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import prisma from "@/lib/db";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getServerSession(authOptions);

  if (!session?.user) {
    redirect("/login");
  }

  const teamId = session.user.teamId;
  const workspaces = session.user.workspaces || [];

  const [installation, projects] = await Promise.all([
    teamId
      ? prisma.slackInstallation.findUnique({ where: { teamId } })
      : null,
    teamId
      ? prisma.project.findMany({ where: { teamId }, orderBy: { name: "asc" } })
      : [],
  ]);

  return (
    <div className="flex min-h-screen bg-background text-foreground">
      <Sidebar
        user={session.user}
        workspaceName={installation?.teamName || null}
        workspaces={workspaces}
        projects={projects.map(p => ({ id: p.id, name: p.name }))}
      />
      <main className="flex-1 overflow-y-auto px-8 py-6 max-w-4xl mx-auto">
        {children}
      </main>
    </div>
  );
}
