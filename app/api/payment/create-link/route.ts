import { NextResponse } from 'next/server';
import { PayOS } from '@payos/node';
import { adminFirestore } from '@/lib/firebase-admin';

export async function POST(req: Request) {
  try {
    if (!process.env.PAYOS_CLIENT_ID) {
      return NextResponse.json({ error: 'PayOS keys not loaded. Vui lòng tắt terminal và chạy lại npm run dev.' }, { status: 500 });
    }

    const payos = new PayOS({
      clientId: process.env.PAYOS_CLIENT_ID,
      apiKey: process.env.PAYOS_API_KEY || '',
      checksumKey: process.env.PAYOS_CHECKSUM_KEY || ''
    });

    const body = await req.json();
    const { amount, description, userId, userEmail, type, toolIds } = body;

    if (!amount || !userId) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const domain = req.headers.get('origin') || 'https://btailabs.vercel.app';
    
    // PayOS requires orderCode to be a number (max 53 bit)
    // We use timestamp suffix to ensure uniqueness
    const orderCode = Number(String(Date.now()).slice(-9));

    // Save transaction info to Firebase BEFORE calling PayOS
    // This allows us to track pending transactions and fulfill them via Webhook
    const txRef = adminFirestore.collection('transactions').doc(String(orderCode));
    await txRef.set({
      orderCode: orderCode,
      userId: userId,
      userEmail: userEmail || '',
      amount: amount,
      description: description || 'Nạp tiền vào ví',
      type: type || 'topup', // 'topup' or 'direct_purchase'
      toolIds: toolIds || [], // Array of string IDs if direct_purchase
      status: 'PENDING',
      createdAt: new Date().toISOString()
    });

    const requestData = {
      orderCode,
      amount,
      description: `NAP ${orderCode}`,
      returnUrl: `${domain}/hub?tab=wallet&status=success&orderCode=${orderCode}`,
      cancelUrl: `${domain}/hub?tab=wallet&status=cancel&orderCode=${orderCode}`,
    };

    const paymentLinkData = await payos.paymentRequests.create(requestData);

    return NextResponse.json({
      checkoutUrl: paymentLinkData.checkoutUrl
    });

  } catch (error: any) {
    console.error('Error creating payment link:', error);
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}
