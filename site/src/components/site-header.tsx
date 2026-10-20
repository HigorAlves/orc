import Link from "next/link"
import { GitHubIcon, Wordmark } from "@/components/brand"
import { ThemeToggle } from "@/components/theme"
import { buttonVariants } from "@/components/ui/button"
import { REPO, nav } from "@/content/site"

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-20 border-b bg-background/85 backdrop-blur-md">
      <div className="mx-auto flex h-15 max-w-[1120px] items-center gap-5 px-5">
        <Link href="/" aria-label="orc home" className="text-primary">
          <Wordmark className="h-6.5 w-auto" />
        </Link>
        <nav aria-label="Main" className="ml-3 flex gap-1 max-md:hidden">
          {nav.map((n) => (
            <a key={n.href} href={n.href} className={buttonVariants({ variant: "ghost", size: "sm" })}>
              {n.label}
            </a>
          ))}
        </nav>
        <div className="ml-auto flex items-center gap-2">
          <ThemeToggle />
          <a href={REPO} className={buttonVariants({ variant: "outline" })}>
            <GitHubIcon data-icon="inline-start" />
            GitHub
          </a>
          <a href="#install" className={buttonVariants()}>
            Install
          </a>
        </div>
      </div>
    </header>
  )
}
