"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut } from "next-auth/react";
import {
  Inbox,
  Calendar,
  CalendarDays,
  Hash,
  Plus,
  Settings,
  Bell,
  LogOut,
  Users
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { CreateTaskModal } from "./create-task-modal";
import { ThemeToggle } from "@/components/theme-toggle";

const navItems = [
  { name: "Inbox", icon: Inbox, color: "text-blue-500", href: "/" },
  { name: "Today", icon: Calendar, color: "text-green-500", href: "/today" },
  { name: "Upcoming", icon: CalendarDays, color: "text-purple-500", href: "/upcoming" },
  { name: "Team Board", icon: Users, color: "text-orange-500", href: "/team" },
];

export function Sidebar({ user }: { user: { name?: string | null; email?: string | null; image?: string | null } }) {
  const pathname = usePathname();

  return (
    <div className="flex h-screen w-64 flex-col border-r bg-muted/30 px-3 py-4">
      <div className="flex items-center justify-between px-2 mb-4">
        <div className="flex items-center gap-2 font-semibold">
          <div className="h-6 w-6 rounded bg-primary flex items-center justify-center text-primary-foreground text-[10px]">
            ST
          </div>
          <span>SlackTask</span>
        </div>
        <div className="flex items-center gap-1">
          <ThemeToggle />
          <button className="p-1 hover:bg-muted rounded transition-colors text-muted-foreground">
            <Bell className="h-4 w-4" />
          </button>
          <button className="p-1 hover:bg-muted rounded transition-colors text-muted-foreground">
            <Settings className="h-4 w-4" />
          </button>
        </div>
      </div>

      <div className="px-2 mb-4">
        <CreateTaskModal />
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
        <div className="flex items-center justify-between px-3 py-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground group">
          <span>Projects</span>
          <button className="opacity-0 group-hover:opacity-100 p-0.5 hover:bg-muted rounded transition-opacity">
            <Plus className="h-3 w-3" />
          </button>
        </div>
        <div className="space-y-1 mt-1">
          <Link
            href="/project/slack-tasks"
            className="flex items-center gap-3 rounded-md px-3 py-1.5 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          >
            <Hash className="h-4 w-4 text-muted-foreground/60" />
            Slack Tasks
          </Link>
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
