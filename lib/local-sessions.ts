import "server-only";
import { link, mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";

export async function saveLocalSession(session: { id: string }) {
  const folder = join(process.cwd(), ".cermin-local", "sessions");
  await mkdir(folder, { recursive: true, mode: 0o700 });
  const temporary = await mkdtemp(join(folder, ".pending-"));
  try {
    const file = join(temporary, "session.json");
    await writeFile(file, JSON.stringify(session), { mode: 0o600 });
    try {
      await link(file, join(folder, `${session.id}.json`));
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "EEXIST") throw error;
    }
  } finally {
    await rm(temporary, { recursive: true, force: true });
  }
}
