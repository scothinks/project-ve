import { BrandSignature } from "./BrandSignature";
import styles from "./BrandSignature.module.css";

/** Neutral platform attribution; tenant placement and hierarchy belong to B4. */
export function PlatformEndorsement() {
  return (
    <span aria-label="Learning on Project VE" className={styles.endorsement} role="img">
      <span aria-hidden="true">Learning on</span>
      <BrandSignature decorative />
    </span>
  );
}
