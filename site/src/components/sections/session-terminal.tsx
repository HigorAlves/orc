"use client"

import { useEffect, useRef, useState, type ReactNode } from "react"
import { cn } from "@/lib/utils"

// A complete /orc:flow transcript at rest; Replay reveals it line by line.
const M = ({ children }: { children: ReactNode }) => <span className="text-term-primary">{children}</span>
const D = ({ children }: { children: ReactNode }) => <span className="text-term-muted">{children}</span>
const W = ({ children }: { children: ReactNode }) => <span className="text-term-warn">{children}</span>

type Line = { node: ReactNode; kind?: "gate" | "preview" }
const lines: Line[] = [
  { node: <><M>❯</M> <span className="font-medium">/orc:flow add CSV export to the reports page --jira PROJ-142</span></> },
  { node: <D>orc context: repo · branch feat/PROJ-142-csv-export · policy guided</D> },
  { node: " " },
  { kind: "gate", node: <><W>⛔ Gate · triage</W>  feature · medium · no RFC · PROJ-142 bound</> },
  { node: <><M>✓</M> P3 plan        <D>plan.md · 4 slices · est 288 LOC</D></> },
  { node: <><M>✓</M> P4 start       <D>worktree · export.test.ts:12 </D><W>red</W></> },
  { node: <><M>✓</M> P5 implement   <D>orc-implementer ×2, parallel</D></> },
  { node: <D>     slice 1 a1f3c2e  slice 2 9b0e1d4  slice 3 c44a8f0  slice 4 1e7d2b9</D> },
  { node: <><M>✓</M> P6 qa          <D>playwright · staging · 5/5 criteria pass · qa-feat.webm</D></> },
  { kind: "preview", node: <><M>📋 Preview · PR</M>  feat(reports): add CSV export  <D>+276 −12 · 288 ≤ 300 LOC</D></> },
  { node: <><M>✓</M> P7 ship        <D>#128 opened · Resolves PROJ-142</D></> },
  { node: <><M>✓</M> CI             <D>4/4 checks green</D></> },
  { node: " " },
  { node: <><M>➡ Next</M>  <D>address review on #128, or /orc:retro</D></> },
]

export function SessionTerminal() {
  const [shown, setShown] = useState(lines.length)
  const timer = useRef<ReturnType<typeof setInterval> | null>(null)
  useEffect(() => () => { if (timer.current) clearInterval(timer.current) }, [])

  function replay() {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return
    if (timer.current) clearInterval(timer.current)
    setShown(0)
    timer.current = setInterval(() => setShown((n) => {
      if (n + 1 >= lines.length && timer.current) clearInterval(timer.current)
      return n + 1
    }), 260)
  }

  return (
    <div aria-label="Example Claude Code session running /orc:flow" className="min-w-0 overflow-hidden rounded-[14px] border border-term-border bg-term text-term-foreground shadow-[0_30px_60px_-30px_rgba(20,30,15,.45)]">
      <div className="flex items-center gap-2 border-b border-term-border px-3.5 py-2.5">
        <i className="size-2.5 rounded-full bg-[#2c3329]" /><i className="size-2.5 rounded-full bg-[#2c3329]" /><i className="size-2.5 rounded-full bg-[#2c3329]" />
        <span className="ml-2 font-mono text-xs text-term-muted">claude · ~/acme/relay</span>
        <button type="button" onClick={replay} className="ml-auto rounded-md border border-term-border px-2.5 py-1.5 font-mono text-xs text-term-muted hover:text-term-foreground">
          Replay
        </button>
      </div>
      <div className="min-h-[380px] overflow-x-auto px-4.5 pt-4 pb-1.5 font-mono text-[12.5px] leading-[1.7] max-md:min-h-0">
        {lines.map((l, i) => (
          <p key={i} className={cn("whitespace-pre", i >= shown && "invisible", l.kind === "gate" && "my-1.5 border-l-2 border-term-warn pl-2.5", l.kind === "preview" && "my-1.5 border-l-2 border-term-primary pl-2.5")}>
            {l.node}
          </p>
        ))}
      </div>
      <div className="overflow-x-auto border-t border-term-border px-4.5 pt-2.5 pb-3 font-mono text-[11.5px] leading-[1.65] whitespace-pre text-term-muted">
        <span className="font-medium text-term-primary">orc flow 7/9 ship</span> │ PROJ-142 │ slices 4/4 │ guided │ ⎇ feat/PROJ-142-csv-export │ #128 ✔ checks{"\n"}Opus 5.5 high │ ctx ▓▓▓▓▓▓░░░░ 58% │ $3.12 +276/−12
      </div>
    </div>
  )
}
