import { useEffect, useState } from "react";
import { loadTestDeviceIds } from "./fcmTokens";

async function copyText(value) {
  if (!value) {
    return false;
  }
  try {
    await navigator.clipboard.writeText(value);
    return true;
  } catch {
    return false;
  }
}

function TokenRow({ label, value, onCopied }) {
  return (
    <div className="test-device-row">
      <div className="test-device-row-head">
        <strong>{label}</strong>
        <button
          type="button"
          className="secondary-btn"
          disabled={!value}
          onClick={async () => {
            const ok = await copyText(value);
            if (ok) {
              onCopied(label);
            }
          }}
        >
          Copiar
        </button>
      </div>
      <code className="test-device-value">{value || "—"}</code>
    </div>
  );
}

export default function TestDeviceTokens() {
  const [installationId, setInstallationId] = useState("");
  const [fcmToken, setFcmToken] = useState("");
  const [errors, setErrors] = useState([]);
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState("");

  async function refresh() {
    setBusy(true);
    setCopied("");
    try {
      const result = await loadTestDeviceIds();
      setInstallationId(result.installationId || "");
      setFcmToken(result.fcmToken || "");
      setErrors(result.errors || []);
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => {
    refresh();
    const onGranted = () => {
      refresh();
    };
    window.addEventListener("clinica-notifications-granted", onGranted);
    return () => window.removeEventListener("clinica-notifications-granted", onGranted);
  }, []);

  return (
    <section className="card test-device-tokens">
      <div className="notification-heading">
        <h3>Testar no dispositivo</h3>
        <button type="button" className="secondary-btn" disabled={busy} onClick={refresh}>
          {busy ? "Carregando…" : "Atualizar"}
        </button>
      </div>
      <p className="muted-text">
        Copie o ID de instalação ou o token FCM e cole em Messaging → Testar no dispositivo no Console do Firebase.
      </p>
      <TokenRow
        label="ID de instalação do Firebase"
        value={installationId}
        onCopied={(label) => setCopied(label)}
      />
      <TokenRow
        label="Token de registro do FCM"
        value={fcmToken}
        onCopied={(label) => setCopied(label)}
      />
      {copied ? <p className="muted-text">{copied} copiado.</p> : null}
      {errors.length ? (
        <ul className="test-device-errors">
          {errors.map((message) => (
            <li key={message}>{message}</li>
          ))}
        </ul>
      ) : null}
    </section>
  );
}
