import type { Metadata } from "next";
import { Contact, LegalPage, supportContact } from "@/components/site/legal";

export const metadata: Metadata = { title: "Privacy Policy" };
// (the support contact and prices from the admin, re-read every 5 minutes)
export const revalidate = 300;

// What MotionDots keeps about a customer, why, who else processes it, and how to have it deleted.
export default async function PrivacyPage() {
  const contact = await supportContact();
  return (
    <LegalPage title="Privacy Policy">
      <p>This policy explains what information MotionDots collects, why, who processes it for us, and the choices you have. We don&apos;t sell your information and we don&apos;t show ads.</p>

      <h2>1. What we collect</h2>
      <ul>
        <li><b>Your account:</b> your email address, your name if you give it, and your password (stored only as a secure hash by our login provider).</li>
        <li><b>What you give us to make a video:</b> scripts, voice recordings, logos, pictures, your website address, and the brand kits you save (name, colour, logo, website, phone number, tagline).</li>
        <li><b>Pictures of your website:</b> when you give a website address, we visit that public page and take pictures of it for your video.</li>
        <li><b>The videos we make for you</b>, and the voice audio made for them.</li>
        <li><b>Payments:</b> the method (bKash, Nagad or Rocket), the amount, the number you sent from, and the transaction ID. We never see your wallet PIN or password — never share them with anyone, including us.</li>
        <li><b>Usage:</b> your credit balance and history, the videos you made, and basic technical logs (such as errors and the time of a request) to keep the service working and safe.</li>
      </ul>

      <h2>2. Why we use it</h2>
      <ul>
        <li>To make, store and deliver your videos.</li>
        <li>To run your account, add the credits you pay for, and answer your questions.</li>
        <li>To prevent abuse and fraud, and to fix problems.</li>
        <li>To improve the service — for example, how well the timing follows a voice.</li>
      </ul>

      <h2>3. Who processes it for us</h2>
      <p>We use trusted companies to run MotionDots. They process your information only to provide their service to us:</p>
      <ul>
        <li><b>Supabase</b> — our database, file storage and login.</li>
        <li><b>Vercel</b> — hosting the website and making the video files.</li>
        <li><b>AI providers</b> — Google (Gemini), OpenAI, Anthropic (Claude) and fal. Your script, and your voice recording if you upload one, is sent to the provider we use at the time — to plan the scenes, to create the voice, and to time the scenes to the voice.</li>
      </ul>
      <p>These companies may store and process data on servers outside Bangladesh. We share information with others only if the law requires it, or to protect our users or the service.</p>

      <h2>4. Cookies</h2>
      <p>We use only the cookies needed to keep you logged in. We don&apos;t use advertising or tracking cookies.</p>

      <h2>5. How long we keep it</h2>
      <p>We keep your account, your content and your videos while your account is open, so you can download your videos again. Payment records are kept as long as we need them for our accounts. When you ask us to delete your account, we delete your content and videos, and keep only what we must for payments and the law.</p>

      <h2>6. Your choices</h2>
      <ul>
        <li>You can see and download your videos, and edit or remove your brand kits, at any time.</li>
        <li>You can ask us for a copy of your information, to correct it, or to delete your account and your content.</li>
      </ul>

      <h2>7. Security</h2>
      <p>Your files are stored privately and shown only to you through short-lived links. Our API keys are kept encrypted. No system is perfectly secure; if we learn of a problem that affects you, we will tell you.</p>

      <h2>8. Children</h2>
      <p>MotionDots is not meant for children under 13, and we don&apos;t knowingly collect their information.</p>

      <h2>9. Changes and contact</h2>
      <p>
        We may update this policy and will show the new date at the top. Questions, or a request about your information: <Contact {...contact} />.
      </p>
    </LegalPage>
  );
}
