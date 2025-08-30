import { useEffect, useState } from "react";
import api from "../api";
import { ACCESS_TOKEN, REFRESH_TOKEN } from "../constants";
import { Link, useLocation } from "react-router-dom";
import "../App.css";
import Sidebar from "./Sidebar";
import { ToastContainer, toast } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";


export default function UsersDashboard() {
  const [users, setUsers] = useState([]);
  const [selectedUserForTask, setSelectedUserForTask] = useState(null);
  const [taskData, setTaskData] = useState({
    title: "",
    description: "",
    priority: "Średni",
    is_completed: false,
    deadline: "",
  });

  const location = useLocation();

  const isActive = (path) => (location.pathname === path ? "active" : "");

  const [currentUser, setCurrentUser] = useState(null);
  const isAdmin = currentUser?.is_staff === true;
  const [isLeader, setIsLeader] = useState(false);

  useEffect(() => {
    const fetchCurrentUser = async () => {
      const token = localStorage.getItem(ACCESS_TOKEN);
      try {
        const res = await api.get("/api/me/", {
          headers: { Authorization: `Bearer ${token}` },
        });

        const userData = res.data;
        setCurrentUser(userData);
        setIsLeader(userData.profile?.role === "leader");

      } catch (err) {
        console.error("Błąd pobierania aktualnego użytkownika:", err);
      }
    };

    fetchCurrentUser();
  }, []);

  useEffect(() => {
    const fetchUsers = async () => {
      if (!currentUser) return;

      const token = localStorage.getItem(ACCESS_TOKEN);

      try {
        const res = await api.get("/api/visible-users/", {
          headers: { Authorization: `Bearer ${token}` },
        });
        setUsers(res.data);
      } catch (err) {
        console.error("Błąd pobierania widocznych użytkowników:", err);
      }
    };

    fetchUsers();
  }, [currentUser]);

  const handleAddTask = async () => {
  const token = localStorage.getItem(ACCESS_TOKEN);

  if (!token) {
    alert("Brak tokena – zaloguj się ponownie.");
    return;
  }

  const isAdmin = currentUser?.is_staff === true;
  const isLeader = currentUser?.profile?.role === "leader";
  const selectedUserId = selectedUserForTask?.id;

  if ((isAdmin || isLeader) && !selectedUserId) {
    alert("Musisz wybrać użytkownika!");
    return;
  }

  const payload = {
    title: taskData.title,
    description: taskData.description,
    priority: taskData.priority,
    deadline: taskData.deadline,
    is_completed: taskData.is_completed,
    assigned_to_ids: [selectedUserForTask?.id],
    
  };

  try {
    await api.post("/api/tasks/", payload, {
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
    });
    toast.success(`Zadanie dla ${selectedUserForTask.username} zostało dodane`);

    setTaskData({
      title: "",
      description: "",
      priority: "Średni",
      is_completed: false,
      deadline: "",
    });
    setSelectedUserForTask(null);
  } catch (error) {
    console.error("❌ Błąd dodawania zadania:", error);
    alert("Błąd: Nie posiadasz wymaganych uprawnień");
  }
};


  return (
    <div className="d-flex min-vh-100 bg-light">
      <Sidebar />

      {/* Main */}
      <ToastContainer />

      <main className="flex-grow-1 p-4">
        <div className="mb-4">
          <h2 className="h3">Użytkownicy</h2>
          <p className="text-muted">
            Kliknij, aby przypisać zadanie użytkownikowi
          </p>
        </div>

        <div className="card shadow-sm">
          <div className="card-body">
            {users.length === 0 ? (
              <p className="text-muted">Brak użytkowników do wyświetlenia.</p>
            ) : (
              <ul className="list-group list-group-flush">
                {users.map((user) => (
                  <li
                    key={user.id}
                    className="list-group-item d-flex justify-content-between align-items-center"
                  >
                    <div>
                      <strong>
                        {user.username}
                        {currentUser?.id === user.id ? " (Ty)" : ""}
                      </strong>
                      {user.email && (
                        <div className="text-muted">{user.email}</div>
                      )}
                    </div>
                    {(isAdmin || isLeader) && currentUser.id !== user.id && (
                      <button
                        className="btn btn-sm btn-outline-primary"
                        onClick={() => {console.log("🔵 Kliknięto ➕ dla:", user);setSelectedUserForTask(user)}
}
                      >
                        ➕ Dodaj zadanie
                      </button>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </main>

      {/* Modal */}
      {selectedUserForTask && (
        <div className="modal show d-block" tabIndex="-1" role="dialog">
          <div className="modal-dialog" role="document">
            <div className="modal-content">
              <div className="modal-header">
                <h5 className="modal-title">
                  Dodaj zadanie dla: {selectedUserForTask.username}
                </h5>
                <button
                  type="button"
                  className="btn-close"
                  onClick={() => setSelectedUserForTask(null)}
                ></button>
              </div>
              <div className="modal-body">
                <div className="mb-3">
                  <label className="form-label">Tytuł</label>
                  <input
                    type="text"
                    className="form-control"
                    value={taskData.title}
                    onChange={(e) =>
                      setTaskData({ ...taskData, title: e.target.value })
                    }
                  />
                </div>
                <div className="mb-3">
                  <label className="form-label">Opis</label>
                  <textarea
                    className="form-control"
                    value={taskData.description}
                    onChange={(e) =>
                      setTaskData({ ...taskData, description: e.target.value })
                    }
                  />
                </div>
                <div className="mb-3">
                  <label className="form-label">Priorytet</label>
                  <select
                    className="form-select"
                    value={taskData.priority}
                    onChange={(e) =>
                      setTaskData({ ...taskData, priority: e.target.value })
                    }
                  >
                    <option>Wysoki</option>
                    <option>Średni</option>
                    <option>Niski</option>
                  </select>
                </div>
                <div className="mb-3">
                  <label className="form-label">Status</label>
                  <select
                    className="form-select"
                    value={taskData.is_completed ? "Ukończone" : "Nadchodzące"}
                    onChange={(e) =>
                      setTaskData({
                        ...taskData,
                        is_completed: e.target.value === "Ukończone",
                      })
                    }
                  >
                    <option>Nadchodzące</option>
                    <option>W toku</option>
                    <option>Ukończone</option>
                  </select>
                </div>
                <div className="col-md-5 mt-2">
                  <label className="form-label">Termin wykonania</label>
                  <input
                    type="datetime-local"
                    className="form-control mb-1"
                    value={taskData.deadline}
                    onChange={(e) =>
                      setTaskData({ ...taskData, deadline: e.target.value })
                    }
                  />
                </div>
              </div>
              <div className="modal-footer">
                <button
                  className="btn btn-secondary"
                  onClick={() => setSelectedUserForTask(null)}
                >
                  Anuluj
                </button>
                <button className="btn btn-primary" onClick={handleAddTask}>
                  Zapisz zadanie
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
