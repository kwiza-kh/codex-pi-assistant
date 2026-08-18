import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
  {
    variants: {
      variant: {
        default:
          "border-0 bg-ink text-page shadow-btn hover:opacity-90",
        secondary:
          "border-0 bg-field text-ink-2 shadow-btn hover:bg-hover",
        destructive:
          "border-0 bg-red text-white shadow-btn hover:opacity-90",
        outline: "border-0 bg-surface text-ink-2 shadow-hairline",
        sidebar:
          "border-0 bg-field text-ink shadow-btn",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return (
    <div className={cn(badgeVariants({ variant }), className)} {...props} />
  );
}

export { Badge, badgeVariants };
