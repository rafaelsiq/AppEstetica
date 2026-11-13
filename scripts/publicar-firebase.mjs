// Publica no Firebase: site (Hosting) e, se pedido, Cloud Functions e regras.
// Uso: node scripts/publicar-firebase.mjs [--funcoes] [--regras] [--tudo]
//   --funcoes  publica também as Cloud Functions (aviso de novo agendamento).
//              Precisa do plano Blaze no projeto.
//   --regras   publica também as regras e índices do Firestore.
//   --tudo     site, funções e regras.
//   --sem-site não publica o site (ex.: só --funcoes --sem-site).
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { existsSync } from "node:fs";

const PROJECT = "clinica-estetica-a219";
const frontend = fileURLToPath(new URL("../frontend/", import.meta.url));
const functionsDir = fileURLToPath(new URL("../frontend/functions/", import.meta.url));
const args = process.argv.slice(2);
const all = args.includes("--tudo");
const withSite = !args.includes("--sem-site");
const withFunctions = all || args.includes("--funcoes");
const withRules = all || args.includes("--regras");

function run(command, commandArgs, cwd = frontend) {
  console.log(`\n> ${command} ${commandArgs.join(" ")}`);
  const result = spawnSync(command, commandArgs, { cwd, stdio: "inherit", shell: process.platform === "win32" });
  if (result.status !== 0) {
    console.error(`\nFalhou: ${command} ${commandArgs.join(" ")}`);
    process.exit(result.status || 1);
  }
}

const targets = [
  withSite && "hosting",
  withFunctions && "functions",
  withRules && "firestore"
].filter(Boolean);
if (!targets.length) {
  console.error("Nada para publicar.");
  process.exit(1);
}

if (withSite) {
  if (!existsSync(new URL("../frontend/.env", import.meta.url))) {
    console.error("Falta frontend/.env com as chaves do Firebase (veja frontend/.env.example).");
    process.exit(1);
  }
  if (!existsSync(new URL("../frontend/node_modules/", import.meta.url))) {
    run("npm", ["ci"]);
  }
  run("npm", ["run", "build"]);
}

if (withFunctions) {
  run("npm", ["ci"], functionsDir);
}

run("firebase", ["deploy", "--only", targets.join(","), "--project", PROJECT]);

console.log(`\nPublicado (${targets.join(", ")}) em ${PROJECT}.`);
