// src/components/UnreadMessagesNotifier.jsx
import { useEffect, useRef } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { toast } from "react-toastify";
import api from "../api";
import { ACCESS_TOKEN } from "../constants";

const POLL_MS = 5000;
const DEBUG = false;

// -------- helpers --------
const norm = (s) => (s ?? "").toString().trim().toLowerCase();

const getToken = () => localStorage.getItem(ACCESS_TOKEN) || null;

// proste sprawdzenie JWT (bez weryfikacji podpisu) – wystarczy na FE
const parseJwt = (t) => {
  try {
    const base = t.split(".")[1];
    const fixed = base.replace(/-/g, "+").replace(/_/g, "/");
    return JSON.parse(atob(fixed));
  } catch {
    return null;
  }
};
const isTokenValid = () => {
  const t = getToken();
  if (!t) return false;
  const p = parseJwt(t);
  if (!p || !p.exp) return true; // jeśli brak exp, nie blokuj
  // mały bufor, żeby nie odpalać requestów tuż przed wygaśnięciem
  return Date.now() / 1000 < p.exp - 30;
};

export default function UnreadMessagesNotifier() {
  const navigate = useNavigate();
  const { pathname } = useLocation();

  const lastToastRef = useRef({}); // { [convId]: lastMsgIdShown }
  const intervalRef = useRef(null);
  const meRef = useRef(null); // { id, username }
  const bootstrappedRef = useRef(false);

  // guard: nie uruchamiaj na stronach auth
  const isAuthRoute = pathname === "/login" || pathname === "/register";

  const isFromMe = (msg) => {
    if (!msg || !meRef.current) return false;
    const meId = Number(meRef.current.id || 0);
    const meName = norm(meRef.current.username);

    const candId = Number(
      msg?.sender_id ??
        msg?.sender?.id ??
        msg?.created_by_id ??
        msg?.user_id ??
        0
    );
    const candName = norm(
      msg?.sender_username ??
        msg?.sender?.username ??
        msg?.author ??
        msg?.user?.username
    );

    return (meId && candId && meId === candId) ||
      (!!meName && !!candName && meName === candName);
  };

  const computeTitle = (conv, last) => {
    if (conv.is_group) return conv.group_name || `Grupa #${conv.id}`;

    if (last && !isFromMe(last)) {
      const name =
        last?.sender_username ??
        last?.sender?.username ??
        last?.author ??
        last?.user?.username;
      if (name) return name;
    }

    if (conv?.other_user?.username) return conv.other_user.username;

    const meId = Number(meRef.current?.id || 0);
    const others = Array.isArray(conv.participants)
      ? conv.participants.filter((p) => Number(p?.id || 0) !== meId)
      : [];
    if (others.length === 1 && others[0]?.username) return others[0].username;

    return `Rozmowa #${conv.id}`;
  };

  const openInChat = (conv) => {
    if (conv.is_group) {
      localStorage.setItem("openGroupId", String(conv.id));
    } else if (conv.other_user?.id) {
      localStorage.setItem("openUserId", String(conv.other_user.id));
    } else {
      const meId = Number(meRef.current?.id || 0);
      const others = Array.isArray(conv.participants)
        ? conv.participants.filter((p) => Number(p?.id || 0) !== meId)
        : [];
      if (others.length === 1 && others[0]?.id) {
        localStorage.setItem("openUserId", String(others[0].id));
      } else {
        localStorage.setItem("openGroupId", String(conv.id));
      }
    }
    navigate("/chat");
  };

  // --- API helpers (wszystkie respektują token) ---
  const authHeaders = () => {
    const t = getToken();
    return t ? { Authorization: `Bearer ${t}` } : {};
  };

  async function fetchMe() {
    if (!isTokenValid()) {
      meRef.current = null;
      return;
    }
    try {
      const { data } = await api.get("/api/me/", { headers: authHeaders() });
      meRef.current = {
        id: data?.id ?? data?.user?.id ?? null,
        username: data?.username ?? data?.user?.username ?? null,
      };
      if (DEBUG) console.debug("[Notifier] me =", meRef.current);
    } catch (e) {
      // 401? – token nie działa → zatrzymaj polling i wyczyść kontekst
      if (e?.response?.status === 401) {
        if (intervalRef.current) {
          clearInterval(intervalRef.current);
          intervalRef.current = null;
        }
      }
      meRef.current = null;
      if (DEBUG) console.debug("[Notifier] /api/me 401 – stop polling");
    }
  }

  async function fetchConversations() {
    const res = await api.get("/api/conversations/", { headers: authHeaders() });
    const list = Array.isArray(res.data?.results)
      ? res.data.results
      : Array.isArray(res.data)
      ? res.data
      : [];
    const normalized = list
      .map((c) => ({
        id: c.id ?? c.conversation_id ?? c.pk,
        is_group: !!c.is_group,
        group_name: c.group_name ?? c.title ?? c.name ?? null,
        other_user: c.other_user || null,
        participants: c.participants || c.users || [],
      }))
      .filter((c) => c.id != null);
    if (DEBUG) console.debug("[Notifier] convs =", normalized);
    return normalized;
  }

  async function fetchLastMessage(convId) {
    const res = await api.get(`/api/chat/${convId}/`, { headers: authHeaders() });
    const arr = Array.isArray(res.data?.results)
      ? res.data.results
      : Array.isArray(res.data)
      ? res.data
      : [];
    if (!arr.length) return null;
    // najnowsza po id (fallback po timestamp)
    let last = arr[0];
    for (const m of arr) if ((m.id ?? 0) > (last.id ?? 0)) last = m;
    if (arr.length > 1 && last?.timestamp) {
      for (const m of arr) {
        if (m.timestamp && new Date(m.timestamp) > new Date(last.timestamp)) {
          last = m;
        }
      }
    }
    return last;
  }

  async function fetchUnread(convId) {
    const res = await api.get(`/api/chat/${convId}/unread/`, {
      headers: authHeaders(),
    });
    const v = res.data;
    return typeof v === "number" ? v : v?.unread ?? v?.count ?? 0;
  }

  async function poll() {
    // twarde gardy – bez nich nie wywołujemy backendu
    if (isAuthRoute) return;
    if (!isTokenValid()) return;

    if (!meRef.current) {
      await fetchMe();
      if (!meRef.current) return;
    }

    try {
      const convs = await fetchConversations();

      // Pierwszy przebieg – zapamiętaj ostatnie ID, żeby nie strzelały stare toasty
      if (!bootstrappedRef.current) {
        const lastOfAll = await Promise.all(
          convs.map(async (c) => ({ conv: c, last: await fetchLastMessage(c.id) }))
        );
        lastOfAll.forEach(({ conv, last }) => {
          const id = Number(last?.id || 0);
          lastToastRef.current[conv.id] = id;
        });
        bootstrappedRef.current = true;
        if (DEBUG) console.debug("[Notifier] bootstrap lastToast =", lastToastRef.current);
        return;
      }

      // Normalna praca
      for (const conv of convs) {
        const pageVisible = !document.hidden && document.hasFocus();
        const activeConv = Number(localStorage.getItem("activeConversationId") || 0);
        const isActiveHere = pageVisible && activeConv === Number(conv.id);
        if (isActiveHere) continue; // nie powiadamiaj o otwartej rozmowie

        const [unread, last] = await Promise.all([
          fetchUnread(conv.id),
          fetchLastMessage(conv.id),
        ]);

        if (!last) continue;
        if (isFromMe(last)) continue; // nasza wiadomość – nie powiadamiaj

        const lastId = Number(last.id || 0);
        const alreadyShown = Number(lastToastRef.current[conv.id] || 0);

        if (DEBUG) {
          console.debug("[Notifier] check", {
            convId: conv.id,
            unread,
            lastId,
            alreadyShown,
            isActiveHere,
            title: computeTitle(conv, last),
          });
        }

        if (unread > 0 && lastId > alreadyShown) {
          const title = computeTitle(conv, last);
          const preview = (last?.text ?? last?.content ?? "")
            .toString()
            .slice(0, 120);
          const tid = `newmsg-${conv.id}-${lastId}`;

          toast.info(`${title}: Nowa wiadomość${preview ? `\n${preview}` : ""}`, {
            toastId: tid,
            onClick: () => {
              openInChat(conv);
              toast.dismiss(tid);
            },
          });

          lastToastRef.current[conv.id] = lastId;
        }
      }
    } catch (e) {
      // Na 401 przerywamy polling, bo użytkownik nie jest zalogowany/ma zły token
      if (e?.response?.status === 401) {
        if (intervalRef.current) {
          clearInterval(intervalRef.current);
          intervalRef.current = null;
        }
        meRef.current = null;
        bootstrappedRef.current = false;
        if (DEBUG) console.debug("[Notifier] 401 in poll – stop until re-login");
      } else if (DEBUG) {
        console.debug("[Notifier] poll error", e);
      }
    }
  }

  useEffect(() => {
    // jeśli jesteśmy na /login lub /register – nie montuj w ogóle
    if (isAuthRoute) return;

    // start tylko z ważnym tokenem
    if (!isTokenValid()) return;

    let canceled = false;

    (async () => {
      await fetchMe();
      if (!canceled && meRef.current) {
        await poll();
        intervalRef.current = setInterval(poll, POLL_MS);
      }
    })();

    const onVis = () => {
      if (document.hidden) {
        if (intervalRef.current) {
          clearInterval(intervalRef.current);
          intervalRef.current = null;
        }
      } else if (!intervalRef.current && isTokenValid()) {
        poll();
        intervalRef.current = setInterval(poll, POLL_MS);
      }
    };
    document.addEventListener("visibilitychange", onVis);

    // zsynchronizuj ostatnio pokazane id po „seen”
    const onSeen = (e) => {
      const { convId, lastId } = e.detail || {};
      if (!convId) return;
      const shown = Number(lastToastRef.current[convId] || 0);
      lastToastRef.current[convId] = Math.max(shown, Number(lastId || 0));
      toast.dismiss();
    };
    window.addEventListener("chat:lastSeenUpdated", onSeen);

    const onStorage = () => {
      if (!isTokenValid()) {
        if (intervalRef.current) {
          clearInterval(intervalRef.current);
          intervalRef.current = null;
        }
        meRef.current = null;
        lastToastRef.current = {};
        bootstrappedRef.current = false;
      } else if (!intervalRef.current) {
        bootstrappedRef.current = false;
        poll();
        intervalRef.current = setInterval(poll, POLL_MS);
      }
    };
    window.addEventListener("storage", onStorage);

    return () => {
      canceled = true;
      document.removeEventListener("visibilitychange", onVis);
      window.removeEventListener("chat:lastSeenUpdated", onSeen);
      window.removeEventListener("storage", onStorage);
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
    
  }, [pathname, navigate]);

  return null;
}
