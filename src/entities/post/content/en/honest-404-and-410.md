---
title: "Honest 404 and 410 instead of soft-404"
description: "A “nothing found” page with status 200 is junk in the index. A missing address answers 404, a permanently removed one answers 410 — neither via meta refresh."
pubDate: 2026-07-16
tags: [seo]
translationKey: honest-404-410
cover: ../covers/honest-404-410.png
coverAlt: "Three rectangles of different sizes on a dark background, the rightmost one crossed out by a diagonal line"
---

A soft-404 is a page that honestly says “nothing found” but answers with status 200. The
search engine sees a normal document, indexes it and keeps coming back to check. The more
such addresses you have, the less crawl budget is left for the real pages.

## How the template answers

- An unknown route, an unknown post slug, a draft — all of them are a **404** with a proper
  page: heading, explanation, links home.
- A permanently removed address is a **410**: the rule lives in `content/redirects.yaml` next
  to the content and is applied by the server before routing.
- A moved address is a **301** in a single hop to the final URL, with no chains and no
  `<meta http-equiv="refresh">`.

## Why not at build time

Static generators can emit a redirect as an HTML file with `meta refresh`. Search engines
understand it, but they themselves recommend a server-side response. Here redirects are
data: reviewed in a pull request, checked in the gate for loops and duplicates, served by
the Node process.
