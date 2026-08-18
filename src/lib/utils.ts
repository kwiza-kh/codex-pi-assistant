import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatRelativeTime(ts: number): string {
  const diff = Date.now() - ts;
  const minute = 60 * 1000;
  const hour = 60 * minute;
  const day = 24 * hour;
  if (diff < minute) return "刚刚";
  if (diff < hour) return `${Math.floor(diff / minute)} 分钟前`;
  if (diff < day) return `${Math.floor(diff / hour)} 小时前`;
  if (diff < 2 * day) return "昨天";
  if (diff < 7 * day) return `${Math.floor(diff / day)} 天前`;
  const d = new Date(ts);
  return `${d.getMonth() + 1}月${d.getDate()}日`;
}

export function groupByTime(ts: number): "今天" | "昨天" | "最近 7 天" | "更早" {
  const startOfDay = (t: number) => {
    const d = new Date(t);
    d.setHours(0, 0, 0, 0);
    return d.getTime();
  };
  const today = startOfDay(Date.now());
  const day = 24 * 60 * 60 * 1000;
  if (ts >= today) return "今天";
  if (ts >= today - day) return "昨天";
  if (ts >= today - 7 * day) return "最近 7 天";
  return "更早";
}

export function truncateTitle(title: string, max = 28): string {
  const t = title.trim();
  return t.length > max ? t.slice(0, max) + "…" : t;
}
