import { PageShell } from '../components/PageShell';
import { SectionHeader } from '../components/SectionHeader';
import { checklist } from '../content/registry';
import { usePortalState } from '../state/PortalStateProvider';

/**
 * Notes & Decisions.
 *
 * The source leaves this whole section deliberately unfilled: three note
 * subsections carrying only an italic authoring prompt, three blank `Open
 * Issues` rows, and nine `Useful Links` labels with no values.
 *
 * So the page renders capture fields rather than content. Each prompt becomes
 * placeholder guidance on its field, shown verbatim; nothing is pre-filled, and
 * everything the reader types is theirs.
 */
export function NotesPage() {
  const { notes } = checklist;

  return (
    <PageShell>
      <SectionHeader eyebrow={checklist.title} heading={notes.heading} />

      <p className="portal-measure mt-4 text-sm text-ink-muted">
        The source document leaves this section blank. The fields below are empty until you fill
        them in, and your entries are stored in this browser only.
      </p>

      <div className="mt-6 space-y-5">
        {notes.noteSections.map((section) => (
          <NoteField key={section.id} id={section.id} heading={section.heading} prompt={section.prompt} />
        ))}

        <OpenIssues />
        <UsefulLinks />
      </div>
    </PageShell>
  );
}

function NoteField({
  id,
  heading,
  prompt,
}: {
  id: string;
  heading: string;
  prompt: string;
}) {
  const { noteValue, setNote } = usePortalState();
  const fieldId = `note-${id}`;

  return (
    <section id={id} aria-labelledby={`${id}-heading`} className="border border-edge bg-surface">
      <div className="border-b border-edge bg-sunken px-4 py-3">
        <h2 id={`${id}-heading`} className="text-base font-semibold text-ink">
          {heading}
        </h2>
        {/* The source's own italic guidance, shown verbatim. */}
        <p className="mt-1 text-xs italic text-ink-muted">{prompt}</p>
      </div>

      <div className="px-4 py-4">
        <label htmlFor={fieldId} className="sr-only">
          {heading}
        </label>
        <textarea
          id={fieldId}
          value={noteValue(id)}
          onChange={(event) => setNote(id, event.target.value)}
          placeholder={prompt}
          rows={6}
          className="w-full resize-y border border-edge bg-surface px-3 py-2 text-sm text-ink-secondary placeholder:text-ink-muted"
        />
      </div>
    </section>
  );
}

/**
 * The three blank `Open Issues` rows.
 *
 * The source writes them as `- [ ]  [ ]` — a checkbox with no text. Each is
 * rendered as a checkbox plus an empty text field, so the reader can supply the
 * text the document left out.
 */
function OpenIssues() {
  const { isChecked, toggleChecked, openIssueValue, setOpenIssue } = usePortalState();
  const { openIssues, openIssuesHeading } = checklist.notes;

  return (
    <section
      id="open-issues"
      aria-labelledby="open-issues-heading"
      className="border border-edge bg-surface"
    >
      <div className="border-b border-edge bg-sunken px-4 py-3">
        <h2 id="open-issues-heading" className="text-base font-semibold text-ink">
          {openIssuesHeading}
        </h2>
        <p className="mt-1 text-xs text-ink-muted">
          {openIssues.length} blank rows, as left in the source document.
        </p>
      </div>

      <ul className="divide-y divide-edge">
        {openIssues.map((item, index) => {
          const inputId = `open-issue-${item.id}`;
          const checkboxId = `check-${item.id}`;
          return (
            <li key={item.id} className="flex items-center gap-3 px-4 py-3">
              <input
                type="checkbox"
                id={checkboxId}
                checked={isChecked(item.id)}
                onChange={() => toggleChecked(item.id)}
                aria-label={`Open issue ${index + 1} complete`}
                className="size-4 shrink-0 cursor-pointer accent-[var(--portal-accent)]"
              />
              <label htmlFor={inputId} className="sr-only">
                {`Open issue ${index + 1}`}
              </label>
              <input
                type="text"
                id={inputId}
                value={openIssueValue(item.id)}
                onChange={(event) => setOpenIssue(item.id, event.target.value)}
                className="min-w-0 flex-1 border border-edge bg-surface px-2 py-1.5 text-sm text-ink-secondary"
              />
            </li>
          );
        })}
      </ul>
    </section>
  );
}

/** The nine `Useful Links` labels, each with the empty value the source has. */
function UsefulLinks() {
  const { linkValue, setLink } = usePortalState();
  const { usefulLinks, usefulLinksHeading } = checklist.notes;

  return (
    <section
      id="useful-links"
      aria-labelledby="useful-links-heading"
      className="border border-edge bg-surface"
    >
      <div className="border-b border-edge bg-sunken px-4 py-3">
        <h2 id="useful-links-heading" className="text-base font-semibold text-ink">
          {usefulLinksHeading}
        </h2>
      </div>

      <dl className="divide-y divide-edge">
        {usefulLinks.map((link) => {
          const fieldId = `link-${link.id}`;
          return (
            <div
              key={link.id}
              className="grid gap-1 px-4 py-2.5 sm:grid-cols-[14rem_minmax(0,1fr)] sm:items-center sm:gap-4"
            >
              <dt>
                <label htmlFor={fieldId} className="text-sm font-medium text-ink-secondary">
                  {link.label}
                </label>
              </dt>
              <dd>
                <input
                  type="url"
                  id={fieldId}
                  value={linkValue(link.id)}
                  onChange={(event) => setLink(link.id, event.target.value)}
                  className="w-full border border-edge bg-surface px-2 py-1.5 text-sm text-ink-secondary"
                />
              </dd>
            </div>
          );
        })}
      </dl>
    </section>
  );
}
