import type { ComponentProps } from "react";
import { cn } from "@/lib/utils";

export function Button({ className, type = "button", ...props }: ComponentProps<"button">) {
  return <button type={type} className={cn("inline-flex items-center justify-center focus-visible:outline-2", className)} {...props} />;
}
