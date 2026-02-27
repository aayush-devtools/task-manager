"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { 
  Inbox, 
  Calendar, 
  CalendarDays, 
  Hash, 
  Plus, 
  Settings,
  Bell
} from "lucide-react";
import { cn } from "@/lib/utils";

const navItems = [
  { name: "Inbox", icon: Inbox, color: "text-blue-500", href: "/" },
  { name: "Today", icon: Calendar, color: "text-green-500", href: "/today" },
  { name: "Upcoming", icon: CalendarDays, color: "text-purple-500", href: "/upcoming" },
];

export function Sidebar() {
  const pathname = usePathname();

  return (
    <div className="flex h-screen w-64 flex-col border-r bg-muted/30 px-3 py-4">
      <div className="flex items-center justify-between px-2 mb-6">
        <div className="flex items-center gap-2 font-semibold">
          <div className="h-6 w-6 rounded bg-primary flex items-center justify-center text-primary-foreground text-[10px]">
            ST
          </div>
          <span>SlackTask</span>
        </div>
        <div className="flex items-center gap-1">
          <button className="p-1 hover:bg-muted rounded transition-colors text-muted-foreground">
            <Bell className="h-4 w-4" />
          </button>
          <button className="p-1 hover:bg-muted rounded transition-colors text-muted-foreground">
            <Settings className="h-4 w-4" />
          </button>
        </div>
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

      <div className="mt-8">
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
    </div>
  );
}
