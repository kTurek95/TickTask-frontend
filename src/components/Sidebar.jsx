import { Link, useLocation } from "react-router-dom";
import api from "../api";
import { ACCESS_TOKEN } from "../constants";
import { useState, useEffect } from "react";

const toList = (d) =>
  Array.isArray(d) ? d : Array.isArray(d?.results) ? d.results : [];

const POLL_MS = 15000;

const Sidebar = () => {
  const location = useLocation();

  // startowy stan: z localStorage, a jeśli brak – domyślnie zwiniety na < 768 px
  const [isCollapsed, setIsCollapsed] = useState(() => {
    const saved = localStorage.getItem("sidebarCollapsed");
    return saved !== null ? saved === "true" : window.innerWidth < 768;
  });

  const [hasUnread, setHasUnread] = useState(false);

  const isActive = (path) => (location.pathname === path ? "active" : "");

  const getAuthHeaders = () => {
    const token = localStorage.getItem(ACCESS_TOKEN);
    return token ? { Authorization: `Bearer ${token}` } : {};
  };

  // Zapisuj zmianę w localStorage
  useEffect(() => {
    localStorage.setItem("sidebarCollapsed", isCollapsed);
  }, [isCollapsed]);

  // Polling "unread"
  useEffect(() => {
    let mounted = true;

    const checkUnread = async () => {
      try {
        const { data } = await api.get("/api/conversations/", {
          headers: getAuthHeaders(),
        });
        const conversations = toList(data);

        if (!mounted) return;

        if (conversations.length === 0) {
          setHasUnread(false);
          return;
        }

        const results = await Promise.allSettled(
          conversations.map((conv) =>
            api
              .get(`/api/chat/${conv.id}/unread/`, { headers: getAuthHeaders() })
              .then((r) =>
                typeof r.data === "number"
                  ? r.data
                  : r.data?.unread ?? r.data?.count ?? 0
              )
              .catch(() => 0)
          )
        );

        if (!mounted) return;

        const anyUnread = results.some(
          (r) => r.status === "fulfilled" && (r.value || 0) > 0
        );
        setHasUnread(anyUnread);
      } catch (err) {
        console.error("Błąd sprawdzania wiadomości:", err);
      }
    };

    checkUnread();
    const interval = setInterval(checkUnread, POLL_MS);
    return () => {
      mounted = false;
      clearInterval(interval);
    };
  }, []); // getAuthHeaders pobiera świeży token z localStorage

  return (
    <aside
      className={`bg-white shadow-sm p-3 d-flex flex-column ${
        isCollapsed ? "collapsed-sidebar" : ""
      }`}
      style={{
        minWidth: isCollapsed ? "70px" : "250px",
        transition: "all 0.3s ease",
      }}
      aria-label="Główne menu"
    >
      <div className="d-flex justify-content-between align-items-center mb-4">
        {!isCollapsed && (
          <h1 style={{ color: "#2976fb" }} className="h2 m-0">
            TickTask
          </h1>
        )}
        <button
          className="btn btn-sm btn-outline-secondary"
          onClick={() => setIsCollapsed((v) => !v)}
          title="Zwiń/rozwiń menu"
          aria-label={isCollapsed ? "Rozwiń menu" : "Zwiń menu"}
        >
          ☰
        </button>
      </div>

      <ul className="list-unstyled">
        <li className="mb-2">
          <Link
            to="/"
            className={`d-block px-2 py-1 rounded text-dark text-decoration-none ${isActive(
              "/"
            )}`}
          >
            🏠 {!isCollapsed && "Strona główna"}
          </Link>
        </li>

        <li className="mb-2">
          <Link
            to="/zadania"
            className={`d-block px-2 py-1 rounded text-dark text-decoration-none ${isActive(
              "/zadania"
            )}`}
          >
            📋 {!isCollapsed && "Zadania"}
          </Link>
        </li>

        <li className="mb-2">
          <Link
            to="/terminy"
            className={`d-block px-2 py-1 rounded text-dark text-decoration-none ${isActive(
              "/terminy"
            )}`}
          >
            📅 {!isCollapsed && "Terminy"}
          </Link>
        </li>

        <li className="mb-2">
          <Link
            to="/uzytkownicy"
            className={`d-block px-2 py-1 rounded text-dark text-decoration-none ${isActive(
              "/uzytkownicy"
            )}`}
          >
            👥 {!isCollapsed && "Użytkownicy"}
          </Link>
        </li>

        <li className="mb-2">
          <Link
            to="/chat"
            className={`d-flex justify-content-between align-items-center px-2 py-1 rounded text-dark text-decoration-none ${isActive(
              "/chat"
            )}`}
          >
            <span>💬 {!isCollapsed && "Czat"}</span>
            {hasUnread && (
              <span
                className="text-danger fw-bold"
                aria-label="Masz nieprzeczytane wiadomości"
                title="Masz nieprzeczytane wiadomości"
              >
                ●
              </span>
            )}
          </Link>
        </li>

        <li className="mb-2">
          <Link
            to="/ustawienia"
            className={`d-block px-2 py-1 rounded text-dark text-decoration-none ${isActive(
              "/ustawienia"
            )}`}
          >
            ⚙️ {!isCollapsed && "Ustawienia"}
          </Link>
        </li>

        <li className="mb-2">
          <Link
            to="/logout"
            className="d-block px-2 py-1 rounded text-dark text-decoration-none"
          >
            🚪 {!isCollapsed && "Wyloguj"}
          </Link>
        </li>
      </ul>
    </aside>
  );
};

export default Sidebar;
