import { NextResponse } from 'next/server';
import { adminFirestore, adminDatabase } from '@/lib/firebase-admin';
import * as admin from 'firebase-admin';

// Helper to convert frontend ID to Realtime DB tool_id expected by App Launcher
function getRtdbToolId(productId: string): string {
  return productId.replace(/-/g, '_'); // e.g. 'ban-content' -> 'ban_content'
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { userId, items, totalAmount } = body;

    if (!userId || !items || !totalAmount) {
      return NextResponse.json({ success: false, error: 'Thiếu thông tin bắt buộc' }, { status: 400 });
    }

    // Get current user info using firebase-admin
    const userRef = adminFirestore.collection('users').doc(userId);
    const userSnap = await userRef.get();

    if (!userSnap.exists) {
      return NextResponse.json({ success: false, error: 'Tài khoản không tồn tại' }, { status: 404 });
    }

    const userData = userSnap.data();
    if (!userData) {
      return NextResponse.json({ success: false, error: 'Không thể đọc dữ liệu người dùng' }, { status: 500 });
    }

    // Lấy đơn giá thực tế từ Database để xác thực
    const priceCatalog: Record<string, any> = {};
    const productsSnap = await adminFirestore.collection('products').get();
    productsSnap.forEach((doc: any) => {
      priceCatalog[doc.id] = doc.data();
    });

    // Dynamically calculate total price server-side and verify it matches totalAmount
    let calculatedTotal = 0;
    for (const item of items) {
      if (!item.id || !(item.id in priceCatalog)) {
        return NextResponse.json({ success: false, error: `Sản phẩm không hợp lệ: ${item.id || 'Unknown'}` }, { status: 400 });
      }
      calculatedTotal += Number(priceCatalog[item.id].price) || 0;
    }

    if (calculatedTotal !== totalAmount) {
      return NextResponse.json({ success: false, error: `Số tiền thanh toán không khớp với hệ thống. Mong muốn: ${calculatedTotal}, Nhận được: ${totalAmount}` }, { status: 400 });
    }

    const currentBalance = userData.walletBalance || 0;

    // Check balance using verified calculatedTotal
    if (currentBalance < calculatedTotal) {
      return NextResponse.json({ success: false, error: 'Số dư ví không đủ để thanh toán' }, { status: 400 });
    }

    // Extract item IDs
    const itemIds: string[] = items.map((item: any) => item.id);

    // 1. Transactionally deduct balance and add to purchasedItems array in Firestore using calculatedTotal
    const batch = adminFirestore.batch();
    
    // Xử lý tự động ngày hết hạn cho các Tool và Gói
    let newTier = userData?.currentTier || 'free';
    let newTierExpiresAt = userData?.tierExpiresAt || null;
    let isTierUpdated = false;

    // Helper tính hạn sử dụng dựa trên chuỗi priceText
    const calculateExpiresAt = (priceStr: string) => {
      if (priceStr.includes('tháng')) {
        const d = new Date();
        d.setDate(d.getDate() + 30);
        return d.toISOString();
      } else if (priceStr.includes('năm')) {
        const d = new Date();
        d.setFullYear(d.getFullYear() + 1);
        return d.toISOString();
      }
      return null; // trọn đời hoặc miễn phí
    };

    const allActivatedTools = new Set<string>();

    items.forEach((item: any) => {
      const dbItem = priceCatalog[item.id];
      const priceStr = dbItem ? String(dbItem.priceText || dbItem.price || '') : '';
      const expiresAt = calculateExpiresAt(priceStr);

      let toolsToActivate = [item.id];
      if (item.id === 'combo-khoi-nghiep') {
        toolsToActivate = ['ban-content', 'tool-seeding-pro'];
      } else if (item.id === 'combo-scale-up') {
        toolsToActivate = ['ban-content', 'healing-bird'];
      } else if (item.id === 'combo-all-in-one') {
        toolsToActivate = ['ban-content', 'healing-bird', 'tool-seeding-pro'];
      }

      // Cập nhật Subcollection licenses cho từng item
      for (const tId of toolsToActivate) {
        allActivatedTools.add(tId);
        const licenseRef = userRef.collection('licenses').doc(tId);
        batch.set(licenseRef, {
          itemId: tId,
          status: 'active',
          expiresAt: expiresAt,
          activatedAt: new Date().toISOString()
        }, { merge: true });
      }

      // Cập nhật Tier nếu mua Gói
      if (item.id === 'tier-plus') {
        if (newTier !== 'premium') newTier = 'plus';
        newTierExpiresAt = expiresAt;
        isTierUpdated = true;
      } else if (item.id === 'tier-premium') {
        newTier = 'premium';
        newTierExpiresAt = expiresAt;
        isTierUpdated = true;
      }
    });

    const userUpdates: any = {
      walletBalance: admin.firestore.FieldValue.increment(-calculatedTotal),
      purchasedItems: admin.firestore.FieldValue.arrayUnion(...itemIds),
      updatedAt: new Date().toISOString()
    };

    if (isTierUpdated) {
      userUpdates.currentTier = newTier;
      userUpdates.tierExpiresAt = newTierExpiresAt;
    }

    batch.update(userRef, userUpdates);

    // 2. Log order details in Firestore using calculatedTotal
    const orderRef = adminFirestore.collection('orders').doc();
    const orderData = {
      userId,
      items: items.map((item: any) => {
        const dbItem = priceCatalog[item.id];
        return {
          id: item.id,
          name: dbItem ? dbItem.name : item.name,
          price: dbItem ? (dbItem.priceText || dbItem.price) : (item.priceText || item.price || '')
        };
      }),
      totalAmount: calculatedTotal,
      status: 'COMPLETED',
      createdAt: new Date().toISOString()
    };
    batch.set(orderRef, orderData);

    await batch.commit();

    // 3. Update Firebase Realtime Database to instantly activate the tool in the App Launcher
    try {
      const updates: Record<string, boolean> = {};
      Array.from(allActivatedTools).forEach((id) => {
        const rtdbToolId = getRtdbToolId(id);
        updates[rtdbToolId] = true;
      });

      const rtdbRef = adminDatabase.ref(`users/${userId}/purchased_tools`);
      await rtdbRef.update(updates);
      console.log(`Successfully synced purchase tools for user ${userId} to Realtime DB:`, Object.keys(updates));
    } catch (rtdbError) {
      // Log error but don't fail the API call because Firestore transaction is already committed
      console.error('Error syncing purchase to Realtime Database:', rtdbError);
    }

    return NextResponse.json({
      success: true,
      message: 'Thanh toán thành công'
    });

  } catch (error: any) {
    console.error('Lỗi thanh toán giỏ hàng:', error);
    return NextResponse.json({
      success: false,
      error: 'Lỗi hệ thống trong quá trình thanh toán'
    }, { status: 500 });
  }
}

