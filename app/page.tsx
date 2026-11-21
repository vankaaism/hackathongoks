import { BrandMark } from "@/components/BrandMark";
import { DemoLink } from "@/components/DemoLink";
import { SetupForm } from "@/components/SetupForm";

export default function Home() {
  return <main className="home setup-home">
    <header className="setup-header">
      <div className="brand"><BrandMark/></div>
      <DemoLink/>
    </header>
    <h1 className="wizard-title">Latihan wawancara</h1>
    <SetupForm />
  </main>;
}
