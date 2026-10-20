"use client"

import { Section } from "@/components/section"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { loop } from "@/content/site"

export function Loop() {
  return (
    <Section
      id="loop"
      code="orc:flow · the loop"
      title={<>One command from &ldquo;I want X&rdquo; to a merged PR.</>}
      lede={<>Run each step yourself, or let <code className="font-mono">/orc:flow</code> drive all of them with a gate at every decision. Every phase writes to <code className="font-mono">.orc/</code>, so an interrupted session picks up with <code className="font-mono">/orc:resume</code>.</>}
    >
      <Tabs defaultValue={loop[0].name} className="mt-9 gap-0 overflow-hidden rounded-[14px] border bg-card">
        <TabsList variant="line" aria-label="Workflow phases" className="bg-blueprint h-auto! w-full justify-start gap-0 overflow-x-auto rounded-none border-b p-0">
          {loop.map((p, i) => (
            <TabsTrigger
              key={p.name}
              value={p.name}
              className="relative h-auto min-w-32 flex-1 flex-col items-start gap-1.5 rounded-none border-0 border-r bg-card/90 px-4 py-4.5 text-left last:border-r-0 data-active:bg-accent! after:hidden data-active:shadow-[inset_0_-3px_0_var(--primary)]!"
            >
              {p.gate ? <span className="absolute top-2.5 right-2.5 font-mono text-[10px] text-warn">⛔ gate</span> : null}
              <small className="font-mono text-[11px] tracking-wider text-muted-foreground">{String(i + 1).padStart(2, "0")}</small>
              <b className="font-heading text-xl leading-none font-bold [font-stretch:85%]">{p.name}</b>
              <code className="font-mono text-xs text-accent-foreground">{p.cmd}</code>
            </TabsTrigger>
          ))}
        </TabsList>
        {loop.map((p) => (
          <TabsContent key={p.name} value={p.name} className="grid grid-cols-2 gap-7 p-7 max-lg:grid-cols-1">
            <div>
              <h3 className="font-heading text-2xl leading-tight font-bold [font-stretch:85%]">{p.name}</h3>
              <p className="mt-2.5 max-w-[36em] text-base text-muted-foreground">{p.summary}</p>
              <ol className="mt-3.5 flex list-decimal flex-col gap-1.5 pl-5 text-base marker:font-mono marker:text-primary">
                {p.steps.map((s) => <li key={s}>{s}</li>)}
              </ol>
            </div>
            <pre className="min-w-0 overflow-x-auto rounded-xl border border-dashed bg-background p-4 font-mono text-[12.5px] leading-[1.7]">{p.artifact.join("\n")}</pre>
          </TabsContent>
        ))}
      </Tabs>
    </Section>
  )
}
