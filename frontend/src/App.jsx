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
  serverTimestamp
} from "firebase/firestore";
import { auth, db } from "./firebase";

const TABS = {
  AGENDA: "agenda",
  CLIENTES: "clientes",
  SERVICOS: "servicos"
};

function sortAppointments(items) {
  return [...items].sort((a, b) => {
    const first = new Date(`${a.date || "1970-01-01"}T${a.time || "00:00"}`);
    const second = new Date(`${b.date || "1970-01-01"}T${b.time || "00:00"}`);
    return first - second;
  });
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
                  <button
                    type="button"
                    className="danger-btn"
                    onClick={() => handleDeleteByCollection("clients", client.id)}
                  >
                    Excluir
                  </button>
                </li>
              ))
            )}
          </ul>
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
