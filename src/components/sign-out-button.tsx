"use client";

import { useState } from "react";
import { authClient } from "@/src/lib/auth-client";

export function SignOutButton({ className }: { className?: string }) {
  const [loading, setLoading] = useState(false);

  return (
    <button
      className={className}
      type="button"
      disabled={loading}
      onClick={async () => {
        setLoading(true);
        const result = await authClient.signOut();

        if (result.error) {
          setLoading(false);
          return;
        }

        window.location.assign("/");
      }}
    >
      {loading ? "Signing out…" : "Sign out"}
    </button>
  );
}
