"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { Camera, CameraOff, Link2, LoaderCircle, Search } from "lucide-react";

type BarcodeResult = { rawValue: string; format?: string };
type Detector = { detect(source: CanvasImageSource): Promise<BarcodeResult[]> };
type DetectorConstructor = new (options?: { formats?: string[] }) => Detector;

type Home = { id: string; name: string };
type Asset = { id: string; name: string; brand?: string | null; model?: string | null };
type Match = {
  asset: Asset & { id: string };
  identifier: { barcode: string; format?: string | null };
};

export function MobileScanner() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const scanningRef = useRef(false);
  const [homes, setHomes] = useState<Home[]>([]);
  const [homeId, setHomeId] = useState("");
  const [assets, setAssets] = useState<Asset[]>([]);
  const [assetId, setAssetId] = useState("");
  const [code, setCode] = useState("");
  const [format, setFormat] = useState("");
  const [match, setMatch] = useState<Match | null>(null);
  const [cameraActive, setCameraActive] = useState(false);
  const [cameraSupported, setCameraSupported] = useState(true);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    void fetch("/api/homes")
      .then((response) => response.json())
      .then((payload) => {
        const next = payload.homes ?? [];
        setHomes(next);
        setHomeId(next[0]?.id ?? "");
      });
    return () => streamRef.current?.getTracks().forEach((track) => track.stop());
  }, []);

  useEffect(() => {
    if (!homeId) return;
    void fetch(`/api/assets?homeId=${homeId}`)
      .then((response) => response.json())
      .then((payload) => {
        setAssets(payload.assets ?? []);
        setAssetId(payload.assets?.[0]?.id ?? "");
      });
  }, [homeId]);

  async function lookup(rawCode: string, rawFormat?: string) {
    const normalized = rawCode.trim();
    if (!normalized || !homeId) return;
    setBusy(true);
    setError("");
    setMessage("");
    setCode(normalized);
    setFormat(rawFormat ?? "");
    const response = await fetch(
      `/api/assets/identifiers?homeId=${homeId}&code=${encodeURIComponent(normalized)}`,
    );
    const payload = await response.json();
    setMatch(payload.result ?? null);
    if (payload.result) setMessage(`${payload.result.asset.name} found.`);
    else setMessage("No equipment uses this code yet. Pair it below.");
    setBusy(false);
  }

  async function startCamera() {
    setError("");
    const DetectorApi = (
      window as Window & { BarcodeDetector?: DetectorConstructor }
    ).BarcodeDetector;
    if (!DetectorApi || !navigator.mediaDevices?.getUserMedia) {
      setCameraSupported(false);
      setError("Automatic barcode scanning is not supported in this browser. Enter the code manually.");
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: "environment" } },
        audio: false,
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
      setCameraActive(true);
      scanningRef.current = true;
      const detector = new DetectorApi({
        formats: [
          "aztec",
          "code_128",
          "code_39",
          "code_93",
          "data_matrix",
          "ean_13",
          "ean_8",
          "itf",
          "pdf417",
          "qr_code",
          "upc_a",
          "upc_e",
        ],
      });
      const scan = async () => {
        if (!scanningRef.current || !videoRef.current) return;
        try {
          const results = await detector.detect(videoRef.current);
          const first = results[0];
          if (first?.rawValue) {
            stopCamera();
            await lookup(first.rawValue, first.format);
            return;
          }
        } catch {
          // The next frame can still be scanned after a transient detector error.
        }
        window.setTimeout(() => void scan(), 280);
      };
      void scan();
    } catch {
      setError("Camera access was denied or no rear camera is available.");
    }
  }

  function stopCamera() {
    scanningRef.current = false;
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
    setCameraActive(false);
  }

  async function pair() {
    if (!homeId || !assetId || !code) return;
    setBusy(true);
    setError("");
    const response = await fetch("/api/assets/identifiers", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ homeId, assetId, barcode: code, format: format || undefined }),
    });
    const payload = await response.json();
    if (!response.ok) setError(payload.error?.message ?? "Could not pair this code.");
    else await lookup(code, format);
    setBusy(false);
  }

  return (
    <main id="main" className="app-main scan-workspace">
      <div className="dashboard-head">
        <div>
          <small>Camera shortcut</small>
          <h1>Scan equipment</h1>
          <p>Scan a barcode, QR code, serial label or product reference to open or pair an equipment record.</p>
        </div>
        <select value={homeId} onChange={(event) => setHomeId(event.target.value)}>
          {homes.map((home) => <option key={home.id} value={home.id}>{home.name}</option>)}
        </select>
      </div>

      {error && <p className="form-error" role="alert">{error}</p>}
      {message && <p className="form-success" role="status">{message}</p>}

      <div className="dash-grid">
        <section className="dash-card scanner-card">
          <div className="scanner-viewport">
            <video ref={videoRef} muted playsInline aria-label="Equipment barcode camera" />
            {!cameraActive && (
              <div>
                <Camera size={44} />
                <p>Point the rear camera at the equipment label.</p>
              </div>
            )}
            {cameraActive && <span className="scanner-frame" />}
          </div>
          <button
            className="button"
            type="button"
            onClick={cameraActive ? stopCamera : () => void startCamera()}
          >
            {cameraActive ? <CameraOff size={17} /> : <Camera size={17} />}
            {cameraActive ? "Stop camera" : "Start camera"}
          </button>
          {!cameraSupported && <small>Manual entry remains available below.</small>}
        </section>

        <section className="dash-card auth-form">
          <div className="dash-card-head"><h2>Code lookup</h2><Search size={17} /></div>
          <div className="field">
            <label htmlFor="scan-code">Barcode, serial or product reference</label>
            <input id="scan-code" value={code} onChange={(event) => setCode(event.target.value)} placeholder="Scan or type a code" />
          </div>
          <button className="button button-secondary" disabled={!code || busy} onClick={() => void lookup(code, format)}>
            {busy ? <LoaderCircle className="button-spinner" size={17} /> : <Search size={17} />}
            Search Homi
          </button>

          {match ? (
            <div className="scanner-match">
              <strong>{match.asset.name}</strong>
              <small>{[match.asset.brand, match.asset.model].filter(Boolean).join(" · ")}</small>
              <Link className="button" href={`/assets/${match.asset.id}`}>Open equipment</Link>
            </div>
          ) : code ? (
            <div className="scanner-pair">
              <div className="field">
                <label htmlFor="scan-asset">Pair with equipment</label>
                <select id="scan-asset" value={assetId} onChange={(event) => setAssetId(event.target.value)}>
                  {assets.map((asset) => <option key={asset.id} value={asset.id}>{asset.name}</option>)}
                </select>
              </div>
              <button className="button" disabled={!assetId || busy} onClick={() => void pair()}>
                <Link2 size={17} /> Pair code
              </button>
            </div>
          ) : null}
        </section>
      </div>
    </main>
  );
}
