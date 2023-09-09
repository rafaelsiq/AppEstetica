export const clientMock = {
    id: 1,
    name: "Maria da Silva",
    birthDate: "1990-05-15",
    email: "maria.silva@example.com",
    phone: "(11) 98765-4321",
    address: {
        street: "Rua das Flores, 123",
        neighborhood: "Centro",
        city: "São Paulo",
        state: "SP",
        zipCode: "01234-567"
    },
    treatments: [
        {
            id: 101,
            name: "Limpeza de Pele",
            appointmentDate: "2023-07-28",
            time: "14:30"
        },
        {
            id: 102,
            name: "Massagem Relaxante",
            appointmentDate: "2023-08-10",
            time: "16:00"
        }
    ],
    schedules: [
        {
            id: 101,
            name: "Limpeza de Pele",
            appointmentDate: "2023-08-28",
            time: "14:30"
        }],
    cancelled: [
        {
            id: 101,
            name: "Limpeza de Pele",
            appointmentDate: "2023-08-27",
            time: "14:30"
        }],
}

export const clinicMock = {
    id: 1,
    name: "Clínica de Estética Bella",
    address: {
        street: "Rua Principal, 123",
        city: "São Paulo",
        state: "SP",
        zipCode: "01234-567",
        country: "Brasil",
    },
    phone: "(11) 98765-4321",
    email: "contato@bellaesthetics.com",
    website: "https://www.bellaesthetics.com",
    services: [
        "Tratamentos Faciais",
        "Massagens Terapêuticas",
        "Depilação a Laser",
        "Manicure e Pedicure",
        "Tratamentos Corporais",
    ],
    openingHours: {
        monday: "9:00 - 18:00",
        tuesday: "9:00 - 18:00",
        wednesday: "9:00 - 18:00",
        thursday: "9:00 - 20:00",
        friday: "9:00 - 20:00",
        saturday: "10:00 - 16:00",
        sunday: "Fechado",
    },
};
