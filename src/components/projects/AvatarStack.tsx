import { UserAvatar } from "@/components/ui/UserAvatar";

export interface AvatarStackUser {
  id?: string;
  name: string;
  profilePicUrl?: string | null;
}

interface AvatarStackProps {
  users: AvatarStackUser[];
  /** Number of members not shown (for "+N"). */
  overflow: number;
}

/**
 * Overlapping circular avatars with an optional +N overflow chip.
 */
export function AvatarStack({ users, overflow }: AvatarStackProps) {
  if (users.length === 0 && overflow <= 0) {
    return null;
  }

  return (
    <div className="flex items-center">
      {users.map((u, i) => (
        <div
          key={u.id ?? `${u.name}-${i}`}
          className={`relative ${i === 0 ? "" : "-ml-2"}`}
          style={{ zIndex: users.length - i }}
        >
          <UserAvatar user={u} size={28} />
        </div>
      ))}
      {overflow > 0 ? (
        <span
          className="-ml-2 z-10 inline-flex items-center justify-center w-7 h-7 rounded-full bg-base-300 border-2 border-base-100 text-xs font-medium text-base-content"
          title={`${overflow} more`}
        >
          +{overflow}
        </span>
      ) : null}
    </div>
  );
}
