"use client";

import * as Dialog from "@radix-ui/react-dialog";
import Image from "next/image";
import {
  Download,
  Eye,
  FileKey,
  FileQuestion,
  FileUp,
  LoaderCircle,
  LockKeyhole,
  Save,
  Tag,
  Upload,
  X,
} from "lucide-react";
import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type FormEvent,
} from "react";
import { ActionFeedback } from "@/src/components/action-feedback";

type Home = { id: string; name: string; role: string };
type DocumentTag = { id: string; name: string };
type DocumentRow = {
  id: string;
  title: string;
  type: string;
  fileId: string;
  originalName: string;
  mimeType: string;
  size: number;
  createdAt: string;
  tags: DocumentTag[];
};

function formatSize(size: number) {
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
  return `${(size / 1024 / 1024).toFixed(1)} MB`;
}

function previewKind(mimeType: string) {
  if (mimeType === "application/pdf") return "pdf";
  if (mimeType === "application/json" || mimeType.startsWith("text/"))
    return "text";
  if (mimeType.startsWith("image/")) return "image";
  if (mimeType.startsWith("audio/")) return "audio";
  if (mimeType.startsWith("video/")) return "video";
  return "unsupported";
}

function FilePreview({ document }: { document: DocumentRow }) {
  const source = `/api/files/${document.fileId}?preview=1`;
  const kind = previewKind(document.mimeType);

  if (kind === "image")
    return (
      <Image
        className="file-preview-image"
        src={source}
        alt={document.title}
        width={1600}
        height={1200}
        unoptimized
      />
    );
  if (kind === "pdf" || kind === "text")
    return (
      <iframe
        className="file-preview-frame"
        src={source}
        title={`Preview of ${document.title}`}
      />
    );
  if (kind === "video")
    return (
      <video
        className="file-preview-media"
        src={source}
        controls
        preload="metadata"
      />
    );
  if (kind === "audio")
    return (
      <audio
        className="file-preview-audio"
        src={source}
        controls
        preload="metadata"
      />
    );

  return (
    <div className="file-preview-unavailable">
      <FileQuestion size={34} />
      <strong>No browser preview for this file type</strong>
      <p>
        The file is stored safely. You can still download and open{" "}
        {document.originalName} with its usual application.
      </p>
    </div>
  );
}

export function DocumentVault() {
  const [homes, setHomes] = useState<Home[]>([]);
  const [homeId, setHomeId] = useState("");
  const [documents, setDocuments] = useState<DocumentRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [savingTags, setSavingTags] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [selectedFile, setSelectedFile] = useState("");
  const [newDocumentId, setNewDocumentId] = useState("");
  const [selectedDocument, setSelectedDocument] = useState<DocumentRow | null>(
    null,
  );
  const [selectedTag, setSelectedTag] = useState("");
  const [tagInput, setTagInput] = useState("");
  const [dialogMessage, setDialogMessage] = useState("");
  const [dialogError, setDialogError] = useState("");

  const selectedHome = homes.find((home) => home.id === homeId);
  const canEdit = selectedHome?.role !== "VIEWER";

  useEffect(() => {
    void fetch("/api/homes")
      .then((response) => response.json())
      .then((payload) => {
        const next = payload.homes ?? [];
        setHomes(next);
        setHomeId(next[0]?.id ?? "");
      });
  }, []);

  const loadDocuments = useCallback(async (selectedHomeId: string) => {
    if (!selectedHomeId) return setDocuments([]);
    const response = await fetch(`/api/documents?homeId=${selectedHomeId}`);
    const payload = await response.json();
    if (!response.ok) {
      setError(payload.error?.message ?? "Could not load documents.");
      return;
    }
    setDocuments(payload.documents ?? []);
  }, []);

  useEffect(() => {
    if (!homeId) return;
    const controller = new AbortController();
    void fetch(`/api/documents?homeId=${homeId}`, {
      signal: controller.signal,
    })
      .then(async (response) => ({ response, payload: await response.json() }))
      .then(({ response, payload }) => {
        if (!response.ok) {
          setError(payload.error?.message ?? "Could not load documents.");
          return;
        }
        setDocuments(payload.documents ?? []);
      })
      .catch((fetchError: unknown) => {
        if (
          fetchError instanceof DOMException &&
          fetchError.name === "AbortError"
        )
          return;
        setError("Could not load documents.");
      });
    return () => controller.abort();
  }, [homeId]);

  const tagGroups = useMemo(() => {
    const groups = new Map<
      string,
      { id: string; name: string; count: number }
    >();
    for (const document of documents) {
      for (const tag of document.tags) {
        const current = groups.get(tag.id);
        groups.set(tag.id, { ...tag, count: (current?.count ?? 0) + 1 });
      }
    }
    return [...groups.values()].sort((a, b) => a.name.localeCompare(b.name));
  }, [documents]);

  const visibleDocuments = selectedTag
    ? documents.filter((document) =>
        document.tags.some((tag) => tag.id === selectedTag),
      )
    : documents;

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
      await loadDocuments(homeId);
    } finally {
      setLoading(false);
    }
  }

  function openDocument(document: DocumentRow) {
    setSelectedDocument(document);
    setTagInput(document.tags.map((tag) => tag.name).join(", "));
    setDialogError("");
    setDialogMessage("");
  }

  async function saveTags() {
    if (!selectedDocument) return;
    setSavingTags(true);
    setDialogError("");
    setDialogMessage("");
    try {
      const response = await fetch(
        `/api/documents/${selectedDocument.id}/tags`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            tags: tagInput
              .split(",")
              .map((tag) => tag.trim())
              .filter(Boolean),
          }),
        },
      );
      const payload = await response.json();
      if (!response.ok) {
        setDialogError(payload.error?.message ?? "Could not save tags.");
        return;
      }
      const updated = {
        ...selectedDocument,
        tags: payload.tags as DocumentTag[],
      };
      setSelectedDocument(updated);
      setDocuments((current) =>
        current.map((document) =>
          document.id === updated.id ? updated : document,
        ),
      );
      setDialogMessage("Tags updated.");
    } finally {
      setSavingTags(false);
    }
  }

  return (
    <main id="main" className="app-main">
      <div className="dashboard-head">
        <div>
          <small>Private by default</small>
          <h1>Documents</h1>
          <p>
            Preview, tag, filter, and download every file kept with your home.
          </p>
        </div>
        <select
          aria-label="Selected home"
          value={homeId}
          onChange={(event) => {
            setHomeId(event.target.value);
            setSelectedTag("");
            setSelectedDocument(null);
          }}
        >
          {homes.map((home) => (
            <option key={home.id} value={home.id}>
              {home.name}
            </option>
          ))}
        </select>
      </div>

      <ActionFeedback error={error} message={message} />

      <div className="dash-grid document-grid" style={{ marginTop: 32 }}>
        <form
          className={`dash-card auth-form ${loading ? "is-submitting" : ""}`}
          onSubmit={submit}
        >
          <div className="dash-card-head">
            <h2>Upload a file</h2>
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
            <label htmlFor="doc-type">File category</label>
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
            <label htmlFor="doc-tags">Tags</label>
            <input
              id="doc-tags"
              name="tags"
              placeholder="Kitchen, Warranty, 2026"
              disabled={loading}
              maxLength={500}
            />
            <small className="field-hint">
              Separate up to 10 tags with commas.
            </small>
          </div>
          <div className="field">
            <label htmlFor="doc-file">File · any format up to 10 MB</label>
            <label className="upload-dropzone" htmlFor="doc-file">
              <FileUp size={22} />
              <span>
                <strong>
                  {selectedFile || "Choose a file from your device"}
                </strong>
                <small>
                  PDF, image, text, audio, video, Office, archive, and more
                </small>
              </span>
              <b>{selectedFile ? "Change" : "Browse"}</b>
            </label>
            <input
              className="file-input"
              id="doc-file"
              name="file"
              type="file"
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
                Storing {selectedFile || "your file"}…
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

        <section className="dash-card document-library">
          <div className="dash-card-head">
            <h2>Private vault</h2>
            <FileKey size={19} />
          </div>

          {tagGroups.length > 0 && (
            <div className="tag-filters" aria-label="Filter files by tag">
              <button
                className={`tag-chip ${selectedTag === "" ? "is-active" : ""}`}
                type="button"
                onClick={() => setSelectedTag("")}
              >
                All <span>{documents.length}</span>
              </button>
              {tagGroups.map((tag) => (
                <button
                  className={`tag-chip ${selectedTag === tag.id ? "is-active" : ""}`}
                  key={tag.id}
                  type="button"
                  onClick={() => setSelectedTag(tag.id)}
                >
                  <Tag size={12} /> {tag.name} <span>{tag.count}</span>
                </button>
              ))}
            </div>
          )}

          <div className="animated-list">
            {visibleDocuments.map((document) => (
              <article
                className={`dash-task document-row ${
                  newDocumentId === document.id ? "is-new" : ""
                }`}
                key={document.id}
              >
                <button
                  className="document-open"
                  type="button"
                  onClick={() => openDocument(document)}
                  aria-label={`Preview ${document.title}`}
                >
                  <span>
                    <Eye size={17} />
                  </span>
                  <div>
                    <strong>{document.title}</strong>
                    <small>
                      {document.type.toLowerCase()} ·{" "}
                      {formatSize(document.size)}
                    </small>
                    {document.tags.length > 0 && (
                      <span className="document-tags">
                        {document.tags.map((tag) => (
                          <i key={tag.id}>{tag.name}</i>
                        ))}
                      </span>
                    )}
                  </div>
                </button>
                <a
                  className="icon-action"
                  href={`/api/files/${document.fileId}`}
                  aria-label={`Download ${document.title}`}
                >
                  <Download size={17} />
                </a>
              </article>
            ))}
          </div>
          {!visibleDocuments.length && (
            <p className="muted-copy">
              {documents.length
                ? "No files match this tag."
                : "No files stored for this home yet."}
            </p>
          )}
        </section>
      </div>

      <Dialog.Root
        open={Boolean(selectedDocument)}
        onOpenChange={(open) => {
          if (!open) setSelectedDocument(null);
        }}
      >
        <Dialog.Portal>
          <Dialog.Overlay className="file-dialog-overlay" />
          <Dialog.Content className="file-dialog-content">
            {selectedDocument && (
              <>
                <header className="file-dialog-header">
                  <div>
                    <Dialog.Title>{selectedDocument.title}</Dialog.Title>
                    <Dialog.Description>
                      {selectedDocument.originalName} ·{" "}
                      {formatSize(selectedDocument.size)}
                    </Dialog.Description>
                  </div>
                  <Dialog.Close
                    className="icon-action"
                    aria-label="Close preview"
                  >
                    <X size={19} />
                  </Dialog.Close>
                </header>

                <div className="file-preview-stage">
                  <FilePreview document={selectedDocument} />
                </div>

                <footer className="file-dialog-footer">
                  <div className="dialog-tag-editor">
                    <label htmlFor="dialog-tags">Tags</label>
                    <div>
                      <input
                        id="dialog-tags"
                        value={tagInput}
                        onChange={(event) => setTagInput(event.target.value)}
                        placeholder="Kitchen, Warranty, 2026"
                        disabled={!canEdit || savingTags}
                      />
                      {canEdit && (
                        <button
                          className="button button-ghost button-small"
                          type="button"
                          onClick={() => void saveTags()}
                          disabled={savingTags}
                        >
                          {savingTags ? (
                            <LoaderCircle
                              className="button-spinner"
                              size={15}
                            />
                          ) : (
                            <Save size={15} />
                          )}
                          Save tags
                        </button>
                      )}
                    </div>
                    {(dialogError || dialogMessage) && (
                      <p
                        className={
                          dialogError
                            ? "dialog-feedback is-error"
                            : "dialog-feedback"
                        }
                        role={dialogError ? "alert" : "status"}
                      >
                        {dialogError || dialogMessage}
                      </p>
                    )}
                  </div>
                  <a
                    className="button button-small"
                    href={`/api/files/${selectedDocument.fileId}`}
                  >
                    <Download size={16} /> Download
                  </a>
                </footer>
              </>
            )}
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
    </main>
  );
}
