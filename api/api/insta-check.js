export default function handler(req, res) {
  const user = (req.query.user || '').toString();
  res.status(200).json({ ok: true, echo: user });
}
