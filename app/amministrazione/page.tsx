"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import styles from "./page.module.css";

interface PushSettings {
  id: string;
  enabled: number;
  mode: "instant" | "scheduled";
  titleTemplate: string;
  bodyTemplate: string;
}

interface PushSchedule {
  id: string;
  label: string;
  cronExpression: string;
  time: string | null;
  active: number;
  targetType: string;
  targetUserIds: string;
  titleTemplate: string;
  bodyTemplate: string;
}

type AdminTab = "users" | "instant" | "schedule";

interface AdminUser {
  id: string;
  email: string;
}

export default function AmministrazionePage() {
  const router = useRouter();
  const [settings, setSettings] = useState<PushSettings | null>(null);
  const [schedules, setSchedules] = useState<PushSchedule[]>([]);
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [newSchedule, setNewSchedule] = useState({
    label: "",
    cronExpression: "0 * * * *",
    time: "",
    targetType: "all",
    targetUserIds: "[]",
    titleTemplate: "",
    bodyTemplate: "",
  });
  const [sendNowTargetType, setSendNowTargetType] = useState<"all" | "manual">("all");
  const [sendNowUserId, setSendNowUserId] = useState("");
  const [dispatchMessage, setDispatchMessage] = useState("");
  const [editingScheduleId, setEditingScheduleId] = useState<string | null>(null);
  const [editingSchedule, setEditingSchedule] = useState<PushSchedule | null>(null);
  const [activeTab, setActiveTab] = useState<AdminTab>("users");
  const [userSearch, setUserSearch] = useState("");

  const token = useMemo(() => typeof window !== "undefined" ? localStorage.getItem("authToken") : null, []);
  const filteredUsers = useMemo(
    () => users.filter((user) => user.email.toLowerCase().includes(userSearch.toLowerCase())),
    [users, userSearch]
  );

  useEffect(() => {
    if (!token) {
      router.replace("/login");
      return;
    }

    const fetchData = async () => {
      setLoading(true);
      setError(null);

      try {
        const [settingsRes, schedulesRes, usersRes] = await Promise.all([
          fetch("/api/admin/push/settings", {
            headers: { Authorization: `Bearer ${token}` },
            cache: "no-store",
          }),
          fetch("/api/admin/push/schedules", {
            headers: { Authorization: `Bearer ${token}` },
            cache: "no-store",
          }),
          fetch("/api/admin/users", {
            headers: { Authorization: `Bearer ${token}` },
            cache: "no-store",
          }),
        ]);

        if (!settingsRes.ok || !schedulesRes.ok || !usersRes.ok) {
          throw new Error("Impossibile caricare le impostazioni admin");
        }

        const settingsData = await settingsRes.json();
        const schedulesData = await schedulesRes.json();
        const usersData = await usersRes.json();
        setSettings(settingsData);
        setSchedules(schedulesData);
        setUsers(usersData);
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err));
      } finally {
        setLoading(false);
      }
    };

    void fetchData();
  }, [router, token]);

  const handleSaveSettings = async () => {
    if (!settings || !token) return;
    setSaving(true);
    setError(null);
    try {
      const response = await fetch("/api/admin/push/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify(settings),
      });
      if (!response.ok) {
        throw new Error("Errore durante il salvataggio delle impostazioni");
      }
      const data = await response.json();
      setSettings(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSaving(false);
    }
  };

  const handleAddSchedule = async () => {
    if (!token) return;
    setSaving(true);
    setError(null);
    try {
      const payload = {
        label: newSchedule.label || "Nuova schedule",
        cronExpression: newSchedule.cronExpression,
        time: newSchedule.time || null,
        active: 1,
        targetType: newSchedule.targetType,
        targetUserIds: newSchedule.targetUserIds || "[]",
        titleTemplate: newSchedule.titleTemplate || "PowerLotto Notification",
        bodyTemplate: newSchedule.bodyTemplate || "Hai un nuovo aggiornamento PowerLotto.",
      };
      const response = await fetch("/api/admin/push/schedules", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify(payload),
      });
      if (!response.ok) {
        throw new Error("Errore nella creazione della schedule");
      }
      const created = await response.json();
      setSchedules((prev) => [created, ...prev]);
      setNewSchedule({
        label: "",
        cronExpression: "0 * * * *",
        time: "",
        targetType: "all",
        targetUserIds: "[]",
        titleTemplate: "",
        bodyTemplate: "",
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSaving(false);
    }
  };

  const handleToggleActive = async (schedule: PushSchedule) => {
    if (!token) return;
    setError(null);
    try {
      const response = await fetch(`/api/admin/push/schedules/${schedule.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ active: schedule.active === 1 ? 0 : 1 }),
      });
      if (!response.ok) throw new Error("Errore aggiornando la schedule");
      const updated = await response.json();
      setSchedules((prev) => prev.map((item) => (item.id === updated.id ? updated : item)));
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  };

  const handleDeleteSchedule = async (id: string) => {
    if (!token) return;
    setError(null);
    try {
      const response = await fetch(`/api/admin/push/schedules/${id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!response.ok) throw new Error("Errore eliminando la schedule");
      setSchedules((prev) => prev.filter((item) => item.id !== id));
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  };

  const handleSendNow = async () => {
    if (!token || !settings) return;
    if (sendNowTargetType === "manual" && !sendNowUserId) {
      setError("Seleziona un utente per l’invio manuale.");
      return;
    }

    setSaving(true);
    setError(null);
    setDispatchMessage("");
    try {
      const targetType = sendNowTargetType;
      const targetUserIds =
        targetType === "manual" ? JSON.stringify([sendNowUserId]) : "[]";

      const response = await fetch("/api/admin/push/send-now", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          title: settings.titleTemplate,
          body: settings.bodyTemplate,
          targetType,
          targetUserIds,
        }),
      });
      if (!response.ok) throw new Error("Errore invio immediato");
      const data = await response.json();
      setDispatchMessage(`Invio istantaneo eseguito: ${data.summary.notificationsSent} notifiche inviate`);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSaving(false);
    }
  };

  const startEditingSchedule = (schedule: PushSchedule) => {
    setEditingScheduleId(schedule.id);
    setEditingSchedule({ ...schedule });
  };

  const cancelEditingSchedule = () => {
    setEditingScheduleId(null);
    setEditingSchedule(null);
  };

  const handleSaveSchedule = async () => {
    if (!token || !editingScheduleId || !editingSchedule) return;
    setSaving(true);
    setError(null);
    try {
      const payload = {
        label: editingSchedule.label,
        cronExpression: editingSchedule.cronExpression,
        time: editingSchedule.time || null,
        targetType: editingSchedule.targetType,
        targetUserIds: editingSchedule.targetUserIds || "[]",
        titleTemplate: editingSchedule.titleTemplate,
        bodyTemplate: editingSchedule.bodyTemplate,
      };
      const response = await fetch(`/api/admin/push/schedules/${editingScheduleId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify(payload),
      });
      if (!response.ok) throw new Error("Errore aggiornando la schedule");
      const updated = await response.json();
      setSchedules((prev) => prev.map((item) => (item.id === updated.id ? updated : item)));
      cancelEditingSchedule();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSaving(false);
    }
  };

  const handleLogout = () => {
    if (typeof window !== "undefined") {
      localStorage.removeItem("authToken");
    }
    router.replace("/login");
  };

  if (loading) {
    return <div className={styles.container}>Caricamento amministrazione...</div>;
  }

  return (
    <div className={styles.container}>
      <h1>Area Amministrazione PowerLotto</h1>
      {error && <div className={styles.alertError}>{error}</div>}
      <div className={styles.tabs}>
        <button
          type="button"
          className={`${styles.tabButton} ${activeTab === "users" ? styles.tabButtonActive : ""}`}
          onClick={() => setActiveTab("users")}
        >
          Utenti
        </button>
        <button
          type="button"
          className={`${styles.tabButton} ${activeTab === "instant" ? styles.tabButtonActive : ""}`}
          onClick={() => setActiveTab("instant")}
        >
          Push istantanee
        </button>
        <button
          type="button"
          className={`${styles.tabButton} ${activeTab === "schedule" ? styles.tabButtonActive : ""}`}
          onClick={() => setActiveTab("schedule")}
        >
          Schedula push
        </button>
        <button type="button" onClick={handleLogout} className={styles.buttonSmall}>
          Logout
        </button>
      </div>

      {activeTab === "users" && (
        <section className={styles.card}>
          <h2>Utenti registrati</h2>
          <div className={styles.gridSmall}>
            <label>
              Cerca utenti
              <input
                type="text"
                value={userSearch}
                onChange={(event) => setUserSearch(event.target.value)}
                placeholder="Cerca per username o email"
                className={styles.input}
              />
            </label>
          </div>
          {filteredUsers.length === 0 ? (
            <p>Nessun utente trovato.</p>
          ) : (
            <table className={styles.userTable}>
              <thead>
                <tr>
                  <th>Username</th>
                  <th>Email</th>
                  <th>ID</th>
                </tr>
              </thead>
              <tbody>
                {filteredUsers.map((user) => (
                  <tr key={user.id}>
                    <td>{user.email.split("@")[0]}</td>
                    <td>{user.email}</td>
                    <td>{user.id}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>
      )}

      {activeTab === "instant" && (
        <section className={styles.card}>
          <h2>Push istantanea</h2>
          <div className={styles.gridSmall}>
          <label>
            Titolo notifica
            <input
              type="text"
              value={settings?.titleTemplate}
              onChange={(event) => setSettings((prev) => prev ? { ...prev, titleTemplate: event.target.value } : prev)}
              className={styles.input}
            />
          </label>
          <label>
            Testo notifica
            <textarea
              value={settings?.bodyTemplate}
              onChange={(event) => setSettings((prev) => prev ? { ...prev, bodyTemplate: event.target.value } : prev)}
              rows={4}
              className={styles.textarea}
            />
          </label>
          <label>
            Destinatari invio ora
            <select
              value={sendNowTargetType}
              onChange={(event) => setSendNowTargetType(event.target.value as "all" | "manual")}
              className={styles.select}
            >
              <option value="all">Tutti gli utenti</option>
              <option value="manual">Singolo utente</option>
            </select>
          </label>
          {sendNowTargetType === "manual" && (
            <label>
              Utente destinatario
              <select
                value={sendNowUserId}
                onChange={(event) => setSendNowUserId(event.target.value)}
                className={styles.select}
              >
                <option value="">Seleziona un utente</option>
                {users.length === 0 ? (
                  <option value="" disabled>
                    Nessun utente disponibile
                  </option>
                ) : (
                  users.map((user) => (
                    <option key={user.id} value={user.id}>
                      {user.email}
                    </option>
                  ))
                )}
              </select>
            </label>
          )}
          <div className={styles.buttonRow}>
            <button type="button" onClick={handleSaveSettings} disabled={saving} className={styles.button}>
              Salva impostazioni
            </button>
            <button type="button" onClick={handleSendNow} disabled={saving} className={styles.button}>
              Invia ora
            </button>
          </div>
          {dispatchMessage && <div className={styles.alertSuccess}>{dispatchMessage}</div>}
        </div>
      </section>
      )}

      {activeTab === "schedule" && (
        <>
          <section className={styles.cardAlternate}>
            <h2>Nuova schedule</h2>
        <div className={styles.grid}>
          <label>
            Etichetta
            <input
              type="text"
              value={newSchedule.label}
              onChange={(event) => setNewSchedule((prev) => ({ ...prev, label: event.target.value }))}
              placeholder="Esempio: Push giornaliero"
              className={styles.input}
            />
          </label>
          <label>
            Cron expression
            <input
              type="text"
              value={newSchedule.cronExpression}
              onChange={(event) => setNewSchedule((prev) => ({ ...prev, cronExpression: event.target.value }))}
              placeholder="0 * * * *"
              className={styles.input}
            />
          </label>
          <label>
            Ora esatta (UTC, opzionale)
            <input
              type="text"
              value={newSchedule.time}
              onChange={(event) => setNewSchedule((prev) => ({ ...prev, time: event.target.value }))}
              placeholder="HH:mm"
              className={styles.input}
            />
          </label>
          <label>
            Titolo notifica schedule
            <input
              type="text"
              value={newSchedule.titleTemplate}
              onChange={(event) => setNewSchedule((prev) => ({ ...prev, titleTemplate: event.target.value }))}
              placeholder="Titolo notifica"
              className={styles.input}
            />
          </label>
          <label>
            Testo notifica schedule
            <textarea
              value={newSchedule.bodyTemplate}
              onChange={(event) => setNewSchedule((prev) => ({ ...prev, bodyTemplate: event.target.value }))}
              rows={3}
              placeholder="Testo notifica"
              className={styles.textarea}
            />
          </label>
          <label>
            Destinatari
            <select
              value={newSchedule.targetType}
              onChange={(event) => setNewSchedule((prev) => ({ ...prev, targetType: event.target.value }))}
              className={styles.select}
            >
              <option value="all">Tutti gli utenti con subscription</option>
              <option value="notifyWins">Utenti con notifyWins attivo</option>
              <option value="manual">Manuale (user IDs JSON)</option>
            </select>
          </label>
          {newSchedule.targetType === "manual" && (
            <label>
              User IDs JSON
              <textarea
                value={newSchedule.targetUserIds}
                onChange={(event) => setNewSchedule((prev) => ({ ...prev, targetUserIds: event.target.value }))}
                rows={3}
                placeholder='["user-id-1","user-id-2"]'
                className={styles.textarea}
              />
            </label>
          )}
          <button type="button" onClick={handleAddSchedule} disabled={saving} className={styles.button}>
            Aggiungi schedule
          </button>
        </div>
      </section>

      <section className={styles.card}>
        <div className={styles.gridSmall}>
          <label className={styles.labelRow}>
            <input
              type="checkbox"
              checked={settings?.enabled === 1}
              onChange={(event) => setSettings((prev) => prev ? { ...prev, enabled: event.target.checked ? 1 : 0 } : prev)}
            />
            Abilita notifiche push
          </label>
        </div>
      </section>

      <section className={styles.cardLight}>
        <h2>Schedule attive</h2>
        {schedules.length === 0 ? (
          <p>Nessuna schedule creata.</p>
        ) : (
          <div className={styles.grid}>
            {schedules.map((schedule) => {
              const isEditing = editingScheduleId === schedule.id;
              const activeSchedule = isEditing && editingSchedule ? editingSchedule : schedule;

              return (
                <div key={schedule.id} className={styles.scheduleCard}>
                  <div className={styles.scheduleRow}>
                    <strong>{activeSchedule.label}</strong>
                    <span>{schedule.active === 1 ? "Attiva" : "Disattiva"}</span>
                  </div>
                  <div className={styles.scheduleInfo}>
                    {isEditing ? (
                      <>
                        <label>
                          Etichetta
                          <input
                            type="text"
                            value={activeSchedule.label}
                            onChange={(event) => setEditingSchedule((prev) => prev ? { ...prev, label: event.target.value } : prev)}
                            className={styles.input}
                          />
                        </label>
                        <label>
                          Titolo notifica
                          <input
                            type="text"
                            value={activeSchedule.titleTemplate}
                            onChange={(event) => setEditingSchedule((prev) => prev ? { ...prev, titleTemplate: event.target.value } : prev)}
                            className={styles.input}
                          />
                        </label>
                        <label>
                          Testo notifica
                          <textarea
                            value={activeSchedule.bodyTemplate}
                            onChange={(event) => setEditingSchedule((prev) => prev ? { ...prev, bodyTemplate: event.target.value } : prev)}
                            rows={3}
                            className={styles.textarea}
                          />
                        </label>
                        <label>
                          Cron expression
                          <input
                            type="text"
                            value={activeSchedule.cronExpression}
                            onChange={(event) => setEditingSchedule((prev) => prev ? { ...prev, cronExpression: event.target.value } : prev)}
                            className={styles.input}
                          />
                        </label>
                        <label>
                          Ora esatta (UTC)
                          <input
                            type="text"
                            value={activeSchedule.time || ""}
                            onChange={(event) => setEditingSchedule((prev) => prev ? { ...prev, time: event.target.value } : prev)}
                            className={styles.input}
                          />
                        </label>
                      </>
                    ) : (
                      <>
                        <div>Expression: {schedule.cronExpression}</div>
                        <div>Ora: {schedule.time || "non impostata"}</div>
                        <div>Titolo: {schedule.titleTemplate}</div>
                        <div>Testo: {schedule.bodyTemplate}</div>
                        <div>Destinatari: {schedule.targetType}</div>
                        {schedule.targetType === "manual" && <div>User IDs: {schedule.targetUserIds}</div>}
                      </>
                    )}
                  </div>
                  <div className={styles.buttonRow}>
                    {isEditing ? (
                      <>
                        <button type="button" onClick={handleSaveSchedule} disabled={saving} className={styles.buttonSmall}>
                          Salva
                        </button>
                        <button type="button" onClick={cancelEditingSchedule} disabled={saving} className={styles.buttonSmall}>
                          Annulla
                        </button>
                      </>
                    ) : (
                      <>
                        <button type="button" onClick={() => startEditingSchedule(schedule)} className={styles.buttonSmall}>
                          Modifica
                        </button>
                        <button type="button" onClick={() => void handleToggleActive(schedule)} className={styles.buttonSmall}>
                          {schedule.active === 1 ? "Disattiva" : "Attiva"}
                        </button>
                        <button type="button" onClick={() => void handleDeleteSchedule(schedule.id)} className={styles.buttonSmall}>
                          Elimina
                        </button>
                      </>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>
        </>
      )}
    </div>
  );
}
