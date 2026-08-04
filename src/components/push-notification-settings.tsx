"use client";

import { useEffect, useState } from "react";
import {
  BellRing,
  Check,
  LoaderCircle,
  Send,
  Smartphone,
  X,
} from "lucide-react";

function applicationServerKey(value: string) {
  const padding = "=".repeat((4 - (value.length % 4)) % 4);
  const base64 = (value + padding).replaceAll("-", "+").replaceAll("_", "/");
  const binary = window.atob(base64);
  return Uint8Array.from(binary, (character) => character.charCodeAt(0));
}

export function PushNotificationSettings() {
  const [supported, setSupported] = useState(false);
  const [configured, setConfigured] = useState(false);
  const [publicKey, setPublicKey] = useState("");
  const [deviceSubscribed, setDeviceSubscribed] = useState(false);
  const [subscriptionCount, setSubscriptionCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  async function currentSubscription() {
    const registration = await navigator.serviceWorker.register("/sw.js");
    await navigator.serviceWorker.ready;
    return registration.pushManager.getSubscription();
  }

  async function load() {
    const browserSupported =
      "serviceWorker" in navigator &&
      "PushManager" in window &&
      "Notification" in window;
    setSupported(browserSupported);
    const response = await fetch("/api/push/subscriptions");
    const payload = await response.json();
    setConfigured(Boolean(payload.configured));
    setPublicKey(payload.publicKey ?? "");
    setSubscriptionCount(payload.subscriptionCount ?? 0);
    if (browserSupported) {
      const subscription = await currentSubscription();
      setDeviceSubscribed(Boolean(subscription));
    }
  }

  useEffect(() => {
    void load();
  }, []);

  async function enable() {
    setLoading(true);
    setError("");
    setMessage("");
    try {
      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        setError("Notification permission was not granted for this browser.");
        return;
      }
      const registration = await navigator.serviceWorker.register("/sw.js");
      await navigator.serviceWorker.ready;
      const existing = await registration.pushManager.getSubscription();
      const subscription =
        existing ??
        (await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: applicationServerKey(publicKey),
        }));
      const json = subscription.toJSON();
      if (!json.endpoint || !json.keys?.p256dh || !json.keys.auth) {
        throw new Error("The browser returned an incomplete push subscription.");
      }
      const response = await fetch("/api/push/subscriptions", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ endpoint: json.endpoint, keys: json.keys }),
      });
      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload.error?.message ?? "Could not register this device.");
      }
      setDeviceSubscribed(true);
      setMessage("This device will receive Homi reminders.");
      await load();
    } catch (nextError) {
      setError(
        nextError instanceof Error
          ? nextError.message
          : "Could not enable push notifications.",
      );
    } finally {
      setLoading(false);
    }
  }

  async function disable() {
    setLoading(true);
    setError("");
    setMessage("");
    try {
      const subscription = await currentSubscription();
      if (subscription) {
        await fetch("/api/push/subscriptions", {
          method: "DELETE",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ endpoint: subscription.endpoint }),
        });
        await subscription.unsubscribe();
      }
      setDeviceSubscribed(false);
      setMessage("Push notifications were disabled on this device.");
      await load();
    } catch (nextError) {
      setError(
        nextError instanceof Error
          ? nextError.message
          : "Could not disable push notifications.",
      );
    } finally {
      setLoading(false);
    }
  }

  async function sendTest() {
    setLoading(true);
    setError("");
    setMessage("");
    try {
      const response = await fetch("/api/push/test", { method: "POST" });
      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload.error?.message ?? "The test could not be delivered.");
      }
      setMessage("Test sent. It may appear after you leave this tab.");
    } catch (nextError) {
      setError(
        nextError instanceof Error
          ? nextError.message
          : "The test could not be delivered.",
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="dash-card push-settings-card">
      <div className="dash-card-head">
        <div>
          <small>Browser delivery</small>
          <h2>Web Push</h2>
        </div>
        <BellRing size={18} />
      </div>
      <p className="muted-copy">
        Receive maintenance, warranty, and document reminders even when Homi is
        not open. Each browser is registered independently and can be removed
        at any time.
      </p>
      <div className="push-device-status">
        <span className={deviceSubscribed ? "active" : ""}>
          <Smartphone size={17} />
        </span>
        <div>
          <strong>
            {deviceSubscribed ? "This device is connected" : "This device is off"}
          </strong>
          <small>
            {subscriptionCount} active device{subscriptionCount === 1 ? "" : "s"}
          </small>
        </div>
      </div>
      {!supported && (
        <p className="form-error" role="alert">
          This browser does not expose the Web Push APIs required by Homi.
        </p>
      )}
      {supported && !configured && (
        <p className="form-error" role="alert">
          Add the VAPID environment variables to this Homi installation before
          registering devices.
        </p>
      )}
      <div className="inline-actions">
        {deviceSubscribed ? (
          <button
            className="button button-secondary"
            type="button"
            disabled={loading}
            onClick={() => void disable()}
          >
            {loading ? (
              <LoaderCircle className="button-spinner" size={16} />
            ) : (
              <X size={16} />
            )}
            Disable this device
          </button>
        ) : (
          <button
            className="button"
            type="button"
            disabled={!supported || !configured || loading}
            onClick={() => void enable()}
          >
            {loading ? (
              <LoaderCircle className="button-spinner" size={16} />
            ) : (
              <Check size={16} />
            )}
            Enable on this device
          </button>
        )}
        {deviceSubscribed && (
          <button
            className="button button-secondary"
            type="button"
            disabled={loading}
            onClick={() => void sendTest()}
          >
            <Send size={16} />
            Send test
          </button>
        )}
      </div>
      {message && (
        <p className="form-success" role="status">
          {message}
        </p>
      )}
      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}
    </section>
  );
}
