"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import {
  Bell,
  BookOpenCheck,
  Building2,
  CalendarClock,
  CalendarDays,
  Check,
  ChevronRight,
  CircleAlert,
  Clock3,
  ExternalLink,
  LayoutDashboard,
  LoaderCircle,
  LogOut,
  Mail,
  MapPin,
  Menu,
  Palette,
  Plus,
  RefreshCw,
  Save,
  Settings2,
  Store,
  UserRoundCheck,
  Users,
  X,
} from "lucide-react";
import styles from "./admin.module.css";

type AdminData = {
  user: { email: string; displayName: string; role: string };
  tenant: {
    id: string;
    slug: string;
    name: string;
    contactEmail: string;
    timezone: string;
    primaryColor: string;
    accentColor: string;
    template: string;
  };
  stores: Array<Record<string, string | number>>;
  services: Array<Record<string, string | number>>;
  schedules: Array<Record<string, string | number>>;
  exceptions: Array<Record<string, string | number | null>>;
  members: Array<Record<string, string | number>>;
  bookings: Array<Record<string, string | number | null>>;
  notifications: Array<Record<string, string | number>>;
  audit: Array<Record<string, string>>;
};

type Tab = "overview" | "bookings" | "schedule" | "services" | "stores" | "team" | "brand";
type BookingCommand = (
  payload: Record<string, unknown>,
  success?: string,
  method?: "POST" | "PATCH",
) => Promise<void>;

const tabs: Array<{ id: Tab; label: string; icon: typeof LayoutDashboard }> = [
  { id: "overview", label: "经营概览", icon: LayoutDashboard },
  { id: "bookings", label: "预约管理", icon: BookOpenCheck },
  { id: "schedule", label: "开放时间", icon: CalendarClock },
  { id: "services", label: "预约主题", icon: CalendarDays },
  { id: "stores", label: "门店管理", icon: Store },
  { id: "team", label: "成员权限", icon: Users },
  { id: "brand", label: "品牌设置", icon: Palette },
];

const statusLabels: Record<string, string> = {
  pending_confirmation: "待确认",
  confirmed: "已确认",
  checked_in: "已签到",
  completed: "已完成",
  cancelled: "已取消",
  no_show: "爽约",
  expired: "已过期",
};

const roleLabels: Record<string, string> = {
  owner: "所有者",
  admin: "管理员",
  receptionist: "接待员",
  staff: "服务人员",
  viewer: "只读成员",
};

const weekdays = [
  { id: 1, label: "周一" },
  { id: 2, label: "周二" },
  { id: 3, label: "周三" },
  { id: 4, label: "周四" },
  { id: 5, label: "周五" },
  { id: 6, label: "周六" },
  { id: 0, label: "周日" },
];

function field(form: FormData, name: string) {
  return String(form.get(name) ?? "").trim();
}

function numberField(form: FormData, name: string, fallback = 0) {
  const value = Number(form.get(name));
  return Number.isFinite(value) ? value : fallback;
}

function formatDateTime(value: string | number | null | undefined) {
  if (!value) return "-";
  return String(value).replace("T", " ").slice(0, 16);
}

export function AdminDashboard({ user }: { user: { displayName: string; email: string } }) {
  const [data, setData] = useState<AdminData | null>(null);
  const [activeTab, setActiveTab] = useState<Tab>("overview");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [menuOpen, setMenuOpen] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const response = await fetch("/api/admin/context", { cache: "no-store" });
      const body = (await response.json()) as AdminData & { error?: string };
      if (!response.ok) throw new Error(body.error || "后台加载失败。");
      setData(body);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "后台加载失败。");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let active = true;
    fetch("/api/admin/context", { cache: "no-store" })
      .then(async (response) => {
        const body = (await response.json()) as AdminData & { error?: string };
        if (!response.ok) throw new Error(body.error || "后台加载失败。");
        if (active) setData(body);
      })
      .catch((loadError: unknown) => {
        if (active) setError(loadError instanceof Error ? loadError.message : "后台加载失败。");
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => { active = false; };
  }, []);

  async function command(payload: Record<string, unknown>, success = "已保存") {
    setSaving(true);
    setError("");
    setMessage("");
    try {
      const response = await fetch("/api/admin/config", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const body = (await response.json()) as { error?: string };
      if (!response.ok) throw new Error(body.error || "保存失败。");
      setMessage(success);
      await load();
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "保存失败。");
    } finally {
      setSaving(false);
    }
  }

  async function bookingCommand(
    payload: Record<string, unknown>,
    success = "预约已更新",
    method: "POST" | "PATCH" = "PATCH",
  ) {
    setSaving(true);
    setError("");
    setMessage("");
    try {
      const response = await fetch("/api/admin/bookings", {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const body = (await response.json()) as { error?: string };
      if (!response.ok) throw new Error(body.error || "预约更新失败。");
      setMessage(success);
      await load();
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "预约更新失败。");
    } finally {
      setSaving(false);
    }
  }

  const today = new Date().toISOString().slice(0, 10);
  const metrics = useMemo(() => {
    const bookings = data?.bookings ?? [];
    return {
      today: bookings.filter((item) => item.date === today && item.status !== "cancelled").length,
      pending: bookings.filter((item) => item.status === "pending_confirmation").length,
      upcoming: bookings.filter((item) => String(item.date) >= today && item.status === "confirmed").length,
      failedNotifications: (data?.notifications ?? []).filter((item) => item.status === "failed").length,
    };
  }, [data, today]);

  if (loading && !data) {
    return (
      <main className={styles.centerState}>
        <LoaderCircle className={styles.spin} size={30} />
        <p>正在准备你的商户后台</p>
      </main>
    );
  }

  if (!data) {
    return (
      <main className={styles.centerState}>
        <CircleAlert size={32} />
        <h1>后台暂时没有加载成功</h1>
        <p>{error}</p>
        <button type="button" onClick={() => void load()}><RefreshCw size={17} />重新加载</button>
      </main>
    );
  }

  const currentTab = tabs.find((tab) => tab.id === activeTab) ?? tabs[0];

  return (
    <div className={styles.shell}>
      <aside className={`${styles.sidebar} ${menuOpen ? styles.sidebarOpen : ""}`}>
        <div className={styles.brand}>
          <span><CalendarDays size={19} /></span>
          <div><strong>预约工作台</strong><small>{data.tenant.name}</small></div>
          <button className={styles.closeMenu} type="button" onClick={() => setMenuOpen(false)} title="关闭菜单"><X size={20} /></button>
        </div>
        <nav className={styles.nav} aria-label="后台导航">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                type="button"
                className={activeTab === tab.id ? styles.navActive : ""}
                onClick={() => { setActiveTab(tab.id); setMenuOpen(false); }}
              >
                <Icon size={18} /><span>{tab.label}</span>
              </button>
            );
          })}
        </nav>
        <div className={styles.sidebarFooter}>
          <a href={`/book/${data.tenant.slug}`} target="_blank" rel="noreferrer"><ExternalLink size={16} />打开预约页</a>
          <a href="/signout-with-chatgpt?return_to=/"><LogOut size={16} />退出登录</a>
        </div>
      </aside>

      <div className={styles.mainArea}>
        <header className={styles.topbar}>
          <button className={styles.menuButton} type="button" onClick={() => setMenuOpen(true)} title="打开菜单"><Menu size={21} /></button>
          <div><span>{currentTab.label}</span><small>{user.displayName}</small></div>
          <button className={styles.refreshButton} type="button" onClick={() => void load()} title="刷新数据"><RefreshCw size={18} /></button>
        </header>

        {(message || error) ? (
          <div className={error ? styles.errorBanner : styles.successBanner} role="status">
            {error ? <CircleAlert size={17} /> : <Check size={17} />}
            <span>{error || message}</span>
          </div>
        ) : null}

        <main className={styles.content}>
          {activeTab === "overview" ? (
            <Overview data={data} metrics={metrics} onNavigate={setActiveTab} />
          ) : null}
          {activeTab === "bookings" ? (
            <Bookings data={data} saving={saving} onCommand={bookingCommand} />
          ) : null}
          {activeTab === "schedule" ? (
            <Schedule data={data} saving={saving} onCommand={command} />
          ) : null}
          {activeTab === "services" ? (
            <Services data={data} saving={saving} onCommand={command} />
          ) : null}
          {activeTab === "stores" ? (
            <Stores data={data} saving={saving} onCommand={command} />
          ) : null}
          {activeTab === "team" ? (
            <Team data={data} saving={saving} onCommand={command} />
          ) : null}
          {activeTab === "brand" ? (
            <Brand data={data} saving={saving} onCommand={command} />
          ) : null}
        </main>
      </div>
    </div>
  );
}

function SectionHeader({ title, description, action }: { title: string; description: string; action?: React.ReactNode }) {
  return <div className={styles.sectionHeader}><div><h1>{title}</h1><p>{description}</p></div>{action}</div>;
}

function Overview({ data, metrics, onNavigate }: { data: AdminData; metrics: Record<string, number>; onNavigate: (tab: Tab) => void }) {
  const upcoming = data.bookings
    .filter((item) => String(item.date) >= new Date().toISOString().slice(0, 10) && item.status !== "cancelled")
    .slice(0, 6);
  return (
    <>
      <SectionHeader title="今天的预约一目了然" description="快速查看待处理事项、即将到店的客人和通知状态。" />
      <div className={styles.metricGrid}>
        <button type="button" onClick={() => onNavigate("bookings")}><CalendarDays size={19} /><span>今日预约</span><strong>{metrics.today}</strong></button>
        <button type="button" onClick={() => onNavigate("bookings")}><Clock3 size={19} /><span>待确认</span><strong>{metrics.pending}</strong></button>
        <button type="button" onClick={() => onNavigate("bookings")}><UserRoundCheck size={19} /><span>即将到店</span><strong>{metrics.upcoming}</strong></button>
        <button type="button" onClick={() => onNavigate("bookings")}><Bell size={19} /><span>通知失败</span><strong>{metrics.failedNotifications}</strong></button>
      </div>
      <section className={styles.panel}>
        <div className={styles.panelHeading}><div><h2>近期预约</h2><p>按日期显示最近需要关注的记录</p></div><button type="button" onClick={() => onNavigate("bookings")}>查看全部<ChevronRight size={16} /></button></div>
        {upcoming.length ? <div className={styles.compactList}>{upcoming.map((booking) => <div key={String(booking.id)}><span className={styles.dateBlock}><strong>{String(booking.date).slice(5)}</strong><small>{booking.start_time}</small></span><span><strong>{booking.customer_name}</strong><small>{booking.service_name} · {booking.party_size} 人</small></span><em data-status={booking.status}>{statusLabels[String(booking.status)] ?? booking.status}</em></div>)}</div> : <Empty text="暂时没有即将到来的预约" />}
      </section>
      <section className={styles.quickGrid}>
        <button type="button" onClick={() => onNavigate("schedule")}><CalendarClock size={20} /><span><strong>配置开放时间</strong><small>设置每周时段和接待容量</small></span><ChevronRight size={17} /></button>
        <button type="button" onClick={() => onNavigate("services")}><Settings2 size={20} /><span><strong>管理预约主题</strong><small>编辑时长、人数和确认方式</small></span><ChevronRight size={17} /></button>
        <a href={`/book/${data.tenant.slug}`} target="_blank" rel="noreferrer"><ExternalLink size={20} /><span><strong>预览公开预约页</strong><small>/book/{data.tenant.slug}</small></span><ChevronRight size={17} /></a>
      </section>
    </>
  );
}

function Bookings({ data, saving, onCommand }: { data: AdminData; saving: boolean; onCommand: BookingCommand }) {
  const [filter, setFilter] = useState("all");
  const items = filter === "all" ? data.bookings : data.bookings.filter((item) => item.status === filter);
  return (
    <>
      <SectionHeader title="预约管理" description="确认、签到、完成或取消预约，并记录只对内部可见的备注。" />
      <ManualBookingForm data={data} saving={saving} onCommand={onCommand} />
      <div className={styles.filterBar}>
        {[["all", "全部"], ["pending_confirmation", "待确认"], ["confirmed", "已确认"], ["checked_in", "已签到"], ["cancelled", "已取消"]].map(([value, label]) => <button key={value} type="button" className={filter === value ? styles.filterActive : ""} onClick={() => setFilter(value)}>{label}</button>)}
      </div>
      <section className={styles.panel}>
        {items.length ? <div className={styles.bookingList}>{items.map((booking) => <BookingRow key={String(booking.id)} booking={booking} saving={saving} onCommand={onCommand} />)}</div> : <Empty text="没有符合筛选条件的预约" />}
      </section>
    </>
  );
}

function BookingRow({ booking, saving, onCommand }: { booking: Record<string, string | number | null>; saving: boolean; onCommand: BookingCommand }) {
  const [expanded, setExpanded] = useState(false);
  const [note, setNote] = useState(String(booking.internal_note ?? ""));
  const [newDate, setNewDate] = useState(String(booking.date));
  const [newTime, setNewTime] = useState(String(booking.start_time));
  const [newPartySize, setNewPartySize] = useState(Number(booking.party_size));
  const status = String(booking.status);
  const actions: Array<[string, string]> = status === "pending_confirmation"
    ? [["confirmed", "确认"] , ["cancelled", "取消"]]
    : status === "confirmed"
      ? [["checked_in", "签到"], ["no_show", "爽约"], ["cancelled", "取消"]]
      : status === "checked_in"
        ? [["completed", "完成"], ["cancelled", "取消"]]
        : status === "cancelled" || status === "no_show"
          ? [["confirmed", "恢复"]]
          : [];
  return (
    <article className={styles.bookingItem}>
      <button className={styles.bookingSummary} type="button" onClick={() => setExpanded(!expanded)}>
        <span className={styles.dateBlock}><strong>{String(booking.date).slice(5)}</strong><small>{booking.start_time}</small></span>
        <span className={styles.bookingName}><strong>{booking.customer_name}</strong><small>{booking.service_name} · {booking.party_size} 人 · {booking.booking_code}</small></span>
        <em data-status={status}>{statusLabels[status] ?? status}</em><ChevronRight className={expanded ? styles.chevronOpen : ""} size={18} />
      </button>
      {expanded ? <div className={styles.bookingDetail}>
        <dl><div><dt>门店</dt><dd>{booking.store_name}</dd></div><div><dt>联系方式</dt><dd>{booking.customer_phone || booking.customer_email || "未填写"}</dd></div><div><dt>客户备注</dt><dd>{booking.customer_note || "无"}</dd></div><div><dt>提交时间</dt><dd>{formatDateTime(booking.created_at)}</dd></div></dl>
        <label><span>内部备注</span><textarea value={note} maxLength={1000} onChange={(event) => setNote(event.target.value)} placeholder="仅商户成员可见" /></label>
        <div className={styles.rescheduleFields}><label><span>改期日期</span><input type="date" value={newDate} onChange={(event) => setNewDate(event.target.value)} /></label><label><span>开始时间</span><input type="time" value={newTime} onChange={(event) => setNewTime(event.target.value)} /></label><label><span>预约人数</span><input type="number" min="1" value={newPartySize} onChange={(event) => setNewPartySize(Number(event.target.value))} /></label><button type="button" disabled={saving} onClick={() => void onCommand({ id: booking.id, action: "reschedule", date: newDate, startTime: newTime, partySize: newPartySize }, "预约时间与人数已更新")}><CalendarClock size={16} />保存改期</button></div>
        <div className={styles.rowActions}>
          <button type="button" disabled={saving} onClick={() => void onCommand({ id: booking.id, action: "note", internalNote: note }, "内部备注已保存")}><Save size={16} />保存备注</button>
          <button type="button" disabled={saving} onClick={() => void onCommand({ id: booking.id, action: "resend" }, "通知已重新发送")}><Mail size={16} />重发通知</button>
          {actions.map(([next, label]) => <button key={next} type="button" disabled={saving} data-danger={next === "cancelled" || next === "no_show"} onClick={() => void onCommand({ id: booking.id, action: "status", status: next }, `预约已${label}`)}>{label}</button>)}
        </div>
      </div> : null}
    </article>
  );
}

function ManualBookingForm({ data, saving, onCommand }: { data: AdminData; saving: boolean; onCommand: BookingCommand }) {
  const firstService = data.services.find((item) => Number(item.active)) ?? data.services[0];
  const [serviceId, setServiceId] = useState(String(firstService?.id ?? ""));
  const service = data.services.find((item) => item.id === serviceId);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!service) return;
    const form = new FormData(event.currentTarget);
    await onCommand(
      {
        serviceId,
        storeId: service.store_id,
        date: field(form, "date"),
        startTime: field(form, "startTime"),
        customerName: field(form, "customerName"),
        customerEmail: field(form, "customerEmail"),
        customerPhone: field(form, "customerPhone"),
        partySize: numberField(form, "partySize", 1),
        customerNote: field(form, "customerNote"),
        customData: {},
        idempotencyKey: `admin-${crypto.randomUUID()}`,
      },
      "手工预约已创建",
      "POST",
    );
    event.currentTarget.reset();
  }

  return <section className={styles.panel}><div className={styles.panelHeading}><div><h2>手工录入预约</h2><p>用于电话、现场或其他渠道；提交时仍会检查开放时间和容量</p></div></div><form className={styles.manualBookingForm} onSubmit={(event) => void submit(event)}><label><span>预约主题</span><select required value={serviceId} onChange={(event) => setServiceId(event.target.value)}>{data.services.filter((item) => Number(item.active)).map((item) => <option key={String(item.id)} value={String(item.id)}>{item.name}</option>)}</select></label><label><span>日期</span><input required type="date" name="date" /></label><label><span>时间</span><input required type="time" name="startTime" /></label><label><span>人数</span><input required type="number" min="1" name="partySize" defaultValue="1" /></label><label><span>预约人</span><input required name="customerName" /></label><label><span>手机号</span><input name="customerPhone" /></label><label><span>邮箱</span><input type="email" name="customerEmail" /></label><label><span>备注</span><input name="customerNote" /></label><button type="submit" disabled={saving || !service}><Plus size={16} />创建预约</button></form></section>;
}

function Schedule({ data, saving, onCommand }: { data: AdminData; saving: boolean; onCommand: (payload: Record<string, unknown>, success?: string) => Promise<void> }) {
  const firstService = String(data.services.find((item) => Number(item.active))?.id ?? data.services[0]?.id ?? "");
  const [serviceId, setServiceId] = useState(firstService);
  const service = data.services.find((item) => item.id === serviceId);
  const storeId = String(service?.store_id ?? "");
  return (
    <>
      <SectionHeader title="开放时间与容量" description="设置每周可预约时段，以及每个时段最多接待的预约单数和人数。" />
      <div className={styles.toolbarField}><label>预约主题<select value={serviceId} onChange={(event) => setServiceId(event.target.value)}>{data.services.map((item) => <option key={String(item.id)} value={String(item.id)}>{item.name}</option>)}</select></label></div>
      {service ? <section className={styles.panel}><div className={styles.scheduleList}>{weekdays.map((day) => {
        const schedule = data.schedules.find((item) => item.service_id === serviceId && Number(item.weekday) === day.id);
        return <ScheduleRow key={`${serviceId}-${day.id}`} day={day} schedule={schedule} serviceId={serviceId} storeId={storeId} saving={saving} onCommand={onCommand} />;
      })}</div></section> : <Empty text="请先创建预约主题" />}
      {service ? <ExceptionForm serviceId={serviceId} storeId={storeId} saving={saving} onCommand={onCommand} /> : null}
    </>
  );
}

function ScheduleRow({ day, schedule, serviceId, storeId, saving, onCommand }: { day: { id: number; label: string }; schedule?: Record<string, string | number>; serviceId: string; storeId: string; saving: boolean; onCommand: (payload: Record<string, unknown>, success?: string) => Promise<void> }) {
  const explicit = (() => { try { return (JSON.parse(String(schedule?.slot_times ?? "[]")) as string[]).join(", "); } catch { return ""; } })();
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const times = field(form, "slotTimes").split(/[，,\s]+/).map((item) => item.trim()).filter(Boolean);
    await onCommand({ action: "upsertSchedule", serviceId, storeId, weekday: day.id, enabled: form.get("enabled") === "on", startTime: field(form, "startTime"), endTime: field(form, "endTime"), intervalMinutes: numberField(form, "intervalMinutes", 60), slotTimes: times, maxBookings: numberField(form, "maxBookings", 4), maxGuests: numberField(form, "maxGuests", 20) }, `${day.label}开放时间已保存`);
  }
  return <form className={styles.scheduleRow} onSubmit={(event) => void submit(event)}>
    <label className={styles.dayToggle}><input type="checkbox" name="enabled" defaultChecked={schedule ? Boolean(Number(schedule.enabled)) : false} /><span>{day.label}</span></label>
    <label><span>开始</span><input type="time" name="startTime" defaultValue={String(schedule?.start_time ?? "09:00")} /></label>
    <label><span>结束</span><input type="time" name="endTime" defaultValue={String(schedule?.end_time ?? "18:00")} /></label>
    <label><span>间隔/分钟</span><input type="number" name="intervalMinutes" min="5" max="720" defaultValue={Number(schedule?.interval_minutes ?? 60)} /></label>
    <label className={styles.slotInput}><span>指定时间 <small>用逗号分隔；留空则按间隔生成</small></span><input name="slotTimes" defaultValue={explicit} placeholder="10:00, 11:30, 14:00" /></label>
    <label><span>最多订单</span><input type="number" name="maxBookings" min="1" max="1000" defaultValue={Number(schedule?.max_bookings ?? 4)} /></label>
    <label><span>最多人数</span><input type="number" name="maxGuests" min="1" max="10000" defaultValue={Number(schedule?.max_guests ?? 20)} /></label>
    <button type="submit" disabled={saving} title={`保存${day.label}`}><Save size={17} /></button>
  </form>;
}

function ExceptionForm({ serviceId, storeId, saving, onCommand }: { serviceId: string; storeId: string; saving: boolean; onCommand: (payload: Record<string, unknown>, success?: string) => Promise<void> }) {
  async function submit(event: FormEvent<HTMLFormElement>) { event.preventDefault(); const form = new FormData(event.currentTarget); const times = field(form, "slotTimes").split(/[，,\s]+/).filter(Boolean); await onCommand({ action: "upsertException", serviceId, storeId, date: field(form, "date"), closed: form.get("closed") === "on", slotTimes: times, maxBookings: field(form, "maxBookings") ? numberField(form, "maxBookings") : null, maxGuests: field(form, "maxGuests") ? numberField(form, "maxGuests") : null, note: field(form, "note") }, "日期例外已保存"); event.currentTarget.reset(); }
  return <section className={styles.panel}><div className={styles.panelHeading}><div><h2>添加日期例外</h2><p>临时闭店、加场或单独调整某一天容量</p></div></div><form className={styles.inlineForm} onSubmit={(event) => void submit(event)}><label><span>日期</span><input required type="date" name="date" /></label><label className={styles.checkField}><input type="checkbox" name="closed" /><span>当天关闭</span></label><label><span>指定时间</span><input name="slotTimes" placeholder="10:00, 14:00" /></label><label><span>最多订单</span><input type="number" min="1" name="maxBookings" /></label><label><span>最多人数</span><input type="number" min="1" name="maxGuests" /></label><label><span>说明</span><input name="note" placeholder="节假日安排" /></label><button type="submit" disabled={saving}><Plus size={16} />保存例外</button></form></section>;
}

function Services({ data, saving, onCommand }: { data: AdminData; saving: boolean; onCommand: (payload: Record<string, unknown>, success?: string) => Promise<void> }) {
  return <><SectionHeader title="预约主题" description="定义消费者可以预约的服务、活动时长、人数和确认方式。" />
    <div className={styles.editList}>{data.services.map((service) => <ServiceForm key={String(service.id)} service={service} stores={data.stores} saving={saving} onCommand={onCommand} />)}</div>
    <CreateService stores={data.stores} saving={saving} onCommand={onCommand} />
  </>;
}

function ServiceForm({ service, stores, saving, onCommand }: { service: Record<string, string | number>; stores: AdminData["stores"]; saving: boolean; onCommand: (payload: Record<string, unknown>, success?: string) => Promise<void> }) {
  async function submit(event: FormEvent<HTMLFormElement>) { event.preventDefault(); const form = new FormData(event.currentTarget); await onCommand({ action: "updateService", id: service.id, storeId: field(form, "storeId"), name: field(form, "name"), description: field(form, "description"), durationMinutes: numberField(form, "durationMinutes"), maxPartySize: numberField(form, "maxPartySize"), advanceDays: numberField(form, "advanceDays"), cutoffHours: numberField(form, "cutoffHours"), confirmationMode: field(form, "confirmationMode"), notificationEmail: field(form, "notificationEmail"), active: form.get("active") === "on" }, "预约主题已保存"); }
  return <form className={styles.editor} onSubmit={(event) => void submit(event)}><div className={styles.editorTitle}><div><CalendarDays size={19} /><strong>{service.name}</strong><small>{service.slug}</small></div><label className={styles.switch}><input type="checkbox" name="active" defaultChecked={Boolean(Number(service.active))} /><span>启用</span></label></div><div className={styles.formGrid}><label><span>主题名称</span><input required name="name" defaultValue={String(service.name)} /></label><label><span>所属门店</span><select name="storeId" defaultValue={String(service.store_id)}>{stores.map((store) => <option key={String(store.id)} value={String(store.id)}>{store.name}</option>)}</select></label><label className={styles.span2}><span>主题介绍</span><textarea name="description" defaultValue={String(service.description)} /></label><label><span>时长/分钟</span><input type="number" name="durationMinutes" min="15" defaultValue={Number(service.duration_minutes)} /></label><label><span>单笔最多人数</span><input type="number" name="maxPartySize" min="1" defaultValue={Number(service.max_party_size)} /></label><label><span>提前开放/天</span><input type="number" name="advanceDays" min="1" defaultValue={Number(service.advance_days)} /></label><label><span>截止预约/小时前</span><input type="number" name="cutoffHours" min="0" defaultValue={Number(service.cutoff_hours)} /></label><label><span>确认方式</span><select name="confirmationMode" defaultValue={String(service.confirmation_mode)}><option value="instant">自动确认</option><option value="manual">人工确认</option></select></label><label><span>通知邮箱</span><input type="email" name="notificationEmail" defaultValue={String(service.notification_email)} /></label></div><div className={styles.formFooter}><button type="submit" disabled={saving}><Save size={16} />保存主题</button></div></form>;
}

function CreateService({ stores, saving, onCommand }: { stores: AdminData["stores"]; saving: boolean; onCommand: (payload: Record<string, unknown>, success?: string) => Promise<void> }) {
  async function submit(event: FormEvent<HTMLFormElement>) { event.preventDefault(); const form = new FormData(event.currentTarget); await onCommand({ action: "createService", storeId: field(form, "storeId"), name: field(form, "name"), description: field(form, "description"), durationMinutes: 90, maxPartySize: 6, advanceDays: 60, cutoffHours: 2, confirmationMode: "instant", notificationEmail: field(form, "notificationEmail") }, "新预约主题已创建"); event.currentTarget.reset(); }
  return <section className={styles.panel}><div className={styles.panelHeading}><div><h2>新建预约主题</h2><p>创建后再到开放时间中配置每周时段</p></div></div><form className={styles.inlineForm} onSubmit={(event) => void submit(event)}><label><span>主题名称</span><input required name="name" placeholder="例如：新展览参观" /></label><label><span>门店</span><select required name="storeId">{stores.map((store) => <option key={String(store.id)} value={String(store.id)}>{store.name}</option>)}</select></label><label><span>主题介绍</span><input name="description" placeholder="一句简短说明" /></label><label><span>通知邮箱</span><input type="email" name="notificationEmail" /></label><button type="submit" disabled={saving}><Plus size={16} />创建主题</button></form></section>;
}

function Stores({ data, saving, onCommand }: { data: AdminData; saving: boolean; onCommand: (payload: Record<string, unknown>, success?: string) => Promise<void> }) {
  return <><SectionHeader title="门店管理" description="维护预约地点、联系方式和消费者到店指引。" /><div className={styles.editList}>{data.stores.map((store) => <StoreForm key={String(store.id)} store={store} saving={saving} onCommand={onCommand} />)}</div><CreateStore saving={saving} onCommand={onCommand} /></>;
}

function StoreForm({ store, saving, onCommand }: { store: Record<string, string | number>; saving: boolean; onCommand: (payload: Record<string, unknown>, success?: string) => Promise<void> }) {
  async function submit(event: FormEvent<HTMLFormElement>) { event.preventDefault(); const form = new FormData(event.currentTarget); await onCommand({ action: "updateStore", id: store.id, name: field(form, "name"), address: field(form, "address"), phone: field(form, "phone"), arrivalGuide: field(form, "arrivalGuide"), active: form.get("active") === "on" }, "门店信息已保存"); }
  return <form className={styles.editor} onSubmit={(event) => void submit(event)}><div className={styles.editorTitle}><div><MapPin size={19} /><strong>{store.name}</strong></div><label className={styles.switch}><input type="checkbox" name="active" defaultChecked={Boolean(Number(store.active))} /><span>营业</span></label></div><div className={styles.formGrid}><label><span>门店名称</span><input required name="name" defaultValue={String(store.name)} /></label><label><span>联系电话</span><input name="phone" defaultValue={String(store.phone)} /></label><label className={styles.span2}><span>地址</span><input name="address" defaultValue={String(store.address)} /></label><label className={styles.span2}><span>到店指引</span><textarea name="arrivalGuide" defaultValue={String(store.arrival_guide)} /></label></div><div className={styles.formFooter}><button type="submit" disabled={saving}><Save size={16} />保存门店</button></div></form>;
}

function CreateStore({ saving, onCommand }: { saving: boolean; onCommand: (payload: Record<string, unknown>, success?: string) => Promise<void> }) { async function submit(event: FormEvent<HTMLFormElement>) { event.preventDefault(); const form = new FormData(event.currentTarget); await onCommand({ action: "createStore", name: field(form, "name"), address: field(form, "address"), phone: field(form, "phone"), arrivalGuide: field(form, "arrivalGuide") }, "新门店已创建"); event.currentTarget.reset(); } return <section className={styles.panel}><div className={styles.panelHeading}><div><h2>添加门店</h2><p>新门店创建后可以继续添加预约主题</p></div></div><form className={styles.inlineForm} onSubmit={(event) => void submit(event)}><label><span>门店名称</span><input required name="name" /></label><label><span>联系电话</span><input name="phone" /></label><label><span>地址</span><input name="address" /></label><label><span>到店指引</span><input name="arrivalGuide" /></label><button type="submit" disabled={saving}><Plus size={16} />添加门店</button></form></section>; }

function Team({ data, saving, onCommand }: { data: AdminData; saving: boolean; onCommand: (payload: Record<string, unknown>, success?: string) => Promise<void> }) {
  async function invite(event: FormEvent<HTMLFormElement>) { event.preventDefault(); const form = new FormData(event.currentTarget); await onCommand({ action: "inviteMember", email: field(form, "email"), displayName: field(form, "displayName"), role: field(form, "role") }, "成员已加入商户"); event.currentTarget.reset(); }
  return <><SectionHeader title="成员与权限" description="成员使用同一邮箱登录后即可进入这个商户后台。" /><section className={styles.panel}><div className={styles.memberList}>{data.members.map((member) => <div key={String(member.id)}><span className={styles.avatar}>{String(member.display_name || member.email).slice(0, 1).toUpperCase()}</span><span><strong>{member.display_name || member.email}</strong><small>{member.email}</small></span><em>{roleLabels[String(member.role)] ?? member.role}</em><span data-member-status={member.status}>{member.status === "active" ? "已启用" : "已停用"}</span>{member.role !== "owner" ? <div className={styles.memberActions}><select defaultValue={String(member.role)} onChange={(event) => void onCommand({ action: "updateMember", id: member.id, role: event.target.value, status: member.status }, "成员角色已更新")}>{["admin", "receptionist", "staff", "viewer"].map((role) => <option key={role} value={role}>{roleLabels[role]}</option>)}</select><button type="button" disabled={saving} onClick={() => void onCommand({ action: "updateMember", id: member.id, role: member.role, status: member.status === "active" ? "inactive" : "active" }, "成员状态已更新")}>{member.status === "active" ? "停用" : "启用"}</button></div> : null}</div>)}</div></section><section className={styles.panel}><div className={styles.panelHeading}><div><h2>添加成员</h2><p>管理员可配置商户；接待员可处理预约；只读成员只能查看</p></div></div><form className={styles.inlineForm} onSubmit={(event) => void invite(event)}><label><span>姓名</span><input name="displayName" /></label><label><span>登录邮箱</span><input required type="email" name="email" /></label><label><span>角色</span><select name="role"><option value="admin">管理员</option><option value="receptionist">接待员</option><option value="staff">服务人员</option><option value="viewer">只读成员</option></select></label><button type="submit" disabled={saving}><Plus size={16} />添加成员</button></form></section></>;
}

function Brand({ data, saving, onCommand }: { data: AdminData; saving: boolean; onCommand: (payload: Record<string, unknown>, success?: string) => Promise<void> }) {
  async function submit(event: FormEvent<HTMLFormElement>) { event.preventDefault(); const form = new FormData(event.currentTarget); await onCommand({ action: "updateTenant", name: field(form, "name"), contactEmail: field(form, "contactEmail"), primaryColor: field(form, "primaryColor"), accentColor: field(form, "accentColor"), template: field(form, "template") }, "品牌设置已保存"); }
  return <><SectionHeader title="品牌与预约入口" description="这些信息会展示在公开预约页，并作为新主题的默认通知设置。" action={<a className={styles.headerLink} href={`/book/${data.tenant.slug}`} target="_blank" rel="noreferrer"><ExternalLink size={16} />预览预约页</a>} /><form className={styles.editor} onSubmit={(event) => void submit(event)}><div className={styles.editorTitle}><div><Building2 size={19} /><strong>商户品牌</strong></div></div><div className={styles.formGrid}><label><span>商户名称</span><input required name="name" defaultValue={data.tenant.name} /></label><label><span>默认通知邮箱</span><input required type="email" name="contactEmail" defaultValue={data.tenant.contactEmail} /></label><label><span>主色</span><span className={styles.colorField}><input type="color" name="primaryColor" defaultValue={data.tenant.primaryColor} /><code>{data.tenant.primaryColor}</code></span></label><label><span>强调色</span><span className={styles.colorField}><input type="color" name="accentColor" defaultValue={data.tenant.accentColor} /><code>{data.tenant.accentColor}</code></span></label><label><span>页面模板</span><select name="template" defaultValue={data.tenant.template}><option value="gallery">简洁展厅</option><option value="wonderland">童话活动</option><option value="restaurant">餐饮门店</option></select></label><label><span>公开地址</span><input readOnly value={`/book/${data.tenant.slug}`} /></label></div><div className={styles.formFooter}><button type="submit" disabled={saving}><Save size={16} />保存品牌设置</button></div></form></>;
}

function Empty({ text }: { text: string }) { return <div className={styles.empty}><CalendarDays size={24} /><p>{text}</p></div>; }
