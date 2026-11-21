import type { z } from "zod";
import { planSchema, type Plan, type planInput } from "./schemas";

type Input = z.infer<typeof planInput>;

function short(text: string) {
  return text.replace(/[\r\n.?!]+/g, " ").trim().split(/\s+/).slice(0, 9).join(" ").slice(0, 100);
}

export function groundedPlan({ cv, posting, company, language }: Input): Plan {
  const firstRole = cv.experience[0];
  const example = firstRole?.role || firstRole?.org || cv.projects[0]?.name || cv.education[0]?.degree;
  const skill = cv.skills[0] || cv.projects[1]?.name || firstRole?.highlights[0] || cv.education[0]?.school;
  const responsibility = posting.responsibilities[0] || posting.role;
  const requirement = posting.requirements[0] || posting.responsibilities[1] || posting.role;
  const details = [example, skill, responsibility, requirement].map(detail => detail ? short(detail) : "");
  const [cvExample, cvSkill, roleWork, roleRequirement] = details;
  const employer = short(company) || company.slice(0, 40);
  const types = ["warmup", "cv", "cv", "role", "role", "company", "behavioral"] as const;

  const pairs = language === "id" ? [
    ["Ceritakan singkat tentang diri Anda dan arah karier yang ingin Anda kejar.", "Jawaban ringkas yang relevan dengan posisi."],
    [cvExample ? `CV Anda mencantumkan “${cvExample}”. Apa kontribusi Anda dan bagaimana Anda mengukur hasilnya?` : "Pengalaman mana yang paling mempersiapkan Anda untuk posisi ini?", "Kontribusi pribadi dan hasil yang bisa dijelaskan."],
    [cvSkill ? `Berikan contoh ketika Anda menggunakan “${cvSkill}” untuk menyelesaikan masalah.` : "Keterampilan apa yang paling Anda andalkan saat menangani tugas baru?", "Satu contoh konkret tentang penggunaan keterampilan."],
    [roleWork ? `Untuk tanggung jawab “${roleWork}”, apa yang akan Anda prioritaskan pada minggu pertama?` : "Apa prioritas Anda pada minggu pertama di posisi ini?", "Prioritas dan langkah awal yang masuk akal."],
    [roleRequirement ? `Lowongan ini menyebut “${roleRequirement}”. Pengalaman apa yang menunjukkan kesiapan Anda?` : "Bagaimana Anda menunjukkan bahwa Anda siap menjalankan tanggung jawab posisi ini?", "Bukti yang berkaitan langsung dengan persyaratan."],
    [`Apa yang membuat Anda ingin bergabung dengan ${employer}, dan kontribusi apa yang ingin Anda berikan?`, "Alasan yang spesifik dan kontribusi yang realistis."],
    ["Ceritakan saat rencana tim tidak berjalan lancar. Apa situasinya, bagaimana Anda bertindak, dan apa hasilnya?", "Gunakan alur situasi, tugas, tindakan, dan hasil."],
  ] : [
    ["Tell me briefly about yourself and the direction you want to take in your career.", "A concise introduction relevant to the role."],
    [cvExample ? `Your CV mentions “${cvExample}.” What did you contribute, and how did you measure the result?` : "Which experience best prepared you for this role?", "Distinguish your own contribution and describe a concrete outcome."],
    [cvSkill ? `Give an example of when you used “${cvSkill}” to solve a problem.` : "What skill do you rely on most when taking on an unfamiliar task?", "Describe one specific example of applying a skill."],
    [roleWork ? `For “${roleWork},” what would you prioritize during your first week?` : "What would you prioritize in your first week in this role?", "Give a realistic priority and an initial action."],
    [roleRequirement ? `The posting mentions “${roleRequirement}.” What experience shows you're ready for it?` : "What experience shows you're ready for the role's responsibilities?", "Connect a concrete example to the job requirement."],
    [`What draws you to ${employer}, and what contribution would you like to make?`, "Give a specific reason to join and a realistic contribution."],
    ["Tell me about a time your team's plan fell through. What did you do, and what happened next?", "Use a situation, task, action, and result structure."],
  ];
  return planSchema.parse({
    scene_caption: language === "id" ? "Pagi hari di ruang wawancara." : "Morning in the interview room.",
    closing: language === "id" ? "Terima kasih sudah berlatih. Mari tinjau hasil wawancara Anda." : "Thank you for practicing. Let's review your interview.",
    questions: types.map((type, i) => ({ type, text: pairs[i][0], focus: pairs[i][1] })),
  });
}
