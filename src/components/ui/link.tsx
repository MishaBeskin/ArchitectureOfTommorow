import NextLink from "next/link";
import type { ComponentProps } from "react";
import { cn } from "@/lib/cn";

export function Link({ className, ...props }: ComponentProps<typeof NextLink>) {
  return (
    <NextLink
      className={cn("underline underline-offset-4 decoration-1 hover:decoration-2", className)}
      {...props}
    />
  );
}
