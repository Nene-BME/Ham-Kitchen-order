import Link from "next/link";

const linkStyle = {
  display: "block",
  padding: "14px 20px",
  borderRadius: 12,
  background: "#c2410c",
  color: "#fff",
  textDecoration: "none",
  fontSize: 18,
  textAlign: "center",
};

export default function HomePage() {
  return (
    <main
      style={{
        minHeight: "100vh",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: 24,
        padding: 24,
      }}
    >
      <h1 style={{ fontSize: 40, margin: 0 }}>Ham Kitchen</h1>
      <p style={{ margin: 0 }}>Deploy สำเร็จ — เลือกหน้าที่ต้องการทดสอบ</p>
      <nav style={{ display: "grid", gap: 12, width: "100%", maxWidth: 320 }}>
        <Link href="/generate-qr" style={linkStyle}>
          สร้าง QR โต๊ะ
        </Link>
        <Link href="/kitchen" style={linkStyle}>
          หน้าครัว
        </Link>
      </nav>
    </main>
  );
}
