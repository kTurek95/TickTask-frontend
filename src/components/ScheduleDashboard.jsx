import { useEffect, useMemo, useState } from "react";
import { ACCESS_TOKEN } from "../constants";
import api from "../api";
import EditModal from "./EditModal";
import "../App.css";
import Sidebar from "./Sidebar";

// --- helpery ---
const toList = (d) =>
  Array.isArray(d) ? d : Array.isArray(d?.results) ? d.results : [];

const fmtDateTime = (date, time) => {
  if (!date && !time) return "Brak";
  const d = date || "";
  const t = (time || "").slice(0, 5); // HH:MM
  return `${d}${t ? " " + t : ""}`;
};

export default function ScheduleDashboard() {
  const [users, setUsers] = useState([]);
  const [schedules, setSchedules] = useState([]); // zawsze trzymamy TABLICĘ
  const [currentUser, setCurrentUser] = useState(null);
  const [loading, setLoading] = useState(false);

  const [newSchedule, setNewSchedule] = useState({
    name: "",
    date: "",
    time: "",
    notes: "",
  });

  const [scheduleToEdit, setScheduleToEdit] = useState(null);

  const scheduleFields = [
    { label: "Nazwa", name: "name", type: "text" },
    { label: "Data", name: "date", type: "date" },
    { label: "Godzina", name: "time", type: "time" },
    { label: "Notatki", name: "notes", type: "textarea" },
  ];

  // --- pobieranie danych startowych równolegle ---
  useEffect(() => {
    const token = localStorage.getItem(ACCESS_TOKEN);
    const headers = { Authorization: `Bearer ${token}` };

    let isMounted = true;
    const boot = async () => {
      try {
        setLoading(true);
        const [me, usersRes, sched] = await Promise.all([
          api.get("/api/me/", { headers }),
          api.get("/api/users/", { headers }),
          api.get("/api/schedules/", { headers }),
        ]);

        if (!isMounted) return;

        setCurrentUser(me.data || null);
        setUsers(toList(usersRes.data) || usersRes.data || []);
        setSchedules(toList(sched.data)); // normalize
      } catch (e) {
        console.error("Błąd inicjalizacji ScheduleDashboard:", e);
        setSchedules([]); // nie pozwól wywalić .map
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    boot();
    return () => {
      isMounted = false;
    };
  }, []);

  // --- odświeżenie listy ---
  const refreshSchedules = async () => {
    const token = localStorage.getItem(ACCESS_TOKEN);
    const headers = { Authorization: `Bearer ${token}` };
    try {
      const res = await api.get("/api/schedules/", { headers });
      setSchedules(toList(res.data));
    } catch (e) {
      console.error("Błąd pobierania terminów:", e);
      setSchedules([]);
    }
  };

  // --- dodawanie terminu ---
  const handleSubmit = async (e) => {
    e.preventDefault();
    // prosta walidacja
    const errors = [];
    if (!newSchedule.name.trim()) errors.push("Nazwa jest wymagana.");
    if (!newSchedule.date) errors.push("Data jest wymagana.");
    // godzina może być opcjonalna, jeśli u Ciebie nie – odkomentuj:
    // if (!newSchedule.time) errors.push("Godzina jest wymagana.");

    if (errors.length) {
      alert(errors.join("\n"));
      return;
    }

    const token = localStorage.getItem(ACCESS_TOKEN);
    const headers = { Authorization: `Bearer ${token}` };
    try {
      await api.post("/api/schedules/", newSchedule, { headers });
      await refreshSchedules();
      setNewSchedule({ name: "", date: "", time: "", notes: "" });
    } catch (e) {
      console.error("Błąd dodawania terminu:", e);
      alert("Nie udało się dodać terminu.");
    }
  };

  // --- usuwanie terminu ---
  const handleDelete = async (id) => {
    const token = localStorage.getItem(ACCESS_TOKEN);
    const headers = { Authorization: `Bearer ${token}` };
    try {
      await api.delete(`/api/schedules/${id}/`, { headers });
      setSchedules((prev) => toList(prev).filter((s) => s.id !== id));
    } catch (e) {
      console.error("Błąd usuwania terminu:", e);
      alert("Nie udało się usunąć terminu.");
    }
  };

  // --- zapis edycji (EditModal) ---
  const handleSaveEdit = async () => {
    const token = localStorage.getItem(ACCESS_TOKEN);
    const headers = { Authorization: `Bearer ${token}` };
    try {
      await api.put(`/api/schedules/${scheduleToEdit.id}/`, scheduleToEdit, {
        headers,
      });
      await refreshSchedules();
      setScheduleToEdit(null);
    } catch (e) {
      console.error("Błąd edycji terminu:", e);
      alert("Nie udało się zaktualizować terminu.");
    }
  };

  // --- lista znormalizowana do renderu ---
  const scheduleList = useMemo(() => toList(schedules), [schedules]);

  return (
    <div className="d-flex min-vh-100 bg-light">
      <Sidebar />

      <main className="flex-grow-1 p-4">
        <div className="mb-4 text-center">
          <h2 className="h3">Zarządzaj terminami</h2>
          <p className="text-muted">Dodawaj i śledź zaplanowane wydarzenia</p>
        </div>

        <EditModal
          item={scheduleToEdit}
          onChange={setScheduleToEdit}
          onCancel={() => setScheduleToEdit(null)}
          onSave={handleSaveEdit}
          fields={scheduleFields}
        />

        <div className="row g-4">
          {/* Formularz */}
          <div className="col-md-6">
            <div className="card shadow-sm">
              <div className="card-body">
                <h5 className="card-title">Dodaj nowy termin</h5>

                <form onSubmit={handleSubmit}>
                  <div className="mb-3">
                    <label className="form-label">Nazwa</label>
                    <input
                      type="text"
                      className="form-control"
                      value={newSchedule.name}
                      onChange={(e) =>
                        setNewSchedule({ ...newSchedule, name: e.target.value })
                      }
                    />
                  </div>

                  <div className="mb-3">
                    <label className="form-label">Data</label>
                    <input
                      type="date"
                      className="form-control"
                      value={newSchedule.date}
                      onChange={(e) =>
                        setNewSchedule({ ...newSchedule, date: e.target.value })
                      }
                    />
                  </div>

                  <div className="mb-3">
                    <label className="form-label">Godzina</label>
                    <input
                      type="time"
                      className="form-control"
                      value={newSchedule.time}
                      onChange={(e) =>
                        setNewSchedule({ ...newSchedule, time: e.target.value })
                      }
                    />
                  </div>

                  <div className="mb-3">
                    <label className="form-label">Opis</label>
                    <textarea
                      className="form-control"
                      rows="3"
                      value={newSchedule.notes}
                      onChange={(e) =>
                        setNewSchedule({ ...newSchedule, notes: e.target.value })
                      }
                    />
                  </div>

                  <button type="submit" className="btn btn-primary" disabled={loading}>
                    {loading ? "Zapisywanie..." : "Zapisz"}
                  </button>
                </form>
              </div>
            </div>
          </div>

          {/* Lista terminów */}
          <div className="col-md-6">
            <div className="card shadow-sm">
              <div className="card-body">
                <h5 className="card-title">Lista terminów</h5>

                {loading && (
                  <div className="d-flex justify-content-center my-2" role="status" aria-live="polite">
                    <div className="spinner-border" />
                    <span className="visually-hidden">Wczytywanie…</span>
                  </div>
                )}

                {scheduleList.length === 0 && !loading ? (
                  <div className="text-muted">Brak terminów.</div>
                ) : (
                  <ul className="list-group list-group-flush">
                    {scheduleList.map((schedule) => (
                      <li
                        key={schedule.id ?? `${schedule.name}-${schedule.date}-${schedule.time}`}
                        className="list-group-item d-flex justify-content-between align-items-start"
                      >
                        <div>
                          <strong>{schedule.name || "Bez nazwy"}</strong>
                          <br />
                          <small className="text-muted">
                            Kiedy: {fmtDateTime(schedule.date, schedule.time)}
                          </small>
                          {schedule.notes ? (
                            <>
                              <br />
                              <small className="text-muted">Opis: {schedule.notes}</small>
                            </>
                          ) : null}
                        </div>

                        <div className="d-flex align-items-center">
                          <button
                            className="btn btn-sm btn-outline-secondary me-2"
                            onClick={() => setScheduleToEdit(schedule)}
                          >
                            ✏️
                          </button>
                          <button
                            className="btn btn-sm btn-outline-danger"
                            onClick={() => handleDelete(schedule.id)}
                          >
                            🗑️
                          </button>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
