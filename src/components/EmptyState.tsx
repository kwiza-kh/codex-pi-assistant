import { Braces, FolderSearch, Lightbulb, ListChecks } from "lucide-react";

const SUGGESTIONS = [
  {
    icon: Braces,
    title: "写代码",
    prompt: "帮我用 TypeScript 写一个带过期时间的 localStorage 缓存工具类",
    color: "text-sky-500",
    bg: "bg-sky-500/10",
  },
  {
    icon: FolderSearch,
    title: "理解项目",
    prompt: "读一下当前项目结构，总结它的架构和入口文件",
    color: "text-amber-500",
    bg: "bg-amber-500/10",
  },
  {
    icon: ListChecks,
    title: "执行任务",
    prompt: "列出当前目录文件，并说明每个文件的用途",
    color: "text-emerald-500",
    bg: "bg-emerald-500/10",
  },
  {
    icon: Lightbulb,
    title: "深度思考",
    prompt: "分析一下 React 19 的主要变化对现有项目迁移的影响",
    color: "text-violet-500",
    bg: "bg-violet-500/10",
  },
];

function getGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 6) return "夜深了";
  if (hour < 12) return "早上好";
  if (hour < 14) return "中午好";
  if (hour < 18) return "下午好";
  return "晚上好";
}

export function EmptyState({ onPick }: { onPick: (prompt: string) => void }) {
  return (
    <div className="mx-auto flex h-full max-w-2xl flex-col justify-center px-4 py-12">
      <div className="mb-8 text-center">
        <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">
          {getGreeting()}
        </h1>
        <p className="mt-2 text-sm text-muted-foreground sm:text-base">
          由 Pi Agent 驱动，具备 read / write / edit / bash 等完整工具能力。
        </p>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        {SUGGESTIONS.map((s) => (
          <button
            key={s.title}
            type="button"
            onClick={() => onPick(s.prompt)}
            className="group flex items-start gap-3 rounded-window bg-surface p-4 text-left shadow-card transition-all hover:-translate-y-0.5 hover:shadow-raised"
          >
            <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${s.bg} ${s.color}`}>
              <s.icon className="h-5 w-5" />
            </span>
            <span>
              <span className="block text-sm font-semibold">{s.title}</span>
              <span className="mt-1 block text-xs leading-5 text-muted-foreground">{s.prompt}</span>
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}
