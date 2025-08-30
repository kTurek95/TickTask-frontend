import React, { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import Sidebar from "./Sidebar";
import api from "../api";
import { ACCESS_TOKEN } from "../constants";

const SettingsPage = () => {
  const [darkMode, setDarkMode] = useState(false);
  const [emailNotifications, setEmailNotifications] = useState(true);
  const [language, setLanguage] = useState("pl");
  const [user, setUser] = useState(null);
  const token = localStorage.getItem(ACCESS_TOKEN);
  const [users, setUsers] = useState([]);
  const [currentUser, setCurrentUser] = useState(null);
  const [selectedUser, setSelectedUser] = useState(null);

  useEffect(() => {
    const fetchUsers = async () => {
      try {
        const res = await api.get("/api/users/", {
          headers: { Authorization: `Bearer ${token}` },
        });
        setUsers(res.data);
      } catch (err) {
        console.error("Błąd pobierania użytkowników:", err);
      }
    };

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

    fetchUsers();
    fetchCurrentUser();
  }, []);

  const handleSave = () => {
    alert("Zmiany nie są jeszcze dostępne");
  };

  const changePassword = () => {
    alert("Zmiana hasła nie jest jeszcze możliwa");
  };

  const changeMode = () => {
    alert("Funkcjonalność nie jest jeszcze dostępna");
  };

  return (
    <div className="d-flex min-vh-100 bg-light">
      <Sidebar />

      <div className="container mt-4">
        <h2 className="mb-4">⚙️ Ustawienia</h2>

        {/* Sekcja: Konto */}
        <div className="card mb-4">
          <div className="card-header">🧑 Konto</div>
          <div className="card-body">
            <div className="mb-3">
              <label className="form-label">Nazwa użytkownika</label>
              <input
                type="text"
                className="form-control"
                value={currentUser?.username || ""}
                readOnly
              />
            </div>
            <div className="mb-3">
              <label className="form-label">Adres e-mail</label>
              <input
                type="email"
                className="form-control"
                value={currentUser?.email || ""}
                readOnly
              />
            </div>
            <button className="btn btn-outline-primary" onClick={changePassword}>
              Zmień hasło
            </button>
          </div>
        </div>

        {/* Sekcja: Wygląd */}
        <div className="card mb-4">
          <div className="card-header">🎨 Wygląd</div>
          <div className="card-body">
            <div className="form-check form-switch mb-3">
              <input
                className="form-check-input"
                type="checkbox"
                checked={darkMode}
                onChange={changeMode}
                id="darkModeSwitch"
              />
              <label className="form-check-label" htmlFor="darkModeSwitch">
                Tryb ciemny
              </label>
            </div>
            <div className="mb-3">
              <label className="form-label">Język</label>
              <select className="form-select" value={language} onChange={changeMode}>
                <option value="pl">Polski 🇵🇱</option>
                <option value="en">English 🇬🇧</option>
              </select>
            </div>
          </div>
        </div>

        {/* Sekcja: Powiadomienia */}
        <div className="card mb-4">
          <div className="card-header">🔔 Powiadomienia</div>
          <div className="card-body">
            <div className="form-check mb-2">
              <input
                className="form-check-input"
                type="checkbox"
                checked={emailNotifications}
                onChange={changeMode}
                id="emailNotif"
              />
              <label className="form-check-label" htmlFor="emailNotif">
                Powiadomienia e-mail o zadaniach
              </label>
            </div>
          </div>
        </div>

        {/* Sekcja: Akcje */}
        <div className="card mb-4">
          <div className="card-header">⚠️ Akcje</div>
          <div className="card-body">
            <button className="btn btn-outline-danger me-2" onClick={changeMode}>
              Usuń konto
            </button>
            <button className="btn btn-outline-secondary">
              <Link className="text-decoration-none" to="/logout">
                Wyloguj się
              </Link>
            </button>
          </div>
        </div>

        {/* Zapisz ustawienia */}
        <div className="text-end">
          <button className="btn btn-success" onClick={handleSave}>
            💾 Zapisz zmiany
          </button>
        </div>
      </div>
    </div>
  );
};

export default SettingsPage;
