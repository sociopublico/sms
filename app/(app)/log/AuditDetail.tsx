import type { AuditField } from "@/lib/audit-format";

export function AuditDetail({ fields, error }: { fields: AuditField[]; error: string | null }) {
  if (!fields.length && !error) {
    return <span className="text-muted">—</span>;
  }
  return (
    <div className="space-y-1">
      {error ? <p className="text-sm text-danger">Error: {error}</p> : null}
      {fields.length ? (
        <dl className="space-y-0.5">
          {fields.map((field) => (
            <div key={`${field.label}-${field.value}`} className="flex flex-wrap gap-x-2">
              <dt className="text-muted">{field.label}</dt>
              <dd className="text-navy">{field.value}</dd>
            </div>
          ))}
        </dl>
      ) : null}
    </div>
  );
}
