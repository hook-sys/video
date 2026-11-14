import type { Metadata } from "next";
import Link from "next/link";
import { Contact, LegalPage, supportContact } from "@/components/site/legal";
import { WALLET_NAME, creditsFor, getBilling, walletsOffered } from "@/lib/billing";

export const metadata: Metadata = { title: "Terms of Service" };
// (the support contact and prices from the admin, re-read every 5 minutes)
export const revalidate = 300;

// The terms a customer agrees to when they create an account (the sign-up form links here).
export default async function TermsPage() {
  const [contact, billing] = await Promise.all([supportContact(), getBilling()]);
  const wallets = walletsOffered(billing).map((w) => WALLET_NAME[w]);
  const rate = billing.tiers.standard.perSecond;

  return (
    <LegalPage title="Terms of Service">
      <p>
        These terms are an agreement between you and MotionDots (&ldquo;we&rdquo;, &ldquo;us&rdquo;). By creating an account or using MotionDots you agree to them. If you don&apos;t agree, please don&apos;t use the service.
      </p>

      <h2>1. What MotionDots does</h2>
      <p>MotionDots turns a script (or your own voice recording), your brand and your website into a short motion video. The voice, the scenes and the timing are made by software, including AI models run by other companies (see our <Link href="/privacy" className="text-[#c4b5fd] hover:underline">Privacy Policy</Link>).</p>

      <h2>2. Your account</h2>
      <ul>
        <li>You must be at least 18 years old, or have the permission of a parent or guardian, to make an account and to pay.</li>
        <li>Give a real email address and keep your password secret. You are responsible for what is done with your account.</li>
        <li>New accounts may need our approval before they get credits.</li>
        <li>One person or business per account. Don&apos;t create several accounts to collect welcome credits again.</li>
      </ul>

      <h2>3. Credits and payment</h2>
      <ul>
        <li>MotionDots is pay per use. There is no subscription. You load credits and each video uses some of them.</li>
        <li>
          A video costs {billing.baseCredits} credits for up to {billing.baseSeconds} seconds, then {rate} credit{rate === 1 ? "" : "s"} for each second after (a 30-second video is {creditsFor(billing, "standard", 30)} credits). The price is always shown before you make a video, and the credits are settled to the video&apos;s real length when it is made.
        </li>
        <li>
          You load credits by mobile payment{wallets.length ? ` (${wallets.join(", ")})` : ""}: you send the amount to our number and submit your transaction ID. Credits are added after we confirm the payment, usually within a few hours. A payment we can&apos;t find in our account is not credited.
        </li>
        <li>Prices and the price of a credit may change. A change never affects credits you already have or a video already started.</li>
        <li>Welcome credits and credits from promotional codes have no cash value.</li>
        <li>
          Refunds follow our <Link href="/refund" className="text-[#c4b5fd] hover:underline">Refund Policy</Link>.
        </li>
      </ul>

      <h2>4. Your content</h2>
      <ul>
        <li>You keep the rights to everything you upload (scripts, recordings, logos, pictures) and to the videos made for you. You may use your videos for any lawful purpose, including advertising.</li>
        <li>You give us permission to store and process your content only to make, show and deliver your videos and to run the service.</li>
        <li>You confirm you have the right to use what you upload: the logo and brand are yours or you have permission, and a voice recording is your own voice or you have permission to use it.</li>
      </ul>

      <h2>5. What you may not do</h2>
      <ul>
        <li>Make videos that are illegal, deceptive, hateful, sexual, violent, or that harass or impersonate a person or business.</li>
        <li>Use another company&apos;s name, logo or trademark without permission, or make false claims about products, health, money or investments.</li>
        <li>Try to break, overload or get around the limits or security of the service, or use it to collect other people&apos;s data.</li>
        <li>Submit a payment you did not make, or a transaction ID that isn&apos;t yours.</li>
      </ul>
      <p>We may refuse a video, remove content, or suspend an account that breaks these rules. Credits spent on a refused video are returned unless the account broke the rules on purpose.</p>

      <h2>6. AI-made videos</h2>
      <p>Videos are made automatically. They can contain mistakes — a mispronounced word, a wrong picture, a timing slip. Please watch every video before you publish it. You are responsible for what you publish.</p>

      <h2>7. The service</h2>
      <ul>
        <li>We work to keep MotionDots running but can&apos;t promise it will always be available or error-free. We may change, add or remove features.</li>
        <li>If a video fails to be made, its credits are returned to your balance automatically.</li>
        <li>Keep your own copy of the videos you need: download them after they are made.</li>
      </ul>

      <h2>8. Liability</h2>
      <p>
        MotionDots is provided &ldquo;as is&rdquo;. As far as the law allows, we are not liable for indirect losses (such as lost profit or lost business) from using the service or from a video, and our total liability to you is limited to the amount you paid us in the three months before the claim.
      </p>

      <h2>9. Ending your account</h2>
      <p>You can stop using MotionDots at any time and ask us to delete your account. We may suspend or close an account that breaks these terms. What happens to unused credits is set out in the Refund Policy.</p>

      <h2>10. Changes and law</h2>
      <p>We may update these terms. If a change is important we will tell you by email or on the website before it applies. These terms are governed by the laws of Bangladesh.</p>

      <h2>11. Contact</h2>
      <p>
        Questions about these terms: <Contact {...contact} />.
      </p>
    </LegalPage>
  );
}
