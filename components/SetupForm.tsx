"use client";

import { ArrowLeft, ArrowRight, FileUp } from "lucide-react";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { interview } from "@/lib/config";
import { documentsSchema, effectSchema, languageSchema, planSchema } from "@/lib/llm/schemas";
import { ProgressBar } from "@/components/ProgressBar";
import { documentCoverage } from "@/lib/document-coverage";
import { Interviewer } from "@/components/character/Interviewer";
import type { Documents } from "@/lib/llm/schemas";
import { useSession } from "@/lib/store";

type Fields = Partial<Record<"cv" | "posting", string>>;

export function SetupForm() {
  const router = useRouter();
  const prepare = useSession(state => state.prepare);
  const [step, setStep] = useState(1);
  const [documents, setDocuments] = useState<Documents>();
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");
  const [fields, setFields] = useState<Fields>({});

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (status) return;
    const form = new FormData(event.currentTarget);
    const company = String(form.get("company") ?? "").trim();
    setFields({});
    setError("");
    function hasDocument(key: "cv" | "posting") {
      const file = form.get(key);
      return !!String(form.get(key + "Text") ?? "").trim() || (file instanceof File && file.size > 0);
    }
    if (step === 1) {
      if (hasDocument("cv")) setStep(2);
      else setError("Unggah PDF atau tempel teks CV untuk melanjutkan.");
      return;
    }
    if (step === 3) {
      setStep(4);
      return;
    }
    if (step === 2) {
      if (!company) { setError("Isi nama perusahaan atau organisasi."); return; }
      if (!hasDocument("posting")) { setError("Unggah PDF atau tempel deskripsi posisi."); return; }
      setStatus("Membaca CV dan deskripsi posisi…");
      try {
      const uploads: { field: "cv" | "posting"; file: File }[] = [];
      for (const key of ["cv", "posting"] as const) {
        const file = form.get(key);
        if (String(form.get(key + "Text") ?? "").trim()) form.delete(key);
        else if (file instanceof File && file.size) {
          if (file.size >= interview.maxPdfBytes) {
            setFields({ [key]: "Ukuran PDF harus di bawah 5 MB." });
            if (key === "cv") setStep(1);
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
            setFields({ [field]: failure instanceof Error ? failure.message : "Tempel teks dokumen untuk melanjutkan." });
            if (field === "cv") setStep(1);
            throw new Error("Check the documents below.");
          }
        }
      }
      const response = await fetch("/api/parse", { method: "POST", body: form });
      const extracted = await response.json();
      if (!response.ok) {
        setFields(extracted.fields ?? {});
        if (extracted.fields?.cv) setStep(1);
        throw new Error(extracted.error);
      }
      setDocuments(documentsSchema.parse(extracted));
      setStep(3);
      } catch (failure) {
        setError(failure instanceof Error ? failure.message : "Dokumen belum bisa dibaca.");
      } finally {
        setStatus("");
      }
      return;
    }
    if (!documents) return;
    setStatus("Menyusun pertanyaan…");
    try {
      const language = languageSchema.parse(form.get("language"));
      const effect = effectSchema.parse(form.get("effect"));

      const planned = await fetch("/api/plan", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...documents, company, language }),
      });
      const plannedData = await planned.json();
      if (!planned.ok) throw new Error(plannedData.error);
      const plan = planSchema.parse(plannedData);
      setStatus("Menyiapkan audio pertanyaan…");
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

  const steps = ["CV", "Posisi", "Kecocokan", "Pengaturan"];
  const hints = [
    "Mulai dengan CV yang akan kamu pakai untuk melamar.",
    "Tambahkan posisi yang ingin kamu latih agar pertanyaannya relevan.",
    "Lihat syarat yang didukung oleh CV dan yang perlu kamu siapkan.",
    "Pilih bahasa dan efek kesadaran sebelum mulai.",
  ];
  const match = documents && step === 3 ? documentCoverage(documents) : null;

  return <form className="setup-form setup-wizard" onSubmit={submit} aria-busy={!!status} noValidate>
    <nav className="wizard-progress" aria-label="Tahapan persiapan">
      <Button className="wizard-back" aria-label="Kembali" disabled={step === 1 || !!status} onClick={() => {
        setStep(value => value - 1); setError(""); setFields({});
      }}><ArrowLeft size={20}/></Button>
      <ProgressBar label="Progres persiapan" value={step * 25}/>
      <span>{step} / 4</span>
    </nav>
    <div className="wizard-guide">
      <Interviewer/>
      <div><h2>{steps[step - 1]}</h2><p>{status || hints[step - 1]}</p></div>
    </div>
    <fieldset disabled={!!status}>
      <div hidden={step !== 1}><DocumentField name="cv" label="CV kamu" error={fields.cv}/></div>
      <div hidden={step !== 2} className="wizard-inputs">
        <label>Perusahaan atau organisasi<input name="company" placeholder="Contoh: Nusantara Foods" maxLength={100} required/></label>
        <DocumentField name="posting" label="Deskripsi posisi" error={fields.posting}/>
      </div>
      {match && <section className="match-card" aria-label="Kecocokan dokumen">
        <h3>{documents?.posting.role || "Kecocokan CV dengan posisi"}</h3>
        {match.rows.length ? <>
          <ProgressBar label="Cakupan syarat di CV" value={match.percent}/>
          <p>Cakupan syarat berdasarkan kata kunci dan bukti tertulis di CV.</p>
          <ul>{match.rows.map(row => <li key={row.requirement}>
            <div><strong>{row.requirement}</strong> <small>{row.optional ? "Nilai tambah" : "Wajib"}</small></div>
            <span className="match-status" data-match={row.status}>{({ full: "Terpenuhi", partial: "Sebagian", none: "Belum terlihat" })[row.status]}</span>
            {row.evidence && <p>{row.evidence}</p>}
          </li>)}</ul>
        </> : <p>Deskripsi ini belum mencantumkan syarat yang bisa diperiksa.</p>}
      </section>}
      <div hidden={step !== 4} className="wizard-inputs">
        <label>Bahasa wawancara<select name="language" defaultValue="id"><option value="id">Bahasa Indonesia</option><option value="en">English</option></select></label>
        <fieldset className="wizard-effects"><legend>Efek kesadaran</legend>
          <div>{[["off", "Mati", "Tanpa efek"], ["gentle", "Lembut", "Vignette ringan"], ["full", "Penuh", "Efek dan panduan napas"]].map(([value, title, hint]) =>
            <label key={value}><input type="radio" name="effect" value={value} defaultChecked={value === "gentle"}/><strong>{title}</strong><small>{hint}</small></label>)}</div>
        </fieldset>
      </div>
      <footer className="wizard-footer">
        <Button type="submit" className="primary">{["Lanjut", "Cek kecocokan", "Atur latihan", "Mulai wawancara"][step - 1]}<ArrowRight size={17}/></Button>
      </footer>
    </fieldset>
    {status && <span className="sr-only" role="status">{status}</span>}
    {error && <p className="form-error" role="alert">{error}</p>}
  </form>;

}

function DocumentField({ name, label, error }: { name: string; label: string; error?: string }) {
  const [fileName, setFileName] = useState("");
  return <div className="document-field">
    <label className="upload-tile" onDragOver={event => event.preventDefault()} onDrop={event => {
      event.preventDefault();
      const file = event.dataTransfer.files[0];
      const input = event.currentTarget.querySelector("input");
      if (!file || !input || input.disabled) return;
      const transfer = new DataTransfer();
      transfer.items.add(file);
      input.files = transfer.files;
      setFileName(file.name);
    }}>
      <FileUp size={23} aria-hidden/>
      <strong>{label}</strong>
      <span>{fileName || "Pilih atau tarik PDF di bawah 5 MB"}</span>
      <input className="sr-only" aria-label={label} name={name} type="file" accept=".pdf,application/pdf"
        onChange={event => setFileName(event.target.files?.[0]?.name ?? "")}/>
    </label>
    <details open={error ? true : undefined}>
      <summary>Tempel teks</summary>
      <label className="paste-label">Teks {label.toLowerCase()}<textarea name={name + "Text"} rows={4} maxLength={interview.maxDocumentCharacters}/></label>
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
