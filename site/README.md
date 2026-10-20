# orc website

The orc landing page. Next.js 16 (App Router, fully static) with shadcn/ui on Base UI and Tailwind 4.

## Run

```sh
pnpm install
pnpm dev            # http://localhost:3000
pnpm build && pnpm start
```

Set `NEXT_PUBLIC_SITE_URL` to the public origin before a production build. Open Graph and Twitter image URLs resolve against it.

## Content

| What | Where |
| --- | --- |
| Copy, install commands, loop phases, palette entries, guardrails | `src/content/site.ts` |
| Counts and version (skills, commands, agents, hooks, evals) | `src/content/facts.json`, generated |
| Claude Desktop graphics | `public/surfaces/*-{light,dark}.svg`, generated |
| Terminal cockpit screenshot | `public/cockpit-terminal.png`, copied from `docs/images/` |
| Favicon | `src/app/icon.svg`, copied from `.github/images/orc-mark.svg` |

Do not edit the generated files by hand.

### Facts

`facts.json` counts what is on disk under `orc/`. Regenerate it after a release or after you add a skill, command, agent, hook or eval:

```sh
pnpm facts          # rewrite src/content/facts.json
pnpm facts:check    # exit 1 when the committed file has drifted (CI runs this)
```

### Surfaces

The Claude Desktop section shows the orc mod's real SVG output. `scripts/surfaces.ts` imports the renderers from `orc/hooks/mod`, renders them with sample data, and splits each SVG into a light and a dark file so the site theme toggle picks one. It needs Bun:

```sh
pnpm surfaces
```

Run it after a change to a mod renderer. The widths in the script are the narrowest each renderer lays out cleanly today.

## Checks

```sh
pnpm facts:check && pnpm test && pnpm lint && pnpm typecheck && pnpm build
```

The `site` job in `.github/workflows/validate.yml` runs the same list.

NOTE: Next.js 16 changed APIs and conventions. Read `AGENTS.md` and the bundled docs in `node_modules/next/dist/docs/` before you change framework code.
