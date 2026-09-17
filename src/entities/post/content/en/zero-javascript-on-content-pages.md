---
title: "Zero JavaScript on content pages"
description: "Content pages need no scripts: text, navigation and the language switch work in plain HTML. JavaScript appears only as an island and only by an explicit decision."
pubDate: 2026-07-09
tags: [performance, astro]
translationKey: zero-js
---

The median web page ships more than 600 KB of JavaScript, and almost none of it is needed
to read the text. For a content site that is pure loss: scripts delay rendering, hurt INP
and add points of failure. So the starting state of a page here is zero bytes of JS.

## How it is enforced

- e2e counts script resources on indexable pages — there must be exactly none.
- `prefetch` and `<ClientRouter />` are off: a client router would cost almost 5 KB on every
  page.
- Every island is a separate line in the `size-limit` budget, so adding one shows up in the
  diff.

## What stays interactive

Switching the language is a plain link. Pagination is links to `/blog/page/2`. The contact
form submits with a native POST and answers with a redirect. The only planned island is the
theme toggle — and even without it the theme follows the system setting through CSS.
