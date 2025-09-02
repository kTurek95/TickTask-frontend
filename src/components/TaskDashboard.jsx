import { useEffect, useMemo, useState } from "react";
import { ACCESS_TOKEN } from "../constants";
import api from "../api";
import EditModal from "./EditModal";
import { useSearchParams } from "react-router-dom";
import "../App.css";
import Sidebar from "./Sidebar";
import { ToastContainer, toast } from "react-toastify";

// === Helpery ===
const toList = (d) =>
  Array.isArray(d) ? d : Array.isArray(d?.results) ? d.results : [];

// Zamienia pole assigned_to na tablicę nazw (obsługuje string "Ala, Jan")
// albo już-tablicę (np. ["Ala", "Jan"])
const toNamesArray = (v) => {
  if (Array.isArray(v)) {
    return v
      .map(String)
      .map((s) => s.trim())
      .filter(Boolean);
  }
  if (typeof v === "string") {
    return v
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
  }
  return [];
};

export default function TaskDashboard() {
  const [users, setUsers] = useState([]);
  const [tasks, setTasks] = useState([]); // przechowujemy już tablicę
  const [currentUser, setCurrentUser] = useState(null);

  const [newTask, setNewTask] = useState({
    title: "",
    description: "",
    is_completed: false,
    priority: "Średni",
    deadline: "",
    status: "upcoming",
    assigned_to_ids: [],
    attachment: null,
  });

  const [taskToEdit, setTaskToEdit] = useState(null);
  const [isLeader, setIsLeader] = useState(false);
  const [searchParams] = useSearchParams();

  const [statusFilter, setStatusFilter] = useState("");
  const [priorityFilter, setPriorityFilter] = useState("");
  const [userFilter, setUserFilter] = useState("");
  const isAdmin = currentUser?.is_staff === true;

  const [viewType, setViewType] = useState("table");
  const [selectedCreatedBy, setSelectedCreatedBy] = useState("wszyscy");
  const [selectedAssignedUser, setSelectedAssignedUser] = useState("wszyscy"); // jeśli używasz dodatkowego selecta

  const [orderingFields, setOrderingFields] = useState(["deadline"]);
  const [orderingAsc, setOrderingAsc] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  const [fileKey, setFileKey] = useState(0);

  const taskFields = [
    { label: "Tytuł", name: "title", type: "text" },
    { label: "Opis", name: "description", type: "textarea" },
    {
      label: "Status",
      name: "status",
      type: "select",
      options: [
        { label: "W toku", value: "in_progress" },
        { label: "Nadchodzące", value: "upcoming" },
        { label: "Ukończone", value: "completed" },
        { label: "Po terminie", value: "overdue" },
      ],
    },
    {
      label: "Priorytet",
      name: "priority",
      type: "select",
      options: ["Wysoki", "Średni", "Niski"],
    },
    { label: "Termin", name: "deadline", type: "datetime-local" },
  ];

  const clearAttachment = () => {
  setNewTask((p) => ({ ...p, attachment: null }));
  setFileKey((k) => k + 1); // <- remount
};

  const handleResetFilters = () => {
    setStatusFilter("");
    setPriorityFilter("");
    setUserFilter("");
    setSelectedCreatedBy("wszyscy");
    setSelectedAssignedUser("wszyscy");
  };

  const translateStatus = (status) => {
    switch (status) {
      case "completed":
        return "Ukończone";
      case "in_progress":
        return "W toku";
      case "overdue":
        return "Po terminie";
      case "upcoming":
        return "Nadchodzące";
      case "no_deadline":
        return "Brak terminu";
      default:
        return status || "Brak statusu";
    }
  };

  const mapStatusFilter = (statusFilter) => {
    switch (statusFilter) {
      case "W toku":
        return "in_progress";
      case "Ukończone":
        return "completed";
      case "Po terminie":
        return "overdue";
      case "Nadchodzące":
        return "upcoming";
      default:
        return "";
    }
  };

  // Znormalizowana lista do pracy w UI
  const taskList = useMemo(() => toList(tasks), [tasks]);

  // Twórcy zadań do filtra
  const uniqueCreators = useMemo(
    () => [...new Set(taskList.map((t) => t?.created_by).filter(Boolean))],
    [taskList]
  );

  // Prefill filtrów z URL (np. ?user_id=...)
  useEffect(() => {
    const userIdFromUrl = searchParams.get("user_id");
    if (userIdFromUrl && users.length > 0) {
      const user = users.find((u) => String(u.id) === String(userIdFromUrl));
      if (user) setUserFilter(user.username);
    }
  }, [users, searchParams]);

  // Bieżący user / rola
  useEffect(() => {
    const fetchCurrentUser = async () => {
      const token = localStorage.getItem(ACCESS_TOKEN);
      try {
        const res = await api.get("/api/me/", {
          headers: { Authorization: `Bearer ${token}` },
        });
        const userData = res.data;
        setCurrentUser(userData);
        setIsLeader(
          userData.profile?.role === "leader" ||
            userData.userprofile?.role === "leader"
        );
      } catch (err) {
        console.error("Błąd pobierania aktualnego użytkownika:", err);
      }
    };
    fetchCurrentUser();
  }, []);

  // Użytkownicy widoczni dla bieżącego usera
  useEffect(() => {
    const fetchUsers = async () => {
      if (!currentUser) return;
      const token = localStorage.getItem(ACCESS_TOKEN);
      try {
        const res = await api.get("/api/visible-users/", {
          headers: { Authorization: `Bearer ${token}` },
        });
        setUsers(toList(res.data) || res.data || []);
      } catch (err) {
        console.error("Błąd pobierania widocznych użytkowników:", err);
      }
    };
    fetchUsers();
  }, [currentUser]);

  // Zadania (pobranie + sortowanie)
  useEffect(() => {
    fetchTasks(); // domyślnie sortowanie po deadline
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const fetchTasks = async (orderingParam = "deadline") => {
    try {
      const token = localStorage.getItem(ACCESS_TOKEN);
      const res = await api.get(`/api/tasks/?ordering=${orderingParam}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setTasks(toList(res.data));
    } catch (err) {
      console.error("Błąd pobierania zadań:", err);
      setTasks([]);
    }
  };

  const handleSort = (field) => {
    let newFields = [...orderingFields];
    const current = newFields[0];
    const baseCurrent = current?.replace("-", "");

    if (baseCurrent === field) {
      newFields[0] = current.startsWith("-") ? field : `-${field}`;
    } else {
      newFields = [
        field,
        ...newFields.filter((f) => f.replace("-", "") !== field),
      ];
    }

    setOrderingAsc(!newFields[0].startsWith("-"));
    setOrderingFields(newFields);
    fetchTasks(newFields.join(","));
  };

  const handleDelete = async (id) => {
    const token = localStorage.getItem(ACCESS_TOKEN);
    try {
      await api.delete(`/api/tasks/${id}/`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setTasks((prev) => toList(prev).filter((t) => t.id !== id));
    } catch (err) {
      console.error("Błąd usuwania zadania:", err);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const errors = [];
    if (!newTask.title.trim()) errors.push("Tytuł jest wymagany.");
    if (!currentUser) errors.push("Brak informacji o bieżącym użytkowniku.");

    if ((isAdmin || isLeader) && !newTask.assigned_to_ids?.length) {
      errors.push("Wybierz przynajmniej jednego użytkownika.");
    }
    if (errors.length) {
      toast.error(errors.join("\n"));
      return;
    }

    setIsLoading(true);
    try {
      const token = localStorage.getItem(ACCESS_TOKEN);

      // 🔹 Tworzymy FormData
      const fd = new FormData();
      fd.append("title", newTask.title);
      fd.append("description", newTask.description || "");
      fd.append("is_completed", newTask.is_completed);
      if (newTask.deadline) {
        fd.append("deadline", new Date(newTask.deadline).toISOString());
      }
      fd.append("priority", newTask.priority);

      // 🔹 Obsługa assigned_to_ids (może być wiele)
      const ids = (
        isAdmin || (isLeader && newTask.assigned_to_ids?.length)
          ? newTask.assigned_to_ids
          : [currentUser.id]
      ).map(Number);

      ids.forEach((id) => fd.append("assigned_to_ids", id));

      // 🔹 Dodanie załącznika jeśli jest
      if (newTask.attachment) {
        fd.append("attachment", newTask.attachment);
      }

      // 🔹 Wysyłka
      await api.post("/api/tasks/", fd, {
        headers: {
          Authorization: `Bearer ${token}`,
          // ❌ NIE ustawiamy Content-Type — axios zrobi to sam dla FormData
        },
      });

      // Toast z info
      const assignedUsernames =
        (users || [])
          .filter((u) => ids.includes(u.id))
          .map((u) => u.username)
          .join(", ") || (isAdmin || isLeader ? "brak użytkowników" : "sobie");

      toast.success(`✅ Zadanie przypisane do: ${assignedUsernames}`);

      // Odśwież listę
      const res = await api.get("/api/tasks/", {
        headers: { Authorization: `Bearer ${token}` },
      });
      setTasks(toList(res.data));

      // Reset formularza
      setNewTask({
        title: "",
        description: "",
        is_completed: false,
        priority: "Średni",
        status: "upcoming",
        deadline: "",
        assigned_to_ids: [],
        attachment: null,
      });
    } catch (err) {
      const status = err?.response?.status;
      const data = err?.response?.data;

      if (status === 400) {
        const dl = data?.deadline;
        if (
          (Array.isArray(dl) && dl.length) ||
          (typeof dl === "string" && dl)
        ) {
          toast.error("Termin nie może być z przeszłości.");
          return;
        }
        const title = data?.title;
        if (
          (Array.isArray(title) && title.length) ||
          (typeof title === "string" && title)
        ) {
          toast.error("Tytuł jest wymagany.");
          return;
        }
        toast.error("Niepoprawne dane — sprawdź formularz i spróbuj ponownie.");
      } else if (status === 500) {
        toast.error("Błąd serwera — spróbuj ponownie później.");
      } else {
        toast.error("Wystąpił nieoczekiwany błąd.");
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleSaveEdit = async () => {
    const token = localStorage.getItem(ACCESS_TOKEN);

    const payload = {
      title: taskToEdit.title,
      description: taskToEdit.description,
      is_completed: taskToEdit.is_completed,
      deadline: taskToEdit.deadline
        ? new Date(taskToEdit.deadline).toISOString()
        : null,
      priority: taskToEdit.priority,
      // status: taskToEdit.status, // jeśli status liczy backend — pomijamy
      assigned_to_ids: Array.isArray(taskToEdit.assigned_to_ids)
        ? taskToEdit.assigned_to_ids.map(Number)
        : [],
    };

    await api.put(`/api/tasks/${taskToEdit.id}/`, payload, {
      headers: { Authorization: `Bearer ${token}` },
    });

    const userParam =
      !userFilter || userFilter === "Wszyscy" ? "all" : userFilter;
    const res = await api.get(`/api/tasks/?user=${userParam}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    setTasks(toList(res.data));
    setTaskToEdit(null);
  };

  // Filtrowanie zadań
  const filteredTasks = useMemo(() => {
    const selectedStatusApi = mapStatusFilter(statusFilter);

    return taskList.filter((task) => {
      const assignedList = toNamesArray(task.assigned_to);

      const matchStatus =
        !selectedStatusApi || task.status === selectedStatusApi;

      const matchPriority =
        !priorityFilter ||
        priorityFilter === "Wszystkie" ||
        task.priority === priorityFilter;

      // WAŻNE: użytkownik może być jednym z wielu przypisanych → includes
      const matchUser =
        !userFilter ||
        userFilter === "Wszyscy" ||
        assignedList.includes(userFilter);

      const matchAssigned =
        selectedAssignedUser === "wszyscy" ||
        assignedList.includes(selectedAssignedUser);

      const matchCreator =
        selectedCreatedBy === "wszyscy" ||
        task.created_by === selectedCreatedBy;

      return (
        matchStatus &&
        matchPriority &&
        matchUser &&
        matchAssigned &&
        matchCreator
      );
    });
  }, [
    taskList,
    statusFilter,
    priorityFilter,
    userFilter,
    selectedAssignedUser,
    selectedCreatedBy,
  ]);

  // Prefill filtrów z URL (status/priority)
  useEffect(() => {
    const statusFromUrl = searchParams.get("status");
    const priorityFromUrl = searchParams.get("priority");

    if (statusFromUrl) {
      const normalized =
        statusFromUrl === "po_terminie"
          ? "Po terminie"
          : statusFromUrl.charAt(0).toUpperCase() +
            statusFromUrl.slice(1).toLowerCase();
      setStatusFilter(normalized);
    }

    if (priorityFromUrl) {
      const normalized =
        priorityFromUrl.charAt(0).toUpperCase() +
        priorityFromUrl.slice(1).toLowerCase();
      setPriorityFilter(normalized);
    }
  }, [searchParams]);

  // ===== RENDER =====
  return (
    <div className="d-flex min-vh-100 bg-light">
      <Sidebar />
      <ToastContainer />

      <main className="flex-grow-1 p-4">
        <div className="mb-4 text-center">
          <h2 className="h3">Zarządzaj zadaniami</h2>
          <p className="text-muted">Dodawaj, aktualizuj i śledź postęp prac</p>
        </div>

        <EditModal
          key={taskToEdit?.id}
          item={taskToEdit}
          onChange={setTaskToEdit}
          onCancel={() => setTaskToEdit(null)}
          onSave={handleSaveEdit}
          fields={taskFields}
        />

        <div className="row g-4">
          {/* Kolumna 1: Filtry */}
          <div className="col-md-4">
            <div className="card p-4 shadow-sm">
              <h5 className="mb-3">🎯 Filtry</h5>
              <div className="row g-3">
                <div className="col-12">
                  {(isAdmin || isLeader) && (
                    <div className="col-12">
                      <label className="form-label">Przypisane do:</label>
                      <select
                        className="form-select"
                        value={userFilter}
                        onChange={(e) => setUserFilter(e.target.value)}
                      >
                        <option value="">Wszyscy</option>
                        {users.map((user) => (
                          <option key={user.id} value={user.username}>
                            {user.username}
                            {currentUser?.id === user.id ? " (Ty)" : ""}
                          </option>
                        ))}
                      </select>
                    </div>
                  )}

                  {(isAdmin || isLeader) && (
                    <div className="mb-3">
                      <label htmlFor="createdByFilter" className="form-label">
                        Dodane przez:
                      </label>
                      <select
                        id="createdByFilter"
                        className="form-select"
                        value={selectedCreatedBy}
                        onChange={(e) => setSelectedCreatedBy(e.target.value)}
                      >
                        <option value="wszyscy">Wszyscy</option>
                        {uniqueCreators.map((name) => (
                          <option key={name} value={name}>
                            {name}
                          </option>
                        ))}
                      </select>
                    </div>
                  )}

                  <label className="form-label">Status</label>
                  <select
                    className="form-select"
                    value={statusFilter}
                    onChange={(e) => setStatusFilter(e.target.value)}
                  >
                    <option value="">Wszystkie</option>
                    <option value="W toku">W toku</option>
                    <option value="Ukończone">Ukończone</option>
                    <option value="Po terminie">Po terminie</option>
                    <option value="Nadchodzące">Nadchodzące</option>
                  </select>
                </div>

                <div className="col-12">
                  <label className="form-label">Priorytet</label>
                  <select
                    className="form-select"
                    value={priorityFilter}
                    onChange={(e) => setPriorityFilter(e.target.value)}
                  >
                    <option value="">Wszystkie</option>
                    <option value="Wysoki">Wysoki</option>
                    <option value="Średni">Średni</option>
                    <option value="Niski">Niski</option>
                  </select>
                </div>

                {(statusFilter ||
                  priorityFilter ||
                  userFilter ||
                  selectedCreatedBy !== "wszyscy" ||
                  selectedAssignedUser !== "wszyscy") && (
                  <button
                    className="btn btn-sm btn-outline-secondary ms-2"
                    onClick={handleResetFilters}
                  >
                    🔁 Resetuj wszystkie
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Kolumna 2: Formularz */}
          <div className="col-md-8">
            <div
              className="card shadow-sm mx-auto"
              style={{ maxWidth: "900px" }}
            >
              <div className="card-body">
                <h5 className="card-title">➕ Dodaj nowe zadanie</h5>
                <form onSubmit={handleSubmit}>
                  {(isAdmin || isLeader) && (
                    <div className="mb-3">
                      <label className="form-label">
                        Przypisz do użytkowników
                      </label>
                      <select
                        className="form-select"
                        multiple
                        value={newTask.assigned_to_ids}
                        onChange={(e) => {
                          const selected = Array.from(
                            e.target.selectedOptions,
                            (opt) => opt.value
                          );
                          setNewTask({ ...newTask, assigned_to_ids: selected });
                        }}
                      >
                        {users.map((user) => (
                          <option key={user.id} value={user.id}>
                            {user.username}
                            {user.id === currentUser?.id ? " (Ty)" : ""}
                          </option>
                        ))}
                      </select>
                      <small className="text-muted">
                        Przytrzymaj CTRL lub SHIFT, aby wybrać wielu.
                      </small>
                    </div>
                  )}

                  <div className="mb-3">
                    <label className="form-label">Tytuł zadania</label>
                    <input
                      type="text"
                      className="form-control"
                      value={newTask.title}
                      onChange={(e) =>
                        setNewTask({ ...newTask, title: e.target.value })
                      }
                    />
                  </div>

                  <div className="mb-3">
                    <label className="form-label">Opis zadania</label>
                    <textarea
                      className="form-control"
                      rows="3"
                      value={newTask.description}
                      onChange={(e) =>
                        setNewTask({ ...newTask, description: e.target.value })
                      }
                    ></textarea>
                  </div>

                  <div className="mb-3">
                    <label className="form-label fw-semibold">Załącznik:</label>
                    <input
                    key={fileKey}
                      type="file"
                      className="form-control"
                      onChange={(e) => {
                        const file = e.target.files?.[0] || null;
                        setNewTask((prev) => ({ ...prev, attachment: file }));
                      }}
                    />

                    {newTask.attachment && (
                      <button
                        type="button"
                        className="btn btn-link text-danger p-0 px-2"
                        onClick={() => {
                          setNewTask((prev) => ({ ...prev, attachment: null }));
                          setFileKey((k) => k + 1);
                        }}
                        title="Usuń plik"
                      >
                        ✖
                      </button>
                    )}
                  </div>

                  <div className="row g-3">
                    <div className="col-md-3">
                      <label className="form-label">Priorytet</label>
                      <select
                        className="form-select"
                        value={newTask.priority}
                        onChange={(e) =>
                          setNewTask({ ...newTask, priority: e.target.value })
                        }
                      >
                        <option>Wysoki</option>
                        <option>Średni</option>
                        <option>Niski</option>
                      </select>
                    </div>

                    <div className="col-md-4">
                      <label className="form-label">Status</label>
                      <select
                        className="form-select"
                        value={newTask.status}
                        onChange={(e) =>
                          setNewTask({ ...newTask, status: e.target.value })
                        }
                      >
                        <option value="upcoming">Nadchodzące</option>
                        <option value="in_progress">W toku</option>
                        <option value="completed">Ukończone</option>
                      </select>
                    </div>

                    <div className="col-md-5 mt-2">
                      <label className="form-label">Termin wykonania</label>
                      <input
                        type="datetime-local"
                        className="form-control mb-1"
                        value={newTask.deadline}
                        onChange={(e) =>
                          setNewTask({ ...newTask, deadline: e.target.value })
                        }
                      />
                    </div>
                  </div>

                  <button
                    className="btn btn-primary mt-3"
                    type="submit"
                    disabled={isLoading}
                  >
                    {isLoading ? "⏳ Dodawanie..." : "Dodaj zadanie"}
                  </button>
                </form>
              </div>
            </div>
          </div>

          {/* Główna sekcja listy */}
          <div className="col-12">
            <div className="d-flex justify-content-end align-items-center mb-3">
              <button
                className="btn btn-sm btn-outline-secondary"
                onClick={() =>
                  setViewType(viewType === "cards" ? "table" : "cards")
                }
              >
                {viewType === "cards" ? "🔁 Widok tabeli" : "🔁 Widok kart"}
              </button>
            </div>

            <div className="card shadow-sm mb-4">
              <div className="card-body">
                <h5 className="card-title">📋 Lista zadań</h5>

                {viewType === "cards" ? (
                  <div className="row">
                    {filteredTasks
                      .filter((task) => task.status !== "completed")
                      .map((task) => (
                        <div key={task.id} className="col-md-4 mb-2 px-1">
                          <div
                            className={`card h-100 shadow-sm border p-2 small ${
                              task.status === "overdue"
                                ? "border-danger bg-danger bg-opacity-10"
                                : task.status === "upcoming"
                                ? "border-primary bg-primary bg-opacity-10"
                                : task.status === "in_progress"
                                ? "border-warning bg-warning bg-opacity-10"
                                : "border-secondary"
                            }`}
                          >
                            <div className="card-body p-2 d-flex flex-column justify-content-between">
                              <h5 className="card-title">
                                {task.status === "overdue"
                                  ? "⚠️"
                                  : task.status === "in_progress"
                                  ? "🔄"
                                  : task.status === "upcoming"
                                  ? "⏳"
                                  : "📅"}{" "}
                                <strong>{task.title}</strong>
                              </h5>

                              <p>
                                <small>Dodane przez:</small>{" "}
                                {task.created_by || "Brak"}
                              </p>
                              <p>
                                Przypisane do:{" "}
                                {toNamesArray(task.assigned_to).join(", ") ||
                                  "Brak"}
                              </p>

                              {task.description && (
                                <small className="text-muted">
                                  Opis: {task.description}
                                </small>
                              )}
                              <br />

                              <small
                                className={`${
                                  task.priority === "Wysoki"
                                    ? "text-danger"
                                    : task.priority === "Średni"
                                    ? "text-warning"
                                    : "text-success"
                                }`}
                              >
                                Priorytet: {task.priority || "Brak"}
                              </small>
                              <br />

                              <strong className="text-muted">
                                Deadline:{" "}
                                {task.deadline
                                  ? task.deadline
                                      .replace("Z", "")
                                      .replace("T", " ")
                                  : "Brak"}
                              </strong>

                              {task.recent_comments?.length > 0 ? (
                                <div className="mt-2">
                                  <small className="text-muted">
                                    💬 Komentarze:
                                  </small>
                                  <ul className="list-unstyled small mb-0">
                                    {task.recent_comments.map(
                                      (comment, index) => (
                                        <li key={index}>
                                          <strong>{comment.author}:</strong>{" "}
                                          {comment.content}
                                        </li>
                                      )
                                    )}
                                  </ul>
                                </div>
                              ) : (
                                <small className="text-muted">
                                  <br />
                                  Brak komentarzy
                                </small>
                              )}

                              <br />
                              <small className="text-muted">
                                Status: {translateStatus(task.status)}
                              </small>

                              <div className="d-flex justify-content-between align-items-center pt-3 mt-auto">
                                <small className="text-muted">
                                  Utworzono:{" "}
                                  {task.created_at
                                    ?.slice(0, 19)
                                    .replace("T", " ")}
                                </small>
                                <div className="d-flex gap-2">
                                  <button
                                    className="btn btn-sm btn-outline-primary"
                                    onClick={() => setTaskToEdit(task)}
                                  >
                                    ✏️
                                  </button>
                                  {(currentUser?.is_staff ||
                                    task.created_by ===
                                      currentUser?.username) && (
                                    <button
                                      className="btn btn-sm btn-outline-danger"
                                      onClick={() => handleDelete(task.id)}
                                    >
                                      🗑️
                                    </button>
                                  )}
                                </div>
                              </div>
                            </div>
                          </div>
                        </div>
                      ))}
                  </div>
                ) : (
                  <div className="table-responsive">
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                        marginBottom: "1rem",
                        fontSize: "0.9rem",
                      }}
                    >
                      <div>
                        <strong>Sortowanie:</strong>{" "}
                        {orderingFields.map((field, index) => {
                          const base = field.replace("-", "");
                          const direction = field.startsWith("-") ? "↓" : "↑";
                          return (
                            <span key={index} style={{ marginRight: "1rem" }}>
                              {base} {direction}
                            </span>
                          );
                        })}
                      </div>

                      <button
                        onClick={() => {
                          setOrderingFields(["deadline"]);
                          setOrderingAsc(true);
                          fetchTasks("deadline");
                        }}
                        style={{
                          background: "#f5f5f5",
                          border: "1px solid #ccc",
                          borderRadius: "4px",
                          padding: "4px 10px",
                          cursor: "pointer",
                          fontSize: "0.85rem",
                          transition: "background 0.2s",
                        }}
                        onMouseOver={(e) =>
                          (e.currentTarget.style.background = "#e0e0e0")
                        }
                        onMouseOut={(e) =>
                          (e.currentTarget.style.background = "#f5f5f5")
                        }
                      >
                        🔄 Resetuj
                      </button>
                    </div>

                    <table className="table table-bordered table-hover small">
                      <thead>
                        <tr>
                          <th
                            onClick={() => handleSort("title")}
                            style={{ cursor: "pointer" }}
                          >
                            Tytuł{" "}
                            <span style={{ fontSize: "0.8em" }}>
                              <span
                                style={{
                                  color:
                                    orderingFields[0]?.replace("-", "") ===
                                      "title" && orderingAsc
                                      ? "black"
                                      : "#ccc",
                                }}
                              >
                                ▲
                              </span>
                              <span
                                style={{
                                  color:
                                    orderingFields[0]?.replace("-", "") ===
                                      "title" && !orderingAsc
                                      ? "black"
                                      : "#ccc",
                                }}
                              >
                                ▼
                              </span>
                            </span>
                          </th>

                          <th
                            onClick={() => handleSort("status")}
                            style={{ cursor: "pointer" }}
                          >
                            Status{" "}
                            <span style={{ fontSize: "0.8em" }}>
                              <span
                                style={{
                                  color:
                                    orderingFields[0]?.replace("-", "") ===
                                      "status" && orderingAsc
                                      ? "black"
                                      : "#ccc",
                                }}
                              >
                                ▲
                              </span>
                              <span
                                style={{
                                  color:
                                    orderingFields[0]?.replace("-", "") ===
                                      "status" && !orderingAsc
                                      ? "black"
                                      : "#ccc",
                                }}
                              >
                                ▼
                              </span>
                            </span>
                          </th>

                          <th
                            onClick={() => handleSort("priority")}
                            style={{ cursor: "pointer" }}
                          >
                            Priorytet{" "}
                            <span style={{ fontSize: "0.8em" }}>
                              <span
                                style={{
                                  color:
                                    orderingFields[0]?.replace("-", "") ===
                                      "priority" && orderingAsc
                                      ? "black"
                                      : "#ccc",
                                }}
                              >
                                ▲
                              </span>
                              <span
                                style={{
                                  color:
                                    orderingFields[0]?.replace("-", "") ===
                                      "priority" && !orderingAsc
                                      ? "black"
                                      : "#ccc",
                                }}
                              >
                                ▼
                              </span>
                            </span>
                          </th>

                          <th
                            onClick={() => handleSort("deadline")}
                            style={{ cursor: "pointer" }}
                          >
                            Deadline{" "}
                            <span style={{ fontSize: "0.8em" }}>
                              <span
                                style={{
                                  color:
                                    orderingFields[0]?.replace("-", "") ===
                                      "deadline" && orderingAsc
                                      ? "black"
                                      : "#ccc",
                                }}
                              >
                                ▲
                              </span>
                              <span
                                style={{
                                  color:
                                    orderingFields[0]?.replace("-", "") ===
                                      "deadline" && !orderingAsc
                                      ? "black"
                                      : "#ccc",
                                }}
                              >
                                ▼
                              </span>
                            </span>
                          </th>

                          <th>Dodane przez</th>
                          <th>Przypisane do</th>
                          <th>Załącznik</th>
                          <th>Akcje</th>
                        </tr>
                      </thead>

                      <tbody>
                        {filteredTasks
                          .filter((task) => task.status !== "completed")
                          .map((task) => (
                            <tr
                              key={task.id}
                              className={
                                task.status === "overdue"
                                  ? "table-danger"
                                  : task.status === "in_progress"
                                  ? "table-warning"
                                  : task.status === "upcoming"
                                  ? "table-primary"
                                  : ""
                              }
                            >
                              <td>
                                {task.status === "overdue"
                                  ? "⚠️"
                                  : task.status === "in_progress"
                                  ? "🔄"
                                  : task.status === "upcoming"
                                  ? "⏳"
                                  : "📅"}{" "}
                                {task.title}
                              </td>
                              <td>{translateStatus(task.status)}</td>
                              <td>{task.priority || "Brak"}</td>
                              <td>
                                {task.deadline
                                  ? task.deadline.slice(0, 19).replace("T", " ")
                                  : "Brak"}
                              </td>
                              <td>{task.created_by || "Brak"}</td>
                              <td>
                                {toNamesArray(task.assigned_to).join(", ") ||
                                  "Brak"}
                              </td>

                              <td>
                                {task.attachment ? (
                                  <a
                                    href={
                                      task.attachment.startsWith("http")
                                        ? task.attachment
                                        : `${process.env.REACT_APP_API_URL}${task.attachment}`
                                    }
                                    target="_blank"
                                    rel="noreferrer"
                                  >
                                    📎 {task.attachment.split("/").pop()}
                                  </a>
                                ) : (
                                  <span>Brak załącznika</span>
                                )}
                              </td>
                              <td>
                                <div className="d-flex gap-1">
                                  <button
                                    className="btn btn-sm btn-outline-primary"
                                    onClick={() => setTaskToEdit(task)}
                                  >
                                    ✏️
                                  </button>
                                  {(currentUser?.is_staff ||
                                    task.created_by ===
                                      currentUser?.username) && (
                                    <button
                                      className="btn btn-sm btn-outline-danger"
                                      onClick={() => handleDelete(task.id)}
                                    >
                                      🗑️
                                    </button>
                                  )}
                                </div>
                              </td>
                            </tr>
                          ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>

            {/* ✅ Ukończone zadania */}
            <div className="card shadow-sm">
              <div className="card-body">
                <h5 className="card-title">✅ Ukończone zadania</h5>

                {filteredTasks.filter((t) => t.status === "completed")
                  .length === 0 && (
                  <p className="text-muted">Brak ukończonych zadań.</p>
                )}

                {viewType === "cards" ? (
                  <div className="row">
                    {filteredTasks
                      .filter((task) => task.status === "completed")
                      .map((task) => (
                        <div key={task.id} className="col-md-4 mb-2 px-1">
                          <div className="card h-100 shadow-sm border border-success bg-success bg-opacity-10 p-2 small">
                            <div className="card-body p-2 d-flex flex-column justify-content-between">
                              <h5 className="card-title">
                                ✅ <strong>{task.title}</strong>
                              </h5>

                              <p>
                                <small>Dodane przez:</small>{" "}
                                {task.created_by || "Brak"}
                              </p>
                              <p>
                                Przypisane do:{" "}
                                {toNamesArray(task.assigned_to).join(", ") ||
                                  "Brak"}
                              </p>

                              {task.description && (
                                <small className="text-muted text-decoration-line-through">
                                  Opis: {task.description}
                                </small>
                              )}
                              <br />

                              <small
                                className={`${
                                  task.priority === "Wysoki"
                                    ? "text-danger"
                                    : task.priority === "Średni"
                                    ? "text-warning"
                                    : "text-success"
                                }`}
                              >
                                Priorytet: {task.priority || "Brak"}
                              </small>
                              <br />

                              <strong className="text-muted">
                                Deadline:{" "}
                                {task.deadline
                                  ? task.deadline
                                      .replace("Z", "")
                                      .replace("T", " ")
                                  : "Brak"}
                              </strong>

                              <br />
                              <small className="text-muted">
                                Utworzono:{" "}
                                {task.created_at
                                  ?.slice(0, 19)
                                  .replace("T", " ")}
                              </small>
                            </div>
                          </div>
                        </div>
                      ))}
                  </div>
                ) : (
                  <div className="table-responsive">
                    <table className="table table-bordered table-hover small">
                      <thead>
                        <tr>
                          <th>Tytuł</th>
                          <th>Status</th>
                          <th>Priorytet</th>
                          <th>Deadline</th>
                          <th>Dodane przez</th>
                          <th>Przypisane do</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredTasks
                          .filter((task) => task.status === "completed")
                          .map((task) => (
                            <tr key={task.id} className="table-success">
                              <td>✅ {task.title}</td>
                              <td>{translateStatus(task.status)}</td>
                              <td>{task.priority || "Brak"}</td>
                              <td>
                                {task.deadline
                                  ? task.deadline.slice(0, 19).replace("T", " ")
                                  : "Brak"}
                              </td>
                              <td>{task.created_by || "Brak"}</td>
                              <td>
                                {toNamesArray(task.assigned_to).join(", ") ||
                                  "Brak"}
                              </td>
                            </tr>
                          ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
