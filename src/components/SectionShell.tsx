import type { ReactNode } from 'react';

type SectionShellProps = {
  id?: string;
  eyebrow?: string;
  title: string;
  subtitle?: string;
  action?: ReactNode;
  children: ReactNode;
};

export function SectionShell({ id, eyebrow, title, subtitle, action, children }: SectionShellProps) {
  return (
    <section id={id} className="section-shell">
      <div className="section-shell__head">
        <div>
          {eyebrow ? <p className="section-shell__eyebrow">{eyebrow}</p> : null}
          <h2 className="section-shell__title">{title}</h2>
          {subtitle ? <p className="section-shell__subtitle">{subtitle}</p> : null}
        </div>
        {action ? <div className="section-shell__action">{action}</div> : null}
      </div>
      {children}
    </section>
  );
}
