// HomeDashboard.jsx
import React from "react";
import { Navigate, useLocation } from "react-router-dom";
import { useState, useEffect } from "react";
import { ACCESS_TOKEN } from "../constants";
import ActivityList from "./ActivityList";
import Sidebar from "./Sidebar";
import UnreadMessagesNotifier from "./UnreadMessagesNotifier";
import { useNavigate } from "react-router-dom";
import { useSearchParams } from "react-router-dom";
import api from "../api";

export default function HomeDashboard() {
  const [currentUser, setCurrentUser] = useState(null);
  const isAdmin = currentUser?.is_staff === true;
  const isLeader = currentUser?.profile?.role === "leader";
  const location = useLocation();
  const [users, setUsers] = useState([]);
  const [selectedUser, setSelectedUser] = useState(null);
  const token = localStorage.getItem(ACCESS_TOKEN);
  const isActive = (path) => (location.pathname === path ? "active" : "");
  const [searchParams] = useSearchParams();
  const [selectedUserId, setSelectedUserId] = useState(null);

  const [dashboardStats, setDashboardStats] = useState({
    terminy: 0,
    uzytkownicy: null,
  });

  const navigate = useNavigate();
  const goToFilteredTasks = (filter) => {
  const params = new URLSearchParams();

  const [key, value] = filter.split("="); // np. ["priority", "wysoki"]
  params.set(key, value); // ustawia odpowiedni filtr

  if (selectedUser?.id) {
    params.set("user_id", selectedUser.id);
  }

  navigate(`/zadania?${params.toString()}`);
};

  function navigateToUsers() {
    navigate("/uzytkownicy");
  }

  function navigateToSchedules() {
    navigate("/terminy")
  }

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const res = await api.get("/api/dashboard-stats/", {
          headers: { Authorization: `Bearer ${token}` },
        });
        setDashboardStats(res.data);
      } catch (err) {
        console.error("Błąd pobierania statystyk dashboardu:", err);
      }
    };

    fetchStats();
  }, []);

  useEffect(() => {
    api
      .get("api/tasks-stats/", {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      })
      .then((res) => {
      })
      .catch((err) => {
        console.error("❌ Błąd:", err);
      });
  }, []);

  useEffect(() => {
    const fetchCurrentUser = async () => {
      try {
        const res = await api.get("/api/me/", {
          headers: { Authorization: `Bearer ${token}` },
        });
        setCurrentUser(res.data);
        setSelectedUser(res.data);
      } catch (err) {
        console.error("Błąd pobierania aktualnego użytkownika:", err);
      }
    };

    fetchCurrentUser();
  }, [token]);

  useEffect(() => {
    const fetchUsers = async () => {
      if (!currentUser) return;

      try {
        const res = await api.get("/api/visible-users/", {
          headers: { Authorization: `Bearer ${token}` },
        });
        setUsers(res.data);
      } catch (err) {
        console.error("Błąd pobierania użytkowników:", err);
      }
    };

    fetchUsers();
  }, [currentUser, token]);

  const [taskStats, setTaskStats] = useState(null);

  useEffect(() => {
    const fetchStats = async () => {
      if (selectedUser?.id) {
        try {
          const res = await api.get(
            `/api/summary-tasks/?user_id=${selectedUser.id}`,
            {
              headers: { Authorization: `Bearer ${token}` },
            }
          );
          setTaskStats(res.data[0]);
        } catch (err) {
          console.error("Błąd podczas pobierania statystyk:", err);
          setTaskStats(null);
        }
      }
    };

    fetchStats();
  }, [selectedUser]);

  return (
    <div className="d-flex min-vh-100 bg-light">
      <Sidebar />
      <div className="container py-4">
        {currentUser && (
          <div className="text-center mb-4">
            <h2 className="fw-bold">Witaj {currentUser.username}👋</h2>
            <p className="text-muted">
              Twoje podsumowanie znajduje się poniżej
            </p>
          </div>
        )}

        <UnreadMessagesNotifier />

        {/* Dropdown wyboru użytkownika */}
        {(isAdmin || isLeader) && (
          <div className="mb-4 text-center">
            <label className="form-label d-block mb-2 fw-semibold">
              👥 Użytkownicy
            </label>
            <select
              className="form-select w-auto d-inline rounded-pill shadow-sm px-4"
              style={{ fontSize: "1rem", minWidth: "200px" }}
              value={selectedUser?.id || ""}
              onChange={(e) => {
                const found = users.find(
                  (u) => String(u.id) === e.target.value
                );
                setSelectedUser(found);
              }}
            >
              {users.map((user) => (
                <option key={user.id} value={user.id}>
                  {user.username}
                  {currentUser?.id === user.id ? " (Ty)" : ""}
                </option>
              ))}
            </select>
          </div>
        )}

        {taskStats && (
          <div
            className="card p-5 shadow-sm mx-auto mb-5"
            style={{ maxWidth: "1100px", fontSize: "1.1rem" }}
          >
            <h4 className="mb-4 text-center">
              <strong className="text-center">📊 Statystyki zadań</strong>
            </h4>

            {/* Statusy */}
            <div className="d-flex flex-wrap justify-content-center gap-4 mb-4">
              {[
                {
                  label: "Wszystkie",
                  icon: "📋",
                  value: taskStats?.total ?? 0,
                  color: "",
                  filter: "status=wszystkie",
                },
                {
                  label: "Ukończone",
                  icon: "✅",
                  value: taskStats?.completed ?? 0,
                  color: "text-success",
                  filter: "status=ukończone",
                },
                {
                  label: "W toku",
                  icon: "🔄",
                  value: taskStats?.in_progress ?? 0,
                  color: "text-warning",
                  filter: "status=w toku",
                },
                {
                  label: "Po terminie",
                  icon: "⚠️",
                  value: taskStats?.overdue ?? 0,
                  color: "text-danger",
                  filter: "status=po_terminie",
                },
                {
                  label: "Nadchodzące",
                  icon: "⏳",
                  value: taskStats?.upcoming ?? 0,
                  color: "text-primary",
                  filter: "status=nadchodzące",
                },
              ].map(({ label, icon, value, color, filter }) => (
                <div
                  key={label}
                  className={`card shadow-sm p-4 text-center ${color}`}
                  onClick={() => goToFilteredTasks(filter)}
                  style={{
                    cursor: "pointer",
                    width: "180px",
                    minHeight: "160px",
                    display: "flex",
                    flexDirection: "column",
                    justifyContent: "center",
                    alignItems: "center",
                  }}
                >
                  <div className="fs-2">{icon}</div>
                  <h6 className="mt-2 mb-1">{label}</h6>
                  <h3>
                    <strong>{value}</strong>
                  </h3>
                </div>
              ))}
            </div>

            {/* Priorytety */}
            <div className="text-center mt-4">
              <h4 className="mb-4">🎯 Priorytety</h4>
              <div className="d-flex flex-wrap justify-content-center gap-4">
                {["Wysoki", "Średni", "Niski"].map((priority) => {
                  const count = taskStats.priority_stats?.[priority] || 0;
                  let icon = "🟢",
                    className = "text-success",
                    filter = "priority=niski";

                  if (priority === "Wysoki") {
                    icon = "🔴";
                    className = "text-danger";
                    filter = "priority=wysoki";
                  } else if (priority === "Średni") {
                    icon = "🟡";
                    className = "text-warning";
                    filter = "priority=średni";
                  }

                  return (
                    <div
                      key={priority}
                      className={`card shadow-sm p-4 text-center ${className}`}
                      onClick={() => goToFilteredTasks(filter)}
                      style={{
                        cursor: "pointer",
                        width: "160px",
                        minHeight: "140px",
                        display: "flex",
                        flexDirection: "column",
                        justifyContent: "center",
                        alignItems: "center",
                      }}
                    >
                      <div className="fs-3">{icon}</div>
                      <div className="mt-1">{priority}</div>
                      <div className="fw-bold fs-4">{count}</div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {/* Karty: Terminy, Użytkownicy */}
        <div className="row text-center mb-4">
          <div className="col-md-6">
            <div className="card shadow-sm p-3"
            onClick={navigateToSchedules}
            style={{cursor: "pointer"}}>
              📅
              <h5>Terminy</h5>
              <p className="text-muted">Nadchodzące wydarzenia</p>
              <h5>
                <strong>{dashboardStats.terminy}</strong>
              </h5>
            </div>
          </div>

          <div className="col-md-6">
            <div className="card shadow-sm p-3" onClick={navigateToUsers}
            style={{cursor: "pointer"}}>
              👥
              <h5>Użytkownicy</h5>
              <p className="text-muted">Zarejestrowanych w systemie</p>
              <h5>
                <strong>{dashboardStats.uzytkownicy}</strong>
              </h5>
            </div>
          </div>
        </div>

        {/* Aktywności */}
        <div className="mt-4">
          <ActivityList />
        </div>
      </div>
    </div>
  );
}
