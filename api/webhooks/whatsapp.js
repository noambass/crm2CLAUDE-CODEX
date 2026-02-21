// WhatsApp Business API webhook — stub
// Will be connected to /api/ai/chat in a future iteration
//
// GET  /api/webhooks/whatsapp — webhook verification (required by Meta)
// POST /api/webhooks/whatsapp — incoming messages
export default async function handler(req, res) {
  if (req.method === 'GET') {
    // Meta webhook verification handshake
    const mode = req.query['hub.mode'];
    const token = req.query['hub.verify_token'];
    const challenge = req.query['hub.challenge'];

    if (mode === 'subscribe' && token === process.env.WHATSAPP_VERIFY_TOKEN) {
      return res.status(200).send(challenge);
    }
    return res.status(403).json({ error: 'Forbidden' });
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // TODO: Process incoming WhatsApp messages
  // 1. Validate X-Hub-Signature-256 header
  // 2. Parse webhook payload (req.body.entry[].changes[].value.messages)
  // 3. Extract phone number + message text
  // 4. Call answerBiQuestion or POST to /api/ai/chat logic
  // 5. Send reply via WhatsApp Cloud API

  return res.status(200).json({ status: 'ok' });
}
