import { useEffect, useMemo, useRef, useState } from "react";
import api from "../api";
import Sidebar from "./Sidebar";
import CreateGroupForm from "./CreateGroupForm";
import { ACCESS_TOKEN } from "../constants";
import EmojiPicker from "emoji-picker-react";
import { useNavigate } from "react-router-dom";

const toList = (d) =>
  Array.isArray(d) ? d : Array.isArray(d?.results) ? d.results : [];

const POLL_MS = 5000;

const ChatComponent = () => {
  const [currentUser, setCurrentUser] = useState(null);
  const [users, setUsers] = useState([]);
  const [groupConversations, setGroupConversations] = useState([]);

  const [conversationId, setConversationId] = useState(null);
  const [conversationData, setConversationData] = useState(null);
  const [selectedUser, setSelectedUser] = useState(null);

  const [messages, setMessages] = useState([]);
  const [text, setText] = useState("");
  const [attachment, setAttachment] = useState(null);
  const [isSending, setIsSending] = useState(false);

  const [showPicker, setShowPicker] = useState(false);
  const [activeTab, setActiveTab] = useState("users");
  const [searchTerm, setSearchTerm] = useState("");

  const [pastedPreview, setPastedPreview] = useState(null);
  const [pastedFile, setPastedFile] = useState(null);
  const [selectedImage, setSelectedImage] = useState(null);

  const [unreadCounts, setUnreadCounts] = useState({});       // { userId: number }
  const [groupUnreadCounts, setGroupUnreadCounts] = useState({}); // { groupConvId: number }

  const messagesContainerRef = useRef(null);
  const messagesEndRef = useRef(null);
  const scrollTimeout = useRef(null);
  const [isUserScrolling, setIsUserScrolling] = useState(false);

  const navigate = useNavigate();

  const getAuthHeaders = () => {
    const token = localStorage.getItem(ACCESS_TOKEN);
    return token ? { Authorization: `Bearer ${token}` } : {};
  };

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  const handleScroll = () => {
    setIsUserScrolling(true);
    if (scrollTimeout.current) clearTimeout(scrollTimeout.current);
    scrollTimeout.current = setTimeout(() => setIsUserScrolling(false), 2000);
  };

  useEffect(() => {
    if (!isUserScrolling) scrollToBottom();
  }, [messages, isUserScrolling]);

  // Boot: me + users + grupy + liczniki
  useEffect(() => {
    let mounted = true;

    const loadInitialData = async () => {
      try {
        const headers = getAuthHeaders();
        const [meRes, usersRes, groupsRes] = await Promise.all([
          api.get("/api/me/", { headers }),
          api.get("/api/users/", { headers }),
          api.get("/api/conversations/groups/", { headers }),
        ]);

        if (!mounted) return;

        const me = meRes.data;
        setCurrentUser(me || null);
        setUsers(toList(usersRes.data) || usersRes.data || []);
        setGroupConversations(toList(groupsRes.data));

        // licz liczniki nieprzeczytanych
        await fetchUnreadCountsDirect(me);
      } catch (err) {
        console.error("Błąd ładowania danych startowych:", err);
      }
    };

    loadInitialData();
    return () => {
      mounted = false;
    };
  }, []);

  const fetchUnreadCountsDirect = async (user) => {
    try {
      const headers = getAuthHeaders();
      const res = await api.get("/api/conversations/", { headers });
      const conversations = toList(res.data);

      const results = await Promise.allSettled(
        conversations.map((conv) =>
          api
            .get(`/api/chat/${conv.id}/unread/`, { headers })
            .then((r) => ({
              conv,
              unread:
                typeof r.data === "number"
                  ? r.data
                  : r.data?.unread ?? r.data?.count ?? 0,
            }))
            .catch(() => ({ conv, unread: 0 }))
        )
      );

      const userCounts = {};
      const grpCounts = {};
      results.forEach((r) => {
        if (r.status !== "fulfilled") return;
        const { conv, unread } = r.value;
        if (conv.is_group) {
          grpCounts[Number(conv.id)] = unread;
        } else if (conv.other_user?.id && conv.other_user.id !== user?.id) {
          userCounts[Number(conv.other_user.id)] = unread;
        }
      });

      setUnreadCounts(userCounts);
      setGroupUnreadCounts(grpCounts);
    } catch (err) {
      console.error("Błąd pobierania nieprzeczytanych:", err);
    }
  };

  const fetchGroups = async () => {
    try {
      const headers = getAuthHeaders();
      const res = await api.get("/api/conversations/groups/", { headers });
      setGroupConversations(toList(res.data));
    } catch (err) {
      console.error("Błąd pobierania grup:", err);
    }
  };

  const startConversation = async (userId) => {
    const u = users.find((x) => x.id === userId);
    setSelectedUser(u || null);

    try {
      const headers = getAuthHeaders();
      const res = await api.post(
        "/api/conversations/get_or_create/",
        { participants: [currentUser?.id, userId] },
        { headers }
      );

      const convo = res.data;
      setConversationId(convo.id);
      setConversationData(convo);
      setActiveTab("users");

      await updateSeen(convo.id);
      await fetchMessages(convo.id);

      // wyzeruj badge dla tego usera
      setUnreadCounts((prev) => ({ ...prev, [userId]: 0 }));
    } catch (err) {
      console.error("Błąd startConversation:", err);
    }
  };

  const openGroupConversation = async (group) => {
    try {
      setActiveTab("groups");
      setConversationId(group.id);
      setSelectedUser({ username: group.group_name || "Grupa" });
      setConversationData(group);

      await updateSeen(group.id);
      await fetchMessages(group.id);

      setGroupUnreadCounts((prev) => ({ ...prev, [Number(group.id)]: 0 }));
    } catch (err) {
      console.error("Błąd otwierania grupy:", err);
    }
  };

  const fetchMessages = async (convId) => {
    if (!convId) return;
    try {
      const headers = getAuthHeaders();
      const res = await api.get(`/api/chat/${convId}/`, { headers });
      setMessages(toList(res.data) || res.data || []);
    } catch (err) {
      console.error("Błąd pobierania wiadomości:", err);
    }
  };

  const sendMessage = async () => {
    if (!conversationId) return;
    if (!text.trim() && !attachment) return;

    const currentText = text;
    const currentAttachment = attachment ?? pastedFile;

    setText("");
    setAttachment(null);
    setPastedFile(null);
    setPastedPreview(null);
    setIsSending(true);

    try {
      const headers = getAuthHeaders();
      const formData = new FormData();
      formData.append("text", currentText);
      if (currentAttachment) formData.append("attachment", currentAttachment);

      await api.post(`/api/chat/${conversationId}/messages/`, formData, {
        headers,
      });

      await fetchMessages(conversationId);
      if (currentUser) await fetchUnreadCountsDirect(currentUser);
    } catch (err) {
      console.error("Błąd wysyłania wiadomości:", err);
      // przywróć tekst przy błędzie, żeby nie zniknął
      setText((prev) => prev || currentText);
    } finally {
      setIsSending(false);
    }
  };

  const filteredUsers = useMemo(
    () =>
      users.filter(
        (u) =>
          u.id !== currentUser?.id &&
          (u.username || "")
            .toLowerCase()
            .includes((searchTerm || "").toLowerCase())
      ),
    [users, currentUser, searchTerm]
  );

  const updateSeen = async (convId) => {
    try {
      const headers = getAuthHeaders();
      await api.post(`/api/chat/${convId}/seen/`, {}, { headers });
    } catch (err) {
      console.error("Błąd aktualizacji seen:", err);
    }
  };

  // Polling wiadomości dla aktywnej rozmowy
  useEffect(() => {
    if (!conversationId) return;
    let mounted = true;
    const id = setInterval(() => {
      if (!mounted) return;
      fetchMessages(conversationId);
    }, POLL_MS);
    return () => {
      mounted = false;
      clearInterval(id);
    };
  }, [conversationId]);

  // „Deep link” z powiadomień (localStorage)
  useEffect(() => {
    if (!currentUser) return;

    const check = () => {
      const userId = localStorage.getItem("openUserId");
      const groupId = localStorage.getItem("openGroupId");

      if (userId) {
        startConversation(parseInt(userId, 10));
        localStorage.removeItem("openUserId");
      }

      if (groupId) {
        const group = groupConversations.find(
          (g) => Number(g.id) === parseInt(groupId, 10)
        );
        if (group) {
          openGroupConversation(group);
          localStorage.removeItem("openGroupId");
        }
      }
    };

    const timer = setTimeout(check, 500); // daj czas na wczytanie grup
    return () => clearTimeout(timer);
  }, [groupConversations, currentUser]);

  const handlePaste = (e) => {
    const items = e.clipboardData?.items;
    if (!items) return;

    for (const item of items) {
      if (item.kind === "file") {
        const file = item.getAsFile();
        if (file) {
          setAttachment(file);
          setPastedFile(file);
          const previewURL = URL.createObjectURL(file);
          setPastedPreview(previewURL);
        }
        e.preventDefault();
        break;
      }
    }
  };

  const handleDeleteGroup = async (groupId) => {
    if (!window.confirm("Usunąć grupę?")) return;
    try {
      const headers = getAuthHeaders();
      await api.delete(`/api/groups/${groupId}/`, { headers });

      await fetchGroups();
      setConversationData(null);
      setConversationId(null);
      navigate("/chat");
    } catch (err) {
      console.error("Nie udało się usunąć grupy:", err);
      alert("Nie udało się usunąć grupy");
    }
  };

  return (
    <div className="d-flex min-vh-100 bg-light">
      <Sidebar />
      <div className="container mt-4">
        <h2>Rozmowa</h2>

        <div className="row">
          {/* Sidebar */}
          <div className="col-md-3">
            <ul className="nav nav-tabs mb-3">
              <li className="nav-item">
                <button
                  className={`nav-link ${activeTab === "users" ? "active" : ""}`}
                  onClick={() => setActiveTab("users")}
                >
                  Użytkownicy
                </button>
              </li>
              <li className="nav-item">
                <button
                  className={`nav-link ${activeTab === "groups" ? "active" : ""}`}
                  onClick={() => setActiveTab("groups")}
                >
                  Grupy
                </button>
              </li>
            </ul>

            {activeTab === "users" && (
              <>
                <input
                  type="text"
                  className="form-control mb-2"
                  placeholder="Szukaj..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
                <ul className="list-group mb-3">
                  {filteredUsers.map((user) => (
                    <li
                      key={user.id}
                      className="list-group-item list-group-item-action d-flex justify-content-between align-items-center"
                      style={{ cursor: "pointer" }}
                      onClick={() => startConversation(user.id)}
                    >
                      {user.username}
                      {unreadCounts[user.id] > 0 && (
                        <span className="badge bg-primary rounded-pill">
                          {unreadCounts[user.id]}
                        </span>
                      )}
                    </li>
                  ))}
                </ul>
              </>
            )}

            {activeTab === "groups" && (
              <ul className="list-group mb-3">
                {groupConversations.map((group) => {
                  const groupId = Number(group.id);
                  return (
                    <li
                      key={groupId}
                      className="list-group-item list-group-item-action d-flex justify-content-between align-items-center"
                      style={{ cursor: "pointer" }}
                      onClick={() => openGroupConversation(group)}
                    >
                      <span>{group.group_name || "Bez nazwy"}</span>
                      {groupUnreadCounts[groupId] > 0 && (
                        <span className="badge bg-primary rounded-pill">
                          {groupUnreadCounts[groupId]}
                        </span>
                      )}
                    </li>
                  );
                })}
              </ul>
            )}

            {currentUser && (
              <button
                type="button"
                className="btn btn-success w-100"
                data-bs-toggle="modal"
                data-bs-target="#createGroupModal"
              >
                ➕ Utwórz grupę
              </button>
            )}
          </div>

          {/* Main Chat */}
          <div className="col-md-9">
            {conversationId ? (
              <>
                <h5 className="mb-1">Rozmowa z: {selectedUser?.username}</h5>

                {conversationData?.is_group && (
                  <p className="text-muted small">
                    Uczestnicy:{" "}
                    {toList(conversationData?.participants)
                      .map((u) => u?.username)
                      .filter(Boolean)
                      .join(", ")}
                  </p>
                )}

                {conversationData?.is_group &&
                  (conversationData?.created_by?.id === currentUser?.id ||
                    currentUser?.is_staff) && (
                    <button
                      className="btn btn-sm btn-outline-danger mb-3"
                      onClick={() => handleDeleteGroup(conversationData.id)}
                    >
                      🗑️ Usuń grupę
                    </button>
                  )}

                <div
                  ref={messagesContainerRef}
                  style={{ height: "400px", overflowY: "auto" }}
                  onScroll={handleScroll}
                >
                  {toList(messages).map((msg) => {
                    const isMe = msg.sender_username === currentUser?.username;
                    const isImage = !!msg.attachment?.match(/\.(jpg|jpeg|png|gif|webp)$/i);

                    return (
                      <div
                        key={msg.id ?? `${msg.timestamp}-${msg.sender_username}`}
                        className={`d-flex ${isMe ? "justify-content-end" : "justify-content-start"}`}
                      >
                        <div
                          className={`p-2 rounded ${isMe ? "bg-primary text-white" : "bg-secondary bg-opacity-10"}`}
                          style={{ maxWidth: "75%", whiteSpace: "pre-line" }}
                        >
                          <div className="small fw-semibold mb-1">
                            {isMe ? "Ty" : msg.sender_username}
                          </div>

                          {msg.text && <div>{msg.text}</div>}

                          {msg.attachment && (
                            <>
                              {isImage ? (
                                <img
                                  src={msg.attachment}
                                  alt="Załącznik"
                                  style={{ maxWidth: "200px", borderRadius: "8px", marginTop: "8px", cursor: "pointer" }}
                                  onClick={() => setSelectedImage(msg.attachment)}
                                />
                              ) : (
                                <a
                                  href={msg.attachment}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  download
                                  style={{ color: isMe ? "white" : "#0d6efd", textDecoration: "underline" }}
                                >
                                  📎 {msg.attachment.split("/").pop()}
                                </a>
                              )}
                            </>
                          )}

                          <div className="text-end small text-muted mt-1">
                            {msg.timestamp
                              ? new Date(msg.timestamp).toLocaleTimeString("pl-PL", {
                                  hour: "2-digit",
                                  minute: "2-digit",
                                  hour12: false,
                                  timeZone: "Europe/Warsaw",
                                })
                              : ""}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                  <div ref={messagesEndRef} />
                </div>

                <div className="input-group mt-2 align-items-center">
                  <button
                    type="button"
                    className="btn btn-outline-secondary"
                    onClick={() => setShowPicker((v) => !v)}
                  >
                    😊
                  </button>

                  <label htmlFor="file-upload" className="btn btn-outline-primary mb-0">
                    ➕
                  </label>
                  <input
                    id="file-upload"
                    type="file"
                    style={{ display: "none" }}
                    onChange={(e) => setAttachment(e.target.files?.[0] || null)}
                  />

                  <input
                    type="text"
                    value={text}
                    onChange={(e) => setText(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        sendMessage();
                      }
                    }}
                    onPaste={handlePaste}
                    className="form-control"
                    placeholder="Napisz wiadomość..."
                  />

                  <button onClick={sendMessage} className="btn btn-primary" disabled={isSending}>
                    {isSending ? "Wysyłanie..." : "Wyślij"}
                  </button>
                </div>

                {(attachment || pastedFile) && (
                  <div className="d-flex align-items-center gap-2 mt-2">
                    {pastedPreview && (
                      <img
                        src={pastedPreview}
                        alt="Podgląd"
                        style={{ maxWidth: "120px", borderRadius: "6px" }}
                      />
                    )}
                    <span className="badge bg-secondary">
                      {attachment?.name || pastedFile?.name || "plik"}
                    </span>
                    <button
                      onClick={() => {
                        setAttachment(null);
                        setPastedFile(null);
                        setPastedPreview(null);
                      }}
                      className="btn btn-outline-danger btn-sm"
                    >
                      ❌
                    </button>
                  </div>
                )}

                {showPicker && (
                  <div className="mt-2">
                    <EmojiPicker
                      onEmojiClick={(emojiData) => setText((prev) => prev + (emojiData?.emoji || ""))}
                    />
                  </div>
                )}
              </>
            ) : (
              <p className="text-muted text-center mt-5">👈 Wybierz rozmowę, aby rozpocząć czat.</p>
            )}
          </div>
        </div>

        {selectedImage && (
          <div
            className="position-fixed top-0 start-0 w-100 h-100 bg-dark bg-opacity-75 d-flex align-items-center justify-content-center"
            style={{ zIndex: 1050 }}
            onClick={() => setSelectedImage(null)}
          >
            <img
              src={selectedImage}
              alt="Pełny podgląd"
              style={{ maxHeight: "90%", maxWidth: "90%", borderRadius: "8px", background: "#fff", padding: "10px" }}
            />
          </div>
        )}

        <div className="modal fade" id="createGroupModal" tabIndex="-1">
          <div className="modal-dialog">
            <div className="modal-content">
              <div className="modal-header">
                <h5 className="modal-title">Nowa grupa</h5>
                <button type="button" className="btn-close" data-bs-dismiss="modal"></button>
              </div>
              <div className="modal-body">
                <CreateGroupForm currentUserId={currentUser?.id} onGroupCreated={fetchGroups} />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ChatComponent;
