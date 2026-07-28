const admin = require("firebase-admin");
const serviceAccount = require("./firebase_admin_key.json");

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
  });
}

const db = admin.firestore();

async function listTiers() {
  console.log("=== TIERS ===");
  const tiers = await db.collection("tiers").get();
  if (tiers.empty) {
    console.log("Collection 'tiers' is completely empty or does not exist.");
  } else {
    tiers.forEach(doc => {
      console.log(doc.id, "=>", doc.data());
    });
  }
  
  console.log("\n=== PACKAGES ===");
  const pkgs = await db.collection("packages").get();
  if (pkgs.empty) {
    console.log("Collection 'packages' is completely empty or does not exist.");
  } else {
    pkgs.forEach(doc => {
      console.log(doc.id, "=>", doc.data());
    });
  }
  
  console.log("\n=== PLANS ===");
  const plans = await db.collection("plans").get();
  if (plans.empty) {
    console.log("Collection 'plans' is completely empty or does not exist.");
  } else {
    plans.forEach(doc => {
      console.log(doc.id, "=>", doc.data());
    });
  }

  process.exit(0);
}

listTiers();
