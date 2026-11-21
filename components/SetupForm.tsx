"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { interview } from "@/lib/config";
import { documentsSchema, effectSchema, languageSchema, planSchema } from "@/lib/llm/schemas";
import { useSession } from "@/lib/store";

type Fields = Partial<Record<"cv" | "posting", string>>;

export function SetupForm() {
  const router = useRouter();
  const prepare = useSession(state => state.prepare);
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");
  const [fields, setFields] = useState<Fields>({});

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (status) return;
    const form = new FormData(event.currentTarget);
    const company = String(form.get("company") ?? "").trim();
    if (!company) {
      setError("Enter the company name.");
      return;
    }
    setFields({});
    setError("");
    setStatus("Reading your documents…");

    try {
      const uploads: { field: "cv" | "posting"; file: File }[] = [];
      for (const key of ["cv", "posting"] as const) {
        const file = form.get(key);
        if (String(form.get(key + "Text") ?? "").trim()) form.delete(key);
        else if (file instanceof File && file.size) {
          if (file.size >= interview.maxPdfBytes) {
            setFields({ [key]: "The PDF must be under 5 MB." });
            throw new Error("Check the documents below.");
          }
          uploads.push({ field: key, file });
        }
      }
      if (uploads.reduce((sum, upload) => sum + upload.file.size, 0) > interview.maxCombinedUploadBytes) {
        const { readPdfText } = await import("@/lib/document-text");
        // Vercel rejects multipart requests over 4.5 MB on the default function tier.
        for (const { field, file } of uploads) {
          try {
            form.set(field + "Text", await readPdfText(file));
            form.delete(field);
          } catch (failure) {
            setFields({ [field]: failure instanceof Error ? failure.message : "Paste the document text to continue." });
            throw new Error("Check the documents below.");
          }
        }
      }
      const response = await fetch("/api/parse", { method: "POST", body: form });
      const extracted = await response.json();
      if (!response.ok) {
        setFields(extracted.fields ?? {});
        throw new Error(extracted.error);
      }
      const documents = documentsSchema.parse(extracted);
      const language = languageSchema.parse(form.get("language"));
      const effect = effectSchema.parse(form.get("effect"));
      setStatus("Writing interview questions…");
      const planned = await fetch("/api/plan", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...documents, company, language }),
      });
      const plannedData = await planned.json();
      if (!planned.ok) throw new Error(plannedData.error);
      const plan = planSchema.parse(plannedData);
      setStatus("Preparing question audio…");
      const audio: (Blob | null)[] = [];
      // The provider accepted two concurrent requests and throttled additional calls.
      for (let i = 0; i < plan.questions.length; i += 2) {
        const batch = await Promise.all(plan.questions.slice(i, i + 2).map(({ text }) => prepareAudio(text)));
        audio.push(...batch);
      }
      const id = crypto.randomUUID();
      prepare({ id, company, language, effect, documents, plan, audio, startedAt: new Date().toISOString() });
      router.push(`/interview/${id}`);
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : "Could not prepare the interview.");
      setStatus("");
    }
  }

  return <form className="setup-form" onSubmit={submit} aria-busy={!!status}>
    <fieldset disabled={!!status}>
      <div className="document-fields">
        <DocumentField name="cv" label="Your CV" error={fields.cv}/>
        <DocumentField name="posting" label="Job posting" error={fields.posting}/>
      </div>
      <label>Company<input name="company" placeholder="e.g. Nusantara Foods" maxLength={100} required/></label>
      <div className="document-fields">
        <label>Interview language<select name="language" defaultValue="id"><option value="id">Bahasa Indonesia</option><option value="en">English</option></select></label>
        <label>Awareness Effect<select name="effect" defaultValue="gentle"><option value="off">Off</option><option value="gentle">Gentle</option><option value="full">Full</option></select></label>
      </div>
      <Button type="submit" className="primary">Prepare interview</Button>
    </fieldset>
    {status && <p role="status">{status}</p>}
    {error && <p className="form-error" role="alert">{error}</p>}
  </form>;
}

function DocumentField({ name, label, error }: { name: string; label: string; error?: string }) {
  return <div className="document-field">
    <label>{label}<input name={name} type="file" accept=".pdf,application/pdf"/></label>
    <details open={error ? true : undefined}>
      <summary>Paste text instead</summary>
      <label className="paste-label">Text from {label.toLowerCase()}<textarea name={name + "Text"} rows={4} maxLength={interview.maxDocumentCharacters}/></label>
    </details>
    {error && <div className="form-error">{error}</div>}
  </div>;
}

async function prepareAudio(text: string) {
  try {
    const response = await fetch("/api/tts", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text }),
    });
    return response.ok ? await response.blob() : null;
  } catch {
    return null;
  }
}
