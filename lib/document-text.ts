import { extractText, getDocumentProxy } from "unpdf";
import { interview } from "./config";

export async function readPdfText(file: File) {
  if (file.size >= interview.maxPdfBytes) throw new Error("The PDF must be under 5 MB.");
  const bytes = new Uint8Array(await file.arrayBuffer());
  if (new TextDecoder().decode(bytes.slice(0, 5)) !== "%PDF-") throw new Error("Choose a valid PDF.");

  let text: string;
  try {
    const pdf = await getDocumentProxy(bytes);
    try {
      text = (await extractText(pdf, { mergePages: true })).text.trim();
    } finally {
      await pdf.cleanup();
    }
  } catch {
    throw new Error("This PDF could not be read. Paste its text to continue.");
  }
  if (text.length < interview.minPdfCharacters) {
    throw new Error("This PDF has too little selectable text. Paste its text to continue.");
  }
  return text.slice(0, interview.maxDocumentCharacters);
}
