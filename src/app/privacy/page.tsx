export const metadata = {
  title: "Privacy Policy – Brotherhood Mobility",
  description: "How Brotherhood Mobility collects, uses and protects your data.",
};

const CONTACT_EMAIL = "brotherhoodmobility1@gmail.com";
const CONTACT_PHONE = "+91 9990452277, +91 9990452266";
const LAST_UPDATED = "01/10/26";

const s = {
  page: { maxWidth: 720, margin: "0 auto", padding: "40px 20px 80px", fontFamily: "system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif", color: "#1f2933", lineHeight: 1.65, fontSize: 16, background: "#ffffff" },
  h1: { fontSize: 30, margin: "0 0 4px", lineHeight: 1.2 },
  date: { color: "#5f6b7a", margin: "0 0 32px", fontSize: 14 },
  h2: { fontSize: 20, margin: "32px 0 8px" },
  ul: { paddingLeft: 22, margin: "8px 0" },
  li: { margin: "4px 0" },
  a: { color: "#1a56db" },
};

export default function PrivacyPolicy() {
  return (
    <main style={s.page}>
      <h1 style={s.h1}>Privacy Policy</h1>
      <p style={s.date}>Last updated: {LAST_UPDATED}</p>

      <p>Brotherhood Mobility ("we", "us") rents electric scooters in Delhi NCR. This policy explains what information our app (the "Brotherhood Mobility" app and app.brotherhoodmobility.in) collects, why we collect it, and how you can control it. By using the app you agree to this policy.</p>

      <h2 style={s.h2}>Who is responsible</h2>
      <p>Brotherhood Mobility, owned and operated by Daksh Mehra and Ashish Thakran. Contact: <a style={s.a} href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>, {CONTACT_PHONE}.</p>

      <h2 style={s.h2}>Information we collect</h2>
      <ul style={s.ul}>
        <li style={s.li}><b>Account details:</b> name, mobile number and password (stored encrypted).</li>
        <li style={s.li}><b>Identity documents:</b> ID proof such as Aadhaar card and driving licence, address proof, and a selfie, used to verify riders before handing over a scooter.</li>
        <li style={s.li}><b>Rental records:</b> scooter allotted, chassis number, start date, rent, security deposit, signed rental agreement, and scooter photos taken at handover and return.</li>
        <li style={s.li}><b>Payment records:</b> payment amounts, dates, and the UPI payment receipts you upload. We do not collect or store your bank account, card or UPI PIN. Payments are made directly from your own UPI app.</li>
        <li style={s.li}><b>Location:</b> your device location while you use the app, to keep track of our scooters and help you during breakdowns.</li>
        <li style={s.li}><b>Breakdown and service records:</b> breakdown reports, photos, repair work and spare parts used.</li>
        <li style={s.li}><b>Enquiries:</b> name, phone number and details submitted through the "Join Brotherhood Mobility" form.</li>
        <li style={s.li}><b>Camera and photos:</b> used only when you choose to take or upload a photo, document or receipt.</li>
      </ul>

      <h2 style={s.h2}>How we use your information</h2>
      <ul style={s.ul}>
        <li style={s.li}>To verify your identity and create your rental agreement.</li>
        <li style={s.li}>To manage your rental, rent dues, wallet and payments.</li>
        <li style={s.li}>To send you rent reminders, receipts and service updates on WhatsApp or by phone.</li>
        <li style={s.li}>To locate and protect our scooters, and to help you in a breakdown.</li>
        <li style={s.li}>To handle repairs, damage and security deposit adjustments.</li>
        <li style={s.li}>To follow the law and resolve disputes.</li>
      </ul>
      <p>We do not sell your personal information. We do not show ads in the app.</p>

      <h2 style={s.h2}>Who can see your information</h2>
      <ul style={s.ul}>
        <li style={s.li}>Our owners, staff and mechanics, only as needed for their work.</li>
        <li style={s.li}>Service providers that run the app for us: Supabase (database and file storage, servers in India), Vercel (website hosting), and WhatsApp (for messages).</li>
        <li style={s.li}>Police or government authorities, when the law requires it, or in case of theft, accident or misuse of a scooter.</li>
      </ul>

      <h2 style={s.h2}>How long we keep it</h2>
      <p>We keep your information while your rental is active and for up to 3 years after it ends, for accounting, legal and dispute purposes. After that we delete it or make it anonymous. Enquiry details from people who do not become riders are deleted within 12 months.</p>

      <h2 style={s.h2}>How we protect it</h2>
      <p>Data is sent over secure connections (HTTPS), passwords are encrypted, and each user can only see what their role allows. No system is fully secure, but we take reasonable steps to protect your information.</p>

      <h2 style={s.h2}>Your rights</h2>
      <p>Under India's Digital Personal Data Protection Act, 2023, you can ask us to see, correct or delete your information, or withdraw your consent. Contact us at <a style={s.a} href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a> or {CONTACT_PHONE}. We will reply within 30 days. Some records may need to be kept until any pending rent, damage or legal matter is settled.</p>

      <h2 style={s.h2}>Deleting your account</h2>
      <p>To delete your account and data, send a WhatsApp message or email to us from your registered mobile number with the words "Delete my account". We will delete your account and personal data, except records we must keep by law.</p>

      <h2 style={s.h2}>Age</h2>
      <p>The app is only for people aged 18 and above. We do not knowingly collect data from anyone under 18.</p>

      <h2 style={s.h2}>Changes to this policy</h2>
      <p>We may update this policy. The new version will be posted on this page with a new date.</p>

      <h2 style={s.h2}>Grievance officer</h2>
      <p>Daksh Mehra, Brotherhood Mobility.<br />Email: <a style={s.a} href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a><br />Phone: {CONTACT_PHONE}</p>
    </main>
  );
}
