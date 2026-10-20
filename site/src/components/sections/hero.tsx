import { InstallBox } from "@/components/sections/install-box"
import { SessionTerminal } from "@/components/sections/session-terminal"
import { buttonVariants } from "@/components/ui/button"
import { REPO, doc, facts } from "@/content/site"
import { cn } from "@/lib/utils"

export function Hero() {
  return (
    <div className="mx-auto grid max-w-[1120px] grid-cols-[minmax(0,1fr)_minmax(0,1.05fr)] items-center gap-12 px-5 pt-16 pb-10 max-lg:grid-cols-1 max-lg:pt-11">
      <div>
        <div className="flex flex-wrap items-center gap-2 font-mono text-xs font-medium tracking-[0.06em] text-muted-foreground uppercase">
          <i className="size-1.5 rounded-full bg-primary" />
          Open source · MIT · Claude Code plugin ·
          <a href={`${REPO}/releases/tag/orc--v${facts.version}`} className="border-b border-current text-accent-foreground">v{facts.version}</a>
        </div>
        <h1 className="mt-4.5 font-display-tight text-[clamp(3rem,7.4vw,5.6rem)] leading-[0.9] text-balance">
          Let the <em className="text-primary not-italic">orcs</em> do the&nbsp;work.
        </h1>
        <p className="mt-5 max-w-[34em] text-lg text-muted-foreground">
          The senior-developer workflow as a Claude Code plugin.{" "}
          <strong className="font-semibold text-foreground">Plan, test first, QA with evidence, ship, watch CI, release.</strong>{" "}
          Hooks keep it off <code className="font-mono">main</code>, out of your git history, and on your machine.
        </p>
        <InstallBox />
        <div className="mt-4.5 flex flex-wrap gap-2.5">
          <a href={doc("docs/examples/README.md")} className={buttonVariants({ variant: "outline" })}>See 19 scenarios</a>
          <a href={doc("docs/safety.md")} className={buttonVariants({ variant: "outline" })}>Is it safe?</a>
        </div>
      </div>
      <SessionTerminal />
    </div>
  )
}

export function Stats() {
  const items = [
    [facts.skills, "skills"], [facts.commands, "slash commands"], [facts.agents, "subagents"], [facts.hooks, "guard hooks"], [0, "telemetry"],
  ] as const
  return (
    <div aria-label="What ships in the plugin" className="border-y">
      <dl className="mx-auto grid max-w-[1120px] grid-cols-5 px-5 max-md:grid-cols-3">
        {items.map(([n, label], i) => (
          <div key={label} className={cn("flex flex-col-reverse gap-1 py-5.5", i > 0 && "border-l pl-5 max-md:[&:nth-child(4)]:border-l-0 max-md:[&:nth-child(4)]:pl-0 max-md:[&:nth-child(n+4)]:border-t")}>
            <dt className="text-[13px] text-muted-foreground">{label}</dt>
            <dd className="font-display-tight text-[2.2rem] leading-none tabular-nums">{n}</dd>
          </div>
        ))}
      </dl>
    </div>
  )
}
