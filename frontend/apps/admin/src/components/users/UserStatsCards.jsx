import React from "react";
import { Card } from "../ui/card";
import { Users, UserCheck, UserX, Shield, UserCog } from "lucide-react";

export function UserStatsCards({ stats = {} }) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3.5">
      <Card className="p-3.5 border-border/70 bg-card/60 shadow-xs">
        <div className="flex items-center gap-3">
          <div className="h-9 w-9 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-center text-primary shrink-0">
            <Users className="h-4 w-4" />
          </div>
          <div>
            <div className="text-xl font-bold font-mono leading-tight">{stats.totalUsers || 0}</div>
            <div className="text-[11px] text-muted-foreground font-medium">Total Registered</div>
          </div>
        </div>
      </Card>

      <Card className="p-3.5 border-border/70 bg-card/60 shadow-xs">
        <div className="flex items-center gap-3">
          <div className="h-9 w-9 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-500 shrink-0">
            <UserCheck className="h-4 w-4" />
          </div>
          <div>
            <div className="text-xl font-bold font-mono text-emerald-600 dark:text-emerald-400 leading-tight">
              {stats.activeUsers || 0}
            </div>
            <div className="text-[11px] text-muted-foreground font-medium">Active Accounts</div>
          </div>
        </div>
      </Card>

      <Card className="p-3.5 border-border/70 bg-card/60 shadow-xs">
        <div className="flex items-center gap-3">
          <div className="h-9 w-9 rounded-lg bg-rose-500/10 border border-rose-500/20 flex items-center justify-center text-rose-500 shrink-0">
            <UserX className="h-4 w-4" />
          </div>
          <div>
            <div className="text-xl font-bold font-mono text-rose-600 dark:text-rose-400 leading-tight">
              {stats.inactiveUsers || 0}
            </div>
            <div className="text-[11px] text-muted-foreground font-medium">Inactive Accounts</div>
          </div>
        </div>
      </Card>

      <Card className="p-3.5 border-border/70 bg-card/60 shadow-xs">
        <div className="flex items-center gap-3">
          <div className="h-9 w-9 rounded-lg bg-purple-500/10 border border-purple-500/20 flex items-center justify-center text-purple-500 shrink-0">
            <Shield className="h-4 w-4" />
          </div>
          <div>
            <div className="text-xl font-bold font-mono text-purple-600 dark:text-purple-400 leading-tight">
              {stats.adminCount || 0}
            </div>
            <div className="text-[11px] text-muted-foreground font-medium">Administrators</div>
          </div>
        </div>
      </Card>

      <Card className="p-3.5 border-border/70 bg-card/60 shadow-xs col-span-2 sm:col-span-1">
        <div className="flex items-center gap-3">
          <div className="h-9 w-9 rounded-lg bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-500 shrink-0">
            <UserCog className="h-4 w-4" />
          </div>
          <div>
            <div className="text-xl font-bold font-mono text-blue-600 dark:text-blue-400 leading-tight">
              {stats.managerCount || 0}
            </div>
            <div className="text-[11px] text-muted-foreground font-medium">Managers</div>
          </div>
        </div>
      </Card>
    </div>
  );
}

export default UserStatsCards;
