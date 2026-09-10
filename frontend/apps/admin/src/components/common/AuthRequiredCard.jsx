import React from "react";
import { Button } from "../ui/button";
import { Lock, LogIn } from "lucide-react";

export function AuthRequiredCard({ onOpenLogin, title }) {
  return (
    <div className="p-12 text-center rounded-xl border border-border bg-card space-y-3 shadow-sm max-w-lg mx-auto my-6">
      <div className="h-10 w-10 rounded-full bg-primary/10 border border-primary/20 text-primary flex items-center justify-center mx-auto">
        <Lock className="h-5 w-5" />
      </div>
      <h3 className="text-sm font-bold text-foreground">Admin Session Required</h3>
      <p className="text-xs text-muted-foreground">
        {title} requires an active administrator token to inspect.
      </p>
      <div className="pt-2">
        <Button onClick={onOpenLogin} size="sm" className="gap-1.5">
          <LogIn className="h-3.5 w-3.5" />
          <span>Sign In with Admin Credentials</span>
        </Button>
      </div>
    </div>
  );
}

export default AuthRequiredCard;
