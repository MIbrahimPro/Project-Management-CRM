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
  /** Optional map of user presence to show online status dots */
  presenceMap?: Record<string, string>;
}

/**
 * Overlapping circular avatars with an optional +N overflow chip.
 */
  export function AvatarStack({ users, overflow, presenceMap }: AvatarStackProps) {
    if (users.length === 0 && overflow <= 0) {
      return null;
    }
  
    const onlineCount = presenceMap ? Object.values(presenceMap).filter(v => v === "online").length : 0;
    const totalCount = users.length + overflow;

    return (
      <div className="flex items-center group/stack relative">
        <div className="flex -space-x-2">
          {users.map((u, i) => (
            <div
              key={u.id ?? `${u.name}-${i}`}
              className="relative"
              style={{ zIndex: users.length - i }}
            >
              <UserAvatar 
                user={u} 
                size={28} 
                showPresence={!!presenceMap}
                isOnline={presenceMap && u.id ? presenceMap[u.id] === "online" : false}
              />
            </div>
          ))}
          {overflow > 0 && (
            <div 
              className="z-0 inline-flex items-center justify-center w-7 h-7 rounded-full bg-base-300 border-2 border-base-100 text-[10px] font-bold text-base-content"
            >
              +{overflow}
            </div>
          )}
        </div>

        {/* Hover list */}
        <div className="absolute left-0 bottom-full mb-2 hidden group-hover/stack:block z-[100] w-48 bg-base-200 border border-base-300 rounded-xl shadow-xl p-2 animate-in fade-in slide-in-from-bottom-1">
          <p className="text-[10px] font-bold uppercase tracking-widest text-base-content/40 px-2 mb-1">
            Members ({totalCount})
          </p>
          <div className="space-y-1 max-h-48 overflow-y-auto pr-1">
            {users.map(u => (
              <div key={u.id} className="flex items-center gap-2 px-2 py-1 rounded-md hover:bg-base-300 transition-colors">
                <UserAvatar user={u} size={24} />
                <span className="text-xs font-medium truncate flex-1">{u.name}</span>
                {presenceMap && u.id && (
                  <span className={`w-1.5 h-1.5 rounded-full ${presenceMap[u.id] === "online" ? "bg-success" : "bg-base-content/20"}`} />
                )}
              </div>
            ))}
            {overflow > 0 && (
              <p className="text-[10px] text-center text-base-content/40 py-1">
                + {overflow} more members
              </p>
            )}
          </div>
          {presenceMap && (
             <div className="mt-2 pt-2 border-t border-base-300 px-2 flex justify-between items-center">
                <span className="text-[10px] text-base-content/50">Online</span>
                <span className="text-[10px] font-bold text-success">{onlineCount}</span>
             </div>
          )}
        </div>
      </div>
    );
  }
