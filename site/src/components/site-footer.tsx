import { Mark, Wordmark } from "@/components/brand"
import { CopyButton } from "@/components/copy-button"
import { Separator } from "@/components/ui/separator"
import { REPO, doc, facts, install } from "@/content/site"

export function CallToAction() {
  const cmd = install.cli[0].cmd
  return (
    <section aria-label="Install orc" className="relative mt-24 grid grid-cols-[minmax(0,1fr)_auto] items-center gap-8 overflow-hidden rounded-[18px] bg-term px-10 py-14 text-term-foreground max-lg:grid-cols-1 max-lg:px-6 max-lg:py-10">
      <Mark className="pointer-events-none absolute -top-20 -right-15 size-[340px] text-term-primary opacity-[0.12]" />
      <div>
        <h2 className="font-heading text-[clamp(2rem,4.4vw,3.2rem)] leading-none font-bold [font-stretch:82%]">Zug zug.</h2>
        <p className="mt-3 text-term-muted">Three commands from zero to a working orc. Restart Claude Code and type <code className="font-mono">/orc:</code>.</p>
      </div>
      <div className="relative flex max-w-full items-center gap-3 rounded-full border border-term-border bg-[#182016] py-1.5 pr-1.5 pl-4.5 font-mono text-[13.5px]">
        <code className="overflow-x-auto whitespace-nowrap">{cmd}</code>
        <CopyButton text={cmd} className="rounded-full border-0 bg-term-primary text-term hover:bg-term-primary/85" />
      </div>
    </section>
  )
}

const columns = [
  { title: "Start", links: [["Install", doc("docs/install.md")], ["Examples", doc("docs/examples/README.md")], ["Commands", doc("docs/commands.md")], ["Configuration", doc("docs/configuration.md")]] },
  { title: "Trust", links: [["Safety", doc("docs/safety.md")], ["Decisions (ADRs)", `${REPO}/tree/main/docs/adr`], ["Scope", doc("SCOPE.md")], ["Changelog", doc("CHANGELOG.md")]] },
  { title: "Project", links: [["GitHub", REPO], ["Contributing", doc("docs/contributing.md")], ["Releases", `${REPO}/releases`], ["MIT License", doc("LICENSE")]] },
]

export function SiteFooter() {
  return (
    <footer className="mt-18 border-t">
      <div className="mx-auto grid max-w-[1120px] grid-cols-[minmax(0,1.4fr)_repeat(3,minmax(0,1fr))] gap-8 px-5 pt-10 pb-14 max-lg:grid-cols-2">
        <div className="max-lg:col-span-2">
          <Wordmark className="h-7.5 w-auto text-primary" />
          <p className="mt-3 max-w-[26em] text-sm text-muted-foreground">The senior-developer workflow as a Claude Code plugin. Open source, local, and audited by you.</p>
        </div>
        {columns.map((c) => (
          <nav key={c.title} aria-label={c.title}>
            <h5 className="mb-2.5 font-mono text-[11px] font-medium tracking-[0.08em] text-muted-foreground uppercase">{c.title}</h5>
            <ul className="flex flex-col gap-2 text-sm">
              {c.links.map(([label, href]) => <li key={label}><a href={href} className="hover:text-accent-foreground">{label}</a></li>)}
            </ul>
          </nav>
        ))}
        <div className="col-span-full flex flex-col gap-5">
          <Separator />
          <div className="flex flex-wrap justify-between gap-3 font-mono text-xs text-muted-foreground">
            <span>orc v{facts.version} · MIT · no telemetry</span>
            <span>Zug zug. Let the orcs do the work.</span>
          </div>
        </div>
      </div>
    </footer>
  )
}
