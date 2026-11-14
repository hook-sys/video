# MotionDots — নিজের সার্ভারে (VPS) চালানোর নির্দেশিকা

এই ফোল্ডারে যা আছে:

| ফাইল | কাজ |
|---|---|
| `setup.sh` | নতুন সার্ভার একবার প্রস্তুত করে: Node 22, Caddy (HTTPS), pm2, ffmpeg, বাংলা ফন্ট, ভিডিও রেন্ডারের জন্য Chrome-এর দরকারি জিনিস, ফায়ারওয়াল, ৪ GB swap |
| `deploy.sh` | নতুন কোড চালু করে: কোড টানা, প্যাকেজ, বিল্ড, রিস্টার্ট (প্রতিবার আপডেটে এটাই চালাবেন) |
| `ecosystem.config.cjs` | pm2-এর সেটিং: সাইট সবসময় চালু রাখে, সার্ভার রিস্টার্ট হলেও |
| `Caddyfile` | ডোমেইন, ফ্রি HTTPS সার্টিফিকেট, ক্যাশ |
| `env.example` | কোন কোন গোপন মান লাগবে তার তালিকা (মান ছাড়া) |

> গোপন মান (চাবি, পাসওয়ার্ড) কখনো চ্যাটে, GitHub-এ বা কাউকে পাঠাবেন না। শুধু সার্ভারের `.env.production` ফাইলে বসাবেন।

---

## ১. সার্ভার কেনা

- **অঞ্চল: মুম্বাই (Mumbai / ap-south-1)** — Supabase ডাটাবেস মুম্বাইতে, তাই সার্ভারও সেখানে। এতে প্রতিটা পেজ দ্রুত খুলবে।
- **সিস্টেম:** Ubuntu 24.04
- **কমপক্ষে:** ৪ vCPU, ৮ GB RAM, ৮০ GB SSD। ভিডিও বেশি হলে ৮ vCPU।
- কেনার পর পাবেন: সার্ভারের **IP** আর **root** লগইন।

## ২. ডোমেইন সার্ভারের দিকে

ডোমেইনের DNS-এ দুটো **A record** দিন, দুটোই সার্ভারের IP-তে:
- `@` → সার্ভারের IP
- `www` → সার্ভারের IP

(Cloudflare ব্যবহার করলে প্রথমে কমলা মেঘ বন্ধ রাখুন — "DNS only" — যতক্ষণ না HTTPS চালু হয়।)

## ৩. সার্ভার প্রস্তুত করা (একবারই)

নিজের কম্পিউটার থেকে সার্ভারে ঢুকুন:

```bash
ssh root@সার্ভারের-IP
```

তারপর এই ফাইলটা নামিয়ে চালান (রিপো প্রাইভেট হলে ফাইলটা কপি-পেস্ট করে `setup.sh` নামে বানিয়ে নিন):

```bash
bash setup.sh
```

শেষে একটা লাইন দেখাবে যেটা `ssh-ed25519 ...` দিয়ে শুরু — এটা সার্ভারের **পাবলিক চাবি** (গোপন না)।
GitHub-এ রিপো → **Settings → Deploy keys → Add deploy key** → এটা পেস্ট করুন, **Allow write access বন্ধ** রাখুন।

## ৪. কোড নামানো

```bash
sudo -iu motiondots
git clone git@github.com:hook-sys/video.git app
cd app
```

> নতুন ডিজাইন, ট্রায়াল আর এই VPS-এর ফাইলগুলো এখনো PR #45-এ, main-এ মার্জ হয়নি। মার্জের আগে চালাতে চাইলে:
> `git checkout claude/eloquent-shannon-nnjoei`
> মার্জের পরে: `git checkout main`

## ৫. গোপন মানগুলো বসানো

```bash
cp deploy/env.example .env.production
nano .env.production
```

Vercel → Project → **Settings → Environment Variables** থেকে একই মানগুলো বসান। নতুন দুটো মান নিজে বানান:

```bash
openssl rand -hex 32   # এটা IP_HASH_SECRET-এ
openssl rand -hex 32   # এটা CRON_SECRET-এ
```

সেভ: `Ctrl+O`, `Enter`, `Ctrl+X`।

## ৬. চালু করা

```bash
bash deploy/deploy.sh
```

প্রথমবার ৫–১০ মিনিট লাগবে (প্যাকেজ, Chrome আর বিল্ড নামে)। শেষে লেখা আসবে **Live**।
পরীক্ষা: `curl -I http://127.0.0.1:3000` → `200` এলে ঠিক আছে।

## ৭. HTTPS (Caddy)

`exit` দিয়ে আবার root-এ ফিরে:

```bash
cp /home/motiondots/app/deploy/Caddyfile /etc/caddy/Caddyfile
nano /etc/caddy/Caddyfile        # motiondots.com-এর জায়গায় আপনার ডোমেইন (দুই জায়গায়)
systemctl reload caddy
```

১–২ মিনিটে `https://আপনার-ডোমেইন` খুলবে, সার্টিফিকেট Caddy নিজেই নেয় আর নবায়ন করে।

## ৮. Supabase-এ যা বদলাতে হবে

Supabase ড্যাশবোর্ড → আপনার প্রজেক্ট:

1. **Authentication → URL Configuration**
   - **Site URL:** `https://আপনার-ডোমেইন`
   - **Redirect URLs**-এ যোগ করুন: `https://আপনার-ডোমেইন/auth/callback`
2. **Authentication → Emails → SMTP Settings** — নিজের ইমেইল পাঠানোর সার্ভিস বসান (যেমন Resend, Brevo, Zoho)। Supabase-এর নিজেরটা ঘণ্টায় মাত্র কয়েকটা ইমেইল পাঠায়, তাই **ইমেইল ভেরিফিকেশন চালু করলে এটা অবশ্যই লাগবে**।
3. **Authentication → Sign In / Providers → Email → Confirm email** চালু রাখুন।
4. ইমেইলের লেখায় কোথাও MotionBrief থাকলে MotionDots করে দিন (Authentication → Emails → Templates)।
5. ডাটাবেসের নতুন পরিবর্তন (মাইগ্রেশন `20261114000039_trial_and_signup_ip.sql`) — এটা Claude আপনার অনুমতি নিয়ে চালাবে।

## ৯. অ্যাডমিনে যা দেখে নেবেন

- **/admin/settings**
  - Email verification → **চালু**
  - One account per network → **চালু**
  - Support email → আপনার ইমেইল (MotionBrief থাকলে বদলান)
- **/admin/billing**
  - Welcome credits → **0** (নতুন ইউজার ট্রায়াল পায়, ক্রেডিট লাগে না)
  - Free trial videos → **3**
  - Longest free trial video → **20** সেকেন্ড
  - bKash / Nagad / Rocket নম্বর আর টাকার রেট

## ১০. পরে আপডেট

নতুন কোড main-এ (বা যে ব্রাঞ্চে আছেন) গেলে:

```bash
sudo -iu motiondots
bash app/deploy/deploy.sh
```

## কাজের কমান্ড

| কী দেখতে চান | কমান্ড (motiondots ইউজার হিসেবে) |
|---|---|
| সাইটের লগ | `pm2 logs motiondots` |
| চালু আছে কি না | `pm2 status` |
| রিস্টার্ট | `pm2 restart motiondots` |
| Caddy-র লগ (root) | `journalctl -u caddy -n 100` |
| ডিস্ক | `df -h` |

## জেনে রাখুন

- ভিডিও এখন এই সার্ভারেই তৈরি হয় (`RENDER_MODE=local`), একবারে একটা — প্রতিটা সব CPU ব্যবহার করে, বাকিগুলো লাইনে অপেক্ষা করে। তাই pm2-তে একটাই কপি চলে (`instances: 1`), এটা বাড়াবেন না।
- সার্ভার রিস্টার্টের সময় চলতি রেন্ডার হারিয়ে যায়; ৩০ মিনিট পরে সেটা "failed" হয়ে যায়, আর ইউজারের পেজ থেকে আবার শুরু হতে পারে।
- Supabase-এর ফ্রি প্ল্যান যেন ঘুমিয়ে না পড়ে, `deploy.sh` প্রতিদিন একবার নিজে নিজে সংযোগ করার ব্যবস্থা (cron) বসিয়ে দেয়।
- Vercel চাইলে ব্যাকআপ হিসেবে রেখে দিতে পারেন; ডোমেইন যেদিকে, সাইট সেদিক থেকেই আসবে।
- Remotion একটা কোম্পানির কাজে ব্যবহার হলে (৩ জনের বেশি কর্মী থাকলে) তাদের লাইসেন্স লাগে — remotion.dev/license দেখে নিন।
