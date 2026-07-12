"use client";

import { useMemo, useRef, useState } from "react";
import { DayPicker } from "react-day-picker";
import { zhCN } from "date-fns/locale";
import { addDays, format, getDay, startOfDay } from "date-fns";
import { motion } from "motion/react";
import { toPng } from "html-to-image";
import {
  ArrowLeft,
  CalendarDays,
  CalendarPlus,
  Check,
  Clapperboard,
  Download,
  GalleryVerticalEnd,
  KeyRound,
  LoaderCircle,
  PartyPopper,
  Send,
  Share2,
  Sparkles,
  UtensilsCrossed,
  WandSparkles,
  Wine,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

type ActivityId =
  | "movie"
  | "meal"
  | "exhibition"
  | "drinks"
  | "surprise"
  | "other";

type Activity = {
  id: ActivityId;
  title: string;
  description: string;
  icon: LucideIcon;
};

const FRIDAY_SLOTS = ["21:00", "21:30", "22:00", "22:30", "23:00"];
const WEEKEND_SLOTS = ["10:30", "13:00", "15:30", "18:00", "20:30"];

const activities: Activity[] = [
  {
    id: "movie",
    title: "看电影",
    description: "挑一部不会睡着的电影",
    icon: Clapperboard,
  },
  {
    id: "meal",
    title: "一起吃饭",
    description: "把好吃的都分你一口",
    icon: UtensilsCrossed,
  },
  {
    id: "exhibition",
    title: "看展",
    description: "认真或假装认真地看艺术",
    icon: GalleryVerticalEnd,
  },
  {
    id: "drinks",
    title: "小酌一杯",
    description: "慢慢聊到晚风都困了",
    icon: Wine,
  },
  {
    id: "surprise",
    title: "交给 QQ",
    description: "保留一点未知的惊喜",
    icon: WandSparkles,
  },
  {
    id: "other",
    title: "其他计划",
    description: "写下你脑海里的秘密路线",
    icon: Sparkles,
  },
];

function getNextAvailableDate() {
  let candidate = startOfDay(addDays(new Date(), 1));

  while (![0, 5, 6].includes(getDay(candidate))) {
    candidate = addDays(candidate, 1);
  }

  return candidate;
}

function getTimeSlots(date?: Date) {
  if (!date) return [];
  return getDay(date) === 5 ? FRIDAY_SLOTS : WEEKEND_SLOTS;
}

function getActivityLabel(activityId: ActivityId | null, otherPlan: string) {
  if (activityId === "other" && otherPlan.trim()) return otherPlan.trim();
  return activities.find((activity) => activity.id === activityId)?.title ?? "";
}

function toCalendarTimestamp(date: Date) {
  return date.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
}

export default function Home() {
  const [step, setStep] = useState(0);
  const [declined, setDeclined] = useState(false);
  const [noAttempts, setNoAttempts] = useState(0);
  const [noOffset, setNoOffset] = useState({ x: 0, y: 0 });
  const [selectedDate, setSelectedDate] = useState<Date>();
  const [selectedTime, setSelectedTime] = useState("");
  const [activityId, setActivityId] = useState<ActivityId | null>(null);
  const [otherPlan, setOtherPlan] = useState("");
  const [note, setNote] = useState("");
  const [bookingId, setBookingId] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState("");
  const [shareLabel, setShareLabel] = useState("分享");
  const invitationRef = useRef<HTMLDivElement>(null);
  const firstAvailableDate = useMemo(() => getNextAvailableDate(), []);
  const lastAvailableDate = useMemo(() => addDays(firstAvailableDate, 70), [firstAvailableDate]);

  const slots = getTimeSlots(selectedDate);
  const activityLabel = getActivityLabel(activityId, otherPlan);
  const dateLabel = selectedDate
    ? format(selectedDate, "M 月 d 日 EEEE", { locale: zhCN })
    : "";

  function dodgeNo(event: React.PointerEvent<HTMLButtonElement>) {
    if (noAttempts >= 3) return;

    event.preventDefault();
    const horizontalRoom = Math.min(window.innerWidth * 0.42, 150);
    const direction = noAttempts % 2 === 0 ? 1 : -1;
    setNoOffset({
      x: direction * (70 + Math.random() * horizontalRoom),
      y: -22 + Math.random() * 52,
    });
    setNoAttempts((attempts) => attempts + 1);
  }

  function acceptInvitation() {
    setDeclined(false);
    setStep(1);
  }

  function declineInvitation() {
    if (noAttempts < 3) return;
    setDeclined(true);
  }

  function goBack() {
    setSubmitError("");
    setStep((current) => Math.max(0, current - 1));
  }

  async function submitBooking() {
    if (!selectedDate || !selectedTime || !activityId || !activityLabel) return;

    const nextBookingId =
      bookingId ||
      `QQ-${format(selectedDate, "yyyyMMdd")}-${Math.floor(1000 + Math.random() * 9000)}`;

    setBookingId(nextBookingId);
    setIsSubmitting(true);
    setSubmitError("");

    try {
      const response = await fetch("/api/bookings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          bookingId: nextBookingId,
          date: format(selectedDate, "yyyy-MM-dd"),
          time: selectedTime,
          activity: activityId,
          activityLabel,
          note: note.trim(),
          website: "",
        }),
      });

      if (!response.ok) throw new Error("Booking request failed");
      setStep(4);
    } catch {
      setSubmitError("信鸽暂时迷路了，请再试一次。你的选择都还在。");
    } finally {
      setIsSubmitting(false);
    }
  }

  async function downloadInvitation() {
    if (!invitationRef.current) return;
    const dataUrl = await toPng(invitationRef.current, {
      cacheBust: true,
      pixelRatio: 2,
      backgroundColor: "#fffaf0",
    });
    const link = document.createElement("a");
    link.download = `${bookingId || "QQ-date"}.png`;
    link.href = dataUrl;
    link.click();
  }

  function addToCalendar() {
    if (!selectedDate || !selectedTime) return;

    const [hours, minutes] = selectedTime.split(":").map(Number);
    const start = new Date(selectedDate);
    start.setHours(hours, minutes, 0, 0);
    const end = new Date(start.getTime() + 2 * 60 * 60 * 1000);
    const calendar = [
      "BEGIN:VCALENDAR",
      "VERSION:2.0",
      "PRODID:-//QQ Weekend Adventure//CN",
      "BEGIN:VEVENT",
      `UID:${bookingId}@qq-weekend-date`,
      `DTSTAMP:${toCalendarTimestamp(new Date())}`,
      `DTSTART:${toCalendarTimestamp(start)}`,
      `DTEND:${toCalendarTimestamp(end)}`,
      "SUMMARY:和 QQ 的周末小冒险",
      `DESCRIPTION:${activityLabel}${note ? ` - ${note.replace(/\n/g, " ")}` : ""}`,
      "END:VEVENT",
      "END:VCALENDAR",
    ].join("\r\n");

    const url = URL.createObjectURL(new Blob([calendar], { type: "text/calendar;charset=utf-8" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = `${bookingId || "QQ-date"}.ics`;
    link.click();
    URL.revokeObjectURL(url);
  }

  async function shareInvitation() {
    const text = `和 QQ 的约会已经约好啦：${dateLabel} ${selectedTime}，${activityLabel}。`;

    if (navigator.share) {
      await navigator.share({ title: "和 QQ 的周末小冒险", text, url: window.location.href });
      return;
    }

    await navigator.clipboard.writeText(`${text} ${window.location.href}`);
    setShareLabel("已复制");
  }

  return (
    <main className="wonderland-shell">
      <div className="storybook-stage">
        <header className="site-header">
          <div className="brand-lockup">
            <span className="brand-icon" aria-hidden="true">
              <KeyRound size={18} strokeWidth={1.8} />
            </span>
            <span>和 QQ 的周末小冒险</span>
          </div>
          {step > 0 && step < 4 ? (
            <div className="progress" aria-label={`第 ${step} 步，共 3 步`}>
              {[1, 2, 3].map((item) => (
                <span key={item} className={item <= step ? "progress-dot active" : "progress-dot"} />
              ))}
            </div>
          ) : null}
        </header>

        <section className={`paper-sheet ${step === 0 ? "invitation-opening" : ""}`}>
          {step === 0 && !declined ? (
            <div className="opening-content">
              <span className="ornament" aria-hidden="true">
                <Sparkles size={26} />
              </span>
              <p className="eyebrow">一封只在周末生效的邀请</p>
              <h1 className="opening-question">你愿意周末和QQ一起出去玩耍吗？</h1>
              <p className="opening-copy">穿过小门以后，有一段时间正等着被我们共同填满。</p>

              <div className="choice-arena">
                <button className="primary-button yes-button" type="button" onClick={acceptInvitation}>
                  <Check size={18} />
                  愿意呀
                </button>
                <motion.button
                  className="secondary-button no-button"
                  type="button"
                  animate={noOffset}
                  transition={{ type: "spring", stiffness: 420, damping: 24 }}
                  onPointerEnter={dodgeNo}
                  onPointerDown={dodgeNo}
                  onClick={declineInvitation}
                >
                  {noAttempts === 0
                    ? "让我想想"
                    : noAttempts === 1
                      ? "真的嘛？"
                      : noAttempts === 2
                        ? "再想一下"
                        : "这次先不了"}
                </motion.button>
              </div>
              <p className="tiny-note">来自 QQ 的认真邀请，有效期是每一个空闲周末。</p>
            </div>
          ) : null}

          {step === 0 && declined ? (
            <div className="opening-content gentle-exit">
              <span className="ornament" aria-hidden="true">
                <Sparkles size={26} />
              </span>
              <p className="eyebrow">邀请会好好留在这里</p>
              <h1>没关系，等你想见 QQ 的时候再来。</h1>
              <p className="opening-copy">小门不会消失，周末也还会有很多个。</p>
              <button
                className="primary-button"
                type="button"
                onClick={() => {
                  setDeclined(false);
                  setNoAttempts(0);
                  setNoOffset({ x: 0, y: 0 });
                }}
              >
                <KeyRound size={18} />
                再看看邀请
              </button>
            </div>
          ) : null}

          {step === 1 ? (
            <div className="step-content">
              <div className="step-heading">
                <button className="icon-button" type="button" onClick={goBack} title="返回邀请页">
                  <ArrowLeft size={20} />
                </button>
                <div>
                  <p className="eyebrow">第一章 · 月光日历</p>
                  <h2>挑一个我们都有空的日子</h2>
                </div>
              </div>

              <div className="calendar-wrap">
                <DayPicker
                  mode="single"
                  locale={zhCN}
                  weekStartsOn={1}
                  defaultMonth={firstAvailableDate}
                  selected={selectedDate}
                  onSelect={(date) => {
                    setSelectedDate(date);
                    setSelectedTime("");
                  }}
                  disabled={[
                    { before: firstAvailableDate },
                    { after: lastAvailableDate },
                    { dayOfWeek: [1, 2, 3, 4] },
                  ]}
                  startMonth={firstAvailableDate}
                  endMonth={lastAvailableDate}
                />
                <div className="calendar-legend">
                  <span><i className="legend-open" />可以约会</span>
                  <span><i className="legend-work" />QQ 在上班</span>
                </div>
              </div>

              <div className="time-section" aria-live="polite">
                <div className="time-heading">
                  <CalendarDays size={18} />
                  <span>{selectedDate ? dateLabel : "先在日历里选一天"}</span>
                </div>
                {selectedDate ? (
                  <div className="time-grid">
                    {slots.map((slot) => (
                      <button
                        key={slot}
                        className={selectedTime === slot ? "time-option selected" : "time-option"}
                        type="button"
                        aria-pressed={selectedTime === slot}
                        onClick={() => setSelectedTime(slot)}
                      >
                        {slot}
                      </button>
                    ))}
                  </div>
                ) : null}
              </div>

              <button
                className="primary-button wide-button"
                type="button"
                disabled={!selectedDate || !selectedTime}
                onClick={() => setStep(2)}
              >
                选好了，继续
                <Sparkles size={18} />
              </button>
            </div>
          ) : null}

          {step === 2 ? (
            <div className="step-content">
              <div className="step-heading">
                <button className="icon-button" type="button" onClick={goBack} title="返回日期选择">
                  <ArrowLeft size={20} />
                </button>
                <div>
                  <p className="eyebrow">第二章 · 今日冒险</p>
                  <h2>这次想和 QQ 做什么？</h2>
                </div>
              </div>

              <div className="activity-grid">
                {activities.map((activity) => {
                  const Icon = activity.icon;
                  const isSelected = activityId === activity.id;
                  return (
                    <button
                      key={activity.id}
                      className={isSelected ? "activity-option selected" : "activity-option"}
                      type="button"
                      aria-pressed={isSelected}
                      onClick={() => setActivityId(activity.id)}
                    >
                      <span className="activity-icon"><Icon size={22} /></span>
                      <span>
                        <strong>{activity.title}</strong>
                        <small>{activity.description}</small>
                      </span>
                      {isSelected ? <Check className="activity-check" size={18} /> : null}
                    </button>
                  );
                })}
              </div>

              {activityId === "other" ? (
                <label className="field-label">
                  <span>你的秘密计划</span>
                  <textarea
                    value={otherPlan}
                    maxLength={80}
                    placeholder="比如去公园散步、逛书店……"
                    onChange={(event) => setOtherPlan(event.target.value)}
                  />
                </label>
              ) : null}

              <label className="field-label">
                <span>想偷偷告诉 QQ 的话 <small>可不填</small></span>
                <textarea
                  value={note}
                  maxLength={240}
                  placeholder="天气、口味、想去的地方，或一句悄悄话"
                  onChange={(event) => setNote(event.target.value)}
                />
              </label>

              <button
                className="primary-button wide-button"
                type="button"
                disabled={!activityId || (activityId === "other" && !otherPlan.trim())}
                onClick={() => setStep(3)}
              >
                看看预约单
                <Sparkles size={18} />
              </button>
            </div>
          ) : null}

          {step === 3 ? (
            <div className="step-content review-step">
              <div className="step-heading">
                <button className="icon-button" type="button" onClick={goBack} title="返回活动选择">
                  <ArrowLeft size={20} />
                </button>
                <div>
                  <p className="eyebrow">第三章 · 盖章之前</p>
                  <h2>最后核对一次约会安排</h2>
                </div>
              </div>

              <div className="booking-summary">
                <div>
                  <span>日期</span>
                  <strong>{dateLabel}</strong>
                </div>
                <div>
                  <span>时间</span>
                  <strong>{selectedTime}</strong>
                </div>
                <div>
                  <span>这次的冒险</span>
                  <strong>{activityLabel}</strong>
                </div>
                {note ? (
                  <div>
                    <span>悄悄话</span>
                    <strong>{note}</strong>
                  </div>
                ) : null}
              </div>

              {submitError ? <p className="error-message">{submitError}</p> : null}

              <button
                className="primary-button wide-button seal-button"
                type="button"
                disabled={isSubmitting}
                onClick={submitBooking}
              >
                {isSubmitting ? <LoaderCircle className="spin" size={18} /> : <Send size={18} />}
                {isSubmitting ? "正在派出信鸽" : "确认预约并告诉 QQ"}
              </button>
            </div>
          ) : null}

          {step === 4 ? (
            <div className="success-content">
              <div className="success-heading">
                <PartyPopper size={28} />
                <div>
                  <p className="eyebrow">预约已经送达</p>
                  <h2>周末小冒险，正式成立。</h2>
                </div>
              </div>

              <div className="invitation-card" ref={invitationRef}>
                <div className="invite-card-topline">
                  <KeyRound size={18} />
                  <span>QQ WEEKEND ADVENTURE</span>
                </div>
                <p className="invite-kicker">A VERY IMPORTANT DATE</p>
                <h3>约会邀请函</h3>
                <p className="invite-message">很高兴即将和你一起出去玩，请带上一点期待准时出现。</p>
                <div className="invite-details">
                  <div>
                    <span>日期</span>
                    <strong>{dateLabel}</strong>
                  </div>
                  <div>
                    <span>时间</span>
                    <strong>{selectedTime}</strong>
                  </div>
                  <div>
                    <span>计划</span>
                    <strong>{activityLabel}</strong>
                  </div>
                </div>
                {note ? <p className="invite-note">“{note}”</p> : null}
                <div className="invite-footer">
                  <span>{bookingId}</span>
                  <span>CONFIRMED</span>
                </div>
              </div>

              <div className="invitation-actions">
                <button type="button" onClick={downloadInvitation}>
                  <Download size={19} />
                  保存邀请函
                </button>
                <button type="button" onClick={addToCalendar}>
                  <CalendarPlus size={19} />
                  加入日历
                </button>
                <button type="button" onClick={shareInvitation}>
                  <Share2 size={19} />
                  {shareLabel}
                </button>
              </div>

              <p className="delivery-note">QQ 也会收到一份相同的预约消息。</p>
            </div>
          ) : null}
        </section>
      </div>
    </main>
  );
}
