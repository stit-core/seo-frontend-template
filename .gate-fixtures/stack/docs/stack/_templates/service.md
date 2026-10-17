---
id: stack.service
kind: service
name: service
status: draft
---

# service

## Идентичность

| поле | значение |
|---|---|
| name | _<site>_ |
| scope | `@<org>/site` |
| repository | `git@git.stit.tech:<org>/site.git` |
| image registry | `git.stit.tech/<org>/site` |
| `infra-svc` | `site` |
| owners | _кто_ |

## Домены

| среда | хост | доступ |
|---|---|---|
| prod | `https://<domain>` | — |
| staging | `https://staging.<domain>` | _Traefik `basicAuth`_ |

## Generates

- `package.json` — `name`

## Открытые вопросы

- _что_
