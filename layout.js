export const metadata = {
  title: "Ham Kitchen",
  description: "ระบบสั่งอาหารร้านอาหารตามสั่ง Ham Kitchen",
};

export default function RootLayout({ children }) {
  return (
    <html lang="th">
      <body
        style={{
          margin: 0,
          fontFamily: "system-ui, -apple-system, 'Noto Sans Thai', sans-serif",
          background: "#fffaf0",
          color: "#2b1d16",
        }}
      >
        {children}
      </body>
    </html>
  );
}
