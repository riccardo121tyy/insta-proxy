export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET");
  res.setHeader("Content-Type", "application/json; charset=utf-8");

  const user = (req.query.user || "").toString().replace(/[^a-zA-Z0-9._]/g, "");
  if (!user) return res.status(400).json({ error: true, message: "Missing user" });

  async function fetchJson(url, ua) {
    const r = await fetch(url, {
      headers: {
        "User-Agent": ua || "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124 Safari/537.36",
        "Accept": "application/json,text/html;q=0.9,*/*;q=0.8",
        "Accept-Language": "it-IT,it;q=0.9,en-US;q=0.8",
        "Referer": "https://www.instagram.com/"
      }
    });
    return { status: r.status, text: await r.text() };
  }

  // A) Mobile web_profile_info
  let r = await fetchJson(`https://i.instagram.com/api/v1/users/web_profile_info/?username=${user}`,
    "Instagram 289.0.0.0.77 Android (30/11; 420dpi; 1080x1920; Google; Pixel 4; flame; qcom; it_IT)");
  try {
    const j = JSON.parse(r.text);
    if (j?.data?.user) {
      const u = j.data.user;
      return res.json({
        full_name: u.full_name || "",
        profile_pic_url: u.profile_pic_url_hd || u.profile_pic_url || "",
        is_private: !!u.is_private,
        via: "A"
      });
    }
  } catch {}

  // B) Web web_profile_info
  r = await fetchJson(`https://www.instagram.com/api/v1/users/web_profile_info/?username=${user}`);
  try {
    const j = JSON.parse(r.text);
    if (j?.data?.user) {
      const u = j.data.user;
      return res.json({
        full_name: u.full_name || "",
        profile_pic_url: u.profile_pic_url_hd || u.profile_pic_url || "",
        is_private: !!u.is_private,
        via: "B"
      });
    }
  } catch {}

  // C) Legacy ?__a=1
  r = await fetchJson(`https://www.instagram.com/${user}/?__a=1&__d=dis`);
  try {
    const j = JSON.parse(r.text);
    if (j?.graphql?.user) {
      const u = j.graphql.user;
      return res.json({
        full_name: u.full_name || "",
        profile_pic_url: u.profile_pic_url_hd || u.profile_pic_url || "",
        is_private: !!u.is_private,
        via: "C"
      });
    }
  } catch {}

  // D) Mirror HTML (parsing og:title/og:image)
  r = await fetchJson(`https://r.jina.ai/http://www.instagram.com/${user}/`);
  const titleMatch = r.text.match(/<meta property="og:title" content="([^"]+)"/i);
  const imgMatch = r.text.match(/<meta property="og:image" content="([^"]+)"/i);
  if (titleMatch || imgMatch) {
    const title = titleMatch ? titleMatch[1] : "";
    const full_name = title ? title.split(" (@")[0].trim() : "";
    const pic = imgMatch ? imgMatch[1] : "";
    const is_private = /"is_private":true|Account is Private/i.test(r.text);
    return res.json({
      full_name,
      profile_pic_url: pic,
      is_private,
      via: "D"
    });
  }

  return res.status(200).json({ error: true, message: "Lookup failed" });
}
