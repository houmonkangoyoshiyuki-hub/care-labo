async function kvCommand(commandArray) {
  const url = process.env.KV_REST_API_URL;
  const token = process.env.KV_REST_API_TOKEN;
  const res = await fetch(`${url}/${commandArray.map(encodeURIComponent).join('/')}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const data = await res.json();
  return data.result;
}

export default async function handler(req, res) {
  const adminKey = req.query.key || (req.method === 'POST' ? req.body?.key : null);
  if (!adminKey || adminKey !== process.env.ADMIN_PASSCODE) {
    res.status(401).send('<html><body style="font-family:sans-serif; padding:40px; text-align:center;"><h2>アクセスできません</h2><p>URLの末尾に ?key=あなたの管理パスコード を付けてください</p></body></html>');
    return;
  }

  try {
    const listKey = 'passcode_list';
    const raw = await kvCommand(['GET', listKey]);
    const list = raw ? JSON.parse(raw) : [];

    const rows = list.map((item) => `
      <tr>
        <td style="padding:10px; border-bottom:1px solid #eee; font-family:monospace; font-weight:bold; font-size:16px;">${item.code}</td>
        <td style="padding:10px; border-bottom:1px solid #eee; color:#666;">${item.email}</td>
        <td style="padding:10px; border-bottom:1px solid #eee;"><span style="font-size:11px; padding:2px 8px; border-radius:10px; background:${item.tier === 'basic' ? '#FBF3EA' : '#E8F0F5'}; color:${item.tier === 'basic' ? '#D4874A' : '#3A6B96'};">${item.tier === 'basic' ? 'プチ課金' : '本契約'}</span></td>
        <td style="padding:10px; border-bottom:1px solid #eee; color:#999; font-size:13px;">${item.stamp}</td>
        <td style="padding:10px; border-bottom:1px solid #eee;"><button onclick="navigator.clipboard.writeText('${item.code}'); this.innerText='コピー済み';" style="padding:6px 12px; background:#D4874A; color:#fff; border:none; border-radius:6px; cursor:pointer;">コピー</button></td>
      </tr>`).join('');

    res.status(200).send(`
      <!DOCTYPE html>
      <html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
      <title>発行済みパスコード一覧</title></head>
      <body style="font-family:sans-serif; padding:20px; max-width:700px; margin:0 auto;">
        <h2>発行済みパスコード一覧</h2>
        <p style="color:#666; font-size:13px;">決済完了時に自動発行されたコードです。お客様にLINEで送るコードをここからコピーしてください。</p>
        <table style="width:100%; border-collapse:collapse; margin-top:16px;">
          <thead><tr style="background:#f4f4f4;">
            <th style="padding:10px; text-align:left;">コード</th>
            <th style="padding:10px; text-align:left;">メール</th>
            <th style="padding:10px; text-align:left;">プラン</th>
            <th style="padding:10px; text-align:left;">発行日時</th>
            <th style="padding:10px; text-align:left;"></th>
          </tr></thead>
          <tbody>${rows || '<tr><td colspan="5" style="padding:20px; text-align:center; color:#999;">まだ発行されたコードはありません</td></tr>'}</tbody>
        </table>
      </body></html>
    `);
  } catch (err) {
    res.status(500).send('エラー: ' + err.message);
  }
}
