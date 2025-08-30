import React from "react";
import ChatBox from "../components/ChatBox"; // ścieżka zależna od struktury
import { Navigate } from "react-router-dom";
import { ACCESS_TOKEN } from "../constants";
import axios from "axios";
import { useState, useEffect } from "react";
import Sidebar from "../components/Sidebar";

const ChatPage = () => {
  const [currentUser, setCurrentUser] = useState(null);
  const [users, setUsers] = useState([]);
  const [selectedUser, setSelectedUser] = useState(null);
  const [token, setToken] = useState(null);
  const [conversationId, setConversationId] = useState(null);

  useEffect(() => {
    const token = localStorage.getItem(ACCESS_TOKEN);

    const fetchUsers = async () => {
      try {
        const res = await axios.get("https://ticktask-4799a6bce04e.herokuapp.com/api/users/", {
          headers: { Authorization: `Bearer ${token}` },
        });
        setUsers(res.data);
      } catch (err) {
        console.error("Błąd pobierania użytkowników:", err);
      }
    };

    const fetchCurrentUser = async () => {
      const token = localStorage.getItem(ACCESS_TOKEN);
      try {
        const res = await axios.get("https://ticktask-4799a6bce04e.herokuapp.com/api/me/", {
          headers: { Authorization: `Bearer ${token}` },
        });
        setCurrentUser(res.data);
      } catch (err) {
        console.error("Błąd pobierania aktualnego użytkownika:", err);
      }
    };

    fetchUsers();
    fetchCurrentUser();
  }, []);

  const startConversation = async (otherUserId) => {
  const token = localStorage.getItem(ACCESS_TOKEN);

  try {
    const res = await axios.post(
      "https://ticktask-4799a6bce04e.herokuapp.com/api/conversations/get_or_create/",
      {
        participants: [currentUser.id, otherUserId],
      },
      {
        headers: { Authorization: `Bearer ${token}` },
      }
    );

    setConversationId(res.data.id);
    setSelectedUser(users.find((u) => u.id === otherUserId));
  } catch (err) {
    console.error("Błąd przy tworzeniu/uzyskaniu rozmowy:", err);
  }
};


  return (
    <div className="d-flex min-vh-100 bg-light">
      <Sidebar />
      <div className="container mt-4">
        <h2>Rozmowa</h2>
        <div className="row">
          {/* Lista użytkowników */}
          <div className="col-md-3">
            <h6>Użytkownicy</h6>
            <ul className="list-group">
              {users
                .filter((u) => u.id !== currentUser?.id)
                .map((user) => (
                  <li
                    key={user.id}
                    className="list-group-item list-group-item-action"
                    style={{ cursor: "pointer" }}
                    onClick={() => startConversation(user.id)}
                  >
                    {user.username}
                  </li>
                ))}
            </ul>
          </div>

          {/* Czat */}
          <div className="col-md-9">
            {conversationId ? (
              <>
                {selectedUser && (
                  <h5 className="mb-3">
                    Rozmowa z: <strong>{selectedUser.username}</strong>
                  </h5>
                )}
                <ChatBox
                  conversationId={conversationId}
                  currentUserId={currentUser.id}
                />
              </>
            ) : (
              <p>Wybierz użytkownika, aby rozpocząć rozmowę.</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default ChatPage;
