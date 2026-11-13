import { Capacitor } from "@capacitor/core";
import { Directory, Filesystem } from "@capacitor/filesystem";
import { Share } from "@capacitor/share";

function blobToBase64(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result).split(",")[1] || "");
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
}

function downloadInBrowser(blob, filename) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 4000);
}

// No navegador baixa o arquivo. No app Android o WebView não baixa arquivos,
// então grava no cache do app e abre o compartilhamento do Android
// (salvar no Drive/Arquivos, enviar pelo WhatsApp etc.).
// Retorna "downloaded", "shared" ou "canceled".
export async function saveFile(blob, filename, title = filename) {
  if (!Capacitor.isNativePlatform()) {
    downloadInBrowser(blob, filename);
    return "downloaded";
  }
  const { uri } = await Filesystem.writeFile({
    path: filename,
    data: await blobToBase64(blob),
    directory: Directory.Cache
  });
  try {
    await Share.share({ title, dialogTitle: title, files: [uri] });
    return "shared";
  } catch (error) {
    if (/cancel/i.test(String(error?.message || error))) {
      return "canceled";
    }
    throw error;
  }
}
