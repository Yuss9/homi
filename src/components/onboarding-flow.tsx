"use client";
import { useEffect, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, ArrowRight, Check, House } from "lucide-react";
import Link from "next/link";
import { Brand } from "@/src/components/brand";

const steps = [
  [
    "Welcome to Homi",
    "A few calm steps will give your home a useful place to live.",
  ],
  [
    "Tell us about your home",
    "Start with the basics. Address details are always optional.",
  ],
  [
    "Add the first room",
    "Rooms keep appliances, documents, and maintenance easy to find.",
  ],
  [
    "Add something worth remembering",
    "An appliance is a good start, but any home component belongs here.",
  ],
  [
    "Put one task on a rhythm",
    "Optional: add something you would rather not remember manually.",
  ],
  [
    "Your home is ready",
    "Homi will keep the details close and bring the right work back at the right time.",
  ],
] as const;

async function jsonRequest(url: string, method: string, body: unknown) {
  const response = await fetch(url, {
    method,
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await response.json();
  if (!response.ok)
    throw new Error(data.error?.message ?? "Could not save this step.");
  return data;
}

export function OnboardingFlow({ initialStep = 0 }: { initialStep?: number }) {
  const router = useRouter();
  const [step, setStep] = useState(Math.min(initialStep, steps.length - 1));
  const [homeId, setHomeId] = useState("");
  const [assetId, setAssetId] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    void fetch("/api/homes")
      .then((response) => (response.ok ? response.json() : null))
      .then((data) => {
        if (data?.homes?.[0]?.id) setHomeId(data.homes[0].id);
      });
  }, []);

  async function saveProgress(next: number) {
    await jsonRequest("/api/onboarding/progress", "PATCH", {
      step: next,
      completed: next === steps.length - 1,
    });
    setStep(next);
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError("");
    const values = Object.fromEntries(new FormData(event.currentTarget));
    try {
      if (step === 1) {
        const data = await jsonRequest("/api/homes", "POST", {
          ...values,
          constructionYear: values.constructionYear
            ? Number(values.constructionYear)
            : undefined,
        });
        setHomeId(data.home.id);
      }
      if (step === 2)
        await jsonRequest("/api/rooms", "POST", { ...values, homeId });
      if (step === 3) {
        const data = await jsonRequest("/api/assets", "POST", {
          ...values,
          homeId,
        });
        setAssetId(data.asset.id);
      }
      if (step === 4)
        await jsonRequest("/api/tasks", "POST", {
          ...values,
          homeId,
          assetId: assetId || undefined,
          frequencyInterval: Number(values.frequencyInterval || 1),
          nextDueAt: new Date(String(values.nextDueAt)).toISOString(),
        });
      await saveProgress(Math.min(step + 1, steps.length - 1));
    } catch (caught) {
      setError(
        caught instanceof Error ? caught.message : "Could not save this step.",
      );
    } finally {
      setLoading(false);
    }
  }

  const [title, description] = steps[step];
  return (
    <main id="main" className="onboarding">
      <header className="onboarding-top">
        <Link href="/">
          <Brand connected />
        </Link>
        <div className="progress-wrap">
          <span>
            Step {step + 1} of {steps.length}
          </span>
          <div className="progress-track">
            <i style={{ width: `${((step + 1) / steps.length) * 100}%` }} />
          </div>
        </div>
      </header>
      <div className="onboarding-main">
        <section className="onboarding-step" key={step}>
          <small>
            {step === 0
              ? "LET’S BEGIN"
              : step === steps.length - 1
                ? "ALL SET"
                : "YOUR HOME"}
          </small>
          <h1>{title}</h1>
          <p>{description}</p>
          {step === 0 && (
            <div>
              <div className="dash-status">
                <span className="status-orb">
                  <House size={24} />
                </span>
                <div>
                  <h2>About five minutes</h2>
                  <p>
                    You can skip optional details and change everything later.
                  </p>
                </div>
              </div>
              <div className="onboarding-actions">
                <span></span>
                <button
                  className="button button-large"
                  onClick={() => void saveProgress(1)}
                >
                  Begin <ArrowRight size={17} />
                </button>
              </div>
            </div>
          )}
          {step === 1 && (
            <form className="onboarding-form" onSubmit={submit}>
              <div className="field wide">
                <label htmlFor="homeName">Home name</label>
                <input
                  id="homeName"
                  name="name"
                  placeholder="Cedar House"
                  required
                />
              </div>
              <div className="field">
                <label htmlFor="type">Home type</label>
                <select id="type" name="type" defaultValue="HOUSE">
                  <option value="HOUSE">House</option>
                  <option value="APARTMENT">Apartment</option>
                  <option value="OTHER">Other</option>
                </select>
              </div>
              <div className="field">
                <label htmlFor="year">Construction year</label>
                <input
                  id="year"
                  name="constructionYear"
                  inputMode="numeric"
                  placeholder="2018"
                />
              </div>
              <div className="field">
                <label htmlFor="city">City (optional)</label>
                <input id="city" name="city" autoComplete="address-level2" />
              </div>
              <div className="field">
                <label htmlFor="timezone">Timezone</label>
                <input
                  id="timezone"
                  name="timezone"
                  defaultValue={
                    Intl.DateTimeFormat().resolvedOptions().timeZone
                  }
                  required
                />
              </div>
              <Actions
                step={step}
                loading={loading}
                error={error}
                back={() => setStep(step - 1)}
              />
            </form>
          )}
          {step === 2 && (
            <form className="onboarding-form" onSubmit={submit}>
              <div className="field wide">
                <label htmlFor="roomName">Room name</label>
                <input
                  id="roomName"
                  name="name"
                  placeholder="Kitchen"
                  required
                />
              </div>
              <div className="field">
                <label htmlFor="floor">Floor (optional)</label>
                <input id="floor" name="floor" placeholder="Ground floor" />
              </div>
              <div className="field">
                <label htmlFor="icon">Label (optional)</label>
                <input id="icon" name="icon" placeholder="Cooking" />
              </div>
              <Actions
                step={step}
                loading={loading}
                error={error}
                back={() => setStep(step - 1)}
                skip={() => void saveProgress(step + 1)}
              />
            </form>
          )}
          {step === 3 && (
            <form className="onboarding-form" onSubmit={submit}>
              <div className="field wide">
                <label htmlFor="assetName">Asset name</label>
                <input
                  id="assetName"
                  name="name"
                  placeholder="Dishwasher"
                  required
                />
              </div>
              <div className="field">
                <label htmlFor="category">Category</label>
                <select id="category" name="category">
                  <option>Kitchen appliance</option>
                  <option>Heating</option>
                  <option>Plumbing</option>
                  <option>Electrical</option>
                  <option>Smart home</option>
                  <option>Furniture</option>
                  <option>Other</option>
                </select>
              </div>
              <div className="field">
                <label htmlFor="brand">Brand</label>
                <input id="brand" name="brand" placeholder="Miele" />
              </div>
              <div className="field">
                <label htmlFor="model">Model</label>
                <input id="model" name="model" />
              </div>
              <div className="field">
                <label htmlFor="serial">Serial number</label>
                <input id="serial" name="serialNumber" />
              </div>
              <Actions
                step={step}
                loading={loading}
                error={error}
                back={() => setStep(step - 1)}
                skip={() => void saveProgress(step + 1)}
              />
            </form>
          )}
          {step === 4 && (
            <form className="onboarding-form" onSubmit={submit}>
              <div className="field wide">
                <label htmlFor="taskTitle">Task</label>
                <input
                  id="taskTitle"
                  name="title"
                  placeholder="Clean the filter"
                  required
                />
              </div>
              <div className="field">
                <label htmlFor="frequency">Repeat</label>
                <select
                  id="frequency"
                  name="frequencyType"
                  defaultValue="MONTHLY"
                >
                  <option value="ONCE">Once</option>
                  <option value="WEEKLY">Weekly</option>
                  <option value="MONTHLY">Monthly</option>
                  <option value="YEARLY">Yearly</option>
                  <option value="CUSTOM">Custom days</option>
                </select>
              </div>
              <div className="field">
                <label htmlFor="interval">Every</label>
                <input
                  id="interval"
                  name="frequencyInterval"
                  type="number"
                  min="1"
                  defaultValue="1"
                  required
                />
              </div>
              <div className="field">
                <label htmlFor="due">First due date</label>
                <input id="due" name="nextDueAt" type="date" required />
              </div>
              <div className="field">
                <label htmlFor="priority">Priority</label>
                <select id="priority" name="priority" defaultValue="MEDIUM">
                  <option value="LOW">Low</option>
                  <option value="MEDIUM">Medium</option>
                  <option value="HIGH">High</option>
                  <option value="CRITICAL">Critical</option>
                </select>
              </div>
              <Actions
                step={step}
                loading={loading}
                error={error}
                back={() => setStep(step - 1)}
                skip={() => void saveProgress(step + 1)}
              />
            </form>
          )}
          {step === 5 && (
            <div>
              <div className="dash-status">
                <span className="status-orb">
                  <Check size={25} />
                </span>
                <div>
                  <h2>Your journal is ready</h2>
                  <p>
                    Add details as you live with your home. Homi will keep the
                    record orderly.
                  </p>
                </div>
              </div>
              <div className="onboarding-actions">
                <button
                  className="link-button"
                  onClick={() => setStep(step - 1)}
                >
                  <ArrowLeft size={15} /> Back
                </button>
                <button
                  className="button button-large"
                  onClick={() => router.push("/dashboard")}
                >
                  Open dashboard <ArrowRight size={17} />
                </button>
              </div>
            </div>
          )}
        </section>
      </div>
    </main>
  );
}

function Actions({
  step,
  loading,
  error,
  back,
  skip,
}: {
  step: number;
  loading: boolean;
  error: string;
  back: () => void;
  skip?: () => void;
}) {
  return (
    <div className="wide">
      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}
      <div className="onboarding-actions">
        <button className="link-button" type="button" onClick={back}>
          <ArrowLeft size={15} /> Back
        </button>
        <div>
          {skip && (
            <button className="link-button" type="button" onClick={skip}>
              Skip for now
            </button>
          )}
          <button
            className="button button-large"
            type="submit"
            disabled={loading}
          >
            {loading ? "Saving…" : step === 4 ? "Finish setup" : "Continue"}{" "}
            <ArrowRight size={17} />
          </button>
        </div>
      </div>
    </div>
  );
}
