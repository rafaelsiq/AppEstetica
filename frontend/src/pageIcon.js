let pageIconRequest = 0;

function setPageIcon(href, type) {
  document.querySelectorAll("link[rel='icon'], link[rel='shortcut icon']").forEach((node) => node.remove());
  const link = document.createElement("link");
  link.rel = "icon";
  link.type = type;
  link.href = href;
  document.head.appendChild(link);
}

export function applyClinicIcon(dataUrl) {
  const request = ++pageIconRequest;
  if (!String(dataUrl || "").startsWith("data:image/")) {
    setPageIcon("/icon.svg", "image/svg+xml");
    return;
  }
  const image = new Image();
  image.onload = () => {
    if (request !== pageIconRequest) {
      return;
    }
    const size = 64;
    const canvas = document.createElement("canvas");
    canvas.width = size;
    canvas.height = size;
    const context = canvas.getContext("2d");
    context.clearRect(0, 0, size, size);
    const scale = Math.min(size / image.naturalWidth, size / image.naturalHeight);
    const width = image.naturalWidth * scale;
    const height = image.naturalHeight * scale;
    context.drawImage(image, (size - width) / 2, (size - height) / 2, width, height);
    setPageIcon(canvas.toDataURL("image/png"), "image/png");
  };
  image.onerror = () => {
    if (request !== pageIconRequest) {
      return;
    }
    setPageIcon("/icon.svg", "image/svg+xml");
  };
  image.src = dataUrl;
}
