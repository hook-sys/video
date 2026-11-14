import type { Metadata } from "next";
import { Contact, LegalPage, supportContact } from "@/components/site/legal";

export const metadata: Metadata = { title: "Refund Policy" };
// (the support contact and prices from the admin, re-read every 5 minutes)
export const revalidate = 300;

// When credits come back on their own, and when loaded money is returned.
export default async function RefundPage() {
  const contact = await supportContact();
  return (
    <LegalPage title="Refund Policy">
      <p>MotionDots is pay per use: you load credits and each video uses some. This page explains when credits come back to your balance and when we return money.</p>

      <h2>1. Credits come back automatically when</h2>
      <ul>
        <li><b>A video fails</b> to be made: all its credits are returned to your balance.</li>
        <li><b>A video is shorter</b> than estimated: the difference is returned when it is made.</li>
        <li><b>We refuse a video</b> (for example, content we can&apos;t make): its credits are returned, unless the account broke our Terms on purpose.</li>
      </ul>

      <h2>2. When a video isn&apos;t right</h2>
      <p>If a video has a clear fault on our side — for example the voice is cut, a scene is blank, or the words don&apos;t match the script — tell us within 7 days and we will make it again or return its credits. A change of mind about the script, the voice or the style is not a fault.</p>

      <h2>3. Payments</h2>
      <ul>
        <li><b>A payment we can&apos;t confirm</b> (the transaction ID isn&apos;t in our account) is not credited. If you believe it was sent, contact us with the transaction details.</li>
        <li><b>A wrong or double payment</b> (you sent more than once, or the wrong amount) is returned to the number it came from once we confirm it, or added as credits if you prefer.</li>
        <li><b>Unused credits:</b> within 7 days of loading, you can ask for the unused credits from that load to be returned as money, to the number the payment came from. After 7 days, or once credits from a load are used, they can&apos;t be returned as money.</li>
        <li>Fees charged by the mobile wallet to send a refund are taken from the amount returned.</li>
        <li>Welcome credits and credits from promotional codes can&apos;t be returned as money.</li>
      </ul>

      <h2>4. How long it takes</h2>
      <p>We answer refund requests within 3 working days. An approved money refund is sent within 7 working days.</p>

      <h2>5. Credits don&apos;t expire</h2>
      <p>Credits you load stay in your balance while your account is open. If we close MotionDots, we will tell you in advance and return the money for unused loaded credits.</p>

      <h2>6. Ask for a refund</h2>
      <p>
        Contact us at <Contact {...contact} /> with your account email, the transaction ID and what happened.
      </p>
    </LegalPage>
  );
}
