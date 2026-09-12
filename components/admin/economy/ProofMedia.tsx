function safeProofUrl(value: string) {
  try {
    const url = new URL(value);
    return url.protocol === "https:" ? url.href : null;
  } catch {
    return null;
  }
}
export function ProofMedia({ type, value }: { type: string; value: string }) {
  const url = safeProofUrl(value);
  if (url && type === "image")
    return (
      <a href={url} rel="noreferrer" target="_blank">
        {/* Uploaded proof URLs are not known at build time. */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          alt="Learner submitted evidence; open full image"
          className="mt-2 max-h-80 w-full rounded-lg object-contain"
          loading="lazy"
          referrerPolicy="no-referrer"
          src={url}
        />
      </a>
    );
  if (url && type === "video")
    return (
      <video
        aria-label="Learner submitted video evidence"
        className="mt-2 max-h-80 w-full"
        controls
        preload="metadata"
        src={url}
      />
    );
  if (url && type === "link")
    return (
      <a
        className="break-all underline"
        href={url}
        rel="noreferrer"
        target="_blank"
      >
        {value} ↗
      </a>
    );
  return (
    <p className="mt-1 whitespace-pre-wrap break-words text-sm leading-6">
      {value}
    </p>
  );
}
