---
title: "Prerender by default: why static is the baseline"
description: "A content page does not depend on the request, so it is more honest to build it once: sub-millisecond TTFB, no runtime work and a predictable release."
pubDate: 2026-07-02
tags: [rendering, astro]
translationKey: prerender-by-default
---

A post, an “about” page, a privacy policy — none of them depend on who asked for them or
when. So there is no reason to assemble such a page on every request: the result is always
the same. In this template prerendering is the default, and server rendering is switched on
only where the runtime is genuinely needed.

## What static buys you

- The page is served by the Node process as a file: TTFB is a fraction of a millisecond, no
  rendering under load, no “cold cache” after a release.
- A broken frontmatter field fails the build instead of shipping an empty page.
- Releases are atomic: a new image is a new set of pages; there is no partial rollback.

## When the runtime is needed

Service routes — `/healthz`, `robots.txt`, `sitemap.xml`, the form handler — know about the
environment and read it from env at request time. They opt in with
`export const prerender = false`; everything else stays static.

## The trap you cannot see in dev

The dev server renders by route, production serves files from disk. That is why the mode is
verified on the production build: e2e starts the same server the container runs and checks
status codes, headers and the absence of scripts on every page.
