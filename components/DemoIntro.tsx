"use client";

import { useEffect, useState } from "react";
import { ArrowRight, FileUp, MousePointer2 } from "lucide-react";
import { Interviewer } from "./character/Interviewer";
import { ProgressBar } from "./ProgressBar";
import { demoChimeReady, unlockDemoChime, useDemoProgressChime } from "@/lib/demo-chime";
import { seedReplay } from "@/lib/replay";

const titles = ["CV", "Posisi", "Kecocokan", "Pengaturan"];
const duration = 3100;

export function DemoIntro({ onFinish }: { onFinish: () => void }) {
  const [started, setStarted] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const step = Math.min(3, Math.floor(elapsed / duration));
  const offset = elapsed % duration;
  const percent = (step + (offset >= 2200 ? 1 : 0)) * 25;
  useDemoProgressChime(percent);
  const company = seedReplay.session.company;
  useEffect(() => {
    if (demoChimeReady()) setStarted(true);
  }, []);
  useEffect(() => {
    if (!started) return;
    const start = performance.now();
    const timer = window.setInterval(() => {
      const next = performance.now() - start;
      if (next >= 4 * duration) { window.clearInterval(timer); onFinish(); }
      else setElapsed(next);
    }, 85);
    return () => window.clearInterval(timer);
  }, [onFinish, started]);

  return <section className="setup-form setup-wizard demo-wizard" aria-label="Simulasi persiapan wawancara">
    <ProgressBar label="Progres persiapan demo" value={percent}/>
    <div className="wizard-guide">
      <Interviewer/>
      <div><h2>{titles[step]}</h2><p>{[
        "Rania mengunggah CV untuk latihan ini.",
        "Rania mengisi nama perusahaan dan memilih PDF lowongan.",
        "ngblu meninjau syarat posisi dan bukti yang ada di CV.",
        "Rania memilih Bahasa Indonesia dan masuk ke ruang wawancara.",
      ][step]}</p></div>
    </div>
    <div className="demo-scene" key={step}>
      {step === 0 && <div className="upload-tile demo-upload"><FileUp size={24}/><strong>{offset > 800 ? "CV Rania Putri · cv.pdf" : "Pilih CV (PDF)"}</strong><small>{offset > 800 ? "PDF berhasil dipilih" : "Unggah atau tarik PDF"}</small><Cursor visible={started && offset < 1550}/></div>}
      {step === 1 && <div className="wizard-inputs">
        <div className="demo-input-target"><label>Perusahaan atau organisasi<input readOnly value={company.slice(0, Math.max(0, Math.floor((offset - 500) / 45)))}/></label><Cursor visible={offset < 1250}/></div>
        <div className="upload-tile demo-upload"><FileUp size={22}/><strong>{offset > 1700 ? "Management Trainee · posting.pdf" : "Pilih PDF lowongan"}</strong><Cursor visible={offset >= 1250 && offset < 2300}/></div>
      </div>}
      {step === 2 && <div className="match-card"><h3>Kecocokan CV untuk Management Trainee</h3><p>CV mencatat pengalaman membuat laporan stok, tetapi belum mencantumkan pengalaman rotasi antardivisi.</p></div>}
      {step === 3 && <div className="wizard-inputs"><label>Bahasa wawancara<input readOnly value="Bahasa Indonesia"/></label><label>Efek kesadaran<input readOnly value="Penuh"/></label></div>}
      <div className="wizard-footer demo-footer">
        {started ? <button type="button" className="demo-link" onClick={onFinish}>Langsung ke wawancara</button>
          : <button type="button" className="demo-link" onClick={() => { unlockDemoChime(); setStarted(true); }}>Mulai demo bersuara</button>}
        <span className="primary">{["Lanjut", "Cek kecocokan", "Atur latihan", "Mulai wawancara"][step]} <ArrowRight size={17}/><Cursor visible={offset > (step === 1 ? 2300 : 1500)}/></span>
      </div>
    </div>
  </section>;
}

function Cursor({ visible }: { visible: boolean }) {
  return visible ? <span className="demo-cursor" aria-hidden><MousePointer2 size={24} fill="currentColor" stroke="white"/></span> : null;
}
