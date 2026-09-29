"use client";

import { useEffect, useRef, useState } from "react";
import { supabase } from "@/lib/supabaseClient";

const ACTIVE = ["received", "cooking"];
const POLL_MS = 30000; // ดึงข้อมูลซ้ำเป็นตัวสำรอง เผื่อ Realtime หลุด

const C = {
  bg: "#101319",
  ink: "#1c1a12",
  newBg: "#ffffff",
  newBorder: "#3b82f6",
  cookBg: "#f5b301",
  cookBorder: "#b45309",
  red: "#ef4444",
  green: "#22c55e",
};

function sortByCreated(list) {
  return [...list].sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
}

// ใส่/อัปเดตออเดอร์ใน list ถ้ายัง active อยู่ ไม่งั้นเอาออก
function applyRow(list, row) {
  const without = list.filter((o) => o.id !== row.id);
  return ACTIVE.includes(row.status) ? sortByCreated([...without, row]) : without;
}

const actionBtn = (bg) => ({
  minHeight: 68,
  fontSize: 28,
  fontWeight: 800,
  border: "none",
  borderRadius: 16,
  background: bg,
  color: "#fff",
  cursor: "pointer",
});

export default function KitchenPage() {
  const [orders, setOrders] = useState([]);
  const [loaded, setLoaded] = useState(false);
  const [loadError, setLoadError] = useState("");
  const [actionError, setActionError] = useState("");
  const [conn, setConn] = useState("CONNECTING");
  const [busy, setBusy] = useState({});
  const [now, setNow] = useState(() => Date.now());
  const loadRef = useRef(null);

  // โหลดครั้งแรก + Realtime (INSERT/UPDATE) + ดึงซ้ำเป็นระยะ
  useEffect(() => {
    let cancelled = false;

    async function load() {
      const { data, error } = await supabase
        .from("orders")
        .select("id, session_id, table_number, items, status, created_at")
        .in("status", ACTIVE)
        .order("created_at", { ascending: true });
      if (cancelled) return;
      if (error) {
        setLoadError(error.message || "เกิดข้อผิดพลาด");
        return;
      }
      setLoadError("");
      setOrders(data || []);
      setLoaded(true);
    }
    loadRef.current = load;
    load();

    const channel = supabase
      .channel("kitchen-orders")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "orders" }, (payload) => {
        setOrders((list) => applyRow(list, payload.new));
      })
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "orders" }, (payload) => {
        setOrders((list) => applyRow(list, payload.new));
      })
      .subscribe((status) => {
        if (cancelled) return;
        setConn(status);
        if (status === "SUBSCRIBED") load(); // เชื่อมต่อใหม่แล้วดึงข้อมูลล่าสุดอีกรอบ
      });

    const poll = setInterval(load, POLL_MS);

    return () => {
      cancelled = true;
      clearInterval(poll);
      supabase.removeChannel(channel);
    };
  }, []);

  // อัปเดตเวลา "รอมา N นาที"
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 30000);
    return () => clearInterval(t);
  }, []);

  // กันจอดับ (ถ้าเบราว์เซอร์รองรับ)
  useEffect(() => {
    let lock = null;
    async function request() {
      try {
        if ("wakeLock" in navigator) lock = await navigator.wakeLock.request("screen");
      } catch {
        // ไม่รองรับหรือถูกปฏิเสธ ข้ามไป
      }
    }
    const onVisible = () => {
      if (document.visibilityState === "visible") request();
    };
    request();
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      document.removeEventListener("visibilitychange", onVisible);
      if (lock) lock.release().catch(() => {});
    };
  }, []);

  async function changeStatus(order, nextStatus) {
    if (busy[order.id]) return;
    setBusy((b) => ({ ...b, [order.id]: true }));
    setActionError("");
    try {
      let query = supabase.from("orders").update({ status: nextStatus }).eq("id", order.id);
      // เริ่มทำได้เฉพาะออเดอร์ที่ยังเป็น received, เสิร์ฟได้จาก received/cooking
      query = nextStatus === "cooking" ? query.eq("status", "received") : query.in("status", ACTIVE);
      const { data, error } = await query.select("id");
      if (error) throw error;

      if (!data || data.length === 0) {
        // สถานะถูกเปลี่ยนไปแล้วจากที่อื่น ดึงข้อมูลล่าสุดมาแสดงแทน
        if (loadRef.current) loadRef.current();
        return;
      }
      setOrders((list) =>
        nextStatus === "served"
          ? list.filter((o) => o.id !== order.id)
          : list.map((o) => (o.id === order.id ? { ...o, status: nextStatus } : o))
      );
    } catch (e) {
      setActionError(`อัปเดตออเดอร์โต๊ะ ${order.table_number} ไม่สำเร็จ: ${e.message || "เกิดข้อผิดพลาด"}`);
    } finally {
      setBusy((b) => {
        const next = { ...b };
        delete next[order.id];
        return next;
      });
    }
  }

  const waiting = orders.filter((o) => o.status === "received").length;
  const cooking = orders.length - waiting;
  const online = conn === "SUBSCRIBED";

  return (
    <div style={{ minHeight: "100vh", background: C.bg, color: "#fff", padding: 20, boxSizing: "border-box" }}>
      <header
        style={{
          display: "flex",
          flexWrap: "wrap",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 12,
          marginBottom: 20,
        }}
      >
        <h1 style={{ fontSize: 40, margin: 0 }}>ครัว</h1>
        <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 24, fontSize: 28, fontWeight: 700 }}>
          <span>รอทำ {waiting}</span>
          <span style={{ color: C.cookBg }}>กำลังทำ {cooking}</span>
          <span style={{ display: "inline-flex", alignItems: "center", gap: 8, fontSize: 20, fontWeight: 500 }}>
            <span
              aria-hidden="true"
              style={{ width: 14, height: 14, borderRadius: 7, background: online ? C.green : C.red }}
            />
            {online ? "เชื่อมต่อแล้ว" : "ขาดการเชื่อมต่อ"}
          </span>
        </div>
      </header>

      {(loadError || actionError) && (
        <p
          role="alert"
          style={{ fontSize: 22, background: C.red, color: "#fff", borderRadius: 12, padding: "12px 16px", margin: "0 0 20px" }}
        >
          {actionError || `โหลดออเดอร์ไม่สำเร็จ: ${loadError} (ระบบจะลองใหม่อัตโนมัติ)`}
        </p>
      )}

      {!loaded && !loadError ? (
        <p style={{ fontSize: 32, textAlign: "center", marginTop: 80 }}>กำลังโหลด...</p>
      ) : loaded && orders.length === 0 ? (
        <p style={{ fontSize: 40, textAlign: "center", marginTop: 80, color: "#94a3b8" }}>ยังไม่มีออเดอร์ค้าง</p>
      ) : (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(340px, 1fr))",
            gap: 20,
            alignItems: "start",
          }}
        >
          {orders.map((order) => {
            const isCooking = order.status === "cooking";
            const items = Array.isArray(order.items) ? order.items : [];
            const created = new Date(order.created_at);
            const minutes = Math.max(0, Math.floor((now - created.getTime()) / 60000));
            return (
              <article
                key={order.id}
                style={{
                  background: isCooking ? C.cookBg : C.newBg,
                  color: C.ink,
                  border: `6px solid ${isCooking ? C.cookBorder : C.newBorder}`,
                  borderRadius: 20,
                  padding: 20,
                  display: "flex",
                  flexDirection: "column",
                  gap: 14,
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12 }}>
                  <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
                    <span style={{ fontSize: 26, fontWeight: 700 }}>โต๊ะ</span>
                    <span style={{ fontSize: 76, fontWeight: 900, lineHeight: 1 }}>{order.table_number}</span>
                  </div>
                  <div style={{ textAlign: "right", fontSize: 24 }}>
                    <div style={{ fontWeight: 800 }}>
                      {created.toLocaleTimeString("th-TH", { hour: "2-digit", minute: "2-digit", hour12: false })} น.
                    </div>
                    <div>รอมา {minutes} นาที</div>
                  </div>
                </div>

                <div style={{ fontSize: 24, fontWeight: 800 }}>{isCooking ? "กำลังทำ" : "ออเดอร์ใหม่"}</div>

                <ul style={{ listStyle: "none", margin: 0, padding: 0 }}>
                  {items.map((it, idx) => (
                    <li
                      key={idx}
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        gap: 12,
                        fontSize: 32,
                        fontWeight: 700,
                        padding: "8px 0",
                        borderBottom: "2px dashed rgba(0,0,0,0.25)",
                      }}
                    >
                      <span>{it.name}</span>
                      <span style={{ flexShrink: 0 }}>× {it.quantity}</span>
                    </li>
                  ))}
                </ul>

                <div style={{ display: "grid", gap: 10 }}>
                  {!isCooking && (
                    <button
                      type="button"
                      onClick={() => changeStatus(order, "cooking")}
                      disabled={!!busy[order.id]}
                      style={{ ...actionBtn("#1d4ed8"), opacity: busy[order.id] ? 0.6 : 1 }}
                    >
                      เริ่มทำ
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => changeStatus(order, "served")}
                    disabled={!!busy[order.id]}
                    style={{ ...actionBtn("#15803d"), opacity: busy[order.id] ? 0.6 : 1 }}
                  >
                    จัดเสิร์ฟแล้ว
                  </button>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}
