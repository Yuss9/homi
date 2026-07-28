"use client";

import { AlertCircle, Check } from "lucide-react";

export function ActionFeedback({
  error,
  message,
}: {
  error?: string;
  message?: string;
}) {
  const content = error || message;
  if (!content) return null;

  const isError = Boolean(error);

  return (
    <div
      className={`action-feedback ${isError ? "is-error" : "is-success"}`}
      role={isError ? "alert" : "status"}
    >
      <span className="feedback-icon" aria-hidden="true">
        {isError ? <AlertCircle size={18} /> : <Check size={18} />}
      </span>
      <div>
        <strong>{isError ? "Action needed" : "All set"}</strong>
        <span>{content}</span>
      </div>
    </div>
  );
}
