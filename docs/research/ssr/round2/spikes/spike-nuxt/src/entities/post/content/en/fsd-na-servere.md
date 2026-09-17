---
title: "FSD on the server: layers that survive rendering"
description: "Splitting server code across entities/features/widgets without breaking boundaries."
pubDate: 2026-03-19
updatedDate: 2026-07-03
cover: /covers/fsd-na-servere.png
tags: ["fsd", "architecture"]
---
## Why this matters

FSD on the server: layers that survive rendering is a recurring topic in every other project. Below is a practical walkthrough:
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

Step 3 of twelve: the fewer moving parts, the more predictable the output.
A content site outlives any framework fashion, and its quality is measured in
milliseconds to first byte and kilobytes of document.
