"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { signOut, useSession } from "next-auth/react";
import {
  Inbox,
  Calendar,
  CalendarDays,
  Hash,
  Plus,
  Settings,
  Bell,
  LogOut,
  Users,
  ChevronsUpDown,
  Check,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { CreateTaskModal } from "./create-task-modal";
import { CreateProjectModal } from "./create-project-modal";
import { ThemeToggle } from "@/components/theme-toggle";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

const navItems = [
  { name: "Inbox", icon: Inbox, color: "text-blue-500", href: "/" },
  { name: "Today", icon: Calendar, color: "text-green-500", href: "/today" },
  { name: "Upcoming", icon: CalendarDays, color: "text-purple-500", href: "/upcoming" },
  { name: "Team Board", icon: Users, color: "text-orange-500", href: "/team" },
];

interface SidebarProps {
  user: { name?: string | null; email?: string | null; image?: string | null; teamId?: string | null };
  workspaceName: string | null;
  workspaces: { teamId: string; teamName: string | null }[];
  projects: { id: string; name: string }[];
}

export function Sidebar({ user, workspaceName, workspaces, projects }: SidebarProps) {
  const pathname = usePathname();
  const router = useRouter();
  const { update } = useSession();

  async function switchWorkspace(teamId: string) {
    await fetch("/api/workspaces/switch", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ teamId }),
    });
    // Update JWT token in-place so session reflects new teamId immediately
    await update({ teamId });
    router.refresh();
  }

  const showWorkspaceSwitcher = workspaces.length > 1;

  return (
    <div className="flex h-screen w-64 flex-col border-r bg-muted/30 px-3 py-4">
      <div className="flex items-center justify-between px-2 mb-4">
        {showWorkspaceSwitcher ? (
          <DropdownMenu>
            <DropdownMenuTrigger className="flex items-center gap-2 font-semibold hover:bg-muted rounded px-1 py-0.5 transition-colors w-full min-w-0">
              <div className="h-6 w-6 shrink-0 rounded bg-primary flex items-center justify-center text-primary-foreground text-[10px]">
                {(workspaceName || "ST").slice(0, 2).toUpperCase()}
              </div>
              <span className="truncate">{workspaceName || "SlackTask"}</span>
              <ChevronsUpDown className="h-3 w-3 shrink-0 text-muted-foreground" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-56">
              <DropdownMenuLabel className="text-xs font-normal text-muted-foreground">
                Workspaces
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              {workspaces.map(ws => (
                <DropdownMenuItem
                  key={ws.teamId}
                  onClick={() => switchWorkspace(ws.teamId)}
                  className="flex items-center justify-between cursor-pointer"
                >
                  <div className="flex items-center gap-2">
                    <div className="h-5 w-5 rounded bg-primary/80 flex items-center justify-center text-primary-foreground text-[9px]">
                      {(ws.teamName || "?").slice(0, 2).toUpperCase()}
                    </div>
                    <span className="truncate">{ws.teamName || ws.teamId}</span>
                  </div>
                  {ws.teamId === user.teamId && (
                    <Check className="h-3 w-3 text-primary shrink-0" />
                  )}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        ) : (
          <div className="flex items-center gap-2 font-semibold">
            <div className="h-6 w-6 rounded bg-primary flex items-center justify-center text-primary-foreground text-[10px]">
              {(workspaceName || "ST").slice(0, 2).toUpperCase()}
            </div>
            <span>{workspaceName || "SlackTask"}</span>
          </div>
        )}

        <div className="flex items-center gap-1 shrink-0 ml-2">
          <ThemeToggle />
          <button className="p-1 hover:bg-muted rounded transition-colors text-muted-foreground">
            <Bell className="h-4 w-4" />
          </button>
          <Link href="/settings" className="p-1 hover:bg-muted rounded transition-colors text-muted-foreground">
            <Settings className="h-4 w-4" />
          </Link>
        </div>
      </div>

      <div className="px-2 mb-4">
        <CreateTaskModal projects={projects} />
      </div>

      <nav className="space-y-1">
        {navItems.map((item) => (
          <Link
            key={item.name}
            href={item.href}
            className={cn(
              "flex items-center gap-3 rounded-md px-3 py-1.5 text-sm font-medium transition-colors hover:bg-muted",
              pathname === item.href ? "bg-muted text-foreground" : "text-muted-foreground hover:text-foreground"
            )}
          >
            <item.icon className={cn("h-4 w-4", item.color)} />
            {item.name}
          </Link>
        ))}
      </nav>

      <div className="mt-8 flex-1">
        <div className="flex items-center justify-between px-3 py-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          <span>Projects</span>
          <CreateProjectModal />
        </div>
        <div className="space-y-1 mt-1">
          {projects.map(project => (
            <Link
              key={project.id}
              href={`/project/${project.id}`}
              className={cn(
                "flex items-center gap-3 rounded-md px-3 py-1.5 text-sm font-medium transition-colors hover:bg-muted hover:text-foreground",
                pathname === `/project/${project.id}` ? "bg-muted text-foreground" : "text-muted-foreground"
              )}
            >
              <Hash className="h-4 w-4 text-muted-foreground/60" />
              {project.name}
            </Link>
          ))}
          {projects.length === 0 && (
            <p className="px-3 py-1.5 text-xs text-muted-foreground/60 italic">No projects yet</p>
          )}
        </div>
      </div>

      <div className="mt-auto border-t pt-4 px-2">
        <div className="flex items-center gap-3">
          <Avatar className="h-8 w-8">
            <AvatarImage src={user.image || undefined} alt={user.name || undefined} />
            <AvatarFallback>{user.name?.[0]}</AvatarFallback>
          </Avatar>
          <div className="flex-1 overflow-hidden">
            <p className="truncate text-sm font-medium leading-none">{user.name}</p>
            <p className="truncate text-xs text-muted-foreground">{user.email}</p>
          </div>
          <button
            onClick={() => signOut()}
            className="p-1 hover:bg-muted rounded text-muted-foreground hover:text-destructive transition-colors"
            title="Sign out"
          >
            <LogOut className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
