import { Chip, Section } from "@/components/section"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { guardrails } from "@/content/site"

export function Guardrails() {
  return (
    <Section
      id="guardrails"
      code="hooks/scripts · the guardrails"
      title="Rules the model cannot talk its way past."
      lede="Every guardrail is a short shell script Claude Code runs as a real hook. Read them in five minutes, diff them by tag, and trust what you read."
    >
      <div className="mt-9 grid grid-cols-3 gap-3.5 max-lg:grid-cols-2 max-md:grid-cols-1">
        {guardrails.map((g) => (
          <Card key={g.title} size="sm">
            <CardHeader className="gap-2.5">
              <Chip>{g.chip}</Chip>
              <CardTitle className="font-heading text-lg font-bold [font-stretch:88%]">{g.title}</CardTitle>
            </CardHeader>
            <CardContent><CardDescription>{g.body}</CardDescription></CardContent>
          </Card>
        ))}
        <Card className="col-span-3 grid grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)] items-center gap-6 border-primary/30 bg-accent max-lg:col-span-2 max-lg:grid-cols-1 max-md:col-span-1">
          <CardHeader className="gap-2.5">
            <Chip>pre-git-guard.sh · smoke-tested in CI</Chip>
            <CardTitle className="font-heading text-2xl font-bold [font-stretch:88%]">A guard that cannot run does not let you through.</CardTitle>
            <CardDescription>Missing jq, a deleted check, or a crashing script turns into a question, never a silent allow. CI deletes and breaks the checks on purpose to prove it.</CardDescription>
          </CardHeader>
          <CardContent>
            <pre className="overflow-x-auto rounded-xl bg-term p-4 font-mono text-[12.5px] leading-[1.75] text-term-foreground">
              <span className="text-term-muted">$ git commit -m &quot;fix: retry&quot;   # jq missing</span>{"\n"}
              <span className="text-term-warn">ask</span>{"  orc guards need jq and it is not\n     on PATH. Failing closed.\n     Install it (orc doctor --fix) or\n     confirm this command deliberately."}
            </pre>
          </CardContent>
        </Card>
      </div>
    </Section>
  )
}

export function Manual() {
  const rules = [
    ["15", "words, at most, in a procedural step. One action each."],
    ["0", "unapproved words: should, might, ensure, leverage."],
    ["6 KB", "command entry. Later phases load as modules."],
    ["−3k", "always-on characters per session after the rewrite."],
  ]
  return (
    <Section
      id="manual"
      code="ADR 0007 · the authoring standard"
      title="Written like a maintenance manual, because an agent reads it like one."
      lede="orc's commands follow the rules aircraft manuals use so a stranger performs a procedure exactly: controlled vocabulary, short verb-first steps, warnings before the step, and small modules loaded one phase at a time. A lint enforces it on every PR."
    >
      <div className="mt-9 grid grid-cols-2 overflow-hidden rounded-[14px] border bg-card max-lg:grid-cols-1">
        <div className="min-w-0 p-6">
          <h4 className="mb-3 font-mono text-[11px] font-medium tracking-[0.08em] text-muted-foreground uppercase">Before · prose a model interprets</h4>
          <p className="text-[15px] text-muted-foreground">
            5. <b className="text-foreground">Self-contradiction detection.</b> For each agent&apos;s summary, scan for the strings approve, lgtm, looks good, no concerns, non-blocking (case-insensitive). If matched AND any finding from that agent has severity in bug, security, api-surface{" "}
            <mark className="rounded-sm bg-warn-soft px-0.5 text-warn">→ record a warning to surface in the preview</mark>, which{" "}
            <mark className="rounded-sm bg-warn-soft px-0.5 text-warn">should</mark> then be shown to the user.
          </p>
        </div>
        <div className="min-w-0 border-l p-6 max-lg:border-t max-lg:border-l-0">
          <h4 className="mb-3 font-mono text-[11px] font-medium tracking-[0.08em] text-muted-foreground uppercase">
            After · <span className="tracking-normal normal-case text-accent-foreground">&lt;!-- orc:code-review/P4 --&gt;</span>
          </h4>
          <div className="my-3 grid gap-0.5 rounded-lg bg-warn-soft px-3 py-2.5 text-sm">
            <b className="font-mono text-[11px] tracking-[0.08em] text-warn">CAUTION</b>
            <span>Agents never decide the review event. Step 8 computes it.</span>
          </div>
          <ol start={6} className="flex list-decimal flex-col gap-1 pl-5.5 text-[15px] marker:font-mono marker:text-primary">
            <li>Scan each agent summary for an approval phrase.</li>
            <li>If it matches and the agent has a blocking finding, record a Caution.</li>
            <li>Compute the event from the severities.</li>
          </ol>
          <div className="my-3 grid gap-0.5 rounded-lg bg-accent px-3 py-2.5 text-sm">
            <b className="font-mono text-[11px] tracking-[0.08em] text-accent-foreground">NOTE</b>
            <span>Approval phrases: approve, lgtm, looks good, no concerns, non-blocking.</span>
          </div>
        </div>
      </div>
      <div className="mt-4.5 grid grid-cols-4 gap-3.5 max-lg:grid-cols-2">
        {rules.map(([n, text]) => (
          <div key={n} className="border-t-2 border-foreground pt-3">
            <b className="font-display-tight text-[1.9rem] tabular-nums">{n}</b>
            <p className="mt-1.5 text-sm text-muted-foreground">{text}</p>
          </div>
        ))}
      </div>
    </Section>
  )
}
