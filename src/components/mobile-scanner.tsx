"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import {
  Camera,
  CameraOff,
  ImagePlus,
  Link2,
  LoaderCircle,
  Search,
} from "lucide-react";

type BarcodeResult = { rawValue: string; format?: string };
type Detector = { detect(source: CanvasImageSource): Promise<BarcodeResult[]> };
type DetectorConstructor = new (options?: { formats?: string[] }) => Detector;

type Home = { id: string; name: string };
type Asset = {
  id: string;
  name: string;
  brand?: string | null;
  model?: string | null;
};
type Match = {
  asset: Asset & { id: string };
  identifier: { barcode: string; format?: string | null };
};

function detectorApi() {
  return (window as Window & { BarcodeDetector?: DetectorConstructor })
    .BarcodeDetector;
}

function cameraErrorMessage(error: unknown) {
  if (!window.isSecureContext)
    return "Camera access needs HTTPS, or localhost during development.";
  if (error instanceof DOMException) {
    if (error.name === "NotAllowedError")
      return "Camera permission was declined. Allow camera access in your browser settings, then try again.";
    if (error.name === "NotFoundError")
      return "No camera was found on this device. You can capture a label photo or enter the code manually.";
    if (error.name === "NotReadableError")
      return "The camera is already being used by another application. Close it there and try again.";
  }
  return "The camera could not start. Capture a label photo or enter the code manually.";
}

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
  const [automaticDetection, setAutomaticDetection] = useState(true);
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
    try {
      const response = await fetch(
        `/api/assets/identifiers?homeId=${homeId}&code=${encodeURIComponent(normalized)}`,
      );
      const payload = await response.json();
      setMatch(payload.result ?? null);
      if (payload.result) setMessage(`${payload.result.asset.name} found.`);
      else setMessage("No equipment uses this code yet. Pair it below.");
    } finally {
      setBusy(false);
    }
  }

  function stopCamera() {
    scanningRef.current = false;
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
    setCameraActive(false);
  }

  async function startCamera() {
    setError("");
    setMessage("");
    if (!window.isSecureContext) {
      setError("Camera access needs HTTPS, or localhost during development.");
      return;
    }
    if (!navigator.mediaDevices?.getUserMedia) {
      setError(
        "Live camera preview is not supported here. Use Capture label instead; it opens the native phone camera.",
      );
      return;
    }

    try {
      stopCamera();
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: { ideal: "environment" },
          width: { ideal: 1280 },
          height: { ideal: 720 },
        },
        audio: false,
      });
      streamRef.current = stream;
      const video = videoRef.current;
      if (!video) throw new Error("Camera preview is unavailable.");
      video.srcObject = stream;
      await video.play();
      setCameraActive(true);
      scanningRef.current = true;

      const DetectorApi = detectorApi();
      if (!DetectorApi) {
        setAutomaticDetection(false);
        setMessage(
          "Camera ready. This browser does not support automatic barcode recognition, so you can read the label and enter its code below.",
        );
        return;
      }

      setAutomaticDetection(true);
      const detector = new DetectorApi();
      const scan = async () => {
        if (!scanningRef.current || !videoRef.current) return;
        try {
          if (videoRef.current.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA) {
            const results = await detector.detect(videoRef.current);
            const first = results[0];
            if (first?.rawValue) {
              stopCamera();
              await lookup(first.rawValue, first.format);
              return;
            }
          }
        } catch {
          // A frame can be temporarily unreadable while autofocus is moving.
        }
        window.setTimeout(() => void scan(), 280);
      };
      void scan();
    } catch (cause) {
      stopCamera();
      setError(cameraErrorMessage(cause));
    }
  }

  async function captureLabel(file: File | undefined) {
    if (!file) return;
    setError("");
    setMessage("");
    const DetectorApi = detectorApi();
    if (!DetectorApi) {
      setAutomaticDetection(false);
      setMessage(
        "The label photo was captured. Automatic recognition is unavailable in this browser; type the visible serial or barcode below.",
      );
      return;
    }

    setBusy(true);
    try {
      const bitmap = await createImageBitmap(file);
      const results = await new DetectorApi().detect(bitmap);
      bitmap.close();
      const first = results[0];
      if (!first?.rawValue) {
        setMessage(
          "No readable code was found in that photo. Try again closer to the label or type the code manually.",
        );
        return;
      }
      await lookup(first.rawValue, first.format);
    } catch {
      setError(
        "The captured image could not be read. Try again with more light or enter the code manually.",
      );
    } finally {
      setBusy(false);
    }
  }

  async function pair() {
    if (!homeId || !assetId || !code) return;
    setBusy(true);
    setError("");
    try {
      const response = await fetch("/api/assets/identifiers", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          homeId,
          assetId,
          barcode: code,
          format: format || undefined,
        }),
      });
      const payload = await response.json();
      if (!response.ok)
        setError(payload.error?.message ?? "Could not pair this code.");
      else await lookup(code, format);
    } finally {
      setBusy(false);
    }
  }

  return (
    <main id="main" className="app-main scan-workspace">
      <div className="dashboard-head">
        <div>
          <small>Camera shortcut</small>
          <h1>Scan equipment</h1>
          <p>
            Scan a barcode, QR code, serial label or product reference to open
            or pair an equipment record.
          </p>
        </div>
        <select
          value={homeId}
          aria-label="Selected home"
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
        <section className="dash-card scanner-card">
          <div className="scanner-viewport">
            <video
              ref={videoRef}
              autoPlay
              muted
              playsInline
              aria-label="Equipment barcode camera"
            />
            {!cameraActive && (
              <div>
                <Camera size={44} />
                <p>Point the rear camera at the equipment label.</p>
              </div>
            )}
            {cameraActive && <span className="scanner-frame" />}
          </div>
          <div className="inline-actions">
            <button
              className="button"
              type="button"
              onClick={cameraActive ? stopCamera : () => void startCamera()}
            >
              {cameraActive ? (
                <CameraOff size={17} />
              ) : (
                <Camera size={17} />
              )}
              {cameraActive ? "Stop camera" : "Start camera"}
            </button>
            <label className="button button-secondary camera-file-fallback">
              <ImagePlus size={17} />
              Capture label
              <input
                type="file"
                accept="image/*"
                capture="environment"
                aria-label="Capture an equipment label"
                disabled={busy}
                onChange={(event) => {
                  const file = event.target.files?.[0];
                  void captureLabel(file);
                  event.target.value = "";
                }}
              />
            </label>
          </div>
          <div className="scanner-camera-help">
            <strong>
              {automaticDetection
                ? "Automatic detection is available when your browser supports it."
                : "Live preview is available, with manual code entry as fallback."}
            </strong>
            <span>
              On iPhone or Android, Capture label uses the native rear camera
              even when live browser scanning is unavailable.
            </span>
          </div>
        </section>

        <section className="dash-card auth-form">
          <div className="dash-card-head">
            <h2>Code lookup</h2>
            <Search size={17} />
          </div>
          <div className="field">
            <label htmlFor="scan-code">
              Barcode, serial or product reference
            </label>
            <input
              id="scan-code"
              value={code}
              onChange={(event) => setCode(event.target.value)}
              placeholder="Scan or type a code"
            />
          </div>
          <button
            className="button button-secondary"
            disabled={!code || busy}
            onClick={() => void lookup(code, format)}
          >
            {busy ? (
              <LoaderCircle className="button-spinner" size={17} />
            ) : (
              <Search size={17} />
            )}
            Search Homi
          </button>

          {match ? (
            <div className="scanner-match">
              <strong>{match.asset.name}</strong>
              <small>
                {[match.asset.brand, match.asset.model]
                  .filter(Boolean)
                  .join(" · ")}
              </small>
              <Link className="button" href={`/assets/${match.asset.id}`}>
                Open equipment
              </Link>
            </div>
          ) : code ? (
            <div className="scanner-pair">
              <div className="field">
                <label htmlFor="scan-asset">Pair with equipment</label>
                <select
                  id="scan-asset"
                  value={assetId}
                  onChange={(event) => setAssetId(event.target.value)}
                >
                  {assets.map((asset) => (
                    <option key={asset.id} value={asset.id}>
                      {asset.name}
                    </option>
                  ))}
                </select>
              </div>
              <button
                className="button"
                disabled={!assetId || busy}
                onClick={() => void pair()}
              >
                <Link2 size={17} /> Pair code
              </button>
            </div>
          ) : null}
        </section>
      </div>
    </main>
  );
}
