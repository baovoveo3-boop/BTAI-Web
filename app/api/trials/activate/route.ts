import { NextResponse } from 'next/server';
import { adminDb, adminAuth } from '@/lib/firebase-admin';

export async function POST(req: Request) {
  try {
    const { toolId, hwid, token } = await req.json();

    if (!toolId || !hwid || !token) {
      return NextResponse.json({ success: false, message: 'Thiếu tham số bắt buộc.' }, { status: 400 });
    }

    // 1. Xác thực Token để lấy thông tin User
    let decodedToken;
    try {
      decodedToken = await adminAuth.verifyIdToken(token);
    } catch (error) {
      return NextResponse.json({ success: false, message: 'Token xác thực không hợp lệ hoặc đã hết hạn.' }, { status: 401 });
    }
    const uid = decodedToken.uid;

    // 2. Kiểm tra xem Tool này có cho phép Trial không (allow_trial === true)
    const productRef = adminDb.collection('products').doc(toolId);
    const productSnap = await productRef.get();
    
    if (!productSnap.exists) {
      return NextResponse.json({ success: false, message: 'Tool không tồn tại.' }, { status: 404 });
    }
    
    const productData = productSnap.data();
    if (!productData?.allow_trial) {
      return NextResponse.json({ success: false, message: 'Tool này không cho phép dùng thử.' }, { status: 403 });
    }

    // 3. Kiểm tra Anti-Cheat qua bảng `devices` bằng HWID
    const deviceRef = adminDb.collection('devices').doc(hwid);
    const deviceSnap = await deviceRef.get();
    
    if (deviceSnap.exists) {
      const deviceData = deviceSnap.data();
      
      // Nếu máy này bị cấm (isBanned)
      if (deviceData?.isBanned) {
        return NextResponse.json({ success: false, message: 'Thiết bị của bạn đã bị chặn khỏi hệ thống.' }, { status: 403 });
      }

      // Kiểm tra xem HWID này đã từng xin Trial cho Tool này chưa
      if (deviceData?.trials && deviceData.trials[toolId]) {
        return NextResponse.json({ 
          success: false, 
          message: 'Thiết bị này đã sử dụng hết lượt Dùng thử cho Tool này. Vui lòng mua gói Plus/Premium để tiếp tục!' 
        }, { status: 403 });
      }
    }

    // 4. Nếu an toàn -> Tiến hành cấp quyền Trial
    const now = new Date();
    const expiresAt = new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000); // + 3 days

    const trialData = {
      startedAt: now.toISOString(),
      expiresAt: expiresAt.toISOString(),
      activatedBy: uid,
      status: "active"
    };

    // Update bảng Devices
    if (!deviceSnap.exists) {
      await deviceRef.set({
        hwid: hwid,
        linkedUsers: [uid],
        isBanned: false,
        trials: {
          [toolId]: trialData
        }
      });
    } else {
      const currentLinkedUsers = deviceSnap.data()?.linkedUsers || [];
      const updatedLinkedUsers = currentLinkedUsers.includes(uid) 
        ? currentLinkedUsers 
        : [...currentLinkedUsers, uid];

      await deviceRef.set({
        linkedUsers: updatedLinkedUsers,
        trials: {
          ...(deviceSnap.data()?.trials || {}),
          [toolId]: trialData
        }
      }, { merge: true });
    }

    // Update bảng Users để App Hub load giao diện cho nhanh
    const userRef = adminDb.collection('users').doc(uid);
    await userRef.set({
      trials: {
        [toolId]: trialData
      }
    }, { merge: true });

    return NextResponse.json({ 
      success: true, 
      message: 'Kích hoạt Dùng thử thành công!',
      expiresAt: expiresAt.toISOString()
    });

  } catch (error: any) {
    console.error("Lỗi khi cấp Trial:", error);
    return NextResponse.json({ success: false, message: 'Lỗi hệ thống: ' + error.message }, { status: 500 });
  }
}
