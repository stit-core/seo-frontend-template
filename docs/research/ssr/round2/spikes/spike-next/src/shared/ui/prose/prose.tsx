export function Prose({ html }: { html: string }) {
  return (
    <div
      className="prose-like text-body-md"
      // biome-ignore lint/security/noDangerouslySetInnerHtml: рендер Markdown на сервере
      dangerouslySetInnerHTML={{ __html: html }}
    />
  )
}
