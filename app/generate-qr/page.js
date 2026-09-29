"use client";

import { useState } from "react";
import { supabase } from "@/lib/supabaseClient";

const inputStyle = {
  width: "100%",
  boxSizing: "border-box",
  fontSize: 26,
  padding: "14px 16px",
  border: "2px solid #c9b8a6",
  borderRadius: 12,
  background: "#fff",
  color: "#2b1d16",
};

const labelStyle = { display: "block", fontSize: 22, fontWeight: 600, marginBottom: 8 };

const btn = (bg, color = "#fff", extra = {}) => ({
  fontSize: 24,
  fontWeight: 700,
  padding: "16px 20px",
  border: "none",
  borderRadius: 12,
  background: bg,
  color,
  cursor: "pointer",
  ...extra,
});

function toCount(value) {
  if (value.trim() === "") return 0;
  const n = Number(value);
  return Number.isInteger(n) && n >= 0 ? n : NaN;
}

export default function GenerateQrPage() {
  const [tableNumber, setTableNumber] = useState("");
  const [adultCount, setAdultCount] = useState("");
  const [childCount, setChildCount] = useState("");

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const [existing, setExisting] = useState(null); // session ที่เปิดค้างอยู่
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [confirmAt, setConfirmAt] = useState(0);
  const [closing, setClosing] = useState(false);
  const [dialogError, setDialogError] = useState("");

  const [result, setResult] = useState(null); // { table, adults, children, url }
  const [copied, setCopied] = useState(false);

  async function handleOpenTable() {
    setError("");
    setNotice("");

    const table = Number(tableNumber);
    if (tableNumber.trim() === "" || !Number.isInteger(table) || table <= 0) {
      setError("กรุณากรอกเลขโต๊ะเป็นตัวเลขจำนวนเต็ม");
      return;
    }
    const adults = toCount(adultCount);
    const children = toCount(childCount);
    if (Number.isNaN(adults) || Number.isNaN(children)) {
      setError("จำนวนผู้ใหญ่และเด็กต้องเป็นตัวเลข 0 ขึ้นไป");
      return;
    }
    if (adults + children < 1) {
      setError("กรุณากรอกจำนวนลูกค้าอย่างน้อย 1 คน");
      return;
    }

    setLoading(true);
    try {
      const { data: found, error: findError } = await supabase
        .from("sessions")
        .select("id, adult_count, child_count, created_at")
        .eq("table_number", table)
        .eq("status", "open")
        .order("created_at", { ascending: false })
        .limit(1);
      if (findError) throw findError;

      if (found && found.length > 0) {
        setExisting({ ...found[0], table_number: table });
        return;
      }

      const { error: insertError } = await supabase.from("sessions").insert({
        table_number: table,
        adult_count: adults,
        child_count: children,
        status: "open",
      });
      if (insertError) throw insertError;

      setResult({
        table,
        adults,
        children,
        url: `${window.location.origin}/order/${table}`,
      });
    } catch (e) {
      setError(`เปิดโต๊ะไม่สำเร็จ: ${e.message || "เกิดข้อผิดพลาด"}`);
    } finally {
      setLoading(false);
    }
  }

  function askCloseExisting() {
    setDialogError("");
    setConfirmAt(Date.now());
    setConfirmOpen(true);
  }

  async function confirmCloseExisting() {
    if (closing || !existing) return;
    setClosing(true);
    setDialogError("");
    try {
      // เช็ค status = 'open' ซ้ำตอน update กันการกดซ้ำซ้อน
      const { data, error: updateError } = await supabase
        .from("sessions")
        .update({ status: "closed" })
        .eq("id", existing.id)
        .eq("status", "open")
        .select("id");
      if (updateError) throw updateError;

      const table = existing.table_number;
      setNotice(
        data && data.length > 0
          ? `ปิดโต๊ะ ${table} เดิมเรียบร้อยแล้ว กด "เปิดโต๊ะ" อีกครั้งเพื่อเปิดใหม่`
          : `โต๊ะ ${table} ถูกปิดไปแล้ว กด "เปิดโต๊ะ" อีกครั้งเพื่อเปิดใหม่`
      );
      setConfirmOpen(false);
      setExisting(null);
    } catch (e) {
      setDialogError(`ปิดโต๊ะไม่สำเร็จ: ${e.message || "เกิดข้อผิดพลาด"}`);
    } finally {
      setClosing(false);
    }
  }

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(result.url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      window.prompt("คัดลอกลิงก์นี้", result.url);
    }
  }

  function resetAll() {
    setTableNumber("");
    setAdultCount("");
    setChildCount("");
    setResult(null);
    setExisting(null);
    setConfirmOpen(false);
    setError("");
    setNotice("");
    setCopied(false);
  }

  const minutesOpen = existing
    ? Math.max(0, Math.floor((confirmAt - new Date(existing.created_at).getTime()) / 60000))
    : 0;

  // ---------- หน้าแสดง QR ----------
  if (result) {
    const qrSrc = `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(result.url)}`;
    return (
      <main style={{ maxWidth: 480, margin: "0 auto", padding: 24, textAlign: "center" }}>
        <h1 style={{ fontSize: 32, margin: "0 0 16px" }}>เปิดโต๊ะสำเร็จ</h1>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={qrSrc}
          alt={`QR Code โต๊ะ ${result.table}`}
          width={300}
          height={300}
          style={{ background: "#fff", padding: 12, borderRadius: 12, maxWidth: "100%", height: "auto" }}
        />
        <p style={{ fontSize: 28, fontWeight: 700, margin: "16px 0 8px" }}>
          {`โต๊ะ ${result.table} · ผู้ใหญ่ ${result.adults} · เด็ก ${result.children}`}
        </p>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 10,
            flexWrap: "wrap",
            margin: "0 0 24px",
          }}
        >
          <span style={{ fontSize: 18, wordBreak: "break-all" }}>{result.url}</span>
          <button
            type="button"
            onClick={copyLink}
            style={btn("#e7ddd2", "#2b1d16", { fontSize: 16, padding: "8px 14px" })}
          >
            {copied ? "คัดลอกแล้ว" : "คัดลอกลิงก์"}
          </button>
        </div>
        <button type="button" onClick={resetAll} style={btn("#c2410c", "#fff", { width: "100%" })}>
          เปิดโต๊ะใหม่
        </button>
      </main>
    );
  }

  // ---------- ฟอร์มเปิดโต๊ะ ----------
  return (
    <main style={{ maxWidth: 480, margin: "0 auto", padding: 24 }}>
      <h1 style={{ fontSize: 32, margin: "0 0 20px" }}>เปิดโต๊ะ</h1>

      {existing && (
        <div
          role="alert"
          style={{
            border: "4px solid #dc2626",
            background: "#fef2f2",
            color: "#7f1d1d",
            borderRadius: 14,
            padding: 20,
            marginBottom: 24,
          }}
        >
          <p style={{ fontSize: 24, fontWeight: 700, margin: "0 0 16px" }}>
            โต๊ะนี้มีลูกค้าอยู่ระหว่างทานอาหาร กรุณาปิดออเดอร์เดิมก่อน
          </p>
          <button
            type="button"
            onClick={askCloseExisting}
            style={btn("#dc2626", "#fff", { width: "100%" })}
          >
            ปิดออเดอร์เดิม
          </button>
        </div>
      )}

      {notice && (
        <p
          style={{
            fontSize: 20,
            background: "#ecfdf5",
            border: "2px solid #16a34a",
            color: "#14532d",
            borderRadius: 12,
            padding: 14,
            margin: "0 0 20px",
          }}
        >
          {notice}
        </p>
      )}

      <form
        onSubmit={(e) => {
          e.preventDefault();
          handleOpenTable();
        }}
        style={{ display: "grid", gap: 20 }}
      >
        <div>
          <label htmlFor="table" style={labelStyle}>เลขโต๊ะ</label>
          <input
            id="table"
            type="number"
            inputMode="numeric"
            min="1"
            value={tableNumber}
            onChange={(e) => {
              setTableNumber(e.target.value);
              setExisting(null);
              setNotice("");
            }}
            style={inputStyle}
          />
        </div>
        <div>
          <label htmlFor="adults" style={labelStyle}>จำนวนผู้ใหญ่</label>
          <input
            id="adults"
            type="number"
            inputMode="numeric"
            min="0"
            value={adultCount}
            onChange={(e) => setAdultCount(e.target.value)}
            style={inputStyle}
          />
        </div>
        <div>
          <label htmlFor="children" style={labelStyle}>จำนวนเด็ก</label>
          <input
            id="children"
            type="number"
            inputMode="numeric"
            min="0"
            value={childCount}
            onChange={(e) => setChildCount(e.target.value)}
            style={inputStyle}
          />
        </div>

        {error && (
          <p style={{ fontSize: 20, color: "#b91c1c", margin: 0 }} role="alert">{error}</p>
        )}

        <button
          type="submit"
          disabled={loading}
          style={btn("#c2410c", "#fff", { opacity: loading ? 0.6 : 1 })}
        >
          {loading ? "กำลังตรวจสอบ..." : "เปิดโต๊ะ"}
        </button>
      </form>

      {/* กล่องยืนยันปิดโต๊ะเดิม */}
      {confirmOpen && existing && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.6)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 16,
          }}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="confirm-title"
            style={{
              background: "#fff",
              border: "4px solid #ea580c",
              borderRadius: 16,
              padding: 24,
              width: "100%",
              maxWidth: 420,
            }}
          >
            <h2 id="confirm-title" style={{ fontSize: 28, margin: "0 0 16px", color: "#9a3412" }}>
              ยืนยันปิดโต๊ะเดิม
            </h2>
            <p style={{ fontSize: 24, fontWeight: 700, margin: "0 0 6px" }}>
              โต๊ะ {existing.table_number}
            </p>
            <p style={{ fontSize: 22, margin: "0 0 6px" }}>
              ผู้ใหญ่ {existing.adult_count} · เด็ก {existing.child_count}
            </p>
            <p style={{ fontSize: 22, margin: "0 0 20px" }}>เปิดมาแล้ว {minutesOpen} นาที</p>

            {dialogError && (
              <p style={{ fontSize: 18, color: "#b91c1c", margin: "0 0 16px" }} role="alert">
                {dialogError}
              </p>
            )}

            <div style={{ display: "grid", gap: 12 }}>
              <button
                type="button"
                onClick={confirmCloseExisting}
                disabled={closing}
                style={btn("#dc2626", "#fff", { opacity: closing ? 0.6 : 1 })}
              >
                {closing ? "กำลังปิด..." : "ยืนยันปิดโต๊ะเดิม"}
              </button>
              <button
                type="button"
                onClick={() => setConfirmOpen(false)}
                disabled={closing}
                style={btn("#e7ddd2", "#2b1d16")}
              >
                ยกเลิก
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
