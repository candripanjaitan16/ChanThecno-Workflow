import { randomBytes } from "node:crypto";
import { writeFile } from "node:fs/promises";
const secret = () => randomBytes(32).toString("hex");
try {
  await writeFile(
    ".env",
    `DATABASE_URL=\nENCRYPTION_KEY=${secret()}\nAUTH_SECRET=${secret()}\nADMIN_PASSWORD=\nCRON_SECRET=${secret()}\nOUTBOUND_HOSTS=api.openai.com,api.anthropic.com,generativelanguage.googleapis.com,graph.facebook.com\n`,
    { flag: "wx", mode: 0o600 },
  );
  console.log(
    "Created .env with random secrets. Set ADMIN_PASSWORD to at least 12 characters before starting.",
  );
} catch (e) {
  if (e.code === "EEXIST") console.log(".env already exists; nothing changed.");
  else throw e;
}
