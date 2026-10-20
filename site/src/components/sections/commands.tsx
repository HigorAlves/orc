"use client"

import { Section } from "@/components/section"
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList, CommandShortcut } from "@/components/ui/command"
import { situations } from "@/content/site"

const notes = [
  { title: "Routing you can measure", body: "Each command carries a when_to_use trigger. Eval cases check every night that natural phrasing reaches the right one." },
  { title: "Agents with one job", body: "Investigators read and report; executors change the tree. A reviewer never edits, an implementer never posts." },
  { title: "Ends in a retro", body: "/orc:retro turns a session's friction into a lint rule, a pointer, or a coding standard, so the next one starts better." },
]

export function Commands() {
  return (
    <Section
      id="commands"
      code="orc:map · the router"
      title="Say what happened. orc picks the command."
      lede={<>Every situation a working day throws at you has one entry point. Type the situation, or ask <code className="font-mono">/orc:map</code> inside Claude Code.</>}
    >
      <div className="mt-9 grid grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)] items-start gap-10 max-lg:grid-cols-1">
        <Command className="h-auto rounded-[14px]! border shadow-[0_20px_40px_-32px_rgba(20,30,15,.35)]">
          <CommandInput placeholder="CI is red, prod is down, review a PR…" aria-label="Describe the situation" />
          <CommandList className="max-h-96">
            <CommandEmpty>No match. Try /orc:map inside Claude Code.</CommandEmpty>
            {situations.map((g) => (
              <CommandGroup key={g.group} heading={g.group}>
                {g.items.map((i) => (
                  <CommandItem key={i.cmd + i.label} value={`${i.label} ${i.cmd}`}>
                    {i.label}
                    <CommandShortcut className="font-mono text-accent-foreground">{i.cmd}</CommandShortcut>
                  </CommandItem>
                ))}
              </CommandGroup>
            ))}
          </CommandList>
        </Command>
        <div className="flex flex-col gap-4.5">
          {notes.map((n) => (
            <div key={n.title} className="border-l-2 border-primary pl-4">
              <b className="font-semibold">{n.title}</b>
              <p className="mt-1 text-[15px] text-muted-foreground">{n.body}</p>
            </div>
          ))}
        </div>
      </div>
    </Section>
  )
}
