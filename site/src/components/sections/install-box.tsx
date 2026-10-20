"use client"

import { useState } from "react"
import { CopyButton } from "@/components/copy-button"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { install } from "@/content/site"

type Method = keyof typeof install
const LABEL: Record<Method, string> = { cli: "orc CLI", marketplace: "Plugin marketplace" }
const PROMPT: Record<Method, string> = { cli: "$", marketplace: ">" }

export function InstallBox() {
  const [method, setMethod] = useState<Method>("cli")
  return (
    <div id="install" className="mt-7 max-w-[560px] scroll-mt-24 overflow-hidden rounded-xl border bg-card">
      <Tabs value={method} onValueChange={(v) => setMethod(v as Method)} className="gap-0">
        <div className="border-b bg-muted/40 px-1.5 pt-1.5">
          <TabsList variant="line" aria-label="Install method">
            {(Object.keys(install) as Method[]).map((m) => (
              <TabsTrigger key={m} value={m}>{LABEL[m]}</TabsTrigger>
            ))}
          </TabsList>
        </div>
        {(Object.keys(install) as Method[]).map((m) => (
          <TabsContent key={m} value={m}>
            <pre className="overflow-x-auto px-4 py-3.5 font-mono text-[13.5px] leading-[1.75]">
              {install[m].map((line) => (
                <span key={line.cmd} className="block">
                  <span className="select-none text-primary">{PROMPT[m]} </span>
                  {line.cmd}
                  {"note" in line && line.note ? <span className="text-muted-foreground">{"   # " + line.note}</span> : null}
                </span>
              ))}
            </pre>
          </TabsContent>
        ))}
      </Tabs>
      <div className="flex flex-wrap items-center justify-between gap-3 border-t py-2 pr-2 pl-4 text-[13px] text-muted-foreground">
        <span>macOS · Linux · restart Claude Code, then type <code className="font-mono">/orc:</code></span>
        <CopyButton text={install[method].map((l) => l.cmd).join("\n")} />
      </div>
    </div>
  )
}
