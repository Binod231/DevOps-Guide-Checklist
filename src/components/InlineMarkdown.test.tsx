import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { InlineMarkdown } from './InlineMarkdown';

function renderText(text: string): HTMLElement {
  const { container } = render(
    <p data-testid="out">
      <InlineMarkdown text={text} />
    </p>,
  );
  return container.querySelector('[data-testid="out"]') as HTMLElement;
}

describe('InlineMarkdown', () => {
  it('renders plain text unchanged', () => {
    expect(renderText('Prefer managed application platforms.')).toHaveTextContent(
      'Prefer managed application platforms.',
    );
  });

  it('renders a backtick span as a code element', () => {
    renderText('Run `terraform plan` and confirm.');
    const code = screen.getByText('terraform plan');
    expect(code.tagName).toBe('CODE');
    expect(code).toHaveClass('portal-code');
  });

  it('renders multiple code spans in one string', () => {
    const out = renderText('Enforce branch protection on `main`/`master`.');
    expect(out.querySelectorAll('code')).toHaveLength(2);
    expect(out).toHaveTextContent('Enforce branch protection on main/master.');
  });

  it('renders a bold run as a strong element', () => {
    renderText('Before calling the system **production-ready**, confirm:');
    const strong = screen.getByText('production-ready');
    expect(strong.tagName).toBe('STRONG');
  });

  it('keeps surrounding prose intact around markup', () => {
    const out = renderText('Query the logging platform for a specific `request_id` and confirm.');
    expect(out).toHaveTextContent(
      'Query the logging platform for a specific request_id and confirm.',
    );
  });

  it('leaves dollar-delimited text alone rather than treating it as maths', () => {
    // The tracker CSV carries Notion's LaTeX delimiters; they are content.
    expect(renderText('Simulate a rollback from Version $N+1$ to Version $N$.')).toHaveTextContent(
      'Simulate a rollback from Version $N+1$ to Version $N$.',
    );
  });

  it('interprets nothing beyond code spans and bold runs', () => {
    const out = renderText('A _b_ c [d](e) f # g > h');
    expect(out.querySelectorAll('em, a, h1, blockquote')).toHaveLength(0);
    expect(out).toHaveTextContent('A _b_ c [d](e) f # g > h');
  });

  it('renders nothing for empty text', () => {
    expect(renderText('')).toBeEmptyDOMElement();
  });

  it('preserves a trailing newline inside the text', () => {
    // ST-09 and ST-19 carry a trailing newline inside their CSV fields.
    const out = renderText('Edge Security, WAF & Ingress Rate Limiting\n');
    expect(out.textContent).toBe('Edge Security, WAF & Ingress Rate Limiting\n');
  });
});
