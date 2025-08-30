import React, { useEffect, useState } from "react";
import api from '../api'
import { ACCESS_TOKEN } from "../constants";

const ChatBox = ({ conversationId, currentUserId }) => {
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState("");

  // Pobieranie wiadomości
  // Pobieranie wiadomości
  const fetchMessages = async () => {
    const token = localStorage.getItem(ACCESS_TOKEN);
    try {
      const response = await api.get(
        `/api/chat/${conversationId}/messages/`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );
      setMessages(response.data);
    } catch (error) {
      console.error("Błąd pobierania wiadomości:", error);
    }
  };

  // Wysyłanie wiadomości
  const sendMessage = async () => {
    const token = localStorage.getItem(ACCESS_TOKEN);
    if (!newMessage.trim()) return;
    try {
      await await api.post(
        `/api/chat/${conversationId}/messages/`,
        {
          text: newMessage,
        },
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      setNewMessage("");
      fetchMessages(); // natychmiastowe odświeżenie
    } catch (error) {
      console.error("Błąd wysyłania wiadomości:", error);
      if (error.response) {
        console.error("Odpowiedź serwera:", error.response.data);
      }
    }
  };

  // Polling co 3 sekundy
  useEffect(() => {
    fetchMessages();
    const interval = setInterval(fetchMessages, 3000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="card p-3">
      <h5>💬 Czat</h5>
      <div style={{ maxHeight: "300px", overflowY: "auto" }}>
        {messages.map((msg) => (
          <div key={msg.id}>
            <strong>
              {msg.sender === currentUserId ? "Ty" : msg.sender_username}:
            </strong>{" "}
            {msg.text}
            <br />
            <small className="text-muted">
              {new Date(msg.timestamp).toLocaleTimeString()}
            </small>
            <hr />
          </div>
        ))}
      </div>
      <div className="d-flex mt-3">
        <input
          type="text"
          className="form-control me-2"
          placeholder="Wpisz wiadomość..."
          value={newMessage}
          onChange={(e) => setNewMessage(e.target.value)}
        />
        <button className="btn btn-primary" onClick={sendMessage}>
          Wyślij
        </button>
      </div>
    </div>
  );
};

export default ChatBox;
