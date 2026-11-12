// Gera o .aab do app Android (TWA), assina e envia para o Google Play.
// Uso: node scripts/publicar-play.mjs [opções]
//   --faixa <internal|alpha|beta|production>  faixa do Play (padrão: internal)
//   --notas "texto"                           novidades da versão (pt-BR)
//   --rascunho                                cria a versão como rascunho no Play
//   --sem-envio                               só gera e assina o .aab
//
// Variáveis de ambiente (todas opcionais):
//   PLAY_SERVICE_ACCOUNT  JSON da conta de serviço com acesso ao Play Console
//   UPLOAD_KEY_INFO       arquivo com keystore/alias/storepass/keypass
//   JAVA_HOME             JDK 17+ (padrão: o JBR do Android Studio)
import { spawnSync } from "node:child_process";
import { createSign } from "node:crypto";
import { copyFileSync, existsSync, readFileSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const PACKAGE = "com.rafaelsiq.clinicaestetica.gestao";
const android = fileURLToPath(new URL("../android/", import.meta.url));
const gradleFile = join(android, "app", "build.gradle");
const twaFile = join(android, "twa-manifest.json");
const builtAab = join(android, "app", "build", "outputs", "bundle", "release", "app-release.aab");
const signedAab = join(android, "app-release-signed.aab");

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
let previousVersion = null;

function fail(message) {
  if (previousVersion) {
    writeFileSync(gradleFile, previousVersion.gradle);
    writeFileSync(twaFile, previousVersion.twa);
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

function javaHome() {
  const candidates = [
    process.env.JAVA_HOME,
    "C:/Program Files/Android/Android Studio/jbr",
    "/Applications/Android Studio.app/Contents/jbr/Contents/Home"
  ].filter(Boolean);
  const found = candidates.find((dir) => existsSync(join(dir, "bin", process.platform === "win32" ? "java.exe" : "java")));
  if (!found) {
    fail("Não achei um JDK 17+. Defina JAVA_HOME.");
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
    fail("Não achei versionCode em android/app/build.gradle.");
  }
  const code = Number(match[1]) + 1;
  const name = `1.0.${code}`;
  previousVersion = { gradle, twa: readFileSync(twaFile, "utf8") };
  writeFileSync(gradleFile, gradle
    .replace(/versionCode \d+/, `versionCode ${code}`)
    .replace(/versionName "[^"]*"/, `versionName "${name}"`));
  const twa = JSON.parse(readFileSync(twaFile, "utf8"));
  twa.appVersionCode = code;
  twa.appVersionName = name;
  twa.appVersion = name;
  writeFileSync(twaFile, `${JSON.stringify(twa, null, 2)}\n`);
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
  const java = javaHome();
  ensureLocalProperties();
  const env = { ...process.env, JAVA_HOME: java };
  const gradlew = process.platform === "win32" ? `"${join(android, "gradlew.bat")}"` : join(android, "gradlew");
  run(gradlew, ["bundleRelease", "--no-daemon", "-q"], { cwd: android, env, shell: process.platform === "win32" });
  copyFileSync(builtAab, signedAab);
  const key = readKeyInfo();
  const jarsigner = join(java, "bin", process.platform === "win32" ? "jarsigner.exe" : "jarsigner");
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
  if (/package not found|not found/i.test(error.message)) {
    fail(`O Play não aceitou o envio pela API (${error.message}).\nFaça o primeiro envio arrastando ${signedAab} em Teste interno > Criar versão.`);
  }
  fail(`Falha no envio: ${error.message}`);
}
