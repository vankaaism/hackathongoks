"use client";

import Link from "next/link";
import { Play } from "lucide-react";
import { unlockDemoChime } from "@/lib/demo-chime";

export function DemoLink() {
  return <Link className="demo-link" href="/replay" prefetch={false} onClick={unlockDemoChime}>
    <Play size={16}/> Putar demo
  </Link>;
}
