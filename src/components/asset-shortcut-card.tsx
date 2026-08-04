"use client";

import { useMemo, useState } from "react";
import {
  Check,
  Copy,
  Download,
  LoaderCircle,
  Nfc,
  QrCode,
  Share2,
} from "lucide-react";

type NdefWriter = {
  write(message: {
    records: Array<{ recordType: "url"; data: string }>;
  }): Promise<void>;
};
type NdefWriterConstructor = new () => NdefWriter;

export function AssetShortcutCard({
  assetId,
  assetName,
}: {
  assetId: string;
  assetName: string;
}) {
  const [status, setStatus] = useState<
    "idle" | "writing" | "written" | "copied" | "error"
  >("idle");
  const [error, setError] = useState("");
  const relativeUrl = `/assets/${assetId}`;
  const destination = useMemo(
    () =>
      typeof window === "undefined"
        ? relativeUrl
        : new URL(relativeUrl, window.location.origin).toString(),
    [relativeUrl],
  );
  const NDEFReader =
    typeof window === "undefined"
      ? undefined
      : (window as unknown as { NDEFReader?: NdefWriterConstructor }).NDEFReader;

  async function writeTag() {
    if (!NDEFReader) return;
    setStatus("writing");
    setError("");
    try {
      const writer = new NDEFReader();
      await writer.write({
        records: [{ recordType: "url", data: destination }],
      });
      setStatus("written");
    } catch (nextError) {
      setError(
        nextError instanceof Error
          ? nextError.message
          : "The NFC tag could not be written.",
      );
      setStatus("error");
    }
  }

  async function copyDestination() {
    try {
      await navigator.clipboard.writeText(destination);
      setStatus("copied");
    } catch {
      setError("Copy the asset URL from your browser address bar.");
      setStatus("error");
    }
  }

  async function shareDestination() {
    if (!navigator.share) {
      await copyDestination();
      return;
    }
    await navigator.share({
      title: `${assetName} · Homi`,
      text: `Open ${assetName} in Homi`,
      url: destination,
    });
  }

  return (
    <section className="dash-card asset-shortcut-card">
      <div className="dash-card-head">
        <div>
          <small>Open this record instantly</small>
          <h2>QR & NFC shortcut</h2>
        </div>
        <Nfc size={18} />
      </div>
      <div className="asset-shortcut-layout">
        <div className="asset-qr-frame">
          {/* The endpoint is private and checks household access before rendering. */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={`/api/assets/${assetId}/qr`}
            alt={`QR code that opens ${assetName}`}
            width="220"
            height="220"
          />
        </div>
        <div className="asset-shortcut-actions">
          <p className="muted-copy">
            Print the QR code or write the same private Homi URL to an NFC tag.
            The person scanning it must still be signed in and have access to
            this home.
          </p>
          <a
            className="button button-secondary"
            href={`/api/assets/${assetId}/qr?download=1`}
          >
            <Download size={16} />
            Download QR
          </a>
          {NDEFReader ? (
            <button
              className="button"
              type="button"
              disabled={status === "writing"}
              onClick={() => void writeTag()}
            >
              {status === "writing" ? (
                <LoaderCircle className="button-spinner" size={16} />
              ) : status === "written" ? (
                <Check size={16} />
              ) : (
                <Nfc size={16} />
              )}
              {status === "written" ? "NFC tag linked" : "Write NFC tag"}
            </button>
          ) : (
            <button
              className="button"
              type="button"
              onClick={() => void copyDestination()}
            >
              {status === "copied" ? <Check size={16} /> : <Copy size={16} />}
              {status === "copied" ? "NFC URL copied" : "Copy NFC destination"}
            </button>
          )}
          <button
            className="button button-secondary"
            type="button"
            onClick={() => void shareDestination()}
          >
            <Share2 size={16} />
            Share shortcut
          </button>
          {!NDEFReader && (
            <small className="field-hint">
              Direct browser writing is available on supported Android browsers.
              On iPhone, copy this destination and write it with an NFC utility
              or an Apple Shortcut.
            </small>
          )}
          {status === "written" && (
            <p className="form-success" role="status">
              <QrCode size={15} /> Hold another phone near the tag to verify it.
            </p>
          )}
          {error && (
            <p className="form-error" role="alert">
              {error}
            </p>
          )}
        </div>
      </div>
    </section>
  );
}
