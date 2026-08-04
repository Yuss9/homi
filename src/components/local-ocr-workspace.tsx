"use client";

import { useEffect, useState } from "react";
import { FileSearch, LoaderCircle, ScanText, ShieldCheck } from "lucide-react";

type TextDetection = { rawValue?: string };
type TextDetectorApi = {
  detect(source: CanvasImageSource): Promise<TextDetection[]>;
};
type TextDetectorConstructor = new () => TextDetectorApi;
type Home = { id: string; name: string };
type DocumentRow = { id: string; title: string; type: string };

export function LocalOcrWorkspace() {
  const [homes, setHomes] = useState<Home[]>([]);
  const [homeId, setHomeId] = useState("");
  const [documents, setDocuments] = useState<DocumentRow[]>([]);
  const [documentId, setDocumentId] = useState("");
  const [text, setText] = useState("");
  const [language, setLanguage] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [detectorAvailable, setDetectorAvailable] = useState(
    () => typeof window !== "undefined" && "TextDetector" in window,
  );

  useEffect(() => {
    void fetch("/api/homes")
      .then((response) => response.json())
      .then((payload) => {
        const next = payload.homes ?? [];
        setHomes(next);
        setHomeId(next[0]?.id ?? "");
      });
  }, []);

  useEffect(() => {
    if (!homeId) return;
    void fetch(`/api/documents?homeId=${homeId}`)
      .then((response) => response.json())
      .then((payload) => {
        const next = payload.documents ?? [];
        setDocuments(next);
        setDocumentId(next[0]?.id ?? "");
      });
  }, [homeId]);

  async function extract(file: File) {
    setBusy(true);
    setError("");
    setMessage("");
    try {
      const Constructor = (
        window as Window & { TextDetector?: TextDetectorConstructor }
      ).TextDetector;
      if (!Constructor) {
        setDetectorAvailable(false);
        setError(
          "Local automatic OCR is not supported by this browser. Paste or type the extracted text manually.",
        );
        return;
      }
      const bitmap = await createImageBitmap(file);
      const detector = new Constructor();
      const rows = await detector.detect(bitmap);
      bitmap.close();
      const extracted = rows
        .map((row) => row.rawValue?.trim())
        .filter((value): value is string => Boolean(value))
        .join("\n");
      if (!extracted) {
        setError(
          "No readable text was detected. Try a sharper photo or enter the text manually.",
        );
        return;
      }
      setText(extracted);
      setMessage(
        "Text was extracted locally in this browser. Review it before saving.",
      );
    } catch {
      setError(
        "The browser could not read this image. Try PNG or JPEG, or enter text manually.",
      );
    } finally {
      setBusy(false);
    }
  }

  async function save() {
    if (!documentId || !text.trim()) return;
    setBusy(true);
    setError("");
    const response = await fetch(`/api/documents/${documentId}/ocr`, {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        text,
        language: language || undefined,
        engine: detectorAvailable ? "BROWSER_TEXT_DETECTOR" : "MANUAL",
      }),
    });
    const payload = await response.json();
    if (!response.ok)
      setError(payload.error?.message ?? "Could not save OCR text.");
    else setMessage("OCR text is indexed in Homi global search.");
    setBusy(false);
  }

  return (
    <main id="main" className="app-main ocr-workspace">
      <div className="dashboard-head">
        <div>
          <small>Private local processing</small>
          <h1>Document OCR</h1>
          <p>
            Extract text from a photographed invoice, warranty or manual in the
            browser, then attach the reviewed text to an existing Homi document.
          </p>
        </div>
        <select
          value={homeId}
          onChange={(event) => setHomeId(event.target.value)}
        >
          {homes.map((home) => (
            <option key={home.id} value={home.id}>
              {home.name}
            </option>
          ))}
        </select>
      </div>

      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}
      {message && (
        <p className="form-success" role="status">
          {message}
        </p>
      )}

      <div className="dash-grid">
        <section className="dash-card auth-form">
          <div className="dash-card-head">
            <h2>Local source</h2>
            <ScanText size={18} />
          </div>
          <div className="ocr-privacy-note">
            <ShieldCheck size={20} />
            <p>
              The selected image is processed on this device and is never
              uploaded by the OCR workflow.
            </p>
          </div>
          <div className="field">
            <label htmlFor="ocr-image">Photo or image page</label>
            <input
              id="ocr-image"
              type="file"
              accept="image/png,image/jpeg,image/webp"
              capture="environment"
              disabled={busy}
              onChange={(event) => {
                const file = event.target.files?.[0];
                if (file) void extract(file);
              }}
            />
          </div>
          {!detectorAvailable && (
            <p className="muted-copy">
              Automatic OCR is unavailable here; manual text entry remains
              private and supported.
            </p>
          )}
        </section>

        <section className="dash-card auth-form">
          <div className="dash-card-head">
            <h2>Review and index</h2>
            <FileSearch size={18} />
          </div>
          <div className="field">
            <label htmlFor="ocr-document">Homi document</label>
            <select
              id="ocr-document"
              value={documentId}
              onChange={(event) => setDocumentId(event.target.value)}
            >
              {documents.map((document) => (
                <option key={document.id} value={document.id}>
                  {document.title} · {document.type.toLowerCase()}
                </option>
              ))}
            </select>
          </div>
          <div className="field">
            <label htmlFor="ocr-language">Detected language</label>
            <select
              id="ocr-language"
              value={language}
              onChange={(event) => setLanguage(event.target.value)}
            >
              <option value="">Automatic or unknown</option>
              <option value="en">English</option>
              <option value="fr">Français</option>
              <option value="de">Deutsch</option>
            </select>
          </div>
          <div className="field">
            <label htmlFor="ocr-text">Extracted text</label>
            <textarea
              id="ocr-text"
              rows={16}
              value={text}
              onChange={(event) => setText(event.target.value)}
              placeholder="Review extracted text or paste it manually…"
            />
          </div>
          <button
            className="button"
            type="button"
            disabled={!documentId || !text.trim() || busy}
            onClick={() => void save()}
          >
            {busy ? (
              <LoaderCircle className="button-spinner" size={17} />
            ) : (
              <ScanText size={17} />
            )}
            Index text in Homi
          </button>
        </section>
      </div>
    </main>
  );
}
