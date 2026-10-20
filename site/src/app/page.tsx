import { SiteFooter, CallToAction } from "@/components/site-footer"
import { SiteHeader } from "@/components/site-header"
import { Cockpit } from "@/components/sections/cockpit"
import { Commands } from "@/components/sections/commands"
import { Hero, Stats } from "@/components/sections/hero"
import { Loop } from "@/components/sections/loop"
import { Guardrails, Manual } from "@/components/sections/trust"

export default function Home() {
  return (
    <>
      <SiteHeader />
      <main id="top" className="flex-1">
        <Hero />
        <Stats />
        <div className="mx-auto max-w-[1120px] px-5">
          <Loop />
          <Cockpit />
          <Commands />
          <Guardrails />
          <Manual />
          <CallToAction />
        </div>
      </main>
      <SiteFooter />
    </>
  )
}
