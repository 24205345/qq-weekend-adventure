"use client";

import { useEffect, useMemo, useState } from "react";
import type { FormEvent } from "react";
import { format } from "date-fns";
import styles from "./admin.module.css";

type Booking = {
  id: string;
  booking_code: string;
  applicant_name: string;
  applicant_email: string;
  date: string;
  start_time: string;
  plan: string;
  note: string;
  status: string;
  admin_note: string;
  created_at: string;
};

type SlotView = { time: string; available: boolean; reason?: string };

const statusLabel: Record<string, string> = {
  pending: "待确认",
  approved: "已同意",
  rejected: "已拒绝",
  cancelled: "已取消",
};

export default function PersonalAdminApp() {
  const [authed, setAuthed] = useState(false);
  const [password, setPassword] = useState("");
  const [filter, setFilter] = useState("pending");
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [slotDate, setSlotDate] = useState(() => format(new Date(), "yyyy-MM-dd"));
  const [slots, setSlots] = useState<SlotView[]>([]);
  const [busyId, setBusyId] = useState("");

  const pendingCount = useMemo(
    () => bookings.filter((item) => item.status === "pending").length,
    [bookings],
  );

  async function refreshSession() {
    const response = await fetch("/api/personal/admin/session");
    const body = (await response.json()) as { authenticated?: boolean };
    setAuthed(Boolean(body.authenticated));
    return Boolean(body.authenticated);
  }

  async function loadBookings(nextFilter = filter) {
    const response = await fetch(`/api/personal/admin/bookings?status=${nextFilter}`);
    if (response.status === 401) {
      setAuthed(false);
      return;
    }
    const body = (await response.json()) as { bookings?: Booking[]; error?: string };
    if (!response.ok) throw new Error(body.error || "读取预约失败");
    setBookings(body.bookings || []);
  }

  async function loadSlots(date = slotDate) {
    const response = await fetch(`/api/personal/admin/slots?date=${date}`);
    if (response.status === 401) {
      setAuthed(false);
      return;
    }
    const body = (await response.json()) as { slots?: SlotView[]; error?: string };
    if (!response.ok) throw new Error(body.error || "读取档期失败");
    setSlots(body.slots || []);
  }

  useEffect(() => {
    (async () => {
      try {
        const ok = await refreshSession();
        if (ok) {
          await Promise.all([loadBookings(), loadSlots()]);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "加载失败");
      } finally {
        setLoading(false);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function onLogin(event: FormEvent) {
    event.preventDefault();
    setError("");
    const response = await fetch("/api/personal/admin/session", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "login", password }),
    });
    const body = (await response.json()) as { error?: string };
    if (!response.ok) {
      setError(body.error || "登录失败");
      return;
    }
    setAuthed(true);
    setPassword("");
    await Promise.all([loadBookings(), loadSlots()]);
  }

  async function onLogout() {
    await fetch("/api/personal/admin/session", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "logout" }),
    });
    setAuthed(false);
    setBookings([]);
  }

  async function decide(id: string, action: "approve" | "reject" | "cancel") {
    setBusyId(id);
    setMessage("");
    setError("");
    try {
      const response = await fetch("/api/personal/admin/bookings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, action }),
      });
      const body = (await response.json()) as {
        error?: string;
        applicantMail?: { sent?: boolean; skipped?: boolean; error?: string };
      };
      if (!response.ok) throw new Error(body.error || "操作失败");

      if (body.applicantMail?.sent) {
        setMessage(action === "approve" ? "已同意，并已邮件通知预约人。" : "已拒绝，并已邮件通知预约人。");
      } else if (body.applicantMail?.skipped) {
        setMessage("状态已更新，但未配置 Resend，请手动通知预约人。");
      } else if (body.applicantMail?.error) {
        setMessage(`状态已更新，但通知预约人失败：${body.applicantMail.error}`);
      } else {
        setMessage("状态已更新。");
      }

      await Promise.all([loadBookings(), loadSlots()]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "操作失败");
    } finally {
      setBusyId("");
    }
  }

  async function toggleSlot(time: string, available: boolean) {
    setError("");
    setMessage("");
    const response = await fetch("/api/personal/admin/slots", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: available ? "block" : "unblock",
        date: slotDate,
        startTime: time,
        reason: "手动关闭",
      }),
    });
    const body = (await response.json()) as { error?: string; slots?: SlotView[] };
    if (!response.ok) {
      setError(body.error || "档期更新失败");
      return;
    }
    setSlots(body.slots || []);
    setMessage(available ? `已关闭 ${slotDate} ${time}` : `已重新开放 ${slotDate} ${time}`);
  }

  if (loading) {
    return <main className={styles.shell}><p className={styles.muted}>加载中…</p></main>;
  }

  if (!authed) {
    return (
      <main className={styles.shell}>
        <form className={styles.loginCard} onSubmit={onLogin}>
          <p className={styles.kicker}>个人轻后台</p>
          <h1>周末档期管理</h1>
          <p className={styles.muted}>查看申请、同意或拒绝，并关闭已约满的时间。</p>
          <label>
            <span>管理密码</span>
            <input
              type="password"
              value={password}
              autoComplete="current-password"
              onChange={(event) => setPassword(event.target.value)}
              placeholder="PERSONAL_ADMIN_PASSWORD"
            />
          </label>
          {error ? <p className={styles.error}>{error}</p> : null}
          <button type="submit">进入后台</button>
        </form>
      </main>
    );
  }

  return (
    <main className={styles.shell}>
      <header className={styles.header}>
        <div>
          <p className={styles.kicker}>和 QQ 的周末小冒险</p>
          <h1>轻后台</h1>
          <p className={styles.muted}>待确认 {pendingCount} 笔</p>
        </div>
        <button type="button" className={styles.ghost} onClick={onLogout}>退出</button>
      </header>

      {message ? <p className={styles.success}>{message}</p> : null}
      {error ? <p className={styles.error}>{error}</p> : null}

      <section className={styles.panel}>
        <div className={styles.panelHead}>
          <h2>预约申请</h2>
          <select
            value={filter}
            onChange={async (event) => {
              const next = event.target.value;
              setFilter(next);
              await loadBookings(next);
            }}
          >
            <option value="pending">待确认</option>
            <option value="approved">已同意</option>
            <option value="rejected">已拒绝</option>
            <option value="cancelled">已取消</option>
            <option value="all">全部</option>
          </select>
        </div>

        {bookings.length === 0 ? <p className={styles.muted}>暂时没有记录。</p> : null}

        <div className={styles.list}>
          {bookings.map((booking) => (
            <article key={booking.id} className={styles.card}>
              <div className={styles.cardTop}>
                <strong>{booking.applicant_name}</strong>
                <em>{statusLabel[booking.status] || booking.status}</em>
              </div>
              <p>{booking.date} {booking.start_time} · {booking.plan}</p>
              <p className={styles.muted}>{booking.applicant_email}</p>
              {booking.note ? <p>留言：{booking.note}</p> : null}
              <p className={styles.code}>{booking.booking_code}</p>
              {booking.status === "pending" ? (
                <div className={styles.actions}>
                  <button
                    type="button"
                    disabled={busyId === booking.id}
                    onClick={() => decide(booking.id, "approve")}
                  >
                    同意并通知
                  </button>
                  <button
                    type="button"
                    className={styles.danger}
                    disabled={busyId === booking.id}
                    onClick={() => decide(booking.id, "reject")}
                  >
                    拒绝并通知
                  </button>
                </div>
              ) : null}
              {booking.status === "approved" ? (
                <div className={styles.actions}>
                  <button
                    type="button"
                    className={styles.danger}
                    disabled={busyId === booking.id}
                    onClick={() => decide(booking.id, "cancel")}
                  >
                    取消预约
                  </button>
                </div>
              ) : null}
            </article>
          ))}
        </div>
      </section>

      <section className={styles.panel}>
        <div className={styles.panelHead}>
          <h2>手动档期</h2>
          <input
            type="date"
            value={slotDate}
            onChange={async (event) => {
              const next = event.target.value;
              setSlotDate(next);
              await loadSlots(next);
            }}
          />
        </div>
        <p className={styles.muted}>关闭后访客将无法再选择该时间；可随时重新开放。</p>
        <div className={styles.slotGrid}>
          {slots.length === 0 ? <p className={styles.muted}>这一天没有默认周末时段。</p> : null}
          {slots.map((slot) => (
            <button
              key={slot.time}
              type="button"
              className={slot.available ? styles.slotOpen : styles.slotClosed}
              onClick={() => toggleSlot(slot.time, slot.available)}
            >
              <strong>{slot.time}</strong>
              <small>{slot.available ? "可约 · 点此关闭" : `${slot.reason || "已关闭"} · 点此开放`}</small>
            </button>
          ))}
        </div>
      </section>
    </main>
  );
}
