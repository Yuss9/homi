"use client";

import { useState } from "react";

type UserAvatarProps = {
  name: string;
  avatarUrl?: string | null;
  large?: boolean;
};

export function UserAvatar({ name, avatarUrl, large = false }: UserAvatarProps) {
  const [failedUrl, setFailedUrl] = useState("");
  const [loadedUrl, setLoadedUrl] = useState("");
  const initials =
    name
      .trim()
      .split(/\s+/)
      .slice(0, 2)
      .map((part) => part[0])
      .join("")
      .toUpperCase() || "?";
  const showImage = Boolean(avatarUrl && failedUrl !== avatarUrl);
  const loading = Boolean(showImage && loadedUrl !== avatarUrl);

  return (
    <span
      className={`user-avatar ${large ? "user-avatar-large" : ""} ${showImage ? "has-image" : ""}`}
      role="img"
      aria-label={`${name}'s profile photo`}
      data-loading={loading ? "true" : "false"}
    >
      {showImage && avatarUrl ? (
        // A native image keeps authenticated same-origin requests intact and
        // lets us recover gracefully when storage is briefly unavailable.
        // eslint-disable-next-line @next/next/no-img-element
        <img
          key={avatarUrl}
          src={avatarUrl}
          alt=""
          decoding="async"
          loading={large ? "eager" : "lazy"}
          onLoad={() => setLoadedUrl(avatarUrl)}
          onError={() => setFailedUrl(avatarUrl)}
        />
      ) : (
        initials
      )}
    </span>
  );
}
