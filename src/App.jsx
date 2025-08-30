import react from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import Login from "./pages/Login";
import Register from "./pages/Register";
import Home from "./pages/Home";
import NotFound from "./pages/NotFound";
import ProtectedRoute from "./components/ProtectedRoute";
import ScheduleDashboard from "./components/ScheduleDashboard";
import TaskDashboard from "./components/TaskDashboard";
import UsersDashboard from "./components/UserDashboard";
import HomeDashboard from "./components/HomeDashboard";
import SettingsPage from "./components/SettingsPage";
import ChatComponent from "./components/ChatComponent";

import { ToastContainer } from "react-toastify";
import "react-toastify/dist/ReactToastify.css"; // ⬅️ ważne
import UnreadMessagesNotifier from "./components/UnreadMessagesNotifier"; // ⬅️ NOWE
import { ACCESS_TOKEN } from "./constants"; // jeśli masz stałą na token

function Logout() {
  localStorage.clear();
  return <Navigate to="/login" />;
}

function RegisterAndLogout() {
  localStorage.clear();
  return <Register />;
}

function App() {
  const isAuthed = !!localStorage.getItem(ACCESS_TOKEN); // renderuj notifier tylko zalogowanym

  return (
    <BrowserRouter>
      <Routes>
        <Route
          path="/"
          element={
            <ProtectedRoute>
              <HomeDashboard />
            </ProtectedRoute>
          }
        />
        <Route
          path="/terminy"
          element={
            <ProtectedRoute>
              <ScheduleDashboard />
            </ProtectedRoute>
          }
        />
        <Route
          path="/zadania"
          element={
            <ProtectedRoute>
              <TaskDashboard />
            </ProtectedRoute>
          }
        />
        <Route
          path="/uzytkownicy"
          element={
            <ProtectedRoute>
              <UsersDashboard />
            </ProtectedRoute>
          }
        />
        <Route
          path="/chat"
          element={
            <ProtectedRoute>
              <ChatComponent />
            </ProtectedRoute>
          }
        />
        <Route
          path="/ustawienia"
          element={
            <ProtectedRoute>
              <SettingsPage />
            </ProtectedRoute>
          }
        />
        <Route path="/login" element={<Login />} />
        <Route path="/logout" element={<Logout />} />
        <Route path="/register" element={<RegisterAndLogout />} />
        <Route path="*" element={<NotFound />} />
      </Routes>

      {/* 🔔 notifier – globalny, tylko gdy user zalogowany */}
      {isAuthed && <UnreadMessagesNotifier />}

      {/* 📣 pojemnik na toasty (raz) */}
      {isAuthed && <UnreadMessagesNotifier />}
      <ToastContainer
        position="top-right"
        newestOnTop
        autoClose={5000}
        theme="colored"
      />
    </BrowserRouter>
  );
}

export default App;
