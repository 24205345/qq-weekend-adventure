"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowLeft,
  CalendarDays,
  CalendarPlus,
  Check,
  ChevronRight,
  Clock3,
  LoaderCircle,
  Mail,
  MapPin,
  Share2,
  TicketCheck,
  UserRound,
  UsersRound,
} from "lucide-react";
import styles from "./booking.module.css";

type Tenant = {
  id: string;
  slug: string;
  name: string;
  contactEmail: string;
  timezone: string;
  primaryColor: string;
  accentColor: string;
  template: string;
  stores: Array<{ id: string; name: string; address: string; phone: string; arrivalGuide: string }>;
  services: Array<{
    id: string;
    storeId: string;
    slug: string;
    name: string;
    description: string;
    durationMinutes: number;
    maxPartySize: number;
    advanceDays: number;
    cutoffHours: number;
    confirmationMode: string;
    notificationEmail: string;
    customFields: string;
  }>;
};

type Slot = { time: string; remainingBookings: number; remainingGuests: number; available: boolean };
type Booking = { id: string; code: string; manageToken: string; status: string; date: string; startTime: string; endTime: string };

function dateOffset(days: number) {
  const date = new Date();
  date.setHours(12, 0, 0, 0);
  date.setDate(date.getDate() + days);
  return date.toISOString().slice(0, 10);
}

function dateLabel(value: string) {
  if (!value) return "";
  return new Intl.DateTimeFormat("zh-CN", { month: "long", day: "numeric", weekday: "long" }).format(
    new Date(`${value}T12:00:00`),
  );
}

export function PublicBookingApp({ slug }: { slug: string }) {
  const [tenant, setTenant] = useState<Tenant | null>(null);
  const [serviceId, setServiceId] = useState("");
  const [storeId, setStoreId] = useState("");
  const [date, setDate] = useState("");
  const [time, setTime] = useState("");
  const [partySize, setPartySize] = useState(1);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [note, setNote] = useState("");
  const [customValues, setCustomValues] = useState<Record<string, string>>({});
  const [slots, setSlots] = useState<Slot[]>([]);
  const [loading, setLoading] = useState(true);
  const [slotsLoading, setSlotsLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [booking, setBooking] = useState<Booking | null>(null);
  const requestId = useRef("");

  const service = tenant?.services.find((item) => item.id === serviceId);
  const store = tenant?.stores.find((item) => item.id === storeId);
  const customFields = useMemo(() => {
    try {
      const value = JSON.parse(service?.customFields ?? "[]") as unknown;
      return Array.isArray(value)
        ? value.filter((item): item is { key: string; label: string; type?: string; required?: boolean } =>
            Boolean(item && typeof item === "object" && "key" in item && "label" in item),
          )
        : [];
    } catch {
      return [];
    }
  }, [service]);

  const loadTenant = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const response = await fetch(`/api/public/tenants/${encodeURIComponent(slug)}`, { cache: "no-store" });
      const body = (await response.json()) as { tenant?: Tenant; error?: string };
      if (!response.ok || !body.tenant) throw new Error(body.error || "预约页面不存在。");
      setTenant(body.tenant);
      const firstService = body.tenant.services[0];
      if (firstService) {
        setServiceId(firstService.id);
        setStoreId(firstService.storeId);
      }
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "预约页面暂时不可用。");
    } finally {
      setLoading(false);
    }
  }, [slug]);

  useEffect(() => {
    let active = true;
    fetch(`/api/public/tenants/${encodeURIComponent(slug)}`, { cache: "no-store" })
      .then(async (response) => {
        const body = (await response.json()) as { tenant?: Tenant; error?: string };
        if (!response.ok || !body.tenant) throw new Error(body.error || "预约页面不存在。");
        if (!active) return;
        setTenant(body.tenant);
        const firstService = body.tenant.services[0];
        if (firstService) {
          setServiceId(firstService.id);
          setStoreId(firstService.storeId);
        }
      })
      .catch((loadError: unknown) => {
        if (active) setError(loadError instanceof Error ? loadError.message : "预约页面暂时不可用。");
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => { active = false; };
  }, [slug]);

  useEffect(() => {
    if (!tenant || !serviceId || !storeId || !date) {
      return;
    }
    let cancelled = false;
    async function loadSlots() {
      setSlotsLoading(true);
      setError("");
      try {
        const query = new URLSearchParams({ serviceId, storeId, date });
        const response = await fetch(`/api/public/tenants/${encodeURIComponent(slug)}/slots?${query}`, { cache: "no-store" });
        const body = (await response.json()) as { slots?: Slot[]; error?: string };
        if (!response.ok) throw new Error(body.error || "时段加载失败。");
        if (!cancelled) setSlots(body.slots ?? []);
      } catch (slotError) {
        if (!cancelled) setError(slotError instanceof Error ? slotError.message : "时段加载失败。");
      } finally {
        if (!cancelled) setSlotsLoading(false);
      }
    }
    void loadSlots();
    return () => { cancelled = true; };
  }, [tenant, serviceId, storeId, date, slug]);

  async function submit() {
    if (!service || !store || !date || !time || !name.trim()) return;
    if (!email.trim() && !phone.trim()) {
      setError("请至少填写邮箱或手机号，方便商户联系你。");
      return;
    }
    const missingCustomField = customFields.find((item) => item.required && !customValues[item.key]?.trim());
    if (missingCustomField) {
      setError(`请填写“${missingCustomField.label}”。`);
      return;
    }
    if (!requestId.current) requestId.current = crypto.randomUUID();
    setSubmitting(true);
    setError("");
    try {
      const response = await fetch(`/api/public/tenants/${encodeURIComponent(slug)}/bookings`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          serviceId: service.id,
          storeId: store.id,
          date,
          startTime: time,
          customerName: name,
          customerEmail: email,
          customerPhone: phone,
          partySize,
          customerNote: note,
          customData: customValues,
          idempotencyKey: requestId.current,
          source: "public_booking_page",
        }),
      });
      const body = (await response.json()) as { booking?: Booking; error?: string };
      if (!response.ok || !body.booking) throw new Error(body.error || "预约提交失败，请稍后重试。");
      setBooking(body.booking);
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "预约提交失败，请稍后重试。");
    } finally {
      setSubmitting(false);
    }
  }

  function addCalendar() {
    if (!booking || !service || !store || !tenant) return;
    const start = new Date(`${booking.date}T${booking.startTime}:00+08:00`);
    const end = new Date(`${booking.date}T${booking.endTime}:00+08:00`);
    const stamp = (value: Date) => value.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
    const content = ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//Booking Studio//CN", "BEGIN:VEVENT", `UID:${booking.code}@booking-studio`, `DTSTAMP:${stamp(new Date())}`, `DTSTART:${stamp(start)}`, `DTEND:${stamp(end)}`, `SUMMARY:${tenant.name}｜${service.name}`, `LOCATION:${store.address.replace(/\n/g, " ")}`, `DESCRIPTION:预约编号 ${booking.code}`, "END:VEVENT", "END:VCALENDAR"].join("\r\n");
    const url = URL.createObjectURL(new Blob([content], { type: "text/calendar;charset=utf-8" }));
    const link = document.createElement("a"); link.href = url; link.download = `${booking.code}.ics`; link.click(); URL.revokeObjectURL(url);
  }

  async function share() {
    if (!booking || !service || !tenant) return;
    const text = `${tenant.name}预约成功：${dateLabel(booking.date)} ${booking.startTime}，${service.name}，编号 ${booking.code}`;
    if (navigator.share) await navigator.share({ title: `${tenant.name}预约确认`, text, url: window.location.href });
    else await navigator.clipboard.writeText(`${text} ${window.location.href}`);
  }

  if (loading) return <main className={styles.statePage}><LoaderCircle className={styles.spin} size={30} /><p>正在打开预约页</p></main>;
  if (!tenant || error && !tenant) return <main className={styles.statePage}><CalendarDays size={34} /><h1>预约页暂时不可用</h1><p>{error}</p><button type="button" onClick={() => void loadTenant()}>重新加载</button></main>;

  const themeStyle = { "--brand": tenant.primaryColor, "--accent": tenant.accentColor } as React.CSSProperties;

  if (booking && service && store) {
    return <main className={`${styles.page} ${styles[`template-${tenant.template}`] ?? ""}`} style={themeStyle}>
      <section className={styles.confirmation}>
        <div className={styles.confirmMark}><TicketCheck size={34} /></div>
        <p className={styles.kicker}>BOOKING CONFIRMED</p>
        <h1>{booking.status === "pending_confirmation" ? "预约已提交，等待商户确认" : "预约成功，期待与你见面"}</h1>
        <p className={styles.confirmCopy}>请保留这份预约信息，到店时出示预约编号即可。</p>
        <div className={styles.ticket}>
          <div><span>预约主题</span><strong>{service.name}</strong></div><div><span>日期</span><strong>{dateLabel(booking.date)}</strong></div><div><span>时间</span><strong>{booking.startTime} - {booking.endTime}</strong></div><div><span>门店</span><strong>{store.name}</strong></div><div><span>预约人</span><strong>{name} · {partySize} 人</strong></div><div><span>预约编号</span><strong>{booking.code}</strong></div>
        </div>
        <div className={styles.confirmActions}><button type="button" onClick={addCalendar}><CalendarPlus size={18} />加入日历</button><button type="button" onClick={() => void share()}><Share2 size={18} />分享预约</button></div>
        <p className={styles.privacyNote}><Mail size={14} />预约信息已经通知商户</p>
      </section>
    </main>;
  }

  return <main className={`${styles.page} ${styles[`template-${tenant.template}`] ?? ""}`} style={themeStyle}>
    <header className={styles.hero}>
      <div className={styles.heroInner}><p className={styles.kicker}>ONLINE RESERVATION</p><h1>{tenant.name}</h1><p>选择适合你的主题和时间，我们会为你保留位置。</p></div>
    </header>
    <div className={styles.bookingLayout}>
      <section className={styles.bookingPanel}>
        <div className={styles.stepHeading}><span>1</span><div><h2>选择预约主题</h2><p>先告诉我们你想体验什么</p></div></div>
        <div className={styles.serviceList}>{tenant.services.map((item) => <button key={item.id} type="button" className={serviceId === item.id ? styles.selectedService : ""} onClick={() => { setServiceId(item.id); setStoreId(item.storeId); setDate(""); setTime(""); setSlots([]); }}><span><strong>{item.name}</strong><small>{item.description}</small></span><ChevronRight size={18} /></button>)}</div>

        {service ? <><div className={styles.stepHeading}><span>2</span><div><h2>选择日期和时间</h2><p>可预约日期会根据商户开放规则显示</p></div></div>
          <div className={styles.dateFields}><label><span>门店</span><select value={storeId} onChange={(event) => { setStoreId(event.target.value); setTime(""); setSlots([]); }}>{tenant.stores.filter((item) => item.id === service.storeId).map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label><label><span>日期</span><input type="date" min={dateOffset(1)} max={dateOffset(service.advanceDays)} value={date} onChange={(event) => { setDate(event.target.value); setTime(""); setSlots([]); }} /></label></div>
          {date ? <div className={styles.slotSection}><div className={styles.slotTitle}><Clock3 size={17} /><span>{dateLabel(date)}</span></div>{slotsLoading ? <p className={styles.inlineLoading}><LoaderCircle className={styles.spin} size={18} />正在查看剩余位置</p> : slots.length ? <div className={styles.slotGrid}>{slots.map((slot) => <button key={slot.time} type="button" disabled={!slot.available} className={time === slot.time ? styles.selectedSlot : ""} onClick={() => setTime(slot.time)}><strong>{slot.time}</strong><small>{slot.available ? `剩余 ${Math.min(slot.remainingGuests, slot.remainingBookings)} 个名额` : "已约满"}</small></button>)}</div> : <p className={styles.noSlots}>当天没有开放时段，请选择其他日期。</p>}</div> : null}

          <div className={styles.stepHeading}><span>3</span><div><h2>填写预约信息</h2><p>用于确认预约和必要时联系你</p></div></div>
          <div className={styles.formGrid}><label><span><UserRound size={15} />姓名或昵称</span><input value={name} maxLength={80} onChange={(event) => setName(event.target.value)} placeholder="怎么称呼你" /></label><label><span><UsersRound size={15} />预约人数</span><select value={partySize} onChange={(event) => setPartySize(Number(event.target.value))}>{Array.from({ length: service.maxPartySize }, (_, index) => index + 1).map((value) => <option key={value} value={value}>{value} 人</option>)}</select></label><label><span><Mail size={15} />邮箱</span><input type="email" value={email} maxLength={160} onChange={(event) => setEmail(event.target.value)} placeholder="接收预约信息" /></label><label><span>联系电话</span><input type="tel" value={phone} maxLength={40} onChange={(event) => setPhone(event.target.value)} placeholder="邮箱或手机号至少填一个" /></label>{customFields.map((item) => <label key={item.key} className={styles.span2}><span>{item.label}{item.required ? " *" : ""}</span><input value={customValues[item.key] ?? ""} onChange={(event) => setCustomValues((current) => ({ ...current, [item.key]: event.target.value }))} /></label>)}<label className={styles.span2}><span>备注 <small>可不填</small></span><textarea value={note} maxLength={500} onChange={(event) => setNote(event.target.value)} placeholder="到店需求、偏好或其他说明" /></label></div>
          {store ? <div className={styles.storeNote}><MapPin size={17} /><div><strong>{store.name}</strong><p>{store.address || store.arrivalGuide || "具体地点请留意商户通知。"}</p></div></div> : null}
          {error ? <p className={styles.error}><ArrowLeft size={15} />{error}</p> : null}
          <button className={styles.submitButton} type="button" disabled={submitting || !date || !time || !name.trim()} onClick={() => void submit()}>{submitting ? <LoaderCircle className={styles.spin} size={19} /> : <Check size={19} />}{submitting ? "正在为你保留位置" : "确认预约"}</button>
          <p className={styles.privacyNote}>提交即表示你同意商户仅将这些信息用于本次预约与到店服务。</p>
        </> : null}
      </section>
    </div>
  </main>;
}
