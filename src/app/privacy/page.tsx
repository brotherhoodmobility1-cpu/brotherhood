import type { ReactNode } from "react";

export const metadata = { title: "Privacy policy · Brotherhood Mobility" };

const H = ({ children }: { children: ReactNode }) => <h2 style={{ marginTop: 22 }}>{children}</h2>;

export default function PrivacyPage() {
  return (
    <main style={{ maxWidth: 760, margin: "0 auto", padding: "24px 18px 60px", lineHeight: 1.6 }}>
      <h1>Privacy policy</h1>
      <p className="mute">Brotherhood Mobility · last updated 29 September 2026</p>
      <p>
        This policy explains what information the Brotherhood Mobility app collects when you rent an electric scooter from us,
        why we collect it, and how we protect it. By using the app you agree to this policy.
      </p>

      <H>Information we collect</H>
      <ul>
        <li><b>Your details:</b> name, mobile number and address.</li>
        <li><b>Identity and work documents</b> you upload: driving licence, Aadhaar or other ID, PAN card and gig work ID.</li>
        <li><b>Photos:</b> of the scooter, your helmet, a selfie with the scooter, and photos taken when a scooter is handed over, returned or repaired.</li>
        <li><b>Location:</b> your phone&apos;s location while the app is open during your rental, to keep the scooter safe and help you quickly in a breakdown.</li>
        <li><b>Payments:</b> amounts you pay, receipt numbers, UPI references and payment screenshots you upload. We do not collect card or bank account numbers.</li>
        <li><b>Rental records:</b> your signed rental agreement, rent, wallet balance, breakdown reports and repair records.</li>
      </ul>

      <H>How we use it</H>
      <ul>
        <li>To verify your identity and rent you a scooter.</li>
        <li>To manage your rental: rent, wallet, receipts, reminders, breakdowns and returns.</li>
        <li>To send you payment reminders, receipts and service messages, including on WhatsApp.</li>
        <li>To protect our scooters and to help you if the scooter breaks down.</li>
        <li>To meet legal requirements, such as reporting theft or an accident to the police.</li>
      </ul>

      <H>Who can see it</H>
      <p>
        Only Brotherhood Mobility owners and staff can see your information. Our mechanic can see your name and mobile number for repair jobs on your scooter.
        We do not sell your information. We share it only when the law requires it (for example with the police) or with service providers
        that run the app for us (secure database and hosting providers), who may only use it to provide that service.
      </p>

      <H>How we protect it</H>
      <p>
        Your information is stored in a secure database with access controls. Documents and photos are stored privately and are only shown through
        short-lived secure links. Access to the app needs your mobile number and password.
      </p>

      <H>How long we keep it</H>
      <p>
        We keep your information for as long as you rent from us and for up to 3 years afterwards, for accounts, legal and insurance purposes, unless the law requires otherwise.
      </p>

      <H>Your choices</H>
      <ul>
        <li>You can ask us for a copy of your information, or ask us to correct it.</li>
        <li>You can ask us to delete your information after your rental has ended and all payments are settled, except records we must keep by law.</li>
        <li>Location sharing is a condition of renting a scooter (rental agreement point 14). You can turn it off in your phone&apos;s settings, but we may then contact you or take the scooter back.</li>
      </ul>

      <H>Contact us</H>
      <p>Brotherhood Mobility, Gurugram, Haryana, India. Email: brotherhood1@gmail.com</p>
      <p className="mute">If you have a question or complaint about your information, contact us and we will reply within 30 days.</p>
    </main>
  );
}
