"use client"

import { CheckIcon, CopyIcon } from "lucide-react"
import { useState, type ComponentProps } from "react"
import { Button } from "@/components/ui/button"

// Copies `text` and confirms for 1.6 s. A refused clipboard says so instead of failing silently.
export function CopyButton({ text, label = "Copy", ...props }: { text: string; label?: string } & ComponentProps<typeof Button>) {
  const [state, setState] = useState<"idle" | "copied" | "refused">("idle")
  async function copy() {
    try {
      await navigator.clipboard.writeText(text)
      setState("copied")
    } catch {
      setState("refused")
    }
    setTimeout(() => setState("idle"), 1600)
  }
  return (
    <Button variant="outline" size="sm" onClick={copy} {...props}>
      {state === "copied" ? <CheckIcon data-icon="inline-start" /> : <CopyIcon data-icon="inline-start" />}
      {state === "copied" ? "Copied" : state === "refused" ? "Select and copy" : label}
    </Button>
  )
}
