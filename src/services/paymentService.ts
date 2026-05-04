import { doc, updateDoc, addDoc, collection, serverTimestamp } from 'firebase/firestore';
import { db } from '../lib/firebase';

export interface PaymentOptions {
  amount: number;
  currency: string;
  receipt: string;
  notes: Record<string, string>;
}

export const createRazorpayOrder = async (options: PaymentOptions) => {
  const response = await fetch('/api/payments/create-order', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(options)
  });
  if (!response.ok) throw new Error('Failed to create Razorpay order');
  return response.json();
};

export const verifyPayment = async (paymentData: any) => {
  const response = await fetch('/api/payments/verify', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(paymentData)
  });
  if (!response.ok) return { verified: false };
  return response.json();
};

export const processRefund = async (paymentId: string, amount: number, notes: any) => {
  if (import.meta.env.VITE_PAYMENT_MODE === 'test') {
    return new Promise((resolve) => {
      setTimeout(() => {
        resolve({ status: 'refunded', id: `RFD_DUMMY_${Date.now()}`, amount });
      }, 1000);
    });
  }

  const response = await fetch('/api/payments/refund', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ paymentId, amount, notes })
  });
  return response.json();
};

export const simulateDummyPayment = async (amount: number, bookingId: string) => {
  return new Promise((resolve, reject) => {
    setTimeout(() => {
      // 90% success rate for simulation
      if (Math.random() > 0.1) {
        resolve({
          razorpay_order_id: `ORD_DUMMY_${bookingId.substring(0, 5)}_${Date.now()}`,
          razorpay_payment_id: `PAY_DUMMY_${Date.now()}`,
          verified: true
        });
      } else {
        reject(new Error('Dummy Payment Failed for Testing'));
      }
    }, 2000);
  });
};

export const loadRazorpayScript = () => {
  return new Promise((resolve) => {
    const script = document.createElement('script');
    script.src = 'https://checkout.razorpay.com/v1/checkout.js';
    script.onload = () => resolve(true);
    script.onerror = () => resolve(false);
    document.body.appendChild(script);
  });
};
