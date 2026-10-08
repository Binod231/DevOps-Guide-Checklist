import type { ReactNode } from 'react';

/**
 * Renders the inline markdown the source documents actually use: backtick code
 * spans and bold runs. Nothing else is interpreted, and no text is altered.
 *
 * There are no fenced code blocks anywhere in the four sources, so there is no
 * block-level code renderer. Code spans appear as `main`, `.env`,
 * `terraform plan`, `request_id`, `traceparent` and `503`; bold runs appear in
 * the readiness gate's lead-in sentence.
 */

/** Splits on `` `code` `` and `**bold**`, keeping everything else literal. */
const TOKEN = /(`[^`]+`|\*\*[^*]+\*\*)/g;

export function InlineMarkdown({ text }: { text: string }): ReactNode {
  if (!text) return null;

  const parts = text.split(TOKEN).filter((part) => part !== '');

  return (
    <>
      {parts.map((part, index) => {
        const key = `${index}-${part.slice(0, 12)}`;

        if (part.length > 2 && part.startsWith('`') && part.endsWith('`')) {
          return (
            <code key={key} className="portal-code">
              {part.slice(1, -1)}
            </code>
          );
        }

        if (part.length > 4 && part.startsWith('**') && part.endsWith('**')) {
          return (
            <strong key={key} className="font-semibold">
              {part.slice(2, -2)}
            </strong>
          );
        }

        return <span key={key}>{part}</span>;
      })}
    </>
  );
}
