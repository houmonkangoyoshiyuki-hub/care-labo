import Stripe from 'stripe';

export const config = {
  api: {
    bodyParser: false,
  },
};

function getRawBody(req) {
  return new Promise((resolve, reject) => {
    let data = '';
    req.on('data', (chunk) => { data += chunk; });
    req.on('end', () => resolve(data));
    req.on('error', reject);
  });
}

function generatePasscode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const randPart = (len) => Array.from({ length: len }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
  return `NC-${randPart(4)}-${randPart(4)}`;
}

// このWebhook（このアプリ）が処理すべき決済かどうかを、実際に使われた価格IDで判定する。
// 同じStripeアカウントを複数アプリで共有しているため、他アプリの決済で誤発火しないようにする。
async function getLineItemPriceIds(stripe, event) {
  const obj = event.data.object;
  try {
    if (event.type === 'checkout.session.completed') {
      const items = await stripe.checkout.sessions.listLineItems(obj.id, { limit: 10 });
      return items.data.map((it) => it.price?.id).filter(Boolean);
    }
    if (event.type === 'invoice.payment_succeeded') {
      return (obj.lines?.data || []).map((line) => line.price?.id).filter(Boolean);
    }
  } catch (err) {
    console.error('Failed to fetch line items:', err.message);
  }
  return [];
}

async function kvCommand(commandArray) {
  const url = process.env.KV_REST_API_URL;
  const token = process.env.KV_REST_API_TOKEN;
  const res = await fetch(`${url}/${commandArray.map(encodeURIComponent).join('/')}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const data = await res.json();
  return data.result;
}

async function sendPasscodeEmail(toEmail, code, appName) {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey || !toEmail || toEmail === '(メール不明)') return;
  try {
    await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: process.env.RESEND_FROM_EMAIL || 'onboarding@resend.dev',
        to: [toEmail],
        subject: `【${appName}】ご契約ありがとうございます（パスコードのお知らせ）`,
        html: `
          <div style="font-family:sans-serif; max-width:480px; margin:0 auto; padding:20px;">
            <h2>ご契約ありがとうございます！</h2>
            <p>${appName} をご利用いただき、誠にありがとうございます。</p>
            <p>以下のパスコードを、アプリの「設定」→「APIキー設定」欄に入力してください。</p>
            <div style="background:#F4F6F4; border-radius:10px; padding:20px; text-align:center; margin:20px 0;">
              <div style="font-family:monospace; font-size:22px; font-weight:bold; letter-spacing:2px;">${code}</div>
            </div>
            <p style="font-size:13px; color:#666;">
              ※このパスコードは、ご契約が続く限りずっと同じものをお使いいただけます。毎月新しいパスコードが届くことはありません。大切に保管してください。
            </p>
            <p style="font-size:13px; color:#666;">
              ※初めてのご契約の方は、ご自身でAnthropic社のAPIキーを取得し、あわせて設定していただく必要があります。
              APIキーをまだ設定済みの方は、パスコードの入力だけで継続してご利用いただけます。
            </p>
            <p style="font-size:13px; color:#666;">
              ご不明点があれば、LINE公式アカウントまでお気軽にご連絡ください。
            </p>
          </div>
        `,
      }),
    });
  } catch (err) {
    console.error('Email send failed:', err.message);
  }
}

async function sendRenewalEmail(toEmail, appName) {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey || !toEmail || toEmail === '(メール不明)') return;
  try {
    await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: process.env.RESEND_FROM_EMAIL || 'onboarding@resend.dev',
        to: [toEmail],
        subject: `【${appName}】今月分のお支払いが完了しました`,
        html: `
          <div style="font-family:sans-serif; max-width:480px; margin:0 auto; padding:20px;">
            <h2>今月分のお支払いが完了しました</h2>
            <p>${appName} をご利用いただき、誠にありがとうございます。</p>
            <p style="font-size:13px; color:#666;">
              パスコードは、初回にお送りしたものから変更ありません。お手元のパスコードをそのままお使いください。
            </p>
            <p style="font-size:13px; color:#666;">
              ご不明点があれば、LINE公式アカウントまでお気軽にご連絡ください。
            </p>
          </div>
        `,
      }),
    });
  } catch (err) {
    console.error('Renewal email send failed:', err.message);
  }
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
  const sig = req.headers['stripe-signature'];
  const rawBody = await getRawBody(req);

  let event;
  try {
    event = stripe.webhooks.constructEvent(rawBody, sig, process.env.STRIPE_WEBHOOK_SECRET);
  } catch (err) {
    console.error('Webhook signature verification failed:', err.message);
    res.status(400).send(`Webhook Error: ${err.message}`);
    return;
  }

  // 継続課金（サブスク）は invoice.payment_succeeded だけで処理する（初回・更新どちらもこれで拾える）。
  // 一回限りの支払いは invoice が発生しないため、checkout.session.completed（かつsubscriptionでない場合）で処理する。
  // こうすることで、サブスクの初回支払い時に2つのイベントが両方処理されてしまう問題を防ぐ。
  const isSubscriptionCheckout = event.type === 'checkout.session.completed' && event.data.object.mode === 'subscription';
  const shouldProcess =
    event.type === 'invoice.payment_succeeded' ||
    (event.type === 'checkout.session.completed' && !isSubscriptionCheckout);

  if (shouldProcess) {
    try {
      const obj = event.data.object;

      // このアプリの商品の決済かどうかを確認（STRIPE_PRICE_IDS 環境変数にカンマ区切りで設定）
      const allowedPriceIds = (process.env.STRIPE_PRICE_IDS || '').split(',').map((s) => s.trim()).filter(Boolean);
      if (allowedPriceIds.length > 0) {
        const priceIds = await getLineItemPriceIds(stripe, event);
        const matches = priceIds.some((id) => allowedPriceIds.includes(id));
        if (!matches) {
          res.status(200).json({ received: true, skipped: 'not-this-app-product' });
          return;
        }
      }

      const dedupeId = obj.invoice || obj.id;
      const dedupeKey = `webhook_processed:${dedupeId}`;
      // SET ... NX EX は「まだキーが存在しない時だけ設定する」というアトミックな操作。
      // これにより、ほぼ同時に2つの通知が来ても、片方しか処理が通らないようにする。
      const setResult = await kvCommand(['SET', dedupeKey, '1', 'NX', 'EX', '2592000']);
      if (setResult !== 'OK') {
        res.status(200).json({ received: true, skipped: 'duplicate' });
        return;
      }

      const customerEmail = obj.customer_details?.email || obj.customer_email || '(メール不明)';
      const subscriptionId = obj.subscription || null;

      // ── このサブスクリプションに、既にパスコードが発行済みでないか確認 ──
      // 発行済みなら、更新支払いとみなし新規パスコードは発行しない（1サブスクにつき1パスコードを維持する）
      let existingCode = null;
      if (subscriptionId) {
        try {
          existingCode = await kvCommand(['GET', `passcode_for_subscription:${subscriptionId}`]);
        } catch (e) {}
      }

      if (existingCode) {
        // 更新支払い：パスコードは変更せず、お知らせメールだけ送る
        await sendRenewalEmail(customerEmail, process.env.APP_DISPLAY_NAME || 'アプリ');
        console.log(`Renewal payment confirmed for existing passcode: ${existingCode} sub:${subscriptionId}`);
        res.status(200).json({ received: true, renewal: true, code: existingCode });
        return;
      }

      // 初回支払い：新規パスコードを発行
      const code = generatePasscode();
      const now = new Date();
      const stamp = `${now.getFullYear()}/${now.getMonth() + 1}/${now.getDate()} ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;

      const amountTotal = obj.amount_total ?? obj.amount_paid ?? obj.total ?? 0;
      const tier = amountTotal > 0 && amountTotal < 600 ? 'basic' : 'valid';

      await kvCommand(['SET', `passcode:${code}`, tier]);
      if (subscriptionId) {
        // このパスコードがどのサブスクに紐づくかを記録（解約時に使う／今後の更新時の重複発行防止に使う）
        await kvCommand(['SET', `subscription_for_passcode:${code}`, subscriptionId]);
        await kvCommand(['SET', `passcode_for_subscription:${subscriptionId}`, code]);
      }

      const listKey = 'passcode_list';
      let list = [];
      try {
        const existing = await kvCommand(['GET', listKey]);
        list = existing ? JSON.parse(existing) : [];
      } catch (e) {}
      list.unshift({ code, email: customerEmail, stamp, tier });
      list = list.slice(0, 50);
      await kvCommand(['SET', listKey, JSON.stringify(list)]);

      await sendPasscodeEmail(customerEmail, code, process.env.APP_DISPLAY_NAME || 'アプリ');

      console.log(`New passcode issued: ${code} (${tier}) sub:${subscriptionId} for ${customerEmail}`);
    } catch (err) {
      console.error('Error issuing passcode:', err.message);
    }
  }

  res.status(200).json({ received: true });
}
