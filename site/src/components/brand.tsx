import type { SVGProps } from "react"

// The orc mark and wordmark from .github/images, drawn in currentColor so the
// theme's primary token colours them.
const tusks = (
  <>
    <path fill="currentColor" d="M22 47C22 41 23.5 37 26.5 33C26.5 38 27.5 44 28.5 50Z" />
    <path fill="currentColor" d="M42 47C42 41 40.5 37 37.5 33C37.5 38 36.5 44 35.5 50Z" />
  </>
)

export function Mark(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="6 7 52 52" aria-hidden="true" {...props}>
      <circle cx="32" cy="33" r="20" fill="none" stroke="currentColor" strokeWidth="9" />
      {tusks}
    </svg>
  )
}

export function Wordmark(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="4 5 148 56" role="img" aria-label="orc" {...props}>
      <g fill="none" stroke="currentColor" strokeWidth="9">
        <circle cx="32" cy="33" r="20" />
        <path d="M72 57.5V33A20 20 0 0 1 92 13" />
        <path d="M139.3 20.1A20 20 0 1 0 139.3 45.9" />
      </g>
      {tusks}
    </svg>
  )
}

export function GitHubIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" {...props}>
      <path d="M12 .5a11.5 11.5 0 0 0-3.64 22.41c.58.1.79-.25.79-.56v-2c-3.2.7-3.88-1.37-3.88-1.37-.53-1.33-1.28-1.69-1.28-1.69-1.05-.71.08-.7.08-.7 1.16.08 1.77 1.19 1.77 1.19 1.03 1.77 2.71 1.26 3.37.96.1-.75.4-1.26.73-1.55-2.56-.29-5.25-1.28-5.25-5.68 0-1.26.45-2.28 1.19-3.09-.12-.29-.52-1.46.11-3.05 0 0 .97-.31 3.17 1.18a11 11 0 0 1 5.77 0c2.2-1.49 3.17-1.18 3.17-1.18.63 1.59.23 2.76.11 3.05.74.81 1.19 1.83 1.19 3.09 0 4.41-2.69 5.38-5.26 5.67.41.36.78 1.06.78 2.14v3.17c0 .31.21.67.8.56A11.5 11.5 0 0 0 12 .5Z" />
    </svg>
  )
}
