# Ham Kitchen — ระบบสั่งอาหารร้านอาหารตามสั่ง

## Stack
- Next.js เวอร์ชันล่าสุด (App Router) — **JavaScript เท่านั้น ไม่ใช้ TypeScript**
- Deploy บน Vercel
- Supabase (client ที่ `lib/supabaseClient.js`)

## Environment variables
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`

ตั้งใน `.env.local` (local) และ Vercel → Project Settings → Environment Variables (ดูตัวอย่างที่ `.env.example`)

## กฎสำคัญ: Dynamic Route params เป็น Promise
Next.js เวอร์ชันล่าสุด `params` ของ Dynamic Route เป็น **Promise** ต้อง unwrap ด้วย `use()` จาก React เสมอ (ใน Client Component):

```js
"use client";
import { use } from "react";

export default function OrderPage({ params }) {
  const { sessionId } = use(params);
  // ...
}
```

ห้ามอ่าน `params.sessionId` ตรง ๆ

## โครงสร้างฐานข้อมูล Supabase (มีอยู่แล้ว — ไม่ต้องสร้างใหม่)
ใช้อ้างอิงในโปรเจกต์นี้ทั้งหมด:

- `sessions` (id, table_number, adult_count, child_count, status, created_at)
- `menu_categories` (id, name, sort_order)
- `menu_items` (id, category_id, name)
- `orders` (id, session_id, table_number, items เป็น jsonb, status, created_at)

## หน้าที่วางแผนไว้
- `/` — หน้าแรก (ทดสอบ deploy)
- `/generate-qr` — สร้าง QR ประจำโต๊ะ
- `/kitchen` — หน้าครัว
- หน้าสั่งอาหารของลูกค้า (Dynamic Route) — ขั้นตอนถัดไป
