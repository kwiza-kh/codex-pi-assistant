import * as React from "react";
import { useChatStore } from "@/store/chat";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

export function ExtensionUiDialog() {
  const req = useChatStore((s) => s.extensionUi);
  const respond = useChatStore((s) => s.respondExtensionUi);
  const dismiss = useChatStore((s) => s.dismissExtensionUi);

  const isDialog = req && ["select", "confirm", "input", "editor"].includes(req.method);
  const [value, setValue] = React.useState("");

  React.useEffect(() => {
    if (req) {
      setValue(req.prefill ?? "");
    }
  }, [req]);

  if (!req || !isDialog) return null;

  const title = req.title ?? "Pi 请求";
  const respondValue = (v: string) => respond({ id: req.id, value: v });
  const respondCancelled = () => respond({ id: req.id, cancelled: true });

  return (
    <Dialog open onOpenChange={(open) => !open && dismiss()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          {req.message && <DialogDescription>{req.message}</DialogDescription>}
        </DialogHeader>

        {req.method === "select" && (
          <div className="flex max-h-80 flex-col gap-1 overflow-y-auto">
            {(req.options ?? []).map((opt) => (
              <Button key={opt} variant="outline" className="justify-start" onClick={() => respondValue(opt)}>
                {opt}
              </Button>
            ))}
          </div>
        )}

        {req.method === "confirm" && (
          <DialogFooter className="sm:justify-start">
            <Button onClick={() => respond({ id: req.id, confirmed: true })}>确认</Button>
            <Button variant="outline" onClick={() => respond({ id: req.id, confirmed: false })}>
              取消
            </Button>
          </DialogFooter>
        )}

        {req.method === "input" && (
          <div className="space-y-3">
            <Input
              autoFocus
              value={value}
              onChange={(e) => setValue(e.target.value)}
              placeholder={req.placeholder ?? "请输入…"}
              onKeyDown={(e) => {
                if (e.key === "Enter") respondValue(value.trim());
              }}
            />
            <DialogFooter>
              <Button variant="outline" onClick={respondCancelled}>
                取消
              </Button>
              <Button onClick={() => respondValue(value.trim())}>提交</Button>
            </DialogFooter>
          </div>
        )}

        {req.method === "editor" && (
          <div className="space-y-3">
            <Textarea rows={8} value={value} onChange={(e) => setValue(e.target.value)} className="font-mono text-xs" />
            <DialogFooter>
              <Button variant="outline" onClick={respondCancelled}>
                取消
              </Button>
              <Button onClick={() => respondValue(value)}>提交</Button>
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
