import React, { useEffect, useMemo, useState } from "react";
import { ACCESS_TOKEN } from "../constants";
import api from "../api";

const PAGE_SIZE = 10;

export default function ActivityList() {
  // --- STANY ---
  const [items, setItems] = useState([]);                // główna lista (Twoje / grupa) – paginowana
  const [userActivities, setUserActivities] = useState([]); // możesz używać jako quick-view
  const [otherActivities, setOtherActivities] = useState([]); // „inni” – paginowana niezależnie

  // role
  const [isAdmin, setIsAdmin] = useState(null);
  const [isLeader, setIsLeader] = useState(null);

  // filtry – główna lista
  const [selectedUser, setSelectedUser] = useState("wszyscy");
  const [activityFilterOwn, setActivityFilterOwn] = useState("wszystkie");
  const [activityDateFrom, setActivityDateFrom] = useState("");
  const [activityDateTo, setActivityDateTo] = useState("");

  // filtry – inni
  const [activityFilterOthers, setActivityFilterOthers] = useState("wszystkie");
  const [activityDateFromOthers, setActivityDateFromOthers] = useState("");
  const [activityDateToOthers, setActivityDateToOthers] = useState("");

  // paginacja – główna
  const [page, setPage] = useState(1);
  const [meta, setMeta] = useState({ count: 0, next: null, previous: null });
  const [loading, setLoading] = useState(false);

  // paginacja – inni
  const [pageOthers, setPageOthers] = useState(1);
  const [metaOthers, setMetaOthers] = useState({ count: 0, next: null, previous: null });
  const [loadingOthers, setLoadingOthers] = useState(false);

  // --- HELPERY ---
  const fmtDate = (d) =>
    d
      ? new Date(d)
          .toLocaleString("pl-PL", {
            hour12: false,
            timeZone: "Europe/Warsaw",
            year: "numeric",
            month: "2-digit",
            day: "2-digit",
            hour: "2-digit",
            minute: "2-digit",
          })
          .replace(",", "")
      : "";

  const getActivityIcon = (action) => {
    const a = (action || "").toLowerCase();
    if (a.includes("utworzy")) return "📝";
    if (a.includes("usuną")) return "🗑️";
    if (a.includes("zmieniono status")) return "✅";
    if (a.includes("zmieniono priorytet")) return "❗";
    if (a.includes("przydzieli")) return "👤➕";
    if (a.includes("komentarz")) return "💬";
    if (a.includes("otrzymałe")) return "📥";
    return "ℹ️";
  };

  // numery stron z wielokropkami
  function paginate(current, total, delta = 2) {
    const range = [];
    const out = [];
    let last;

    for (let i = 1; i <= total; i++) {
      if (i === 1 || i === total || (i >= current - delta && i <= current + delta)) {
        range.push(i);
      }
    }
    for (const i of range) {
      if (last) {
        if (i - last === 2) out.push(last + 1);
        else if (i - last > 2) out.push("…");
      }
      out.push(i);
      last = i;
    }
    return out;
  }

  // paramy do backendu – główna lista
  function buildParamsMain(targetPage, admin, leader) {
    const p = {
      page: targetPage,
      page_size: PAGE_SIZE,
    };
    if (admin) p.all = true;

    if (activityFilterOwn !== "wszystkie") p.action_icontains = activityFilterOwn;
    if (activityDateFrom) p.date_from = activityDateFrom;
    if (activityDateTo) p.date_to = activityDateTo;

    if ((admin || leader) && selectedUser !== "wszyscy") p.username = selectedUser;

    return p;
  }

  // paramy do backendu – inni
  function buildParamsOthers(targetPage, admin) {
    const p = {
      page: targetPage,
      page_size: PAGE_SIZE,
    };
    if (admin) p.all = true;

    if (activityFilterOthers !== "wszystkie") p.action_icontains = activityFilterOthers;
    if (activityDateFromOthers) p.date_from = activityDateFromOthers;
    if (activityDateToOthers) p.date_to = activityDateToOthers;

    if (selectedUser !== "wszyscy") p.username = selectedUser;

    return p;
  }

  const totalPages = Math.max(1, Math.ceil(meta.count / PAGE_SIZE));
  const pageItems = useMemo(() => paginate(page, totalPages, 2), [page, totalPages]);

  const totalPagesOthers = Math.max(1, Math.ceil(metaOthers.count / PAGE_SIZE));
  const pageItemsOthers = useMemo(
    () => paginate(pageOthers, totalPagesOthers, 2),
    [pageOthers, totalPagesOthers]
  );

  // do selecta – z aktualnej strony „innych”
  const uniqueUsernames = useMemo(
    () => [...new Set(otherActivities.map((a) => a?.username).filter(Boolean))],
    [otherActivities]
  );

  // --- INIT ---
  useEffect(() => {
    let isMounted = true;
    const token = localStorage.getItem(ACCESS_TOKEN);

    (async () => {
      try {
        const resMe = await api.get("/api/me/", {
          headers: { Authorization: `Bearer ${token}` },
        });
        const admin = !!resMe.data.is_staff;
        const leader =
          resMe.data.profile?.role === "leader" ||
          resMe.data.userprofile?.role === "leader";
        if (!isMounted) return;

        setIsAdmin(admin);
        setIsLeader(leader);

        // quick-view (opcjonalne)
        const resUser = await api.get("/api/my-activities/", {
          headers: { Authorization: `Bearer ${token}` },
          params: { page: 1, page_size: PAGE_SIZE },
        });
        if (!isMounted) return;
        setUserActivities(resUser.data?.results ?? resUser.data ?? []);

        // pierwsze loady list paginowanych
        await loadMain(1, { admin, leader });
        if (admin || leader) await loadOthers(1, { admin });
      } catch (err) {
        console.error("❌ Błąd init:", err);
      }
    })();

    return () => {
      isMounted = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // --- LOADERS ---
  async function loadMain(targetPage = page, roleInfo) {
    setLoading(true);
    try {
      const admin = roleInfo?.admin ?? isAdmin;
      const leader = roleInfo?.leader ?? isLeader;
      if (admin === null || leader === null) return;

      const url = admin || leader ? "/api/group-activities/" : "/api/my-activities/";
      const { data } = await api.get(url, { params: buildParamsMain(targetPage, admin, leader) });

      const results = Array.isArray(data) ? data : data?.results ?? [];
      setItems(results);
      setMeta({
        count: Array.isArray(data) ? data.length : data?.count ?? 0,
        next: data?.next ?? null,
        previous: data?.previous ?? null,
      });
      setPage(targetPage);
    } catch (e) {
      console.error("❌ Błąd ładowania głównej listy:", e);
      setItems([]);
      setMeta({ count: 0, next: null, previous: null });
    } finally {
      setLoading(false);
    }
  }

  async function loadOthers(targetPage = pageOthers, roleInfo) {
    setLoadingOthers(true);
    try {
      const admin = roleInfo?.admin ?? isAdmin;
      if (admin === null || (isLeader === null)) return;
      if (!(admin || isLeader)) return; // brak dostępu do „innych”

      const { data } = await api.get("/api/group-activities/", {
        params: buildParamsOthers(targetPage, admin),
      });

      const results = Array.isArray(data) ? data : data?.results ?? [];
      setOtherActivities(results);
      setMetaOthers({
        count: Array.isArray(data) ? data.length : data?.count ?? 0,
        next: data?.next ?? null,
        previous: data?.previous ?? null,
      });
      setPageOthers(targetPage);
    } catch (e) {
      console.error("❌ Błąd ładowania innych:", e);
      setOtherActivities([]);
      setMetaOthers({ count: 0, next: null, previous: null });
    } finally {
      setLoadingOthers(false);
    }
  }

  // zmiana strony głównej
  useEffect(() => {
    if (isAdmin !== null && isLeader !== null) {
      loadMain(page);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, isAdmin, isLeader]);

  // zmiana strony „innych”
  useEffect(() => {
    if (isAdmin !== null && isLeader !== null && (isAdmin || isLeader)) {
      loadOthers(pageOthers);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pageOthers, isAdmin, isLeader]);

  // filtry → główna lista
  useEffect(() => {
    if (isAdmin !== null && isLeader !== null) {
      setPage(1);
      loadMain(1);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activityFilterOwn, activityDateFrom, activityDateTo, selectedUser]);

  // filtry → inni
  useEffect(() => {
    if (isAdmin !== null && isLeader !== null && (isAdmin || isLeader)) {
      setPageOthers(1);
      loadOthers(1);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activityFilterOthers, activityDateFromOthers, activityDateToOthers, selectedUser]);

  // --- RENDER ---
  return (
    <div className="card shadow-sm p-3">
      {/* Filtry własnych aktywności (działają na głównej liście) */}
      <div className="row mb-3">
        <div className="col-md-6">
          <label className="form-label" htmlFor="ownFilter">
            Filtruj swoje aktywności:
          </label>
          <select
            id="ownFilter"
            className="form-select"
            value={activityFilterOwn}
            onChange={(e) => setActivityFilterOwn(e.target.value)}
          >
            <option value="wszystkie">Wszystkie</option>
            <option value="Utworzyłeś zadanie">Utworzyłeś zadanie</option>
            <option value="Usunąłeś zadanie">Usunąłeś zadanie</option>
            <option value="Przydzieliłeś zadanie">Przydzieliłeś zadanie</option>
            <option value="Dodałeś komentarz">Dodałeś komentarz</option>
            <option value="zmieniono status">Zmieniono status</option>
            <option value="Otrzymałeś">Otrzymałeś zadanie</option>
          </select>
        </div>

        <div className="col-md-3">
          <label className="form-label" htmlFor="ownDateFrom">Od daty:</label>
          <input
            id="ownDateFrom"
            type="date"
            className="form-control"
            value={activityDateFrom}
            onChange={(e) => setActivityDateFrom(e.target.value)}
          />
        </div>

        <div className="col-md-3">
          <label className="form-label" htmlFor="ownDateTo">Do daty:</label>
          <input
            id="ownDateTo"
            type="date"
            className="form-control"
            value={activityDateTo}
            onChange={(e) => setActivityDateTo(e.target.value)}
          />
        </div>
      </div>

      <hr className="my-4" />
      <h5 className="mb-3">🕓 Twoje / grupowe Aktywności</h5>

      {loading && (
        <div className="d-flex justify-content-center my-2" role="status" aria-live="polite">
          <div className="spinner-border" />
          <span className="visually-hidden">Wczytywanie…</span>
        </div>
      )}

      <ul className="list-group">
        {items.map((act) => (
          <li key={act.id ?? `${act.created_at}-${act.username}`} className="list-group-item">
            <strong>
              {getActivityIcon(act.action)} {act.action}
            </strong>
            <br />
            <small className="text-muted">
              {fmtDate(act.created_at)}
              {act.username && <> • Użytkownik: <strong>{act.username}</strong></>}
            </small>
          </li>
        ))}
        {!loading && items.length === 0 && <li className="list-group-item">Brak danych</li>}
      </ul>

      {/* Paginacja – główna */}
      <nav aria-label="Paginacja" className="mt-3">
        <div className="d-flex gap-2 justify-content-center flex-wrap">
          <button className="btn btn-outline-primary" disabled={page === 1} onClick={() => setPage(1)}>« Pierwsza</button>
          <button className="btn btn-outline-primary" disabled={page === 1} onClick={() => setPage((p) => Math.max(1, p - 1))}>‹ Poprzednia</button>
          {pageItems.map((it, idx) =>
            it === "…" ? (
              <span key={`dots-main-${idx}`} className="btn disabled">…</span>
            ) : (
              <button
                key={`main-${it}`}
                className={"btn " + (it === page ? "btn-primary" : "btn-outline-primary")}
                onClick={() => setPage(it)}
                aria-current={it === page ? "page" : undefined}
              >
                {it}
              </button>
            )
          )}
          <button className="btn btn-outline-primary" disabled={page === totalPages} onClick={() => setPage((p) => Math.min(totalPages, p + 1))}>Następna ›</button>
          <button className="btn btn-outline-primary" disabled={page === totalPages} onClick={() => setPage(totalPages)}>Ostatnia »</button>
        </div>
        <div className="text-muted small text-center mt-2">
          Strona {page} z {totalPages}
        </div>
      </nav>

      {(isAdmin || isLeader) && (
        <>
          {/* Filtry „innych” */}
          <div className="row mb-2 mt-5">
            <div className="col-md-6">
              <label className="form-label" htmlFor="othersFilter">Filtruj po aktywności:</label>
              <select
                id="othersFilter"
                className="form-select"
                value={activityFilterOthers}
                onChange={(e) => setActivityFilterOthers(e.target.value)}
              >
                <option value="wszystkie">Wszystkie</option>
                <option value="Utworzyłeś zadanie">Utworzyłeś zadanie</option>
                <option value="Usunąłeś zadanie">Usunąłeś zadanie</option>
                <option value="Przydzieliłeś zadanie">Przydzieliłeś zadanie</option>
                <option value="Dodałeś komentarz">Dodałeś komentarz</option>
                <option value="zmieniono status">Zmieniono status</option>
                <option value="Otrzymałeś">Otrzymałeś zadanie</option>
              </select>
            </div>

            <div className="col-md-6">
              <label className="form-label" htmlFor="userFilter">Filtruj po użytkowniku:</label>
              <select
                id="userFilter"
                className="form-select"
                value={selectedUser}
                onChange={(e) => setSelectedUser(e.target.value)}
              >
                <option value="wszyscy">Wszyscy</option>
                {uniqueUsernames.map((username) => (
                  <option key={username} value={username}>{username}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Daty dla „innych” */}
          <div className="row mb-3">
            <div className="col-md-6">
              <label className="form-label" htmlFor="othersDateFrom">Od daty:</label>
              <input
                id="othersDateFrom"
                type="date"
                className="form-control"
                value={activityDateFromOthers}
                onChange={(e) => setActivityDateFromOthers(e.target.value)}
              />
            </div>
            <div className="col-md-6">
              <label className="form-label" htmlFor="othersDateTo">Do daty:</label>
              <input
                id="othersDateTo"
                type="date"
                className="form-control"
                value={activityDateToOthers}
                onChange={(e) => setActivityDateToOthers(e.target.value)}
              />
            </div>
          </div>

          {/* Lista innych */}
          <h5 className="mt-4 mb-3">🧑‍💼 Aktywności innych użytkowników</h5>

          {loadingOthers && (
            <div className="d-flex justify-content-center my-2" role="status" aria-live="polite">
              <div className="spinner-border" />
              <span className="visually-hidden">Wczytywanie…</span>
            </div>
          )}

          {otherActivities.length === 0 && !loadingOthers ? (
            <div className="text-muted">Brak dopasowanych danych</div>
          ) : (
            otherActivities.map((act) => (
              <div
                key={act.id ?? `${act.created_at}-${act.username}-other`}
                className="border-bottom pb-2 mb-2"
              >
                <strong>
                  {getActivityIcon(act.action)} {act.action}
                </strong>
                <br />
                <small className="text-muted">
                  {fmtDate(act.created_at)} • Użytkownik: <strong>{act.username}</strong>
                </small>
              </div>
            ))
          )}

          {/* Paginacja – inni */}
          <nav aria-label="Paginacja innych" className="mt-3">
            <div className="d-flex gap-2 justify-content-center flex-wrap">
              <button className="btn btn-outline-primary" disabled={pageOthers === 1} onClick={() => setPageOthers(1)}>« Pierwsza</button>
              <button className="btn btn-outline-primary" disabled={pageOthers === 1} onClick={() => setPageOthers((p) => Math.max(1, p - 1))}>‹ Poprzednia</button>
              {pageItemsOthers.map((it, idx) =>
                it === "…" ? (
                  <span key={`dots-others-${idx}`} className="btn disabled">…</span>
                ) : (
                  <button
                    key={`others-${it}`}
                    className={"btn " + (it === pageOthers ? "btn-primary" : "btn-outline-primary")}
                    onClick={() => setPageOthers(it)}
                    aria-current={it === pageOthers ? "page" : undefined}
                  >
                    {it}
                  </button>
                )
              )}
              <button className="btn btn-outline-primary" disabled={pageOthers === totalPagesOthers} onClick={() => setPageOthers((p) => Math.min(totalPagesOthers, p + 1))}>Następna ›</button>
              <button className="btn btn-outline-primary" disabled={pageOthers === totalPagesOthers} onClick={() => setPageOthers(totalPagesOthers)}>Ostatnia »</button>
            </div>
            <div className="text-muted small text-center mt-2">
              Strona {pageOthers} z {totalPagesOthers}
            </div>
          </nav>
        </>
      )}
    </div>
  );
}
