import React, { useState, useEffect } from "react";
import { ACCESS_TOKEN } from "../constants";
import api from "../api";

export default function EditModal({
  item,
  onChange,
  onCancel,
  onSave, // callback z komponentu nadrzędnego np. do odświeżenia listy
  fields,
}) {
  if (!item) return null;

  const [currentUser, setCurrentUser] = useState(null);
  const [users, setUsers] = useState([]);
  const [comments, setComments] = useState([]);
  const [newComment, setNewComment] = useState("");

  useEffect(() => {
    if (item) {
      const fetchComments = async () => {
        try {
          const token = localStorage.getItem(ACCESS_TOKEN);
          const res = await api.get(`/api/tasks/${item.id}/comments/`, {
            headers: { Authorization: `Bearer ${token}` },
          });
          setComments(res.data);
        } catch (err) {
          console.error("Błąd pobierania komentarzy:", err);
        }
      };
      fetchComments();
    }
  }, [item]);

  useEffect(() => {
    const fetchUsers = async () => {
      const token = localStorage.getItem(ACCESS_TOKEN);
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
      const token = localStorage.getItem(ACCESS_TOKEN);
      try {
        const res = await api.get("/api/me/", {
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

  const isAdmin = currentUser?.is_staff === true;

  const handleSave = async () => {
    try {
      const token = localStorage.getItem(ACCESS_TOKEN);
      const payload = {
        ...item,
      };
      await api.put(`/api/tasks/${item.id}/`, payload, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (onSave) onSave(); // np. odświeżenie listy w rodzicu
      onCancel(); // zamknięcie modala
    } catch (err) {
      console.error("Błąd podczas zapisywania zmian:", err);
    }
  };

  return (
    <div className="modal show d-block" tabIndex="-1" role="dialog">
      <div className="modal-dialog" role="document">
        <div className="modal-content">
          <div className="modal-header">
            <h5 className="modal-title">Edytuj</h5>
            <button
              type="button"
              className="btn-close"
              onClick={onCancel}
            ></button>
          </div>
          <div className="modal-body">
            {fields.map(({ label, name, type, options }) => (
              <div className="mb-3" key={name}>
                <label className="form-label">{label}</label>
                {type === "textarea" ? (
                  <textarea
                    className="form-control"
                    value={typeof item[name] === "string" ? item[name] : ""}
                    onChange={(e) =>
                      onChange({ ...item, [name]: e.target.value })
                    }
                  />
                ) : type === "select" ? (
                  <select
                    className="form-select"
                    value={String(item[name] ?? "")}
                    onChange={(e) =>
                      onChange({ ...item, [name]: e.target.value })
                    }
                  >
                    {options.map((opt) => {
                      const val = typeof opt === "object" ? opt.value : opt;
                      const label = typeof opt === "object" ? opt.label : opt;
                      return (
                        <option key={val} value={val}>
                          {label}
                        </option>
                      );
                    })}
                  </select>
                ) : (
                  <>
                    <input
                      type={type}
                      className="form-control"
                      disabled={
                        name === "deadline" &&
                        !(isAdmin || item.created_by === currentUser?.username)
                      }
                      value={
                        name === "deadline" && item[name]
                          ? new Date(item[name]).toISOString().slice(0, 16)
                          : item[name] ?? ""
                      }
                      onChange={(e) =>
                        onChange({ ...item, [name]: e.target.value })
                      }
                    />

                    {!isAdmin &&
                      name === "deadline" &&
                      item.created_by !== currentUser?.username && (
                        <small className="text-muted">
                          Tylko administrator lub autor zadania może zmienić
                          deadline.
                        </small>
                      )}
                  </>
                )}
              </div>
            ))}
          </div>

          <div className="modal-footer">
            <button
              type="button"
              className="btn btn-secondary"
              onClick={onCancel}
            >
              Anuluj
            </button>
            <button
              type="button"
              className="btn btn-primary"
              onClick={handleSave}
            >
              Zapisz zmiany
            </button>
          </div>

          <div className="mt-3 px-3 pb-3">
            <h6>Komentarze</h6>
            {comments.length === 0 ? (
              <p className="text-muted">Brak komentarzy.</p>
            ) : (
              <ul className="list-group">
                {comments.map((comment) => (
                  <li key={comment.id} className="list-group-item">
                    <strong>{comment.author_username}:</strong>{" "}
                    {comment.content}
                    <br />
                    <small className="text-muted">
                      {new Date(comment.created_at).toLocaleString()}
                    </small>
                  </li>
                ))}
              </ul>
            )}

            <textarea
              className="form-control mt-3 mb-2"
              placeholder="Dodaj komentarz..."
              value={newComment}
              onChange={(e) => setNewComment(e.target.value)}
            />
            <button
              className="btn btn-sm btn-primary"
              onClick={async () => {
                if (!newComment.trim()) return;
                try {
                  const token = localStorage.getItem(ACCESS_TOKEN);
                  await api.post(
                    `/api/tasks/${item.id}/comments/`,
                    { content: newComment },
                    { headers: { Authorization: `Bearer ${token}` } }
                  );
                  setNewComment("");
                  const res = await api.get(`/api/tasks/${item.id}/comments/`, {
                    headers: { Authorization: `Bearer ${token}` },
                  });
                  setComments(res.data);
                } catch (err) {
                  console.error("Błąd dodawania komentarza:", err);
                }
              }}
            >
              💬 Dodaj komentarz
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
