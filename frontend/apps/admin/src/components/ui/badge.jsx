import React from "react";
import { cva } from "class-variance-authority";
import { cn } from "../../lib/utils";

const badgeVariants = cva(
  "inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-[11px] font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
  {
    variants: {
      variant: {
        default:
          "border-transparent bg-primary/15 text-primary border-primary/20",
        secondary:
          "border-transparent bg-secondary text-secondary-foreground hover:bg-secondary/80",
        destructive:
          "border-transparent bg-destructive/15 text-destructive border-destructive/20",
        outline: "text-foreground",
        success:
          "border-emerald-500/20 bg-emerald-500/15 text-emerald-500 dark:text-emerald-400",
        warning:
          "border-amber-500/20 bg-amber-500/15 text-amber-500 dark:text-amber-400",
        info:
          "border-sky-500/20 bg-sky-500/15 text-sky-500 dark:text-sky-400",
        purple:
          "border-purple-500/20 bg-purple-500/15 text-purple-500 dark:text-purple-400",
        // Method specific
        get: "border-emerald-500/30 bg-emerald-500/15 text-emerald-500 font-mono font-bold",
        post: "border-sky-500/30 bg-sky-500/15 text-sky-500 font-mono font-bold",
        put: "border-amber-500/30 bg-amber-500/15 text-amber-500 font-mono font-bold",
        patch: "border-orange-500/30 bg-orange-500/15 text-orange-500 font-mono font-bold",
        delete: "border-rose-500/30 bg-rose-500/15 text-rose-500 font-mono font-bold",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
);

export function Badge({ className, variant, ...props }) {
  return <div className={cn(badgeVariants({ variant }), className)} {...props} />;
}
