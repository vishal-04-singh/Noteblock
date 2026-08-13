import { useState } from "react";
import { CheckIcon } from "~/components/icons";

type CopyButtonProps = {
  value: string;
  label?: string;
  className?: string;
};

/** Button that copies `value` to the clipboard and shows a toast + check state. */
export function CopyButton({
  value,
  label = "Copy code",
  className = "",
}: CopyButtonProps) {
  const [copied, setCopied] = useState(false);
  const [copyFailed, setCopyFailed] = useState(false);

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setCopyFailed(false);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      setCopyFailed(true);
      setTimeout(() => setCopyFailed(false), 2400);
    }
  }

  return (
    <button
      type="button"
      onClick={handleCopy}
      className={
        "flex items-center justify-center gap-2 rounded-xl border border-border px-4 py-2 text-xs font-medium text-muted transition hover:bg-surface-2 hover:text-fg active:scale-[0.98] " +
        className
      }
    >
      {copied ? <CheckIcon /> : null}
      {copied ? "Copied" : copyFailed ? "Couldn't copy" : label}
    </button>
  );
}
