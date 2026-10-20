import Image from "next/image"
import { cn } from "@/lib/utils"

// One of the orc mod's real Desktop surfaces (public/surfaces, rendered by
// scripts/surfaces.ts). Both variants ship; the theme class picks one.
const SIZES = {
  progress: [640, 28], "agent-a": [640, 36], "agent-b": [640, 36], touched: [392, 104], radius: [448, 54], replay: [392, 118],
  guard: [440, 120], cache: [440, 28], sentinel: [440, 28], retro: [427, 28], ci: [230, 28], chip: [72, 18],
} as const

export type SurfaceName = keyof typeof SIZES

export function Surface({ name, alt, className }: { name: SurfaceName; alt: string; className?: string }) {
  const [width, height] = SIZES[name]
  const common = { width, height, unoptimized: true, className: "h-auto max-w-full" }
  return (
    <span className={cn("inline-block max-w-full leading-none", className)}>
      <Image src={`/surfaces/${name}-light.svg`} alt={alt} {...common} className={cn(common.className, "dark:hidden")} />
      <Image src={`/surfaces/${name}-dark.svg`} alt="" aria-hidden {...common} className={cn(common.className, "hidden dark:inline")} />
    </span>
  )
}
