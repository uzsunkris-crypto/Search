// functions/index.js
const functions = require('firebase-functions');
const admin = require('firebase-admin');
const fetch = require('node-fetch'); // or axios
admin.initializeApp();

const PAYSTACK_SECRET = functions.config().paystack && functions.config().paystack.secret;

exports.verifyPayment = functions.firestore
  .document('payments/{paymentId}')
  .onCreate(async (snap, context) => {
    const payment = snap.data();
    if(!payment || !payment.ref || !payment.uid) return null;
    try{
      if(!PAYSTACK_SECRET) {
        console.error('Paystack secret not configured');
        await snap.ref.update({ status:'error', error:'no-paystack-secret' });
        return null;
      }
      const res = await fetch(`https://api.paystack.co/transaction/verify/${payment.ref}`, {
        headers: { Authorization: `Bearer ${PAYSTACK_SECRET}` }
      });
      const json = await res.json();
      if(json && json.status && json.data && json.data.status === 'success'){
        await snap.ref.update({ status:'verified', verifyMeta: json.data, verifiedAt: admin.firestore.FieldValue.serverTimestamp() });
        const today = new Date().toISOString().slice(0,10);
        await admin.firestore().collection('users').doc(payment.uid).update({ paidDate: today });
        return true;
      } else {
        await snap.ref.update({ status:'failed', verifyMeta: json });
        return null;
      }
    }catch(err){
      console.error('verify error', err);
      await snap.ref.update({ status:'error', error: (err.message||String(err)) });
      return null;
    }
  });
