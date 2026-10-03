import { useEffect, useMemo, useState } from "react";
import {
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut
} from "firebase/auth";
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  serverTimestamp,
  setDoc
} from "firebase/firestore";
import { auth, db } from "./firebase";

const TABS = {
  AGENDA: "agenda",
  CLIENTES: "clientes",
  SERVICOS: "servicos"
};

const PAIN_AREAS = [
  "Cabeça",
  "Articulação temporomandibular",
  "Pescoço",
  "Ombro",
  "Braço",
  "Antebraço",
  "Mão",
  "Dedos",
  "Peito",
  "Abdômen",
  "Cintura",
  "Quadril",
  "Coxa",
  "Coxa posterior",
  "Joelho",
  "Perna",
  "Tornozelo",
  "Pé",
  "Cervical",
  "Escápula",
  "Cotovelo",
  "Lombar",
  "Glúteo",
  "Panturrilha",
  "Planta do pé"
];

const FRONT_PAIN_REGIONS = [
  { label: "Cabeça", x: 50.2, y: 6.2 },
  { label: "Articulação temporomandibular", x: 57.8, y: 12.8 },
  { label: "Pescoço", x: 57.8, y: 18.1 },
  { label: "Ombro", x: 38.3, y: 27.7 },
  { label: "Braço", x: 35.6, y: 37.0 },
  { label: "Antebraço", x: 30.9, y: 47.0 },
  { label: "Mão", x: 31.1, y: 56.9 },
  { label: "Dedos", x: 35.0, y: 61.2 },
  { label: "Peito", x: 57.8, y: 27.0 },
  { label: "Abdômen", x: 51.7, y: 48.0 },
  { label: "Cintura", x: 61.0, y: 48.0 },
  { label: "Quadril", x: 64.6, y: 58.5 },
  { label: "Coxa", x: 58.5, y: 67.7 },
  { label: "Joelho", x: 62.6, y: 75.8 },
  { label: "Perna", x: 45.1, y: 83.4 },
  { label: "Tornozelo", x: 41.5, y: 92.4 },
  { label: "Pé", x: 60.6, y: 96.0 }
];

const BACK_PAIN_REGIONS = [
  { label: "Cervical", x: 50.0, y: 16.7 },
  { label: "Escápula", x: 59.3, y: 28.0 },
  { label: "Cotovelo", x: 66.7, y: 39.1 },
  { label: "Lombar", x: 49.3, y: 48.2 },
  { label: "Glúteo", x: 55.8, y: 55.7 },
  { label: "Coxa posterior", x: 40.2, y: 68.4 },
  { label: "Panturrilha", x: 38.7, y: 79.5 },
  { label: "Planta do pé", x: 57.5, y: 96.0 }
];

const HEALTH_CONDITIONS = [
  "Tendinite",
  "Bursite",
  "Diabetes",
  "Cardiopatia",
  "Trombose",
  "Lipedema",
  "Gota",
  "Epilepsia",
  "Fibromialgia",
  "Câncer / Tumores",
  "Fratura",
  "Sinusite",
  "Rinite",
  "Enxaqueca",
  "Bruxismo",
  "Depressão",
  "Insônia",
  "Pressão alterada"
];

const SESSION_TYPES = ["Miofascial", "Relaxante", "Facial", "Drenagem", "Esportiva"];

function sortAppointments(items) {
  return [...items].sort((a, b) => {
    const first = new Date(`${a.date || "1970-01-01"}T${a.time || "00:00"}`);
    const second = new Date(`${b.date || "1970-01-01"}T${b.time || "00:00"}`);
    return first - second;
  });
}

function sortByDate(items) {
  return [...items].sort((a, b) => {
    const first = new Date(a.date || "1970-01-01");
    const second = new Date(b.date || "1970-01-01");
    return first - second;
  });
}

function getTodayISODate() {
  return new Date().toISOString().slice(0, 10);
}

function buildEmptyAnamnese(client) {
  return {
    fullName: client?.name || "",
    birthDate: "",
    address: "",
    phone: client?.phone || "",
    email: "",
    painAreas: [],
    localPain: "",
    painRadiates: "",
    firstPainEpisode: "",
    painType: "",
    painTriggers: "",
    painScale: "",
    goal: "",
    practicesSport: "",
    previousTreatment: "",
    previousTreatmentExperience: "",
    aestheticGoals: "",
    habitsContributing: "",
    bodyFocus: "",
    healthConditions: [],
    healthOther: "",
    menstrualPeriod: "",
    pregnant: "",
    gestatingTime: "",
    lactating: "",
    observations: "",
    signatureName: ""
  };
}

function buildEmptyCheckpoint() {
  return {
    date: getTodayISODate(),
    sessionNumber: "",
    sessionType: "",
    painLevel: "",
    stressLevel: "",
    sleepHours: "",
    observations: ""
  };
}

function formatDatePt(dateValue) {
  if (!dateValue) {
    return "--";
  }
  const parsed = new Date(`${dateValue}T00:00`);
  if (Number.isNaN(parsed.getTime())) {
    return dateValue;
  }
  return parsed.toLocaleDateString("pt-BR");
}

function PainMapSelector({ selectedAreas, onToggleArea }) {
  return (
    <div className="pain-map-section">
      <p className="muted-text">
        Toque nos pontos do mapa corporal para marcar/desmarcar regiões de dor.
      </p>
      <div className="pain-map-grid">
        <figure className="pain-map-card">
          <div className="pain-map-canvas">
            <img src="/pain-map-front.jpg" alt="Mapa corporal frontal para seleção de dor" />
            {FRONT_PAIN_REGIONS.map((region) => {
              const isSelected = selectedAreas.includes(region.label);
              return (
                <button
                  key={`front-${region.label}`}
                  type="button"
                  className={`pain-dot ${isSelected ? "selected" : ""}`}
                  style={{ left: `${region.x}%`, top: `${region.y}%` }}
                  onClick={() => onToggleArea(region.label)}
                  title={region.label}
                  aria-label={`Selecionar ${region.label}`}
                >
                  <span>{region.label}</span>
                </button>
              );
            })}
          </div>
          <figcaption>Frente</figcaption>
        </figure>
        <figure className="pain-map-card">
          <div className="pain-map-canvas">
            <img src="/pain-map-back.jpg" alt="Mapa corporal traseiro para seleção de dor" />
            {BACK_PAIN_REGIONS.map((region) => {
              const isSelected = selectedAreas.includes(region.label);
              return (
                <button
                  key={`back-${region.label}`}
                  type="button"
                  className={`pain-dot ${isSelected ? "selected" : ""}`}
                  style={{ left: `${region.x}%`, top: `${region.y}%` }}
                  onClick={() => onToggleArea(region.label)}
                  title={region.label}
                  aria-label={`Selecionar ${region.label}`}
                >
                  <span>{region.label}</span>
                </button>
              );
            })}
          </div>
          <figcaption>Costas</figcaption>
        </figure>
      </div>

      {selectedAreas.length > 0 ? (
        <div className="selected-areas">
          {selectedAreas.map((area) => (
            <button
              key={area}
              type="button"
              className="selected-area-chip"
              onClick={() => onToggleArea(area)}
              title={`Remover ${area}`}
            >
              {area} ×
            </button>
          ))}
        </div>
      ) : (
        <p className="muted-text">Nenhuma região selecionada.</p>
      )}
    </div>
  );
}

function ProgressLineChart({ title, points, firstMetric, secondMetric, maxValue }) {
  if (points.length < 2) {
    return (
      <div className="chart-card">
        <h5>{title}</h5>
        <p className="muted-text">Cadastre pelo menos 2 avaliações para gerar o gráfico.</p>
      </div>
    );
  }

  const width = 420;
  const height = 200;
  const padding = 30;
  const plotWidth = width - padding * 2;
  const plotHeight = height - padding * 2;
  const midValue = maxValue / 2;
  const yLabels = [0, midValue, maxValue];

  const getX = (index) =>
    points.length === 1 ? padding : padding + (index * plotWidth) / (points.length - 1);

  const getY = (value) =>
    padding + (1 - Math.min(Math.max(Number(value) || 0, 0), maxValue) / maxValue) * plotHeight;

  const linePath = (fieldName) =>
    points
      .map((item, index) => `${index === 0 ? "M" : "L"} ${getX(index)} ${getY(item[fieldName])}`)
      .join(" ");

  return (
    <div className="chart-card">
      <h5>{title}</h5>
      <svg viewBox={`0 0 ${width} ${height}`} className="chart-svg" role="img" aria-label={title}>
        {yLabels.map((marker) => {
          const y = getY(marker);
          return (
            <g key={marker}>
              <line x1={padding} y1={y} x2={width - padding} y2={y} className="chart-grid" />
              <text x={4} y={y + 4} className="chart-axis">
                {marker}
              </text>
            </g>
          );
        })}

        <path d={linePath(firstMetric.field)} className="chart-line chart-line-primary" />
        <path d={linePath(secondMetric.field)} className="chart-line chart-line-secondary" />

        {points.map((item, index) => (
          <g key={`${item.date}-${index}`}>
            <circle
              cx={getX(index)}
              cy={getY(item[firstMetric.field])}
              r="3"
              className="chart-point-primary"
            />
            <circle
              cx={getX(index)}
              cy={getY(item[secondMetric.field])}
              r="3"
              className="chart-point-secondary"
            />
            <text x={getX(index)} y={height - 8} textAnchor="middle" className="chart-axis-x">
              {formatDatePt(item.date)}
            </text>
          </g>
        ))}
      </svg>
      <div className="chart-legend">
        <span>
          <i className="legend-dot legend-primary" />
          {firstMetric.label}
        </span>
        <span>
          <i className="legend-dot legend-secondary" />
          {secondMetric.label}
        </span>
      </div>
    </div>
  );
}

function SleepBarChart({ points }) {
  if (points.length < 1) {
    return (
      <div className="chart-card">
        <h5>Sono (horas por sessão)</h5>
        <p className="muted-text">Sem dados de sono até o momento.</p>
      </div>
    );
  }

  const width = 420;
  const height = 200;
  const padding = 30;
  const maxValue = 12;
  const plotWidth = width - padding * 2;
  const plotHeight = height - padding * 2;
  const barWidth = Math.max(14, plotWidth / points.length - 10);

  const getX = (index) =>
    padding +
    index * (plotWidth / points.length) +
    (plotWidth / points.length - barWidth) / 2;

  const barHeight = (value) => (Math.min(Math.max(Number(value) || 0, 0), maxValue) / maxValue) * plotHeight;

  return (
    <div className="chart-card">
      <h5>Sono (horas por sessão)</h5>
      <svg viewBox={`0 0 ${width} ${height}`} className="chart-svg" role="img" aria-label="Gráfico de sono">
        <line x1={padding} y1={height - padding} x2={width - padding} y2={height - padding} className="chart-grid" />
        <line x1={padding} y1={padding} x2={padding} y2={height - padding} className="chart-grid" />

        {points.map((item, index) => {
          const currentBarHeight = barHeight(item.sleepHours);
          return (
            <g key={`${item.date}-${index}`}>
              <rect
                x={getX(index)}
                y={height - padding - currentBarHeight}
                width={barWidth}
                height={currentBarHeight}
                className="chart-bar"
              />
              <text x={getX(index) + barWidth / 2} y={height - 8} textAnchor="middle" className="chart-axis-x">
                {formatDatePt(item.date)}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}

export default function App() {
  const [user, setUser] = useState(null);
  const [isLoadingAuth, setIsLoadingAuth] = useState(true);
  const [authMode, setAuthMode] = useState("login");
  const [authEmail, setAuthEmail] = useState("");
  const [authPassword, setAuthPassword] = useState("");
  const [authError, setAuthError] = useState("");

  const [activeTab, setActiveTab] = useState(TABS.AGENDA);
  const [clients, setClients] = useState([]);
  const [services, setServices] = useState([]);
  const [appointments, setAppointments] = useState([]);

  const [clientName, setClientName] = useState("");
  const [clientPhone, setClientPhone] = useState("");
  const [serviceTitle, setServiceTitle] = useState("");
  const [servicePrice, setServicePrice] = useState("");
  const [appointmentClient, setAppointmentClient] = useState("");
  const [appointmentService, setAppointmentService] = useState("");
  const [appointmentDate, setAppointmentDate] = useState("");
  const [appointmentTime, setAppointmentTime] = useState("");
  const [appointmentNotes, setAppointmentNotes] = useState("");
  const [selectedClientId, setSelectedClientId] = useState("");
  const [anamneseForm, setAnamneseForm] = useState(buildEmptyAnamnese());
  const [checkpoints, setCheckpoints] = useState([]);
  const [checkpointForm, setCheckpointForm] = useState(buildEmptyCheckpoint());
  const [anamneseMessage, setAnamneseMessage] = useState("");

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (nextUser) => {
      setUser(nextUser);
      setIsLoadingAuth(false);
    });

    return unsubscribe;
  }, []);

  useEffect(() => {
    if (!user) {
      setClients([]);
      setServices([]);
      setAppointments([]);
      setSelectedClientId("");
      setAnamneseForm(buildEmptyAnamnese());
      setCheckpoints([]);
      return undefined;
    }

    const clientsRef = collection(db, "users", user.uid, "clients");
    const servicesRef = collection(db, "users", user.uid, "services");
    const appointmentsRef = collection(db, "users", user.uid, "appointments");

    const unsubscribeClients = onSnapshot(clientsRef, (snapshot) => {
      setClients(snapshot.docs.map((item) => ({ id: item.id, ...item.data() })));
    });

    const unsubscribeServices = onSnapshot(servicesRef, (snapshot) => {
      setServices(snapshot.docs.map((item) => ({ id: item.id, ...item.data() })));
    });

    const unsubscribeAppointments = onSnapshot(appointmentsRef, (snapshot) => {
      const loadedAppointments = snapshot.docs.map((item) => ({
        id: item.id,
        ...item.data()
      }));
      setAppointments(sortAppointments(loadedAppointments));
    });

    return () => {
      unsubscribeClients();
      unsubscribeServices();
      unsubscribeAppointments();
    };
  }, [user]);

  useEffect(() => {
    if (!selectedClientId) {
      return;
    }
    if (!clients.some((client) => client.id === selectedClientId)) {
      setSelectedClientId("");
      setAnamneseForm(buildEmptyAnamnese());
      setCheckpoints([]);
    }
  }, [clients, selectedClientId]);

  const selectedClient = useMemo(
    () => clients.find((client) => client.id === selectedClientId) || null,
    [clients, selectedClientId]
  );

  useEffect(() => {
    if (!user || !selectedClient) {
      setAnamneseForm(buildEmptyAnamnese(selectedClient));
      setCheckpoints([]);
      return undefined;
    }

    const anamneseRef = doc(db, "users", user.uid, "anamneses", selectedClient.id);
    const checkpointsRef = collection(db, "users", user.uid, "anamneses", selectedClient.id, "checkpoints");

    const unsubscribeAnamnese = onSnapshot(anamneseRef, (snapshot) => {
      if (!snapshot.exists()) {
        setAnamneseForm(buildEmptyAnamnese(selectedClient));
        return;
      }

      const data = snapshot.data();
      setAnamneseForm({
        ...buildEmptyAnamnese(selectedClient),
        ...data,
        painAreas: Array.isArray(data.painAreas)
          ? data.painAreas.filter((area) => PAIN_AREAS.includes(area))
          : [],
        healthConditions: Array.isArray(data.healthConditions) ? data.healthConditions : []
      });
    });

    const unsubscribeCheckpoints = onSnapshot(checkpointsRef, (snapshot) => {
      const loaded = snapshot.docs.map((item) => ({ id: item.id, ...item.data() }));
      setCheckpoints(sortByDate(loaded));
    });

    return () => {
      unsubscribeAnamnese();
      unsubscribeCheckpoints();
    };
  }, [user, selectedClient]);

  const formattedUserName = useMemo(() => {
    if (!user?.email) {
      return "";
    }
    return user.email.split("@")[0];
  }, [user]);

  const handleAuthSubmit = async (event) => {
    event.preventDefault();
    setAuthError("");

    try {
      if (authMode === "login") {
        await signInWithEmailAndPassword(auth, authEmail, authPassword);
      } else {
        await createUserWithEmailAndPassword(auth, authEmail, authPassword);
      }

      setAuthEmail("");
      setAuthPassword("");
    } catch (error) {
      setAuthError("Não foi possível concluir a autenticação. Verifique os dados.");
    }
  };

  const handleAddClient = async (event) => {
    event.preventDefault();
    if (!clientName.trim() || !user) {
      return;
    }

    await addDoc(collection(db, "users", user.uid, "clients"), {
      name: clientName.trim(),
      phone: clientPhone.trim(),
      createdAt: serverTimestamp()
    });

    setClientName("");
    setClientPhone("");
  };

  const handleAddService = async (event) => {
    event.preventDefault();
    if (!serviceTitle.trim() || !user) {
      return;
    }

    await addDoc(collection(db, "users", user.uid, "services"), {
      title: serviceTitle.trim(),
      price: Number(servicePrice || 0),
      createdAt: serverTimestamp()
    });

    setServiceTitle("");
    setServicePrice("");
  };

  const handleAddAppointment = async (event) => {
    event.preventDefault();
    if (!user || !appointmentClient.trim() || !appointmentService.trim() || !appointmentDate) {
      return;
    }

    await addDoc(collection(db, "users", user.uid, "appointments"), {
      client: appointmentClient.trim(),
      service: appointmentService.trim(),
      date: appointmentDate,
      time: appointmentTime,
      notes: appointmentNotes.trim(),
      createdAt: serverTimestamp()
    });

    setAppointmentClient("");
    setAppointmentService("");
    setAppointmentDate("");
    setAppointmentTime("");
    setAppointmentNotes("");
  };

  const handleDeleteByCollection = async (collectionName, itemId) => {
    if (!user) {
      return;
    }

    await deleteDoc(doc(db, "users", user.uid, collectionName, itemId));
  };

  const handleAnamneseFieldChange = (fieldName, value) => {
    setAnamneseForm((previous) => ({ ...previous, [fieldName]: value }));
  };

  const toggleArrayValue = (fieldName, value) => {
    setAnamneseForm((previous) => {
      const currentValues = Array.isArray(previous[fieldName]) ? previous[fieldName] : [];
      const exists = currentValues.includes(value);
      return {
        ...previous,
        [fieldName]: exists
          ? currentValues.filter((item) => item !== value)
          : [...currentValues, value]
      };
    });
  };

  const handleSaveAnamnese = async (event) => {
    event.preventDefault();
    if (!user || !selectedClient) {
      return;
    }

    const anamneseRef = doc(db, "users", user.uid, "anamneses", selectedClient.id);
    const payload = {
      ...anamneseForm,
      fullName: anamneseForm.fullName || selectedClient.name || "",
      phone: anamneseForm.phone || selectedClient.phone || "",
      clientId: selectedClient.id,
      clientName: selectedClient.name || "",
      updatedAt: serverTimestamp()
    };

    await setDoc(anamneseRef, payload, { merge: true });
    setAnamneseMessage("Ficha salva com sucesso.");
    setTimeout(() => setAnamneseMessage(""), 2500);
  };

  const handleCheckpointFieldChange = (fieldName, value) => {
    setCheckpointForm((previous) => ({ ...previous, [fieldName]: value }));
  };

  const handleAddCheckpoint = async (event) => {
    event.preventDefault();
    if (!user || !selectedClient || !checkpointForm.date || checkpointForm.painLevel === "") {
      return;
    }

    await addDoc(
      collection(db, "users", user.uid, "anamneses", selectedClient.id, "checkpoints"),
      {
        date: checkpointForm.date,
        sessionNumber: checkpointForm.sessionNumber.trim(),
        sessionType: checkpointForm.sessionType,
        painLevel: Number(checkpointForm.painLevel),
        stressLevel: Number(checkpointForm.stressLevel || 0),
        sleepHours: Number(checkpointForm.sleepHours || 0),
        observations: checkpointForm.observations.trim(),
        createdAt: serverTimestamp()
      }
    );

    setCheckpointForm(buildEmptyCheckpoint());
  };

  const handleDeleteCheckpoint = async (checkpointId) => {
    if (!user || !selectedClient) {
      return;
    }
    await deleteDoc(
      doc(db, "users", user.uid, "anamneses", selectedClient.id, "checkpoints", checkpointId)
    );
  };

  const checkpointChartData = useMemo(() => {
    return sortByDate(checkpoints).filter((item) => item.date);
  }, [checkpoints]);

  if (isLoadingAuth) {
    return <main className="page loading">Carregando...</main>;
  }

  if (!user) {
    return (
      <main className="page auth-page">
        <section className="card auth-card">
          <h1>Gestão da Clínica</h1>
          <p className="subtitle">Acesse para gerenciar agenda, clientes e serviços.</p>

          <div className="auth-switch">
            <button
              type="button"
              className={authMode === "login" ? "active" : ""}
              onClick={() => setAuthMode("login")}
            >
              Login
            </button>
            <button
              type="button"
              className={authMode === "register" ? "active" : ""}
              onClick={() => setAuthMode("register")}
            >
              Cadastro
            </button>
          </div>

          <form className="form" onSubmit={handleAuthSubmit}>
            <label>
              E-mail
              <input
                type="email"
                value={authEmail}
                onChange={(event) => setAuthEmail(event.target.value)}
                placeholder="voce@clinica.com"
                required
              />
            </label>
            <label>
              Senha
              <input
                type="password"
                value={authPassword}
                onChange={(event) => setAuthPassword(event.target.value)}
                placeholder="********"
                minLength={6}
                required
              />
            </label>

            {authError ? <p className="error-text">{authError}</p> : null}

            <button className="primary-btn" type="submit">
              {authMode === "login" ? "Entrar" : "Criar conta"}
            </button>
          </form>
        </section>
      </main>
    );
  }

  return (
    <main className="page app-page">
      <header className="topbar">
        <div>
          <h2>Clínica Estética</h2>
          <p>Olá, {formattedUserName}</p>
        </div>
        <button className="secondary-btn" type="button" onClick={() => signOut(auth)}>
          Sair
        </button>
      </header>

      <nav className="tabs">
        <button
          type="button"
          className={activeTab === TABS.AGENDA ? "active" : ""}
          onClick={() => setActiveTab(TABS.AGENDA)}
        >
          Agenda
        </button>
        <button
          type="button"
          className={activeTab === TABS.CLIENTES ? "active" : ""}
          onClick={() => setActiveTab(TABS.CLIENTES)}
        >
          Clientes
        </button>
        <button
          type="button"
          className={activeTab === TABS.SERVICOS ? "active" : ""}
          onClick={() => setActiveTab(TABS.SERVICOS)}
        >
          Serviços
        </button>
      </nav>

      {activeTab === TABS.AGENDA ? (
        <section className="card">
          <h3>Agenda</h3>
          <form className="form grid-form" onSubmit={handleAddAppointment}>
            <label>
              Cliente
              <input
                value={appointmentClient}
                onChange={(event) => setAppointmentClient(event.target.value)}
                placeholder="Nome da cliente"
                required
              />
            </label>
            <label>
              Serviço
              <input
                value={appointmentService}
                onChange={(event) => setAppointmentService(event.target.value)}
                placeholder="Serviço"
                required
              />
            </label>
            <label>
              Data
              <input
                type="date"
                value={appointmentDate}
                onChange={(event) => setAppointmentDate(event.target.value)}
                required
              />
            </label>
            <label>
              Horário
              <input
                type="time"
                value={appointmentTime}
                onChange={(event) => setAppointmentTime(event.target.value)}
              />
            </label>
            <label className="full-row">
              Observações
              <input
                value={appointmentNotes}
                onChange={(event) => setAppointmentNotes(event.target.value)}
                placeholder="Opcional"
              />
            </label>
            <button className="primary-btn full-row" type="submit">
              Adicionar horário
            </button>
          </form>

          <ul className="list">
            {appointments.length === 0 ? (
              <li className="empty">Nenhum horário cadastrado.</li>
            ) : (
              appointments.map((appointment) => (
                <li key={appointment.id}>
                  <div>
                    <strong>{appointment.client}</strong> - {appointment.service}
                    <p>
                      {appointment.date} {appointment.time ? `às ${appointment.time}` : ""}
                    </p>
                    {appointment.notes ? <p>{appointment.notes}</p> : null}
                  </div>
                  <button
                    type="button"
                    className="danger-btn"
                    onClick={() => handleDeleteByCollection("appointments", appointment.id)}
                  >
                    Excluir
                  </button>
                </li>
              ))
            )}
          </ul>
        </section>
      ) : null}

      {activeTab === TABS.CLIENTES ? (
        <section className="card">
          <h3>Clientes</h3>
          <form className="form" onSubmit={handleAddClient}>
            <label>
              Nome
              <input
                value={clientName}
                onChange={(event) => setClientName(event.target.value)}
                placeholder="Nome completo"
                required
              />
            </label>
            <label>
              Telefone
              <input
                value={clientPhone}
                onChange={(event) => setClientPhone(event.target.value)}
                placeholder="(00) 00000-0000"
              />
            </label>
            <button className="primary-btn" type="submit">
              Adicionar cliente
            </button>
          </form>

          <ul className="list">
            {clients.length === 0 ? (
              <li className="empty">Nenhuma cliente cadastrada.</li>
            ) : (
              clients.map((client) => (
                <li key={client.id}>
                  <div>
                    <strong>{client.name}</strong>
                    <p>{client.phone || "Sem telefone"}</p>
                  </div>
                  <div className="inline-actions">
                    <button
                      type="button"
                      className="secondary-btn"
                      onClick={() => setSelectedClientId(client.id)}
                    >
                      Anamnese
                    </button>
                    <button
                      type="button"
                      className="danger-btn"
                      onClick={() => handleDeleteByCollection("clients", client.id)}
                    >
                      Excluir
                    </button>
                  </div>
                </li>
              ))
            )}
          </ul>

          {selectedClient ? (
            <section className="anamnese-panel">
              <div className="panel-header">
                <div>
                  <h4>Ficha de Anamnese - {selectedClient.name}</h4>
                  <p>Registre as informações clínicas e acompanhe evolução por sessão.</p>
                </div>
                <button type="button" className="secondary-btn" onClick={() => setSelectedClientId("")}>
                  Fechar
                </button>
              </div>

              <form className="form" onSubmit={handleSaveAnamnese}>
                <h5>Dados Pessoais</h5>
                <div className="grid-form">
                  <label>
                    Nome
                    <input
                      value={anamneseForm.fullName}
                      onChange={(event) => handleAnamneseFieldChange("fullName", event.target.value)}
                      placeholder="Nome da cliente"
                    />
                  </label>
                  <label>
                    Data de nascimento
                    <input
                      type="date"
                      value={anamneseForm.birthDate}
                      onChange={(event) => handleAnamneseFieldChange("birthDate", event.target.value)}
                    />
                  </label>
                  <label className="full-row">
                    Endereço
                    <input
                      value={anamneseForm.address}
                      onChange={(event) => handleAnamneseFieldChange("address", event.target.value)}
                      placeholder="Rua, número, bairro e cidade"
                    />
                  </label>
                  <label>
                    Telefone
                    <input
                      value={anamneseForm.phone}
                      onChange={(event) => handleAnamneseFieldChange("phone", event.target.value)}
                    />
                  </label>
                  <label>
                    E-mail
                    <input
                      type="email"
                      value={anamneseForm.email}
                      onChange={(event) => handleAnamneseFieldChange("email", event.target.value)}
                    />
                  </label>
                </div>

                <h5>Círculo das dores principais</h5>
                <PainMapSelector
                  selectedAreas={anamneseForm.painAreas}
                  onToggleArea={(area) => toggleArrayValue("painAreas", area)}
                />

                <h5>Perguntas-chave</h5>
                <div className="form">
                  <label>
                    A dor está em ponto específico ou irradia para outra área?
                    <textarea
                      value={anamneseForm.painRadiates}
                      onChange={(event) => handleAnamneseFieldChange("painRadiates", event.target.value)}
                    />
                  </label>
                  <label>
                    Quando percebeu esse incômodo pela primeira vez?
                    <textarea
                      value={anamneseForm.firstPainEpisode}
                      onChange={(event) => handleAnamneseFieldChange("firstPainEpisode", event.target.value)}
                    />
                  </label>
                  <label>
                    Tipo de dor (queimação, fisgada, pontada, constante)?
                    <textarea
                      value={anamneseForm.painType}
                      onChange={(event) => handleAnamneseFieldChange("painType", event.target.value)}
                    />
                  </label>
                  <label>
                    Em quais situações sente mais dor?
                    <textarea
                      value={anamneseForm.painTriggers}
                      onChange={(event) => handleAnamneseFieldChange("painTriggers", event.target.value)}
                    />
                  </label>
                  <label>
                    Intensidade da dor (0 a 10)
                    <input
                      type="number"
                      min="0"
                      max="10"
                      value={anamneseForm.painScale}
                      onChange={(event) => handleAnamneseFieldChange("painScale", event.target.value)}
                    />
                  </label>
                  <label>
                    Busca mais relaxamento geral ou foco em tensão específica?
                    <textarea
                      value={anamneseForm.goal}
                      onChange={(event) => handleAnamneseFieldChange("goal", event.target.value)}
                    />
                  </label>
                  <label>
                    Pratica esporte? Qual?
                    <textarea
                      value={anamneseForm.practicesSport}
                      onChange={(event) => handleAnamneseFieldChange("practicesSport", event.target.value)}
                    />
                  </label>
                  <label>
                    Fez outro tratamento/massagem? Como foi a experiência?
                    <textarea
                      value={anamneseForm.previousTreatmentExperience}
                      onChange={(event) =>
                        handleAnamneseFieldChange("previousTreatmentExperience", event.target.value)
                      }
                    />
                  </label>
                  <label>
                    Objetivos estéticos com a massagem
                    <textarea
                      value={anamneseForm.aestheticGoals}
                      onChange={(event) => handleAnamneseFieldChange("aestheticGoals", event.target.value)}
                    />
                  </label>
                  <label>
                    Hábitos/atividades que podem estar contribuindo para dor
                    <textarea
                      value={anamneseForm.habitsContributing}
                      onChange={(event) =>
                        handleAnamneseFieldChange("habitsContributing", event.target.value)
                      }
                    />
                  </label>
                </div>

                <h5>Condições de saúde</h5>
                <div className="checkbox-grid">
                  {HEALTH_CONDITIONS.map((condition) => (
                    <label key={condition} className="checkbox-field">
                      <input
                        type="checkbox"
                        checked={anamneseForm.healthConditions.includes(condition)}
                        onChange={() => toggleArrayValue("healthConditions", condition)}
                      />
                      {condition}
                    </label>
                  ))}
                </div>
                <label>
                  Outras observações de saúde
                  <textarea
                    value={anamneseForm.healthOther}
                    onChange={(event) => handleAnamneseFieldChange("healthOther", event.target.value)}
                  />
                </label>

                <h5>Para mulheres</h5>
                <div className="grid-form">
                  <label>
                    Período menstrual
                    <input
                      value={anamneseForm.menstrualPeriod}
                      onChange={(event) => handleAnamneseFieldChange("menstrualPeriod", event.target.value)}
                      placeholder="Regular, irregular, etc."
                    />
                  </label>
                  <label>
                    Gestante?
                    <select
                      value={anamneseForm.pregnant}
                      onChange={(event) => handleAnamneseFieldChange("pregnant", event.target.value)}
                    >
                      <option value="">Selecionar</option>
                      <option value="sim">Sim</option>
                      <option value="nao">Não</option>
                    </select>
                  </label>
                  <label>
                    Tempo de gestação (se aplicável)
                    <input
                      value={anamneseForm.gestatingTime}
                      onChange={(event) => handleAnamneseFieldChange("gestatingTime", event.target.value)}
                      placeholder="Ex: 24 semanas"
                    />
                  </label>
                  <label>
                    Lactante?
                    <select
                      value={anamneseForm.lactating}
                      onChange={(event) => handleAnamneseFieldChange("lactating", event.target.value)}
                    >
                      <option value="">Selecionar</option>
                      <option value="sim">Sim</option>
                      <option value="nao">Não</option>
                    </select>
                  </label>
                </div>

                <h5>Conclusão da ficha</h5>
                <label>
                  Qual área do corpo gostaria de mais atenção?
                  <textarea
                    value={anamneseForm.bodyFocus}
                    onChange={(event) => handleAnamneseFieldChange("bodyFocus", event.target.value)}
                  />
                </label>
                <label>
                  Observações gerais
                  <textarea
                    value={anamneseForm.observations}
                    onChange={(event) => handleAnamneseFieldChange("observations", event.target.value)}
                  />
                </label>
                <label>
                  Assinatura (nome digitado)
                  <input
                    value={anamneseForm.signatureName}
                    onChange={(event) => handleAnamneseFieldChange("signatureName", event.target.value)}
                    placeholder="Nome completo da cliente"
                  />
                </label>

                {anamneseMessage ? <p className="success-text">{anamneseMessage}</p> : null}
                <button className="primary-btn" type="submit">
                  Salvar ficha de anamnese
                </button>
              </form>

              <hr />

              <h4>Acompanhamento com gráficos</h4>
              <form className="form grid-form" onSubmit={handleAddCheckpoint}>
                <label>
                  Data do atendimento
                  <input
                    type="date"
                    value={checkpointForm.date}
                    onChange={(event) => handleCheckpointFieldChange("date", event.target.value)}
                    required
                  />
                </label>
                <label>
                  Sessão nº
                  <input
                    value={checkpointForm.sessionNumber}
                    onChange={(event) =>
                      handleCheckpointFieldChange("sessionNumber", event.target.value)
                    }
                    placeholder="Ex: 1"
                  />
                </label>
                <label>
                  Tipo de atendimento
                  <select
                    value={checkpointForm.sessionType}
                    onChange={(event) => handleCheckpointFieldChange("sessionType", event.target.value)}
                  >
                    <option value="">Selecionar</option>
                    {SESSION_TYPES.map((type) => (
                      <option key={type} value={type}>
                        {type}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  Dor (0-10)
                  <input
                    type="number"
                    min="0"
                    max="10"
                    value={checkpointForm.painLevel}
                    onChange={(event) => handleCheckpointFieldChange("painLevel", event.target.value)}
                    required
                  />
                </label>
                <label>
                  Estresse/Tensão (0-10)
                  <input
                    type="number"
                    min="0"
                    max="10"
                    value={checkpointForm.stressLevel}
                    onChange={(event) => handleCheckpointFieldChange("stressLevel", event.target.value)}
                  />
                </label>
                <label>
                  Sono (horas)
                  <input
                    type="number"
                    min="0"
                    max="12"
                    step="0.5"
                    value={checkpointForm.sleepHours}
                    onChange={(event) => handleCheckpointFieldChange("sleepHours", event.target.value)}
                  />
                </label>
                <label className="full-row">
                  Observações da sessão
                  <textarea
                    value={checkpointForm.observations}
                    onChange={(event) => handleCheckpointFieldChange("observations", event.target.value)}
                  />
                </label>
                <button className="primary-btn full-row" type="submit">
                  Registrar evolução
                </button>
              </form>

              <div className="charts-grid">
                <ProgressLineChart
                  title="Evolução da dor x estresse"
                  points={checkpointChartData}
                  firstMetric={{ field: "painLevel", label: "Dor" }}
                  secondMetric={{ field: "stressLevel", label: "Estresse" }}
                  maxValue={10}
                />
                <SleepBarChart points={checkpointChartData} />
              </div>

              <ul className="list">
                {checkpoints.length === 0 ? (
                  <li className="empty">Sem sessões registradas para acompanhamento.</li>
                ) : (
                  checkpoints.map((checkpoint) => (
                    <li key={checkpoint.id}>
                      <div>
                        <strong>
                          {formatDatePt(checkpoint.date)}
                          {checkpoint.sessionNumber ? ` - Sessão ${checkpoint.sessionNumber}` : ""}
                        </strong>
                        <p>
                          Tipo: {checkpoint.sessionType || "Não informado"} | Dor: {checkpoint.painLevel ?? 0} |
                          Estresse: {checkpoint.stressLevel ?? 0} | Sono: {checkpoint.sleepHours ?? 0}h
                        </p>
                        {checkpoint.observations ? <p>{checkpoint.observations}</p> : null}
                      </div>
                      <button
                        type="button"
                        className="danger-btn"
                        onClick={() => handleDeleteCheckpoint(checkpoint.id)}
                      >
                        Excluir
                      </button>
                    </li>
                  ))
                )}
              </ul>
            </section>
          ) : null}
        </section>
      ) : null}

      {activeTab === TABS.SERVICOS ? (
        <section className="card">
          <h3>Serviços</h3>
          <form className="form" onSubmit={handleAddService}>
            <label>
              Nome do serviço
              <input
                value={serviceTitle}
                onChange={(event) => setServiceTitle(event.target.value)}
                placeholder="Ex: Limpeza de pele"
                required
              />
            </label>
            <label>
              Preço (R$)
              <input
                type="number"
                min="0"
                step="0.01"
                value={servicePrice}
                onChange={(event) => setServicePrice(event.target.value)}
                placeholder="0,00"
              />
            </label>
            <button className="primary-btn" type="submit">
              Adicionar serviço
            </button>
          </form>

          <ul className="list">
            {services.length === 0 ? (
              <li className="empty">Nenhum serviço cadastrado.</li>
            ) : (
              services.map((service) => (
                <li key={service.id}>
                  <div>
                    <strong>{service.title}</strong>
                    <p>R$ {Number(service.price || 0).toFixed(2)}</p>
                  </div>
                  <button
                    type="button"
                    className="danger-btn"
                    onClick={() => handleDeleteByCollection("services", service.id)}
                  >
                    Excluir
                  </button>
                </li>
              ))
            )}
          </ul>
        </section>
      ) : null}
    </main>
  );
}
