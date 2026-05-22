"use client";

const YOU_TRACK_FORM_ID = "c421907f-2c33-463a-8bac-f6c701537096";
const YOU_TRACK_FORM_URL = `https://ayika.youtrack.cloud/form/${YOU_TRACK_FORM_ID}`;

export function SupportEmbed() {
  return (
    <div className="rounded-[20px] border border-[var(--ve-line-soft)] bg-[var(--ve-card)] px-5 py-5 shadow-sm">
      <div className="rounded-[16px] bg-[var(--ve-panel-soft)] px-4 py-3 text-sm font-semibold text-[var(--ve-muted-strong)]">
        Fill the form below
      </div>

      <div className="mt-4 overflow-hidden rounded-[16px] border border-[var(--ve-line-soft)]">
        <iframe
          className="block min-h-[980px] w-full border-0 bg-white"
          loading="lazy"
          src={YOU_TRACK_FORM_URL}
          title="Support form"
        />
      </div>
    </div>
  );
}
