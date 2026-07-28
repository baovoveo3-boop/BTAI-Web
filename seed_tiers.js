const admin = require("firebase-admin");
const serviceAccount = require("./firebase_admin_key.json");

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
  });
}

const db = admin.firestore();

async function seedData() {
  const tiersRef = db.collection("tiers");
  const combosRef = db.collection("combos");

  // ================= Tiers =================
  const freeTier = {
    name: "Dùng Thử",
    description: "Trải nghiệm cơ bản để làm quen với hệ thống.",
    priceText: "0đ",
    priceMonthly: 0,
    priceYearly: 0,
    features: [
      { text: "Truy cập tất cả Công cụ cơ bản, Kho Ứng Dụng Miễn Phí", type: "check" },
      { text: "Giới hạn: Dùng Thử 1 Tool/1 ngày", type: "check" },
      { text: "Tốc độ xử lý: Tiêu chuẩn (xếp hàng chờ)", type: "check" },
      { text: "Không có Voice Clone", type: "cross" },
      { text: "Không ưu tiên hỗ trợ", type: "cross" }
    ],
    updatedAt: admin.firestore.FieldValue.serverTimestamp()
  };

  const plusTier = {
    name: "Plus (Chuyên Gia)",
    description: "Công cụ chuyên sâu dành cho Content Creator.",
    priceMonthly: 699000,
    priceYearly: 5990000,
    badgeText: "Phổ Biến",
    features: [
      { text: "Truy cập toàn bộ Công cụ (gồm VIP Tools)", type: "check" },
      { text: "Giới hạn: 3 Tool Không Giới Hạn", type: "check" },
      { text: "Tốc độ xử lý: Nhanh (Server riêng)", type: "check" },
      { text: "Mở khóa Voice Clone cơ bản", type: "check" },
      { text: "Hỗ trợ qua Kênh Email / Ticket", type: "check" }
    ],
    updatedAt: admin.firestore.FieldValue.serverTimestamp()
  };

  const premiumTier = {
    name: "Premium (Vượt Trội)",
    description: "Giải pháp toàn diện cho Studio & Doanh nghiệp.",
    priceMonthly: 1990000,
    priceYearly: 15990000,
    badgeText: "Khuyên Dùng",
    features: [
      { text: "KHÔNG GIỚI HẠN số Tool", type: "check" },
      { text: "Tốc độ xử lý: Super VIP (Render siêu tốc)", type: "check" },
      { text: "Voice Clone Cao cấp (Cảm xúc, đa ngôn ngữ)", type: "check" },
      { text: "Hỗ trợ 1:1 trực tiếp qua Zalo/Telegram", type: "check" },
      { text: "Yêu cầu thêm tính năng (Request Feature)", type: "check" }
    ],
    updatedAt: admin.firestore.FieldValue.serverTimestamp()
  };

  // ================= Combos =================
  const comboPowerpack = {
    name: "Combo Powerpack",
    priceMonthly: 599000,
    priceLifetime: 3990000,
    badgeText: "Tiết kiệm 20%",
    features: [
      { text: "Bao gồm Healing Bird Tool", type: "check" },
      { text: "Bao gồm Ban Content Tool", type: "check" },
      { text: "Cập nhật tính năng miễn phí", type: "check" }
    ],
    updatedAt: admin.firestore.FieldValue.serverTimestamp()
  };

  console.log("Seeding tiers...");
  await tiersRef.doc("tier-free").set(freeTier);
  await tiersRef.doc("tier-plus").set(plusTier);
  await tiersRef.doc("tier-premium").set(premiumTier);

  console.log("Seeding combos...");
  await combosRef.doc("combo-powerpack").set(comboPowerpack);

  console.log("Seed completed successfully!");
  process.exit(0);
}

seedData();
