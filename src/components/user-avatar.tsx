type UserAvatarProps = {
  name: string;
  avatarUrl?: string | null;
  large?: boolean;
};

export function UserAvatar({ name, avatarUrl, large = false }: UserAvatarProps) {
  const initials = name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase();
  return (
    <span
      className={`user-avatar ${large ? "user-avatar-large" : ""} ${avatarUrl ? "has-image" : ""}`}
      role="img"
      aria-label={`${name}'s profile photo`}
      style={
        avatarUrl
          ? { backgroundImage: `url(${JSON.stringify(avatarUrl)})` }
          : undefined
      }
    >
      {!avatarUrl && initials}
    </span>
  );
}
