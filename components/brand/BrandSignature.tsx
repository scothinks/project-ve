import styles from "./BrandSignature.module.css";

type BrandSignatureProps = {
  layout?: "horizontal" | "compact";
  markOnly?: boolean;
  markSize?: 16 | 20 | 24 | 32;
  decorative?: boolean;
};

/** Frozen Open signature. Accessible naming always uses the canonical product name. */
export function BrandSignature({
  layout = "horizontal",
  markOnly = false,
  markSize = 24,
  decorative = false,
}: BrandSignatureProps) {
  return (
    <span
      aria-hidden={decorative || undefined}
      aria-label={decorative ? undefined : "Project VE"}
      className={`${styles.signature} ${layout === "compact" ? styles.compact : ""}`}
      role={decorative ? undefined : "img"}
    >
      {/* One canonical vector is shared with exports; its colour inherits the surface ink. */}
      <span
        aria-hidden="true"
        className={styles.mark}
        style={{ width: markSize, height: markSize }}
      />
      {!markOnly ? (
        <span aria-hidden="true" className={styles.words}>
          <span className={styles.project}>project</span>
          <span className={styles.ve}>v<span className={styles.slash}>/</span>e</span>
        </span>
      ) : null}
    </span>
  );
}
