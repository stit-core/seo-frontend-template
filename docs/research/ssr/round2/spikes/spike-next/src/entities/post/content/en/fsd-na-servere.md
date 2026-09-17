---
title: "FSD on the server: layers survive rendering"
description: "FSD on the server: layers survive rendering: a walkthrough based on a spike build and measurements."
pubDate: "2026-03-03"
updatedDate: "2026-05-03"
cover: "/covers/fsd-na-servere.png"
tags: ["ssr", "infra", "dx"]
---

## Section 1

A content site lives by its first HTML response. If the markup arrives empty, the crawler leaves with nothing and the user stares at a skeleton.

## Section 2

Server rendering removes that risk but adds another: the process becomes part of production and has to be observed, limited and restarted.

## Section 3

The key forks are where the cache lives, who serves the static assets and how configuration reaches the container. Those answers decide whether a single image works everywhere.

## Section 4

Testability beats beauty: every canon requirement needs a test, otherwise it is just a good intention in the docs.

> In practice: the numbers come from a real run, not from the docs.

- a checkable requirement
- a reproducible command
- a recorded result

```sh
curl -sI http://localhost:3204/en/blog/fsd-na-servere
```
