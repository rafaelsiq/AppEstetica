// Publica o frontend no Firebase Hosting.
// Uso: node scripts/publicar-firebase.mjs [--regras]
//   --regras  publica também as regras e índices do Firestore.
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { existsSync } from "node:fs";

const PROJECT = "clinica-estetica-a219";
const frontend = fileURLToPath(new URL("../frontend/", import.meta.url));
const withRules = process.argv.includes("--regras");

function run(command, args) {
  console.log(`\n> ${command} ${args.join(" ")}`);
  const result = spawnSync(command, args, { cwd: frontend, stdio: "inherit", shell: process.platform === "win32" });
  if (result.status !== 0) {
    console.error(`\nFalhou: ${command} ${args.join(" ")}`);
    process.exit(result.status || 1);
  }
}

if (!existsSync(new URL("../frontend/.env", import.meta.url))) {
  console.error("Falta frontend/.env com as chaves do Firebase (veja frontend/.env.example).");
  process.exit(1);
}

if (!existsSync(new URL("../frontend/node_modules/", import.meta.url))) {
  run("npm", ["ci"]);
}
run("npm", ["run", "build"]);


const only = withRules ? "hosting,firestore" : "hosting";
run("firebase", ["deploy", "--only", only, "--project", PROJECT]);

console.log(`\nPublicado: https://${PROJECT}.web.app`);
