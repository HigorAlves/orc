import Image from "next/image"
import { Mark } from "@/components/brand"
import { Chip, Code, Section } from "@/components/section"
import { Surface } from "@/components/surface"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { alerts } from "@/content/site"

const label = "font-mono text-[11px] font-medium tracking-[0.06em] text-muted-foreground uppercase"


function DesktopWindow() {
  return (
    <div aria-label="Claude Desktop, Code tab, running /orc:flow with the orc cockpit docked" className="overflow-hidden rounded-[14px] border bg-card shadow-[0_40px_80px_-48px_rgba(20,30,15,.5)]">
      <div className="flex h-10.5 items-center gap-2 border-b bg-muted/40 px-3.5">
        <i className="size-2.5 rounded-full bg-border" /><i className="size-2.5 rounded-full bg-border" /><i className="size-2.5 rounded-full bg-border" />
        <div className="mx-auto flex gap-0.5 rounded-lg bg-background p-0.5 text-xs">
          <span className="rounded-md px-3 py-1 text-muted-foreground">Chat</span>
          <span className="rounded-md bg-card px-3 py-1 shadow-xs">Code</span>
        </div>
      </div>
      <div className="grid min-h-[560px] grid-cols-[minmax(0,1fr)_400px] max-lg:grid-cols-1">
        <div className="grid min-w-0 grid-rows-[minmax(0,1fr)_auto]">
          <div className="flex flex-col gap-3.5 px-6.5 py-5.5 text-sm">
            <div className="max-w-[80%] self-end rounded-[14px_14px_4px_14px] border bg-background px-3.5 py-2.5 font-mono text-[13px]">
              /orc:flow add CSV export to the reports page --jira PROJ-142
            </div>
            <p className="max-w-[62ch]">Plan approved: four slices, 288 lines. Slices 1 and 2 are committed. Slices 3 and 4 touch separate files, so two implementers run them in parallel.</p>
            <div className="flex items-center gap-2 rounded-lg border border-dashed px-2.5 py-1.5 font-mono text-xs text-muted-foreground">
              <Mark className="size-3 text-primary" />orc-state slice set 3 --status red · slices 2/4
            </div>
            <div className="flex flex-col gap-1">
              <span className={label}>Agents</span>
              <Surface name="agent-a" alt="orc-implementer on slice 3: green, running the suite, 41% context, $0.62, 3m12s" />
              <Surface name="agent-b" alt="orc-implementer on slice 4: red, writing the test, 18% context, $0.21, 1m05s" />
            </div>
          </div>
          <div className="flex flex-col gap-2.5 border-t px-5 pt-3 pb-3.5">
            <div className="flex flex-wrap items-center gap-2">
              <Surface name="progress" alt="orc flow 5 of 9, implement, slices 2 of 4 done, 2 running" />
              <Button variant="outline" size="sm">Cockpit</Button>
              <Button variant="outline" size="sm">Replay</Button>
            </div>
            <div className="grid grid-cols-[minmax(0,1fr)_auto] items-end gap-2.5 rounded-[14px] border bg-card px-3.5 py-3">
              <div>
                <div className="text-sm text-muted-foreground">Reply to Claude…</div>
                <div className="mt-4.5 font-mono text-xs text-muted-foreground">orc flow · implement · ⏎ to steer the implementers</div>
              </div>
              <Surface name="chip" alt="context 58% used" />
            </div>
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Badge variant="secondary" className="font-mono text-accent-foreground">orc · guided</Badge>
              <span>Opus 5.5 · high</span>
            </div>
          </div>
        </div>
        <aside aria-label="orc cockpit" className="flex min-w-0 flex-col gap-3 border-l bg-muted/30 px-3 py-3.5 max-lg:border-t max-lg:border-l-0">
          <div className="flex items-center justify-between text-[13px] font-semibold">orc cockpit <span className="font-mono text-[11px] font-normal text-muted-foreground">×</span></div>
          <div className="font-mono text-[11.5px] leading-normal text-muted-foreground"><b className="font-medium text-foreground">flow 5/9 implement</b> · slices 2/4 · guided · balanced · $1.94</div>
          <div><h6 className={`${label} mb-1.5`}>Touched</h6><Surface name="touched" alt="Files touched: ExportButton.tsx and csv.ts edited, api.ts and export.test.ts committed, types.ts read" /></div>
          <div><h6 className={`${label} mb-1.5`}>Blast radius</h6><Surface name="radius" alt="288 of 300 lines, 6 files, 11 dependents" /></div>
          <div><h6 className={`${label} mb-1.5`}>Replay · slice 2</h6><Surface name="replay" alt="Replay of slice 2: an edit to src/reports/api.ts adding the export route" /></div>
          <div className="flex flex-col gap-0.5 font-mono text-[12.5px] leading-relaxed text-muted-foreground">
            {["QA", "PR", "Decisions", "Digest"].map((s) => (
              <span key={s}><span className="text-primary">▸ </span>{s}{s === "PR" ? <span className="text-warn"> !</span> : null}</span>
            ))}
          </div>
        </aside>
      </div>
    </div>
  )
}

export function Cockpit() {
  return (
    <Section
      id="cockpit"
      code="hooks/mod · the cockpit"
      title="Watch the work happen inside Claude Code."
      lede="The orc mod draws the flow into the app itself: a progress band above the prompt, a live row per agent, a docked cockpit with every file touched and the blast radius, and alerts that stop you before anything risky. Rich graphics on Claude Desktop, plain text in the terminal, same data underneath."
    >
      <Tabs defaultValue="desktop" className="mt-8 gap-4">
        <TabsList aria-label="Surface">
          <TabsTrigger value="desktop">Claude Desktop</TabsTrigger>
          <TabsTrigger value="terminal">Terminal</TabsTrigger>
        </TabsList>
        <TabsContent value="desktop"><DesktopWindow /></TabsContent>
        <TabsContent value="terminal">
          <div className="overflow-hidden rounded-[14px] border border-term-border bg-[#0d1117]">
            <Image
              src="/cockpit-terminal.png"
              width={1280}
              height={645}
              alt="The orc cockpit drawn as text in the Claude Code terminal: phase ladder, slice ledger with commits, and collapsible QA, PR, Agents, Decisions, Digest and Diff sections"
              className="h-auto w-full"
            />
          </div>
        </TabsContent>
      </Tabs>

      <div className="mt-4.5 grid grid-cols-2 gap-3.5 max-md:grid-cols-1">
        {alerts.map((a) => (
          <Card key={a.surface} size="sm">
            <CardHeader>
              <Chip>{a.chip}</Chip>
            </CardHeader>
            <CardContent className="flex flex-col gap-2.5">
              <div className="flex flex-wrap items-center gap-2">
                <Surface name={a.surface} alt={a.alt} />
                {"actions" in a ? a.actions.map((x) => <Button key={x} variant="outline" size="sm">{x}</Button>) : null}
              </div>
              <CardDescription>{a.body}</CardDescription>
            </CardContent>
          </Card>
        ))}
        <Card size="sm">
          <CardHeader><Chip>AskUserQuestion · gate badge</Chip></CardHeader>
          <CardContent className="flex flex-col gap-2.5">
            <div className="flex gap-2">
              <Badge className="bg-warn-soft font-mono text-warn">Post · outward</Badge>
              <Badge variant="secondary" className="font-mono text-accent-foreground">Plan · inward</Badge>
            </div>
            <CardTitle className="sr-only">Gate badges</CardTitle>
            <CardDescription>Every gate carries a chip for its class. Outward gates, which post to GitHub or a tracker, always ask, whatever the autopilot level.</CardDescription>
          </CardContent>
        </Card>
      </div>
      <p className="mt-4 max-w-[80ch] font-mono text-xs leading-relaxed text-muted-foreground">
        Graphics above are rendered by orc&apos;s mod code (<Code>orc/hooks/mod/*/svg.ts</Code>) with sample data; the window around them is illustrative. Needs Claude Code 2.1.287 or later with <Code>mod_enabled</Code> on (the default). Turn the mod off and every guardrail still runs from the bash hooks.
      </p>
    </Section>
  )
}
