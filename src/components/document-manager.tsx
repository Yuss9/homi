"use client";

import { useEffect, useState, type FormEvent } from "react";
import {
  Archive,
  Check,
  Download,
  Eye,
  FileText,
  LoaderCircle,
  Pencil,
  Plus,
  X,
} from "lucide-react";
import { ActionFeedback } from "@/src/components/action-feedback";

type Home = { id: string; name: string; role: string };
type Asset = { id: string; name: string };
type DocumentTag = { id: string; name: string };
type DocumentRow = {
  id: string;
  homeId: string;
  assetId?: string | null;
  title: string;
  description?: string | null;
  type: string;
  documentDate?: string | null;
  expiryDate?: string | null;
  fileId: string;
  originalName: string;
  mimeType: string;
  size: number;
  tags: DocumentTag[];
};

const optional = (form: FormData, name: string) => {
  const value = String(form.get(name) ?? "").trim();
  return value || null;
};

function formatSize(size: number) {
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
  return `${(size / 1024 / 1024).toFixed(1)} MB`;
}

function expiryLabel(expiryDate?: string | null) {
  if (!expiryDate) return "No expiry";
  const today = new Date().toISOString().slice(0, 10);
  if (expiryDate < today) return `Expired ${expiryDate}`;
  return `Expires ${expiryDate}`;
}

export function DocumentManager() {
  const [homes, setHomes] = useState<Home[]>([]);
  const [homeId, setHomeId] = useState("");
  const [assets, setAssets] = useState<Asset[]>([]);
  const [documents, setDocuments] = useState<DocumentRow[]>([]);
  const [editingId, setEditingId] = useState("");
  const [selectedFile, setSelectedFile] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

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

  async function load(selectedHomeId = homeId) {
    if (!selectedHomeId) {
      setAssets([]);
      setDocuments([]);
      return;
    }
    const [assetResponse, documentResponse] = await Promise.all([
      fetch(`/api/assets?homeId=${selectedHomeId}`),
      fetch(`/api/documents?homeId=${selectedHomeId}`),
    ]);
    const assetPayload = await assetResponse.json();
    const documentPayload = await documentResponse.json();
    setAssets(assetPayload.assets ?? []);
    setDocuments(documentPayload.documents ?? []);
  }

  useEffect(() => {
    setEditingId("");
    void load(homeId);
  }, [homeId]);

  async function upload(event: FormEvent<HTMLFormElement>) {
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
      formElement.reset();
      setSelectedFile("");
      setMessage(`${payload.document.title} is now in your private vault.`);
      await load();
    } finally {
      setLoading(false);
    }
  }

  async function saveDocument(
    event: FormEvent<HTMLFormElement>,
    document: DocumentRow,
  ) {
    event.preventDefault();
    setError("");
    const form = new FormData(event.currentTarget);
    const response = await fetch(`/api/documents/${document.id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        assetId: optional(form, "assetId"),
        title: form.get("title"),
        description: optional(form, "description"),
        type: form.get("type"),
        documentDate: optional(form, "documentDate"),
        expiryDate: optional(form, "expiryDate"),
      }),
    });
    const payload = await response.json();
    if (!response.ok) {
      setError(payload.error?.message ?? "Could not update the document.");
      return;
    }

    const tagsResponse = await fetch(`/api/documents/${document.id}/tags`, {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        tags: String(form.get("tags") ?? "")
          .split(",")
          .map((tag) => tag.trim())
          .filter(Boolean),
      }),
    });
    const tagsPayload = await tagsResponse.json();
    if (!tagsResponse.ok) {
      setError(tagsPayload.error?.message ?? "Metadata saved, but tags failed.");
      await load();
      return;
    }

    setEditingId("");
    setMessage("Document metadata updated.");
    await load();
  }

  async function archiveDocument(document: DocumentRow) {
    const response = await fetch(`/api/documents/${document.id}`, {
      method: "DELETE",
    });
    const payload = await response.json();
    if (!response.ok) {
      setError(payload.error?.message ?? "Could not archive the document.");
      return;
    }
    setEditingId("");
    setMessage(`${document.title} was archived. Its private file was preserved.`);
    await load();
  }

  return (
    <main id="main" className="app-main">
      <div className="dashboard-head">
        <div>
          <small>Private by default</small>
          <h1>Documents</h1>
          <p>Store document dates, expirations, tags, and linked equipment.</p>
        </div>
        <select aria-label="Selected home" value={homeId} onChange={(event) => setHomeId(event.target.value)}>
          {homes.map((home) => <option key={home.id} value={home.id}>{home.name}</option>)}
        </select>
      </div>

      <ActionFeedback error={error} message={message} />

      <div className="dash-grid document-grid" style={{ marginTop: 32 }}>
        {canEdit && (
          <form className={`dash-card auth-form ${loading ? "is-submitting" : ""}`} onSubmit={upload}>
            <div className="dash-card-head"><h2>Upload a file</h2><Plus size={19} /></div>
            <input type="hidden" name="homeId" value={homeId} />
            <div className="field"><label htmlFor="doc-title">Title</label><input id="doc-title" name="title" required disabled={loading} placeholder="Dishwasher invoice" /></div>
            <div className="field"><label htmlFor="doc-type">Category</label><select id="doc-type" name="type" defaultValue="INVOICE" disabled={loading}><option value="INVOICE">Invoice</option><option value="WARRANTY">Warranty</option><option value="MANUAL">Manual</option><option value="CERTIFICATE">Certificate</option><option value="CONTRACT">Contract</option><option value="PHOTO">Photo</option><option value="OTHER">Other</option></select></div>
            <div className="field"><label htmlFor="doc-asset">Linked asset</label><select id="doc-asset" name="assetId" disabled={loading}><option value="">Whole home</option>{assets.map((asset) => <option key={asset.id} value={asset.id}>{asset.name}</option>)}</select></div>
            <div className="field"><label htmlFor="doc-description">Description</label><textarea id="doc-description" name="description" disabled={loading} /></div>
            <div className="field"><label htmlFor="doc-date">Document date</label><input id="doc-date" name="documentDate" type="date" disabled={loading} /></div>
            <div className="field"><label htmlFor="doc-expiry">Expiry date</label><input id="doc-expiry" name="expiryDate" type="date" disabled={loading} /></div>
            <div className="field"><label htmlFor="doc-tags">Tags</label><input id="doc-tags" name="tags" placeholder="Kitchen, Warranty, 2026" disabled={loading} maxLength={500} /></div>
            <div className="field">
              <label htmlFor="doc-file">File · any format up to 10 MB</label>
              <label className="upload-dropzone" htmlFor="doc-file"><FileText size={22} /><span><strong>{selectedFile || "Choose a file from your device"}</strong><small>Files remain private and require home access.</small></span><b>{selectedFile ? "Change" : "Browse"}</b></label>
              <input className="file-input" id="doc-file" name="file" type="file" required disabled={loading} onChange={(event) => setSelectedFile(event.target.files?.[0]?.name ?? "")} />
            </div>
            <button className="button button-large" disabled={loading || !homeId} type="submit">{loading ? <LoaderCircle className="button-spinner" size={18} /> : <Plus size={18} />}{loading ? "Uploading securely…" : "Upload securely"}</button>
          </form>
        )}

        <section className="dash-card document-library">
          <div className="dash-card-head"><h2>Private vault</h2><span>{documents.length}</span></div>
          <div className="animated-list">
            {documents.map((document) =>
              editingId === document.id ? (
                <form className="auth-form compact-form" key={document.id} onSubmit={(event) => void saveDocument(event, document)}>
                  <div className="dash-card-head"><h2>Edit document</h2><button className="icon-action" type="button" aria-label="Cancel document editing" onClick={() => setEditingId("")}><X size={16} /></button></div>
                  <div className="field"><label htmlFor={`document-title-${document.id}`}>Title</label><input id={`document-title-${document.id}`} name="title" defaultValue={document.title} required /></div>
                  <div className="field"><label htmlFor={`document-type-${document.id}`}>Category</label><select id={`document-type-${document.id}`} name="type" defaultValue={document.type}><option value="INVOICE">Invoice</option><option value="WARRANTY">Warranty</option><option value="MANUAL">Manual</option><option value="CERTIFICATE">Certificate</option><option value="CONTRACT">Contract</option><option value="PHOTO">Photo</option><option value="OTHER">Other</option></select></div>
                  <div className="field"><label htmlFor={`document-asset-${document.id}`}>Linked asset</label><select id={`document-asset-${document.id}`} name="assetId" defaultValue={document.assetId ?? ""}><option value="">Whole home</option>{assets.map((asset) => <option key={asset.id} value={asset.id}>{asset.name}</option>)}</select></div>
                  <div className="field"><label htmlFor={`document-description-${document.id}`}>Description</label><textarea id={`document-description-${document.id}`} name="description" defaultValue={document.description ?? ""} /></div>
                  <div className="field"><label htmlFor={`document-date-${document.id}`}>Document date</label><input id={`document-date-${document.id}`} name="documentDate" type="date" defaultValue={document.documentDate ?? ""} /></div>
                  <div className="field"><label htmlFor={`document-expiry-${document.id}`}>Expiry date</label><input id={`document-expiry-${document.id}`} name="expiryDate" type="date" defaultValue={document.expiryDate ?? ""} /></div>
                  <div className="field"><label htmlFor={`document-tags-${document.id}`}>Tags</label><input id={`document-tags-${document.id}`} name="tags" defaultValue={document.tags.map((tag) => tag.name).join(", ")} /></div>
                  <div className="inline-actions"><button className="button button-small" type="submit"><Check size={15} />Save</button><button className="button button-secondary button-small" type="button" onClick={() => void archiveDocument(document)}><Archive size={15} />Archive</button></div>
                </form>
              ) : (
                <article className="dash-task document-row has-action" key={document.id}>
                  <span><FileText size={17} /></span>
                  <div>
                    <strong>{document.title}</strong>
                    <small>{document.type.toLowerCase()} · {formatSize(document.size)} · {document.documentDate || "No document date"}</small>
                    <small>{expiryLabel(document.expiryDate)}</small>
                    {document.tags.length > 0 && <span className="document-tags">{document.tags.map((tag) => <i key={tag.id}>{tag.name}</i>)}</span>}
                  </div>
                  <a className="icon-action" href={`/api/files/${document.fileId}?preview=1`} target="_blank" rel="noreferrer" aria-label={`Preview ${document.title}`}><Eye size={16} /></a>
                  <a className="icon-action" href={`/api/files/${document.fileId}`} aria-label={`Download ${document.title}`}><Download size={16} /></a>
                  {canEdit && <button className="icon-action" type="button" aria-label={`Edit ${document.title}`} onClick={() => setEditingId(document.id)}><Pencil size={16} /></button>}
                </article>
              ),
            )}
          </div>
          {!documents.length && <p className="muted-copy">No files stored for this home yet.</p>}
        </section>
      </div>
    </main>
  );
}
