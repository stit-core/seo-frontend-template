---
title: "AVIF, WebP and an honest srcset"
description: "Serving covers in three formats without losing image indexing."
pubDate: 2026-04-19
updatedDate: 2026-07-06
cover: /covers/kartinki-avif-webp.png
tags: ["images", "performance"]
---
## Why this matters

AVIF, WebP and an honest srcset is a recurring topic in every other project. Below is a practical walkthrough:
what to measure, what to configure and where it usually breaks.

The key idea: **decisions follow measurements**, not feelings. If you did not measure TTFB
and document weight before the change, you have nothing to compare against afterwards.

## How it works

The server returns ready HTML, and the browser paints content before a single byte of
JavaScript arrives. Client code attaches later, and only where it is needed.

1. A request reaches the Node process.
2. The process returns pre-built HTML (or renders it on the fly).
3. The browser paints the first screen.
4. Interactive islands boot separately.

```ts
export default defineEventHandler((event) => {
  setResponseHeader(event, 'cache-control', 'public, max-age=60')
  return renderPage(event)
})
```

## What to check

- the response code (200 / 301 / 404 — never "200 and an empty page");
- an `<h1>` and body text in the raw HTML (`curl` with no JS);
- canonical and hreflang as absolute URLs;
- document weight: target under 150 KB uncompressed.

## Takeaway

Step 6 of twelve: the fewer moving parts, the more predictable the output.
A content site outlives any framework fashion, and its quality is measured in
milliseconds to first byte and kilobytes of document.
