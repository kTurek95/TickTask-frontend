// src/components/UnreadMessagesNotifier.jsx
import { useEffect, useRef } from "react";
import { toast } from "react-toastify";
import { useNavigate } from "react-router-dom";
import api from "../api";
import { ACCESS_TOKEN } from "../constants";

const POLL_MS = 5000;
const DEBUG = false; // na testy ustaw true

export default function UnreadMessagesNotifier() {
  const navigate = useNavigate();

  // ile już pokazaliśmy dla danej rozmowy (ostatnie ID, dla którego był toast)
  const lastToastRef = useRef({});     // { [convId]: lastMsgIdShown }
  const intervalRef = useRef(null);
  const meRef = useRef(null);          // { id, username }
  const bootstrappedRef = useRef(false);

  const getToken = () => localStorage.getItem(ACCESS_TOKEN);
  const getActiveConvId = () =>
    Number(localStorage.getItem("activeConversationId") || 0);

  const norm = (s) => (s ?? "").toString().trim().toLowerCase();

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

  // stabilny tytuł rozmowy
  const computeTitle = (conv, last) => {
    if (conv.is_group) return conv.group_name || `Grupa #${conv.id}`;

    // jeśli ostatnia nie jest nasza – pokaż nadawcę
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

  async function fetchMe() {
    const token = getToken();
    if (!token) { meRef.current = null; return; }
    try {
      const { data } = await api.get("/api/me/", {
        headers: { Authorization: `Bearer ${token}` },
      });
      meRef.current = {
        id: data?.id ?? data?.user?.id ?? null,
        username: data?.username ?? data?.user?.username ?? null,
      };
      if (DEBUG) console.debug("[Notifier] me =", meRef.current);
    } catch {
      meRef.current = null;
    }
  }

  async function fetchConversations() {
    const token = getToken();
    const headers = { Authorization: `Bearer ${token}` };
    const res = await api.get("/api/conversations/", { headers });
    const list = Array.isArray(res.data?.results)
      ? res.data.results
      : Array.isArray(res.data) ? res.data : [];
    const normalized = list.map((c) => ({
      id: c.id ?? c.conversation_id ?? c.pk,
      is_group: !!c.is_group,
      group_name: c.group_name ?? c.title ?? c.name ?? null,
      other_user: c.other_user || null,
      participants: c.participants || c.users || [],
    })).filter((c) => c.id != null);
    if (DEBUG) console.debug("[Notifier] convs =", normalized);
    return normalized;
  }

  async function fetchLastMessage(convId) {
    const token = getToken();
    const headers = { Authorization: `Bearer ${token}` };
    const res = await api.get(`/api/chat/${convId}/`, { headers });
    const arr = Array.isArray(res.data?.results)
      ? res.data.results
      : Array.isArray(res.data) ? res.data : [];
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
    const token = getToken();
    const headers = { Authorization: `Bearer ${token}` };
    const res = await api.get(`/api/chat/${convId}/unread/`, { headers });
    const v = res.data;
    // backend może zwrócić liczbę lub { unread: X } / { count: X }
    return typeof v === "number" ? v : (v?.unread ?? v?.count ?? 0);
  }

  async function poll() {
    const token = getToken();
    if (!token) return;

    if (!meRef.current) {
      await fetchMe();
      if (!meRef.current) return;
    }

    try {
      const convs = await fetchConversations();

      // Pierwszy przebieg: tylko zapamiętaj ID ostatniej wiadomości, żeby nie wyskoczyły stare
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
        const activeConv = getActiveConvId();
        const isActiveHere = pageVisible && activeConv === Number(conv.id);

        // nie powiadamiaj o otwartej rozmowie
        if (isActiveHere) continue;

        const [unread, last] = await Promise.all([
          fetchUnread(conv.id),
          fetchLastMessage(conv.id),
        ]);

        if (!last) continue;

        // jeśli ostatnia wiadomość jest nasza – ignoruj (i tak unread powinno być 0)
        if (isFromMe(last)) continue;

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

        // pokaż TYLKO gdy są nieprzeczytane i mamy nową ostatnią, której jeszcze nie pokazywaliśmy
        if (unread > 0 && lastId > alreadyShown) {
          const title = computeTitle(conv, last);
          const preview = (last?.text ?? last?.content ?? "")
            .toString()
            .slice(0, 120);
          const tid = `newmsg-${conv.id}-${lastId}`;

          toast.info(
            `${title}: Nowa wiadomość${preview ? `\n${preview}` : ""}`,
            {
              toastId: tid,
              onClick: () => { openInChat(conv); toast.dismiss(tid); },
            }
          );

          lastToastRef.current[conv.id] = lastId; // pamiętaj, że już pokazaliśmy
        }
      }
    } catch (e) {
      if (DEBUG) console.debug("[Notifier] poll error", e);
    }
  }

  useEffect(() => {
    (async () => {
      await fetchMe();
      await poll();
      intervalRef.current = setInterval(poll, POLL_MS);
    })();

    const onVis = () => {
      if (document.hidden) {
        if (intervalRef.current) { clearInterval(intervalRef.current); intervalRef.current = null; }
      } else if (!intervalRef.current && getToken()) {
        poll();
        intervalRef.current = setInterval(poll, POLL_MS);
      }
    };
    document.addEventListener("visibilitychange", onVis);

    // po „seen” zsynchronizuj ostatnio pokazane id dla rozmowy
    const onSeen = (e) => {
      const { convId, lastId } = e.detail || {};
      if (!convId) return;
      const shown = Number(lastToastRef.current[convId] || 0);
      lastToastRef.current[convId] = Math.max(shown, Number(lastId || 0));
      toast.dismiss();
    };
    window.addEventListener("chat:lastSeenUpdated", onSeen);

    // login/logout – reset
    const onStorage = () => {
      if (!getToken()) {
        if (intervalRef.current) { clearInterval(intervalRef.current); intervalRef.current = null; }
        meRef.current = null;
        lastToastRef.current = {};
        bootstrappedRef.current = false;
      } else if (!intervalRef.current) {
        bootstrappedRef.current = false; // zrób bootstrap po zalogowaniu
        poll();
        intervalRef.current = setInterval(poll, POLL_MS);
      }
    };
    window.addEventListener("storage", onStorage);

    return () => {
      document.removeEventListener("visibilitychange", onVis);
      window.removeEventListener("chat:lastSeenUpdated", onSeen);
      window.removeEventListener("storage", onStorage);
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [navigate]);

  return null;
}
