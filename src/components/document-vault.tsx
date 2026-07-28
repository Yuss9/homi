"use client";

import { useEffect, useState, type FormEvent } from "react";
import {
  Download,
  FileKey,
  FileUp,
  LoaderCircle,
  LockKeyhole,
  Upload,
} from "lucide-react";
import { ActionFeedback } from "@/src/components/action-feedback";

type Home = { id: string; name: string };
type DocumentRow = {
  id: string;
  title: string;
  type: string;
  fileId: string;
  originalName: string;
  size: number;
  createdAt: string;
};

export function DocumentVault() {
  const [homes, setHomes] = useState<Home[]>([]);
  const [homeId, setHomeId] = useState("");
  const [documents, setDocuments] = useState<DocumentRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [selectedFile, setSelectedFile] = useState("");
  const [newDocumentId, setNewDocumentId] = useState("");

  useEffect(() => {
    void fetch("/api/homes")
      .then((response) => response.json())
      .then((payload) => {
        const next = payload.homes ?? [];
        setHomes(next);
        setHomeId(next[0]?.id ?? "");
      });
  }, []);

  async function loadDocuments(selectedHomeId = homeId) {
    if (!selectedHomeId) return setDocuments([]);
    const response = await fetch(`/api/documents?homeId=${selectedHomeId}`);
    const payload = await response.json();
    setDocuments(payload.documents ?? []);
  }

  useEffect(() => {
    if (!homeId) return;
    void fetch(`/api/documents?homeId=${homeId}`)
      .then((response) => response.json())
      .then((payload) => setDocuments(payload.documents ?? []));
  }, [homeId]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formElement = event.currentTarget;
    setLoading(true);
    setError("");
    setMessage("");

    try {
      const response = await fetch("/api/uploads", {
        method: "POST",
        body: new FormData(formElement),
      });
      const payload = await response.json();

      if (!response.ok) {
        setError(payload.error?.message ?? "Upload failed.");
        return;
      }

      setNewDocumentId(payload.document.id);
      setMessage(`${payload.document.title} is now in your private vault.`);
      formElement.reset();
      setSelectedFile("");
      await loadDocuments();
    } finally {
      setLoading(false);
    }
  }

  return (
    <main id="main" className="app-main">
      <div className="dashboard-head">
        <div>
          <small>Private by default</small>
          <h1>Documents</h1>
          <p>Manuals, warranties, invoices, certificates, and home photos.</p>
        </div>
        <select
          aria-label="Selected home"
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

      <ActionFeedback error={error} message={message} />

      <div className="dash-grid" style={{ marginTop: 32 }}>
        <form
          className={`dash-card auth-form ${loading ? "is-submitting" : ""}`}
          onSubmit={submit}
        >
          <div className="dash-card-head">
            <h2>Upload a document</h2>
            <LockKeyhole size={19} />
          </div>
          <input type="hidden" name="homeId" value={homeId} />
          <div className="field">
            <label htmlFor="doc-title">Title</label>
            <input
              id="doc-title"
              name="title"
              placeholder="Dishwasher invoice"
              required
              disabled={loading}
            />
          </div>
          <div className="field">
            <label htmlFor="doc-type">Document type</label>
            <select
              id="doc-type"
              name="type"
              defaultValue="INVOICE"
              disabled={loading}
            >
              <option value="INVOICE">Invoice</option>
              <option value="WARRANTY">Warranty</option>
              <option value="MANUAL">Manual</option>
              <option value="CERTIFICATE">Certificate</option>
              <option value="CONTRACT">Contract</option>
              <option value="PHOTO">Photo</option>
              <option value="OTHER">Other</option>
            </select>
          </div>
          <div className="field">
            <label htmlFor="doc-file">File · PDF or image up to 10 MB</label>
            <label className="upload-dropzone" htmlFor="doc-file">
              <FileUp size={22} />
              <span>
                <strong>
                  {selectedFile || "Choose a document from your device"}
                </strong>
                <small>PDF, JPEG, PNG or WebP</small>
              </span>
              <b>{selectedFile ? "Change" : "Browse"}</b>
            </label>
            <input
              className="file-input"
              id="doc-file"
              name="file"
              type="file"
              accept=".pdf,image/jpeg,image/png,image/webp"
              required
              disabled={loading}
              onChange={(event) =>
                setSelectedFile(event.target.files?.[0]?.name ?? "")
              }
            />
          </div>

          {loading && (
            <div className="upload-progress" role="status" aria-live="polite">
              <span>
                <LoaderCircle className="button-spinner" size={17} />
                Encrypting and storing {selectedFile || "your document"}…
              </span>
              <i />
            </div>
          )}

          <button
            className="button button-large"
            disabled={loading || !homeId}
            type="submit"
          >
            {loading ? (
              <LoaderCircle className="button-spinner" size={18} />
            ) : (
              <Upload size={18} />
            )}
            {loading ? "Uploading securely…" : "Upload securely"}
          </button>
        </form>

        <section className="dash-card">
          <div className="dash-card-head">
            <h2>Private vault</h2>
            <FileKey size={19} />
          </div>
          <div className="animated-list">
            {documents.map((document) => (
              <a
                className={`dash-task ${
                  newDocumentId === document.id ? "is-new" : ""
                }`}
                href={`/api/files/${document.fileId}`}
                key={document.id}
              >
                <span>
                  <FileKey size={17} />
                </span>
                <div>
                  <strong>{document.title}</strong>
                  <small>
                    {document.type.toLowerCase()} ·{" "}
                    {(document.size / 1024).toFixed(1)} KB
                  </small>
                </div>
                <Download size={17} />
              </a>
            ))}
          </div>
          {!documents.length && (
            <p className="muted-copy">No documents stored for this home yet.</p>
          )}
        </section>
      </div>
    </main>
  );
}
