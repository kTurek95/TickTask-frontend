import React, { useState, useEffect } from "react";
import { ACCESS_TOKEN } from "../constants";
import api from "../api";
import { toast } from "react-toastify";

const toList = (d) =>
  Array.isArray(d) ? d : Array.isArray(d?.results) ? d.results : [];

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
  const [newAttachment, setNewAttachment] = useState(null);
  const [fileKey, setFileKey] = useState(0);

  useEffect(() => {
    if (item) {
      const fetchComments = async () => {
        try {
          const token = localStorage.getItem(ACCESS_TOKEN);
          const res = await api.get(`/api/tasks/${item.id}/comments/`, {
            headers: { Authorization: `Bearer ${token}` },
          });
          setComments(toList(res.data));
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

  const clearAttachment = () => {
    setNewTask((p) => ({ ...p, attachment: null }));
    setFileKey((k) => k + 1); // <- remount
  };

  const isAdmin = currentUser?.is_staff === true;

  const handleSave = async () => {
    try {
      const token = localStorage.getItem(ACCESS_TOKEN);
      const fd = new FormData();

      // — teksty
      if (item.title != null) fd.append("title", String(item.title));
      if (item.description != null)
        fd.append("description", String(item.description));
      if (item.priority != null) fd.append("priority", String(item.priority));
      if (item.status != null) fd.append("status", String(item.status)); // pomiń jeśli status ustala backend

      // — bool jako string
      if (typeof item.is_completed === "boolean") {
        fd.append("is_completed", item.is_completed ? "true" : "false");
      }

      // — assigned_to: ID
      if (item.assigned_to != null && item.assigned_to !== "") {
        fd.append("assigned_to", String(item.assigned_to));
      }

      // — deadline → ISO
      const rawDl = item.deadline;
      if (rawDl) {
        let iso = null;
        if (typeof rawDl === "string") {
          // jeśli z <input type="datetime-local"> dostajesz "YYYY-MM-DDTHH:mm"
          const s = rawDl.includes(" ") ? rawDl.replace(" ", "T") : rawDl;
          const d = new Date(s);
          if (!isNaN(d)) iso = d.toISOString();
        } else if (rawDl instanceof Date && !isNaN(rawDl)) {
          iso = rawDl.toISOString();
        }
        if (iso) fd.append("deadline", iso);
      }

      // — nowy plik
      if (newAttachment) {
        fd.append("attachment", newAttachment);
      }

      await api.patch(`/api/tasks/${item.id}/`, fd, {
        headers: { Authorization: `Bearer ${token}` },
        // Content-Type nie ustawiamy ręcznie
      });

      toast.success("✅ Zapisano zmiany");
      onSave?.();
      onCancel();
    } catch (err) {
      const data = err?.response?.data || {};

      // Priorytetowo pokaż precyzyjny komunikat z DRF:
      if (Array.isArray(data.deadline) && data.deadline[0]) {
        toast.error(data.deadline[0]);
      } else if (Array.isArray(data.title) && data.title[0]) {
        toast.error(data.title[0]);
      } else if (typeof data.detail === "string") {
        toast.error(data.detail);
      } else {
        toast.error("Nie zapisano zmian. Sprawdź formularz.");
      }

      console.error("Błąd podczas zapisywania zmian:", data);
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

            <div className="mb-3">
              <label className="form-label">Załącznik</label>

              <input
                key={fileKey}
                type="file"
                className="form-control"
                onChange={(e) => setNewAttachment(e.target.files?.[0] || null)}
              />

              {/* 👇 JEDEN warunek zamiast dwóch */}
              <div className="form-text mt-1">
                {item?.attachment ? (
                  <>
                    📎{" "}
                    <a
                      href={
                        item.attachment.startsWith("http")
                          ? item.attachment
                          : `${process.env.REACT_APP_API_URL}${item.attachment}`
                      }
                      target="_blank"
                      rel="noreferrer"
                    >
                      {item.attachment.split("/").pop()}
                    </a>
                    {" · "}
                    <button
                      type="button"
                      className="btn btn-link btn-sm text-danger p-0"
                      onClick={async () => {
                        try {
                          const token = localStorage.getItem(ACCESS_TOKEN);
                          await api.delete(
                            `/api/tasks/${item.id}/attachment/`,
                            {
                              headers: { Authorization: `Bearer ${token}` },
                            }
                          );
                          onChange({ ...item, attachment: null });
                          setNewAttachment(null);
                          setFileKey((k) => k + 1);
                          toast.success("Załącznik usunięty");
                        } catch (e) {
                          toast.error("Nie udało się usunąć załącznika");
                        }
                      }}
                    >
                      Usuń
                    </button>
                  </>
                ) : newAttachment ? (
                  <>Wybrano nowy plik: {newAttachment.name}</>
                ) : (
                  <>Brak załącznika</>
                )}
              </div>
            </div>
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
            {(comments || []).length === 0 ? (
              <p className="text-muted">Brak komentarzy.</p>
            ) : (
              <ul className="list-group">
                {(comments || []).map((comment) => (
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
