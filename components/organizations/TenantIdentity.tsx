import type { ReactNode } from "react";
import styles from "./TenantIdentity.module.css";

type TenantLogoProps = {
  logoUrl?: string | null;
  name: string;
  small?: boolean;
};

/** A logo is artwork, not an avatar: keep its complete aspect ratio and colours. */
export function TenantLogo({ logoUrl, name, small = false }: TenantLogoProps) {
  const initials = name.trim().split(/\s+/).filter(Boolean).slice(0, 2)
    .map(part => Array.from(part)[0]?.toUpperCase() ?? "").join("") || "?";
  const className = `${styles.logo} ${small ? styles.small : ""}`;
  return logoUrl ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img alt="" className={className} src={logoUrl} />
  ) : (
    <span aria-hidden="true" className={`${className} ${styles.fallback}`}>{initials}</span>
  );
}

/** Uses only identity already supplied by the authorised workspace. */
export function TenantIdentity({ logoUrl, name, detail }: TenantLogoProps & { detail?: ReactNode }) {
  return (
    <span className={styles.identity}>
      <TenantLogo logoUrl={logoUrl} name={name} />
      <span className={styles.copy}>
        <span className={styles.name}>{name}</span>
        {detail ? <span className={styles.detail}>{detail}</span> : null}
      </span>
    </span>
  );
}
