export const metadata = {
  title: "Privacy Policy — Digitalytics IIM Ranchi",
  description: "Privacy policy for the WhatsApp education-loan counselling service.",
};

export default function PrivacyPolicyPage() {
  return (
    <div className="min-h-screen bg-[#f7fafb] py-12 px-4">
      <div className="max-w-2xl mx-auto bg-white rounded-xl border border-slate-200 shadow-sm p-8 md:p-10">
        <div className="mb-8">
          <div className="text-xs font-medium text-brand-teal-dark uppercase tracking-wide mb-1">Digitalytics, IIM Ranchi</div>
          <h1 className="text-2xl font-semibold text-slate-900">Privacy Policy</h1>
          <p className="text-sm text-slate-400 mt-1">Last updated: 13 September 2026</p>
        </div>

        <div className="text-sm text-slate-700 space-y-6 leading-relaxed">
          <p>
            This service (&ldquo;the Service&rdquo;) provides an automated education-loan counselling assistant over
            WhatsApp. It is operated by <strong>Digitalytics, IIM Ranchi</strong> (&ldquo;we&rdquo;, &ldquo;us&rdquo;). This
            policy explains what information we collect when you message the Service, how we use it, and the choices you
            have.
          </p>

          <Section title="1. Information we collect">
            <ul className="list-disc pl-5 space-y-1.5">
              <li><strong>Your WhatsApp number and profile name</strong>, as provided by WhatsApp when you message us.</li>
              <li><strong>The messages you send us</strong>, and the automated replies we send back.</li>
              <li>
                <strong>Information you choose to share in conversation</strong> to help us answer your questions — for
                example the country, course, institution, or intake you&apos;re interested in, your current year of study,
                or (only if you choose to check indicative loan eligibility) a co-applicant&apos;s approximate income and
                existing obligations.
              </li>
              <li><strong>Consent and preference records</strong> — whether you&apos;ve agreed to be contacted, and whether you&apos;ve opted out of marketing messages.</li>
            </ul>
            <p className="mt-2">
              We do not ask for, and you should not send us, sensitive documents or identity numbers (such as Aadhaar,
              PAN, or passport scans) over this chat. Any photo or file you send is never opened, viewed, or stored by
              the Service.
            </p>
          </Section>

          <Section title="2. How we use this information">
            <ul className="list-disc pl-5 space-y-1.5">
              <li>To answer your questions and hold a conversation about education financing options.</li>
              <li>To check an indicative, non-binding &ldquo;up to&rdquo; loan eligibility figure, if you ask us to.</li>
              <li>To follow up with you about your education financing journey, within the preferences you&apos;ve set.</li>
              <li>To improve the quality and relevance of our responses.</li>
            </ul>
            <p className="mt-2">
              We do <strong>not</strong> sell your information to anyone, and we do not use it for purposes unrelated to
              the education-financing conversation you&apos;ve had with us.
            </p>
          </Section>

          <Section title="3. Sharing with service providers">
            <p>
              To operate the Service, limited information is processed by the infrastructure providers who deliver it:
            </p>
            <ul className="list-disc pl-5 space-y-1.5 mt-2">
              <li><strong>Meta / WhatsApp Business Platform</strong> — to send and receive your messages.</li>
              <li>
                <strong>Google (Gemini API)</strong> — to generate conversational responses. Where a live web lookup is
                needed (for example, current visa or forex information), a sanitised version of your question — with
                your name, phone number, and any financial figures removed — may be sent to Google&apos;s search
                grounding tool.
              </li>
              <li><strong>Our cloud hosting provider</strong> — to store conversation data securely.</li>
            </ul>
            <p className="mt-2">These providers act on our instructions and do not use your data for their own purposes.</p>
          </Section>

          <Section title="4. Data retention">
            <p>
              We retain conversation data for as long as reasonably needed to provide the Service and follow up on your
              enquiry, or until you ask us to delete it. Consent and opt-out records are retained as evidence of your
              choices.
            </p>
          </Section>

          <Section title="5. Your choices and rights">
            <ul className="list-disc pl-5 space-y-1.5">
              <li>Reply <strong>STOP</strong> at any time to opt out of marketing messages immediately.</li>
              <li>Email us (below) to request a copy of the information we hold about you, or to request its deletion.</li>
              <li>You can stop using the Service at any time by simply not messaging it further.</li>
            </ul>
          </Section>

          <Section title="6. Children">
            <p>
              The Service asks your age before collecting any profile information. If you tell us you are under 18, we
              do not build a profile of you, create a lead record, send you marketing messages, or pass your details to
              a sales team — we only share general information.
            </p>
          </Section>

          <Section title="7. Security">
            <p>
              We use reasonable technical and organisational measures to protect the information you share with us,
              including encrypted connections and access controls on our systems. No method of transmission or storage
              is completely secure, and we cannot guarantee absolute security.
            </p>
          </Section>

          <Section title="8. Changes to this policy">
            <p>
              We may update this policy from time to time. The &ldquo;Last updated&rdquo; date at the top of this page
              reflects the most recent revision.
            </p>
          </Section>

          <Section title="9. Contact us">
            <p>
              For any privacy question, or to request access to or deletion of your data, email{" "}
              <a href="mailto:goswamiayush7@gmail.com" className="text-brand-teal-dark hover:underline">
                goswamiayush7@gmail.com
              </a>
              .
            </p>
          </Section>
        </div>
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <h2 className="text-base font-semibold text-slate-900 mb-2">{title}</h2>
      {children}
    </section>
  );
}
