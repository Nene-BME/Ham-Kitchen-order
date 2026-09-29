"use client";

import { use, useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";

const ADULT_PRICE = 109;
const CHILD_PRICE = 59;
const MAX_QTY = 5; // จำนวนต่อรายการ
const MAX_LINES = 10; // จำนวนรายการต่อการส่ง 1 ครั้ง

const C = {
  paper: "#fafaf7",
  ink: "#1c2333",
  mute: "#5b6478",
  blue: "#1f4e9c",
  red: "#c62828",
  line: "#dcdfe6",
};

const bigBtn = (bg, color = "#fff", extra = {}) => ({
  fontSize: 20,
  fontWeight: 700,
  minHeight: 52,
  padding: "0 20px",
  border: "none",
  borderRadius: 14,
  background: bg,
  color,
  cursor: "pointer",
  ...extra,
});

const roundBtn = (bg, color) => ({
  width: 48,
  height: 48,
  flexShrink: 0,
  fontSize: 28,
  lineHeight: 1,
  fontWeight: 700,
  border: "none",
  borderRadius: 24,
  background: bg,
  color,
  cursor: "pointer",
});

const overlayStyle = {
  position: "fixed",
  inset: 0,
  background: "rgba(20,25,40,0.55)",
  display: "flex",
  alignItems: "flex-end",
  justifyContent: "center",
  zIndex: 20,
};

const panelStyle = {
  background: "#fff",
  width: "100%",
  maxWidth: 560,
  maxHeight: "85vh",
  overflowY: "auto",
  boxSizing: "border-box",
  borderRadius: "20px 20px 0 0",
  padding: "20px 20px calc(20px + env(safe-area-inset-bottom, 0px))",
  color: C.ink,
};

function FullMessage({ title, children }) {
  return (
    <main
      style={{
        minHeight: "100vh",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: 16,
        padding: 24,
        textAlign: "center",
        background: C.paper,
        color: C.ink,
      }}
    >
      <h1 style={{ fontSize: 32, lineHeight: 1.3, margin: 0 }}>{title}</h1>
      {children}
    </main>
  );
}

function Stepper({ name, qty, onChange }) {
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 10 }}>
      <button type="button" aria-label={`ลด ${name}`} onClick={() => onChange(-1)} style={roundBtn("#e8ebf2", C.ink)}>
        −
      </button>
      <span style={{ minWidth: 24, textAlign: "center", fontSize: 22, fontWeight: 700 }}>{qty}</span>
      <button type="button" aria-label={`เพิ่ม ${name}`} onClick={() => onChange(1)} style={roundBtn(C.blue, "#fff")}>
        +
      </button>
    </span>
  );
}

export default function OrderPage({ params }) {
  // params เป็น Promise ต้อง unwrap ด้วย use() เสมอ
  const { tableNumber } = use(params);
  const table = Number(tableNumber);

  const [phase, setPhase] = useState("loading"); // loading | not-open | error | ready | thanks
  const [loadError, setLoadError] = useState("");
  const [reloadKey, setReloadKey] = useState(0);

  const [session, setSession] = useState(null);
  const [categories, setCategories] = useState([]);
  const [menuItems, setMenuItems] = useState([]);
  const [activeCat, setActiveCat] = useState(null);

  const [cart, setCart] = useState({}); // { [itemId]: { name, quantity } }
  const [sheetOpen, setSheetOpen] = useState(false);
  const [sending, setSending] = useState(false);
  const [sheetError, setSheetError] = useState("");

  const [billOpen, setBillOpen] = useState(false);
  const [billing, setBilling] = useState(false);
  const [billError, setBillError] = useState("");

  const [toast, setToast] = useState(null); // { text, kind }

  useEffect(() => {
    let cancelled = false;
    async function load() {
      if (!Number.isInteger(table) || table <= 0) {
        setPhase("not-open");
        return;
      }
      try {
        const { data: found, error: findError } = await supabase
          .from("sessions")
          .select("id, adult_count, child_count")
          .eq("table_number", table)
          .eq("status", "open")
          .order("created_at", { ascending: false })
          .limit(1);
        if (findError) throw findError;
        if (cancelled) return;
        if (!found || found.length === 0) {
          setPhase("not-open");
          return;
        }

        const [catRes, itemRes] = await Promise.all([
          supabase.from("menu_categories").select("id, name, sort_order").order("sort_order", { ascending: true }),
          supabase.from("menu_items").select("id, category_id, name").order("id", { ascending: true }),
        ]);
        if (catRes.error) throw catRes.error;
        if (itemRes.error) throw itemRes.error;
        if (cancelled) return;

        setSession(found[0]);
        setCategories(catRes.data || []);
        setMenuItems(itemRes.data || []);
        setActiveCat(catRes.data && catRes.data.length > 0 ? catRes.data[0].id : null);
        setPhase("ready");
      } catch (e) {
        if (!cancelled) {
          setLoadError(e.message || "เกิดข้อผิดพลาด");
          setPhase("error");
        }
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [table, reloadKey]);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 3500);
    return () => clearTimeout(t);
  }, [toast]);

  const lines = Object.entries(cart).map(([id, v]) => ({ id, name: v.name, quantity: v.quantity }));

  function changeQty(item, delta) {
    const cur = cart[item.id] ? cart[item.id].quantity : 0;
    const next = Math.min(MAX_QTY, Math.max(0, cur + delta));
    if (next === cur) {
      if (delta > 0) setToast({ text: `สั่งได้สูงสุด ${MAX_QTY} ที่ต่อรายการ`, kind: "warn" });
      return;
    }
    if (cur === 0 && lines.length >= MAX_LINES) {
      setToast({ text: `ส่งได้สูงสุด ${MAX_LINES} รายการต่อครั้ง กรุณาส่งออเดอร์ก่อนสั่งเพิ่ม`, kind: "warn" });
      return;
    }
    const nextCart = { ...cart };
    if (next === 0) delete nextCart[item.id];
    else nextCart[item.id] = { name: item.name, quantity: next };
    setCart(nextCart);
    if (next === 0 && Object.keys(nextCart).length === 0) setSheetOpen(false);
  }

  async function sendOrder() {
    if (sending || lines.length === 0) return;
    setSending(true);
    setSheetError("");
    try {
      // กันสั่งเข้า session ที่พนักงานปิดไปแล้ว
      const { data: still, error: checkError } = await supabase
        .from("sessions")
        .select("id")
        .eq("id", session.id)
        .eq("status", "open")
        .limit(1);
      if (checkError) throw checkError;
      if (!still || still.length === 0) {
        setPhase("not-open");
        return;
      }

      const { error: insertError } = await supabase.from("orders").insert({
        session_id: session.id,
        table_number: table,
        items: lines.map(({ name, quantity }) => ({ name, quantity })),
        status: "received",
      });
      if (insertError) throw insertError;

      setCart({});
      setSheetOpen(false);
      setToast({ text: "ส่งออเดอร์แล้ว", kind: "ok" });
    } catch (e) {
      setSheetError(`ส่งออเดอร์ไม่สำเร็จ: ${e.message || "เกิดข้อผิดพลาด"} กรุณาลองอีกครั้ง`);
    } finally {
      setSending(false);
    }
  }

  async function confirmBill() {
    if (billing) return;
    setBilling(true);
    setBillError("");
    try {
      const { error: updateError } = await supabase
        .from("sessions")
        .update({ status: "closed" })
        .eq("id", session.id);
      if (updateError) throw updateError;
      setBillOpen(false);
      setSheetOpen(false);
      setPhase("thanks");
    } catch (e) {
      setBillError(`ปิดโต๊ะไม่สำเร็จ: ${e.message || "เกิดข้อผิดพลาด"} กรุณาลองอีกครั้ง`);
    } finally {
      setBilling(false);
    }
  }

  // ---------- หน้าเต็มจอ ----------
  if (phase === "loading") return <FullMessage title="กำลังโหลด..." />;
  if (phase === "not-open") return <FullMessage title="โต๊ะนี้ยังไม่เปิดใช้งาน กรุณาแจ้งพนักงาน" />;
  if (phase === "thanks") return <FullMessage title="ขอบคุณที่ใช้บริการ" />;
  if (phase === "error") {
    return (
      <FullMessage title="โหลดข้อมูลไม่สำเร็จ">
        <p style={{ fontSize: 18, color: C.mute, margin: 0 }}>{loadError}</p>
        <button
          type="button"
          style={bigBtn(C.blue)}
          onClick={() => {
            setPhase("loading");
            setReloadKey((k) => k + 1);
          }}
        >
          ลองอีกครั้ง
        </button>
      </FullMessage>
    );
  }

  // ---------- หน้าสั่งอาหาร ----------
  const visibleItems = menuItems.filter((i) => i.category_id === activeCat);
  const adultTotal = session.adult_count * ADULT_PRICE;
  const childTotal = session.child_count * CHILD_PRICE;
  const grandTotal = adultTotal + childTotal;
  const money = (n) => n.toLocaleString("th-TH");

  return (
    <div style={{ minHeight: "100vh", background: C.paper, color: C.ink, paddingBottom: 110 }}>
      <header style={{ position: "sticky", top: 0, zIndex: 5, background: C.paper, borderBottom: `1px solid ${C.line}` }}>
        <div
          style={{
            maxWidth: 560,
            margin: "0 auto",
            padding: "12px 16px 8px",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <h1 style={{ fontSize: 28, margin: 0 }}>โต๊ะ {table}</h1>
          <button
            type="button"
            onClick={() => {
              setBillError("");
              setBillOpen(true);
            }}
            style={bigBtn("#fff", C.red, { border: `2px solid ${C.red}`, fontSize: 18, minHeight: 48 })}
          >
            เรียกเก็บเงิน
          </button>
        </div>
        <div
          role="tablist"
          style={{
            maxWidth: 560,
            margin: "0 auto",
            padding: "4px 16px 12px",
            display: "flex",
            gap: 8,
            overflowX: "auto",
          }}
        >
          {categories.map((cat) => {
            const active = cat.id === activeCat;
            return (
              <button
                key={cat.id}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => setActiveCat(cat.id)}
                style={{
                  flexShrink: 0,
                  whiteSpace: "nowrap",
                  minHeight: 48,
                  padding: "0 18px",
                  fontSize: 18,
                  fontWeight: 700,
                  borderRadius: 24,
                  cursor: "pointer",
                  border: `2px solid ${C.blue}`,
                  background: active ? C.blue : "#fff",
                  color: active ? "#fff" : C.blue,
                }}
              >
                {cat.name}
              </button>
            );
          })}
        </div>
      </header>

      <main style={{ maxWidth: 560, margin: "0 auto", padding: "8px 16px" }}>
        {visibleItems.length === 0 ? (
          <p style={{ fontSize: 18, color: C.mute, textAlign: "center", marginTop: 40 }}>ยังไม่มีเมนูในหมวดนี้</p>
        ) : (
          <ul style={{ listStyle: "none", margin: 0, padding: 0 }}>
            {visibleItems.map((item) => {
              const qty = cart[item.id] ? cart[item.id].quantity : 0;
              return (
                <li
                  key={item.id}
                  style={{ display: "flex", alignItems: "center", minHeight: 68, borderBottom: `1px solid ${C.line}` }}
                >
                  <span style={{ fontSize: 21, fontWeight: 600 }}>{item.name}</span>
                  <span
                    aria-hidden="true"
                    style={{ flex: 1, minWidth: 16, margin: "0 10px", borderBottom: `3px dotted ${C.line}`, alignSelf: "center" }}
                  />
                  {qty === 0 ? (
                    <button
                      type="button"
                      aria-label={`เพิ่ม ${item.name}`}
                      onClick={() => changeQty(item, 1)}
                      style={roundBtn(C.blue, "#fff")}
                    >
                      +
                    </button>
                  ) : (
                    <Stepper name={item.name} qty={qty} onChange={(d) => changeQty(item, d)} />
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </main>

      {/* ตะกร้าลอยด้านล่าง */}
      {lines.length > 0 && (
        <div
          style={{
            position: "fixed",
            left: 0,
            right: 0,
            bottom: 0,
            zIndex: 10,
            background: C.blue,
            color: "#fff",
            padding: "12px 16px calc(12px + env(safe-area-inset-bottom, 0px))",
          }}
        >
          <div style={{ maxWidth: 560, margin: "0 auto", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
            <span style={{ fontSize: 20, fontWeight: 700 }}>
              ตะกร้า {lines.length}/{MAX_LINES} รายการ
            </span>
            <button
              type="button"
              onClick={() => {
                setSheetError("");
                setSheetOpen(true);
              }}
              style={bigBtn("#fff", C.blue)}
            >
              ดูตะกร้า
            </button>
          </div>
        </div>
      )}

      {toast && (
        <div
          role="status"
          style={{
            position: "fixed",
            left: "50%",
            transform: "translateX(-50%)",
            bottom: 100,
            zIndex: 40,
            maxWidth: "90%",
            padding: "14px 20px",
            borderRadius: 14,
            fontSize: 20,
            fontWeight: 700,
            textAlign: "center",
            color: "#fff",
            background: toast.kind === "ok" ? "#15803d" : C.red,
            pointerEvents: "none",
          }}
        >
          {toast.text}
        </div>
      )}

      {/* หน้าต่างตะกร้า + ส่งออเดอร์ */}
      {sheetOpen && (
        <div style={overlayStyle}>
          <div role="dialog" aria-modal="true" aria-labelledby="cart-title" style={panelStyle}>
            <h2 id="cart-title" style={{ fontSize: 26, margin: "0 0 8px" }}>ออเดอร์ของคุณ</h2>
            <ul style={{ listStyle: "none", margin: 0, padding: 0 }}>
              {lines.map((l) => (
                <li
                  key={l.id}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    gap: 12,
                    minHeight: 64,
                    borderBottom: `1px solid ${C.line}`,
                  }}
                >
                  <span style={{ fontSize: 20, fontWeight: 600 }}>{l.name}</span>
                  <Stepper
                    name={l.name}
                    qty={l.quantity}
                    onChange={(d) => changeQty({ id: l.id, name: l.name }, d)}
                  />
                </li>
              ))}
            </ul>
            {sheetError && (
              <p role="alert" style={{ fontSize: 18, color: C.red, margin: "12px 0 0" }}>{sheetError}</p>
            )}
            <div style={{ display: "grid", gap: 10, marginTop: 16 }}>
              <button
                type="button"
                onClick={sendOrder}
                disabled={sending}
                style={bigBtn(C.blue, "#fff", { opacity: sending ? 0.6 : 1 })}
              >
                {sending ? "กำลังส่ง..." : "ส่งออเดอร์"}
              </button>
              <button type="button" onClick={() => setSheetOpen(false)} disabled={sending} style={bigBtn("#e8ebf2", C.ink)}>
                สั่งเพิ่ม
              </button>
            </div>
          </div>
        </div>
      )}

      {/* หน้าต่างยืนยันเรียกเก็บเงิน */}
      {billOpen && (
        <div style={{ ...overlayStyle, zIndex: 30 }}>
          <div role="dialog" aria-modal="true" aria-labelledby="bill-title" style={panelStyle}>
            <h2 id="bill-title" style={{ fontSize: 26, margin: "0 0 12px" }}>เรียกเก็บเงิน โต๊ะ {table}</h2>
            <div style={{ fontSize: 20, display: "grid", gap: 6 }}>
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span>ผู้ใหญ่ {session.adult_count} × {ADULT_PRICE}</span>
                <span>{money(adultTotal)} บาท</span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span>เด็ก {session.child_count} × {CHILD_PRICE}</span>
                <span>{money(childTotal)} บาท</span>
              </div>
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  fontSize: 26,
                  fontWeight: 800,
                  borderTop: `2px solid ${C.ink}`,
                  paddingTop: 10,
                  marginTop: 6,
                }}
              >
                <span>ยอดที่ต้องจ่าย</span>
                <span>{money(grandTotal)} บาท</span>
              </div>
            </div>
            {lines.length > 0 && (
              <p style={{ fontSize: 18, color: C.red, margin: "12px 0 0" }}>
                ตะกร้ามี {lines.length} รายการที่ยังไม่ได้ส่ง หากเรียกเก็บเงินตอนนี้จะสั่งต่อไม่ได้
              </p>
            )}
            {billError && (
              <p role="alert" style={{ fontSize: 18, color: C.red, margin: "12px 0 0" }}>{billError}</p>
            )}
            <div style={{ display: "grid", gap: 10, marginTop: 16 }}>
              <button
                type="button"
                onClick={confirmBill}
                disabled={billing}
                style={bigBtn(C.red, "#fff", { opacity: billing ? 0.6 : 1 })}
              >
                {billing ? "กำลังดำเนินการ..." : "ยืนยันเรียกเก็บเงิน"}
              </button>
              <button type="button" onClick={() => setBillOpen(false)} disabled={billing} style={bigBtn("#e8ebf2", C.ink)}>
                ยกเลิก
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
