import { cn } from "@/lib/utils";

type AvatarProps = {
  name?: string | null;
  email?: string | null;
  avatarUrl?: string | null;
  className?: string;
};

function getInitials(name?: string | null, email?: string | null) {
  const source = name && !name.includes("@") ? name : email ?? "Learner";
  const parts = source
    .replace(/@.*/, "")
    .split(/[\s._-]+/)
    .filter(Boolean);

  const initials = parts
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join("");

  return initials || "VE";
}

export function Avatar({ name, email, avatarUrl, className }: AvatarProps) {
  return (
    <div
      className={cn(
        "grid place-items-center overflow-hidden rounded-full bg-[var(--ve-green-soft)] text-sm font-black text-[var(--ve-green)] shadow-inner",
        className,
      )}
    >
      {avatarUrl ? (
        <img alt="" className="h-full w-full object-cover" src={avatarUrl} />
      ) : (
        <span>{getInitials(name, email)}</span>
      )}
    </div>
  );
}
