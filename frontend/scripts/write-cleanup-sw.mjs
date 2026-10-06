import { readdir, readFile, rm, writeFile } from "node:fs/promises";

const dist = new URL("../dist/", import.meta.url);
const serviceWorker = await readFile(new URL("../public/sw.js", import.meta.url));
await writeFile(new URL("sw.js", dist), serviceWorker);

const generated = await readdir(dist);
await Promise.all(
  generated
    .filter((name) => name.startsWith("workbox-"))
    .map((name) => rm(new URL(name, dist), { force: true }))
);
