import type { ReactNode } from "react"

// A section opens with a code rule: the module or file the section is about,
// the way a manual labels a task with its reference.
export function Section({ id, code, title, children, lede }: { id: string; code: string; title: ReactNode; lede?: ReactNode; children: ReactNode }) {
  return (
    <section id={id} className="scroll-mt-20 pt-24 pb-2 max-md:pt-16">
      <div className="flex items-center gap-3 font-mono text-[11px] font-medium tracking-[0.08em] text-muted-foreground uppercase after:h-px after:flex-1 after:bg-border">
        {code}
      </div>
      <h2 className="mt-4 max-w-[18em] font-heading text-[clamp(2rem,4.4vw,3.2rem)] leading-[0.98] font-bold tracking-tight text-balance [font-stretch:82%]">
        {title}
      </h2>
      {lede ? <p className="mt-3.5 max-w-[40em] text-[1.05rem] text-muted-foreground">{lede}</p> : null}
      {children}
    </section>
  )
}

export function Chip({ children }: { children: ReactNode }) {
  return (
    <span className="inline-flex w-fit items-center gap-1.5 rounded-full border bg-background px-2.5 py-1 font-mono text-[11px] text-muted-foreground">
      <i className="size-1.5 rounded-full bg-primary" />
      {children}
    </span>
  )
}

export function Code({ children }: { children: ReactNode }) {
  return <code className="rounded bg-muted px-1 py-0.5 font-mono text-[0.86em]">{children}</code>
}
