import Link from "next/link";
import { AudioLines } from "lucide-react";

import { SetupForm } from "@/components/SetupForm";

export default function Home() {
  return <main className="home">
    <div className="brand"><AudioLines size={22} /> Cermin</div>
    <h1>Rehearse your next interview.</h1>
    <p>Practice with Ms. Alina, then review where you hesitated and where your answers landed.</p>
    <SetupForm />
    <Link className="preview-link" href="/replay" prefetch={false}>Play the 90-second offline demo</Link>
  </main>;
}
