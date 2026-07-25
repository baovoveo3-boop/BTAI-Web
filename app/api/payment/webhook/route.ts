import { NextResponse } from 'next/server';
import { PayOS } from '@payos/node';
import { adminFirestore, adminDatabase } from '@/lib/firebase-admin';
import * as admin from 'firebase-admin';

export async function POST(req: Request) {
  try {
    if (!process.env.PAYOS_CLIENT_ID) {
      console.error('PayOS keys not loaded in webhook');
      return NextResponse.json({ success: false, code: "99", data: null }, { status: 500 });
    }

    const payos = new PayOS({
      clientId: process.env.PAYOS_CLIENT_ID,
      apiKey: process.env.PAYOS_API_KEY || '',
      checksumKey: process.env.PAYOS_CHECKSUM_KEY || ''
    });

    let body: any;
    try {
      body = await req.json();
    } catch (jsonErr) {
      console.error('Failed to parse webhook JSON body:', jsonErr);
      return NextResponse.json({
        success: false,
        code: "400",
        message: "Invalid JSON body"
      }, { status: 400 });
    }
    
    // Verify webhook payload using verifyPaymentWebhookData if available, otherwise fallback to webhooks.verify
    let webhookData: any = null;
    try {
      if (typeof (payos as any).verifyPaymentWebhookData === 'function') {
        webhookData = (payos as any).verifyPaymentWebhookData(body);
      } else {
        webhookData = await payos.webhooks.verify(body);
      }
    } catch (verifyError: any) {
      console.error('Webhook signature verification failed:', verifyError);
      return NextResponse.json({
        success: false,
        code: "401",
        message: verifyError.message || 'Signature verification failed'
      }, { status: 401 });
    }

    if (!webhookData) {
      return NextResponse.json({
        success: false,
        code: "401",
        message: "Invalid webhook data"
      }, { status: 401 });
    }

    if (webhookData.code === "00") {
      const orderCode = webhookData.orderCode;
      
      // Use firebase-admin Firestore to fetch matching transaction
      const txRef = adminFirestore.collection('transactions').doc(String(orderCode));
      const txSnap = await txRef.get();
      
      if (txSnap.exists) {
        const txData = txSnap.data();
        
        // Prevent double processing
        if (txData && txData.status !== 'SUCCESS') {
          const userId = txData.userId;
          const amount = txData.amount;
          const txType = txData.type || 'topup';
          
          if (userId && amount) {
            const userRef = adminFirestore.collection('users').doc(userId);
            
            // Execute atomic update using batch or transaction
            const batch = adminFirestore.batch();
            
            batch.update(txRef, {
              status: 'SUCCESS',
              updatedAt: new Date().toISOString()
            });

            if (txType === 'topup') {
              batch.update(userRef, {
                walletBalance: admin.firestore.FieldValue.increment(amount),
                updatedAt: new Date().toISOString()
              });
              await batch.commit();
              console.log(`Successfully added ${amount} to user ${userId}'s wallet via webhook.`);
            } else if (txType === 'direct_purchase') {
              batch.update(userRef, {
                updatedAt: new Date().toISOString()
              });
              await batch.commit();
              console.log(`Direct purchase for user ${userId} processed (wallet unaffected).`);

              // Directly activate the tool in the Firebase Realtime Database and Firestore Licenses
              const toolIds = txData.toolIds && txData.toolIds.length > 0 
                ? txData.toolIds 
                : (txData.toolId || txData.productId ? [txData.toolId || txData.productId] : []);
              
              if (toolIds.length > 0) {
                let toolsToActivateSet = new Set<string>();
                let newTier = '';

                for (const rawId of toolIds) {
                  if (rawId === 'combo-powerpack') {
                    toolsToActivateSet.add('ban-content');
                    toolsToActivateSet.add('healing-bird');
                  } else if (rawId === 'tier-plus') {
                    if (newTier !== 'premium') newTier = 'plus';
                  } else if (rawId === 'tier-premium') {
                    newTier = 'premium';
                  } else {
                    toolsToActivateSet.add(rawId);
                  }
                }

                try {
                  // For simplicity in cart purchases, we'll set default expiration based on the first item's price text
                  // In a robust system, each item might have its own expiration, but right now we treat the cart uniformly.
                  const firstToolDoc = await adminFirestore.collection('products').doc(toolIds[0]).get();
                  const item = firstToolDoc.exists ? firstToolDoc.data() : null;
                  const priceStr = item ? String(item.priceText || item.price || '') : '';
                  let expiresAt = null;

                  // Default 30 days for everything unless specified otherwise
                  const d = new Date();
                  d.setDate(d.getDate() + 30);
                  expiresAt = d.toISOString();
                  
                  if (priceStr.includes('năm')) {
                    const dy = new Date();
                    dy.setFullYear(dy.getFullYear() + 1);
                    expiresAt = dy.toISOString();
                  } else if (priceStr.includes('vĩnh viễn')) {
                    expiresAt = null;
                  }

                  // 1. Update RTDB & 2. Create Subcollection Licenses
                  const rtdbRef = adminDatabase.ref(`users/${userId}/purchased_tools`);
                  const rtdbUpdates: any = {};
                  const toolsToActivateArray = Array.from(toolsToActivateSet);

                  for (const tId of toolsToActivateArray) {
                    const rtdbKey = tId.replace(/-/g, '_');
                    rtdbUpdates[rtdbKey] = true;

                    const licenseRef = userRef.collection('licenses').doc(tId);
                    await licenseRef.set({
                      itemId: tId,
                      status: 'active',
                      expiresAt: expiresAt,
                      activatedAt: new Date().toISOString()
                    }, { merge: true });
                  }
                  // RTDB legacy sync is disabled because the RTDB instance does not exist and causes 504 Timeouts
                  /*
                  try {
                    const rtdbRef = adminDatabase.ref(`users/${userId}/purchased_tools`);
                    await rtdbRef.update(rtdbUpdates);
                    console.log(`Successfully updated RTDB for user ${userId}.`);
                  } catch (rtdbErr) {
                    console.error(`RTDB sync failed (legacy), skipping:`, rtdbErr);
                  }
                  */

                  console.log(`Successfully activated tools [${toolsToActivateArray.join(',')}] for user ${userId}.`);

                  const newPurchasedProducts = toolIds.map((id: string) => ({
                    id,
                    expiresAt: expiresAt || '',
                    purchasedAt: new Date().toISOString()
                  }));

                  // Save all raw combos/tools to purchasedItems for analytics
                  await userRef.update({
                    purchasedItems: admin.firestore.FieldValue.arrayUnion(...toolIds),
                    purchasedProducts: admin.firestore.FieldValue.arrayUnion(...newPurchasedProducts)
                  });

                  // Cập nhật Tier nếu mua Combo
                  if (newTier !== '') {
                    await userRef.update({
                      currentTier: newTier,
                      tierExpiresAt: expiresAt
                    });
                  }

                } catch (fsErr) {
                  console.error(`Failed to activate licenses for tools ${toolIds.join(',')}:`, fsErr);
                }
              }
            }
          }
        }
      }

      // PayOS requires this exact JSON response
      return NextResponse.json({
        success: true,
        code: "00",
        data: null
      });
    } else {
      const code = webhookData.code || "99";
      console.warn(`Webhook data verified but code is not "00" (code: ${code}) or webhook data is invalid:`, webhookData);
      
      if (webhookData.orderCode) {
        const orderCode = webhookData.orderCode;
        const txRef = adminFirestore.collection('transactions').doc(String(orderCode));
        const txSnap = await txRef.get();
        if (txSnap.exists) {
          const txData = txSnap.data();
          if (txData && txData.status === 'PENDING') {
            await txRef.update({
              status: 'FAILED',
              updatedAt: new Date().toISOString()
            });
            console.log(`Transaction ${orderCode} marked as FAILED via webhook code ${code}.`);
          }
        }
      }
      
      return NextResponse.json({
        success: false,
        code: code,
        data: null
      });
    }

  } catch (error: any) {
    console.error('Webhook processing error:', error);
    // Return code "99" to indicate error to PayOS
    return NextResponse.json({
      success: false,
      code: "99",
      data: null
    });
  }
}
