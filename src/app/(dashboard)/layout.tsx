import { Sidebar } from "@/components/dashboard/sidebar";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getServerSession(authOptions);

  if (!session?.user) {
    redirect("/login");
  }

  return (
    <div className="flex min-h-screen bg-background text-foreground">
      <Sidebar user={session.user} />
      <main className="flex-1 overflow-y-auto px-8 py-6 max-w-4xl mx-auto">
        {children}
      </main>
    </div>
  );
}
