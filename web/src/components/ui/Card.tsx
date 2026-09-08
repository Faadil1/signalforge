import type { HTMLAttributes } from "react";
import { cn } from "@/lib/utils";

type CardVariant = "default" | "elevated" | "secondary";

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  variant?: CardVariant;
  hover?: boolean;
}

const VARIANT: Record<CardVariant, string> = {
  default: "card",
  elevated: "card shadow-drawer",
  secondary: "bg-surface-secondary dark:bg-surface-secondary rounded-lg ring-1 ring-inset ring-border",
};

export function Card({ className, variant = "default", hover, ...props }: CardProps) {
  return <div className={cn(VARIANT[variant], hover && "card-hover", className)} {...props} />;
}

export function CardHeader({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("flex items-center justify-between px-5 py-4 border-b border-border", className)} {...props} />;
}

export function CardTitle({ className, ...props }: HTMLAttributes<HTMLHeadingElement>) {
  return <h3 className={cn("text-base font-semibold text-text", className)} {...props} />;
}

export function CardBody({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("p-5", className)} {...props} />;
}
