import { useEffect, useState } from "react";

export default function OpenInstalledApp() {
  const [missing, setMissing] = useState(false);

  useEffect(() => {
    let destination = "";
    try {
      destination = localStorage.getItem("clinica-app-destino") || "";
    } catch {
      destination = "";
    }
    if (destination.startsWith("/c/")) {
      window.location.replace(destination);
      return;
    }
    setMissing(true);
  }, []);

  if (!missing) {
    return <main className="quiz-page"><p>Abrindo seu acompanhamento...</p></main>;
  }

  return (
    <main className="quiz-page">
      <section className="quiz-card">
        <h1>Acompanhamento</h1>
        <p>Abra o link enviado pela clínica para entrar no seu acompanhamento.</p>
      </section>
    </main>
  );
}
