import express from 'express';
import cors from 'cors';
import bodyParser from 'body-parser';
import { createServer as createViteServer } from 'vite';
import path from 'path';
import Razorpay from 'razorpay';
import crypto from 'crypto';

// Log environment state
console.log('Payment Mode:', process.env.VITE_PAYMENT_MODE || 'live');

const app = express();
const PORT = 3000;

app.use(cors());
app.use(bodyParser.json());

// Lazy-init Razorpay
let razorpay: Razorpay | null = null;
const getRazorpay = () => {
  if (!razorpay) {
    const keyId = process.env.RAZORPAY_KEY_ID;
    const keySecret = process.env.RAZORPAY_KEY_SECRET;
    if (!keyId || !keySecret) {
      throw new Error('Razorpay keys missing in environment');
    }
    razorpay = new Razorpay({ key_id: keyId, key_secret: keySecret });
  }
  return razorpay;
};

// API: Create Razorpay Order
app.post('/api/payments/create-order', async (req, res) => {
  try {
    const { amount, currency = 'INR', receipt, notes } = req.body;
    const rzp = getRazorpay();
    const order = await rzp.orders.create({
      amount: amount * 100, // Razorpay expects paise
      currency,
      receipt,
      notes
    });
    res.json(order);
  } catch (error: any) {
    console.error('Order creation failed:', error);
    res.status(500).json({ error: error.message });
  }
});

// API: Verify Payment Signature
app.post('/api/payments/verify', async (req, res) => {
  try {
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = req.body;
    const secret = process.env.RAZORPAY_KEY_SECRET;
    
    if (!secret) return res.status(500).json({ error: 'Secret missing' });

    const body = razorpay_order_id + "|" + razorpay_payment_id;
    const expectedSignature = crypto
      .createHmac('sha256', secret)
      .update(body.toString())
      .digest('hex');

    if (expectedSignature === razorpay_signature) {
      res.json({ verified: true });
    } else {
      res.status(400).json({ verified: false });
    }
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// API: Refund Deposit
app.post('/api/payments/refund', async (req, res) => {
    try {
        const { paymentId, amount, notes } = req.body;
        const rzp = getRazorpay();
        const refund = await rzp.payments.refund(paymentId, {
            amount: amount * 100,
            notes
        });
        res.json(refund);
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
});

async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
