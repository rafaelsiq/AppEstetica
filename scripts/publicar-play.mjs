// Gera o .aab do app Android (React + Capacitor), assina e envia para o Google Play.
// O build do React (frontend/dist) vai dentro do app.
// Uso: node scripts/publicar-play.mjs [opções]
//   --faixa <internal|alpha|beta|production>  faixa do Play (padrão: internal)
//   --notas "texto"                           novidades da versão (pt-BR)
//   --rascunho                                cria a versão como rascunho no Play
//   --sem-envio                               só gera e assina o .aab
//
// Variáveis de ambiente (todas opcionais):
//   PLAY_SERVICE_ACCOUNT  JSON da conta de serviço com acesso ao Play Console
//   UPLOAD_KEY_INFO       arquivo com keystore/alias/storepass/keypass
//   JAVA_HOME             JDK 21+
import { spawnSync } from "node:child_process";
import { createSign } from "node:crypto";
import { copyFileSync, existsSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const PACKAGE = "com.rafaelsiq.clinicaestetica.gestao";
const frontend = fileURLToPath(new URL("../frontend/", import.meta.url));
const android = join(frontend, "android");
const gradleFile = join(android, "app", "build.gradle");
const builtAab = join(android, "app", "build", "outputs", "bundle", "release", "app-release.aab");
const signedAab = join(android, "app-release-signed.aab");
const windows = process.platform === "win32";

const args = process.argv.slice(2);
const flag = (name) => args.includes(name);
const option = (name, fallback) => {
  const index = args.indexOf(name);
  return index >= 0 && args[index + 1] ? args[index + 1] : fallback;
};
const track = option("--faixa", "internal");
const notes = option("--notas", "");
const draft = flag("--rascunho");
const skipUpload = flag("--sem-envio");

const serviceAccountPath = process.env.PLAY_SERVICE_ACCOUNT
  || "C:/Users/Rafael/.nia/project-5545d2f0-df5e-48d7-a78-e8692c3fd142.json";
const keyInfoPath = process.env.UPLOAD_KEY_INFO
  || join(homedir(), ".android-keys", "estetica-gestao-upload.txt");

// Se o build ou o envio falhar, volta o número da versão para a próxima tentativa reaproveitar.
let previousGradle = null;

function fail(message) {
  if (previousGradle) {
    writeFileSync(gradleFile, previousGradle);
  }
  console.error(`\n${message}`);
  process.exit(1);
}

function run(command, commandArgs, options = {}) {
  const result = spawnSync(command, commandArgs, { stdio: "inherit", ...options });
  if (result.status !== 0) {
    fail(`Falhou: ${command} ${commandArgs.filter((arg) => !String(arg).includes("pass")).join(" ")}`);
  }
}

function javaMajor(dir) {
  const java = join(dir, "bin", windows ? "java.exe" : "java");
  if (!existsSync(java)) {
    return 0;
  }
  const result = spawnSync(java, ["-version"], { encoding: "utf8" });
  const match = String(result.stderr || result.stdout).match(/version "(\d+)/);
  return match ? Number(match[1]) : 0;
}

function javaHome() {
  const roots = ["C:/Program Files/Java", "C:/Program Files/Eclipse Adoptium", "D:/Program Files/Java"];
  const candidates = [
    process.env.JAVA_HOME,
    "C:/Program Files/Android/Android Studio/jbr",
    "/Applications/Android Studio.app/Contents/jbr/Contents/Home",
    ...roots.filter(existsSync).flatMap((root) => readdirSync(root).map((name) => join(root, name)))
  ].filter(Boolean);
  // Capacitor 8 pede JDK 21+; Gradle 8.14 roda até o 24.
  const found = candidates.find((dir) => {
    const major = javaMajor(dir);
    return major >= 21 && major <= 24;
  });
  if (!found) {
    fail("Não achei um JDK entre 21 e 24. Defina JAVA_HOME.");
  }
  return found;
}

function ensureLocalProperties() {
  const file = join(android, "local.properties");
  if (existsSync(file)) {
    return;
  }
  const sdk = process.env.ANDROID_HOME || process.env.ANDROID_SDK_ROOT
    || (process.env.LOCALAPPDATA && join(process.env.LOCALAPPDATA, "Android", "Sdk"));
  if (!sdk || !existsSync(sdk)) {
    fail("Não achei o Android SDK. Defina ANDROID_HOME.");
  }
  writeFileSync(file, `sdk.dir=${sdk.replace(/\\/g, "/").replace(/:/g, "\\:")}\n`);
}

function bumpVersion() {
  const gradle = readFileSync(gradleFile, "utf8");
  const match = gradle.match(/versionCode (\d+)/);
  if (!match) {
    fail("Não achei versionCode em frontend/android/app/build.gradle.");
  }
  const code = Number(match[1]) + 1;
  const name = `1.0.${code}`;
  previousGradle = gradle;
  writeFileSync(gradleFile, gradle
    .replace(/versionCode \d+/, `versionCode ${code}`)
    .replace(/versionName "[^"]*"/, `versionName "${name}"`));
  return { code, name };
}

function readKeyInfo() {
  if (!existsSync(keyInfoPath)) {
    fail(`Não achei ${keyInfoPath} (keystore de upload).`);
  }
  const info = Object.fromEntries(readFileSync(keyInfoPath, "utf8")
    .split(/\r?\n/)
    .filter((line) => line.includes("="))
    .map((line) => [line.slice(0, line.indexOf("=")), line.slice(line.indexOf("=") + 1)]));
  if (!info.keystore || !info.storepass || !existsSync(info.keystore)) {
    fail(`Arquivo de chave inválido: ${keyInfoPath}`);
  }
  return { alias: "upload", keypass: info.storepass, ...info };
}

function buildAndSign() {
  if (!existsSync(join(android, "app", "google-services.json"))) {
    fail("Falta frontend/android/app/google-services.json (Firebase → app Android).");
  }
  const npm = windows ? "npm.cmd" : "npm";
  const npx = windows ? "npx.cmd" : "npx";
  run(npm, ["run", "build"], { cwd: frontend, shell: windows });
  run(npx, ["cap", "sync", "android"], { cwd: frontend, shell: windows });

  const java = javaHome();
  ensureLocalProperties();
  const env = { ...process.env, JAVA_HOME: java };
  const gradlew = windows ? `"${join(android, "gradlew.bat")}"` : join(android, "gradlew");
  run(gradlew, ["bundleRelease", "--no-daemon", "-q"], { cwd: android, env, shell: windows });
  copyFileSync(builtAab, signedAab);

  const key = readKeyInfo();
  const jarsigner = join(java, "bin", windows ? "jarsigner.exe" : "jarsigner");
  run(jarsigner, [
    "-keystore", key.keystore,
    "-storepass", key.storepass,
    "-keypass", key.keypass,
    "-sigalg", "SHA256withRSA",
    "-digestalg", "SHA-256",
    signedAab,
    key.alias
  ], { stdio: ["ignore", "ignore", "inherit"] });
}

async function accessToken() {
  if (!existsSync(serviceAccountPath)) {
    fail(`Não achei a conta de serviço: ${serviceAccountPath}`);
  }
  const account = JSON.parse(readFileSync(serviceAccountPath, "utf8"));
  const now = Math.floor(Date.now() / 1000);
  const encode = (value) => Buffer.from(JSON.stringify(value)).toString("base64url");
  const unsigned = `${encode({ alg: "RS256", typ: "JWT" })}.${encode({
    iss: account.client_email,
    scope: "https://www.googleapis.com/auth/androidpublisher",
    aud: account.token_uri,
    iat: now,
    exp: now + 3600
  })}`;
  const signature = createSign("RSA-SHA256").update(unsigned).sign(account.private_key, "base64url");
  const response = await fetch(account.token_uri, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion: `${unsigned}.${signature}`
    })
  });
  const data = await response.json();
  if (!response.ok) {
    fail(`Falha ao autenticar a conta de serviço: ${JSON.stringify(data)}`);
  }
  return data.access_token;
}

const API = `https://androidpublisher.googleapis.com/androidpublisher/v3/applications/${PACKAGE}`;
const UPLOAD = `https://androidpublisher.googleapis.com/upload/androidpublisher/v3/applications/${PACKAGE}`;

async function call(token, method, url, body, contentType = "application/json") {
  const response = await fetch(url, {
    method,
    headers: { Authorization: `Bearer ${token}`, "Content-Type": contentType },
    body: body === undefined ? undefined : (contentType === "application/json" ? JSON.stringify(body) : body)
  });
  const text = await response.text();
  const data = text ? JSON.parse(text) : {};
  if (!response.ok) {
    const error = new Error(data.error?.message || text);
    error.status = response.status;
    throw error;
  }
  return data;
}

async function upload(versionName) {
  const token = await accessToken();
  const edit = await call(token, "POST", `${API}/edits`, {});
  console.log(`\nEnviando ${signedAab}…`);
  const bundle = await call(token, "POST", `${UPLOAD}/edits/${edit.id}/bundles?uploadType=media`,
    readFileSync(signedAab), "application/octet-stream");
  const release = (status) => ({
    track,
    releases: [{
      name: versionName,
      versionCodes: [String(bundle.versionCode)],
      status,
      ...(notes ? { releaseNotes: [{ language: "pt-BR", text: notes }] } : {})
    }]
  });
  let status = draft ? "draft" : "completed";
  try {
    await call(token, "PUT", `${API}/edits/${edit.id}/tracks/${track}`, release(status));
    await call(token, "POST", `${API}/edits/${edit.id}:commit`);
  } catch (error) {
    if (status === "draft" || !/draft app/i.test(error.message)) {
      throw error;
    }
    // App ainda não publicado: o Play só aceita versões em rascunho.
    status = "draft";
    await call(token, "PUT", `${API}/edits/${edit.id}/tracks/${track}`, release(status));
    await call(token, "POST", `${API}/edits/${edit.id}:commit`);
  }
  return { versionCode: bundle.versionCode, status };
}

const version = bumpVersion();
console.log(`Versão ${version.name} (código ${version.code})`);
buildAndSign();
console.log(`\n.aab assinado: ${signedAab}`);

if (skipUpload) {
  process.exit(0);
}

try {
  const result = await upload(version.name);
  console.log(`\nEnviado para a faixa "${track}" (código ${result.versionCode}, status ${result.status}).`);
  if (result.status === "draft") {
    console.log("O app ainda está em rascunho no Play: finalize o lançamento em Play Console > Testar e lançar.");
  }
} catch (error) {
  if ((error.status === 403 || error.status === 401) && /permission|caller does not have/i.test(error.message)) {
    fail(`Sem permissão no Play Console (${error.message}).\nConvide a conta de serviço em Usuários e permissões com acesso a este app.`);
  }
  fail(`Falha no envio: ${error.message}`);
}
