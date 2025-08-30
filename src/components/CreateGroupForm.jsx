import { useEffect, useMemo, useState } from "react";
import api from "../api";
import { ACCESS_TOKEN } from "../constants";
import { Modal } from "bootstrap";

const toList = (d) =>
  Array.isArray(d) ? d : Array.isArray(d?.results) ? d.results : [];

const CreateGroupForm = ({ onGroupCreated, currentUserId }) => {
  const [groupName, setGroupName] = useState("");
  const [selectedUsers, setSelectedUsers] = useState([]); // tablica stringów (id z <option>)
  const [allUsers, setAllUsers] = useState([]);
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const getAuthHeaders = () => {
    const token = localStorage.getItem(ACCESS_TOKEN);
    return token ? { Authorization: `Bearer ${token}` } : {};
  };

  useEffect(() => {
    let mounted = true;
    const fetchUsers = async () => {
      try {
        setLoadingUsers(true);
        const res = await api.get("/api/users/", { headers: getAuthHeaders() });
        if (!mounted) return;
        setAllUsers(toList(res.data) || res.data || []);
      } catch (err) {
        console.error("Błąd pobierania użytkowników:", err);
        setAllUsers([]);
      } finally {
        if (mounted) setLoadingUsers(false);
      }
    };
    fetchUsers();
    return () => {
      mounted = false;
    };
  }, []);

  const selectableUsers = useMemo(
    () => allUsers.filter((u) => u?.id !== currentUserId),
    [allUsers, currentUserId]
  );

  const closeCreateGroupModal = () => {
    const modalEl = document.getElementById("createGroupModal");
    if (modalEl) {
      const inst = Modal.getOrCreateInstance(modalEl);
      inst.hide();
      // Opcjonalnie zabierz fokus z przycisku
      if (document.activeElement instanceof HTMLElement) {
        document.activeElement.blur();
      }
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    const errors = [];
    if (!groupName.trim()) errors.push("Podaj nazwę grupy.");
    if (selectedUsers.length === 0) errors.push("Wybierz co najmniej jednego uczestnika.");

    if (errors.length) {
      alert(errors.join("\n"));
      return;
    }

    // Zbuduj listę uczestników: wybrane + bieżący użytkownik (unikalne)
    const participantIds = Array.from(
      new Set([currentUserId, ...selectedUsers.map((id) => Number(id))])
    ).filter(Boolean);

    setSubmitting(true);
    try {
      await api.post(
        "/api/conversations/get_or_create/",
        {
          participants: participantIds,
          is_group: true,
          group_name: groupName.trim(),
        },
        { headers: getAuthHeaders() }
      );

      // odśwież listę grup w rodzicu
      if (typeof onGroupCreated === "function") {
        await onGroupCreated();
      }

      // reset formularza
      setGroupName("");
      setSelectedUsers([]);

      // zamknij modal
      closeCreateGroupModal();

      // prosty feedback
      // (możesz podmienić na toast)
      // alert("Utworzono grupę!");
    } catch (err) {
      console.error("Nie udało się utworzyć grupy:", err);
      alert("Nie udało się utworzyć grupy.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit}>
      <div className="mb-3">
        <label className="form-label">Nazwa grupy:</label>
        <input
          className="form-control"
          value={groupName}
          onChange={(e) => setGroupName(e.target.value)}
          placeholder="np. Zespół marketingu"
        />
      </div>

      <div className="mb-3">
        <label className="form-label">Wybierz uczestników:</label>
        <select
          multiple
          className="form-select"
          value={selectedUsers}
          onChange={(e) =>
            setSelectedUsers(
              Array.from(e.target.selectedOptions, (opt) => opt.value)
            )
          }
        >
          {loadingUsers ? (
            <option disabled>Ładowanie...</option>
          ) : selectableUsers.length === 0 ? (
            <option disabled>Brak użytkowników do dodania</option>
          ) : (
            selectableUsers.map((user) => (
              <option key={user.id} value={user.id}>
                {user.username || `Użytkownik #${user.id}`}
              </option>
            ))
          )}
        </select>
        <small className="text-muted">
          Przytrzymaj CTRL lub SHIFT, aby wybrać wielu.
        </small>
      </div>

      <div className="d-flex gap-2">
        <button className="btn btn-success" type="submit" disabled={submitting}>
          {submitting ? "Tworzenie…" : "Utwórz grupę"}
        </button>
        <button
          className="btn btn-outline-secondary"
          type="button"
          onClick={closeCreateGroupModal}
          disabled={submitting}
        >
          Anuluj
        </button>
      </div>
    </form>
  );
};

export default CreateGroupForm;
