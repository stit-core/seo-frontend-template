---
title: Тело этой записи нарушает правила контент-гейта
description: Каждое нарушение тела — по одному разу, чтобы check:gate видел, что check:content ловит каждое.
pubDate: 2026-01-01
tags: [gate]
translationKey: telo
---

# Заголовок первого уровня в теле

## Раздел

#### Скачок уровня

![](./kartinka.png)

![Описание есть, файла нет](./net.png)

<img src="/kartinka.png">

<h1>Сырой заголовок</h1>

<script>alert(1)</script>

<meta http-equiv="refresh" content="0">

Ссылки: [главная](/), [относительная](./drugaya.md), [нет маршрута](/net),
[черновик](/blog/chernovik), [со слешем](/blog/), [с html](/blog.html).

Литерал плейсхолдера: https://__site_origin__/x.

<div style="display:none">Скрытый текст для роботов.</div>

<p hidden>Скрытый абзац.</p>

<span aria-hidden="true">Текст мимо читателя.</span>

<div class="sr-only">Текст под классом.</div>

<div
  style="font-size:0">Атрибут на следующей строке тега.</div>

Код — не разметка: `<p style="color:red" hidden>` и блок ниже.

```html
<div hidden class="x" style="display:none">в коде можно</div>
```

Файл с кириллицей в имени — буквами и процентами: [цены](/цены.txt),
[цены из адресной строки](/%D1%86%D0%B5%D0%BD%D1%8B.txt).
