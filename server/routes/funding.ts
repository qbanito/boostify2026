import { Router } from 'express';
import { z } from 'zod';
import { db } from '../firebase';
import { isAuthenticated } from '../middleware/clerk-auth';
import { sendNotificationEmail, sendTransactionalEmail } from '../services/brevo-email-service';

const router = Router();
const emailSchema = z.string().email().max(254);
const fundingDraftSchema = z.object({
  profileType: z.string().max(80), artistName: z.string().max(120), country: z.string().max(100), entityType: z.string().max(80), yearsActive: z.string().max(20),
  releasedSongs: z.string().max(20), catalogYears: z.string().max(20), distributor: z.string().max(120),
  masterOwnership: z.string().max(20), publishingOwnership: z.string().max(20), hasAdvance: z.string().max(20), musicRevenueStatus: z.string().max(20),
  existingObligations: z.string().max(20), rightsRegistered: z.string().max(20), splitsOrganized: z.string().max(20),
  monthlyRevenue: z.string().max(40), monthsHistory: z.string().max(20), growth: z.string().max(20),
  amount: z.string().max(40), purpose: z.string().max(120),
}).strict();
const applicationSchema = z.object({
  artistName: z.string().trim().min(1).max(120),
  country: z.string().trim().max(100).optional(),
  amount: z.string().trim().max(40).optional(),
  purpose: z.string().trim().max(120).optional(),
  readinessScore: z.number().int().min(0).max(100),
  agreementsReviewed: z.literal(false),
  form: fundingDraftSchema,
});
const meetingSchema = z.object({
  artistName: z.string().trim().min(1).max(120),
  topic: z.string().trim().min(1).max(500),
  availability: z.string().trim().min(1).max(500),
});

const escapeHtml = (value: string) => value.replace(/[&<>"']/g, char => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
}[char]!));

const fundingInbox = 'convoycubano@gmail.com';
const fundingAppUrl = (process.env.PRODUCTION_URL || 'https://boostifymusic.com').replace(/\/$/, '');

type FundingEmailContent = {
  preview: string;
  eyebrow: string;
  title: string;
  greeting: string;
  paragraphs: string[];
  details: Array<[string, string]>;
  nextSteps: string[];
};

function buildFundingEmail(content: FundingEmailContent) {
  const detailRows = content.details.map(([label, value]) => `
    <tr>
      <td style="padding:12px 0;border-bottom:1px solid #e7e9ee;color:#667085;font-size:13px;line-height:20px;width:38%;vertical-align:top">${escapeHtml(label)}</td>
      <td style="padding:12px 0;border-bottom:1px solid #e7e9ee;color:#182230;font-size:14px;line-height:20px;font-weight:600;vertical-align:top;word-break:break-word">${escapeHtml(value)}</td>
    </tr>`).join('');
  const paragraphs = content.paragraphs.map(paragraph => `<p style="margin:0 0 14px;color:#475467;font-size:15px;line-height:25px">${escapeHtml(paragraph)}</p>`).join('');
  const nextSteps = content.nextSteps.map((step, index) => `
    <tr>
      <td style="width:34px;padding:0 0 12px;vertical-align:top"><span style="display:inline-block;width:24px;height:24px;border-radius:12px;background:#fff1e8;color:#c2410c;text-align:center;line-height:24px;font-size:12px;font-weight:700">${index + 1}</span></td>
      <td style="padding:2px 0 12px;color:#475467;font-size:14px;line-height:22px">${escapeHtml(step)}</td>
    </tr>`).join('');

  const html = `<!doctype html>
  <html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escapeHtml(content.title)}</title></head>
  <body style="margin:0;padding:0;background:#f3f4f6;font-family:Arial,Helvetica,sans-serif;color:#182230">
    <div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent">${escapeHtml(content.preview)}&#847;&nbsp;&#847;&nbsp;&#847;</div>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#f3f4f6;padding:32px 12px">
      <tr><td align="center">
        <table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" style="width:100%;max-width:600px;background:#ffffff;border:1px solid #e7e9ee;border-radius:18px;overflow:hidden">
          <tr><td style="height:6px;background:#f97316;font-size:0;line-height:0">&nbsp;</td></tr>
          <tr><td style="padding:25px 32px;border-bottom:1px solid #eef0f3">
            <p style="margin:0;color:#101828;font-size:16px;line-height:22px;font-weight:800;letter-spacing:1.2px">BOOSTIFY <span style="color:#ea580c">CAPITAL</span></p>
            <p style="margin:5px 0 0;color:#667085;font-size:12px;line-height:18px">Music finance, made clearer</p>
          </td></tr>
          <tr><td style="padding:32px">
            <p style="margin:0 0 10px;color:#c2410c;font-size:11px;line-height:16px;font-weight:700;letter-spacing:1.5px;text-transform:uppercase">${escapeHtml(content.eyebrow)}</p>
            <h1 style="margin:0 0 18px;color:#101828;font-size:28px;line-height:35px;letter-spacing:-.4px">${escapeHtml(content.title)}</h1>
            <p style="margin:0 0 14px;color:#344054;font-size:15px;line-height:24px;font-weight:600">${escapeHtml(content.greeting)}</p>
            ${paragraphs}
            ${content.details.length ? `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:22px 0 26px;padding:4px 18px;background:#f8f9fb;border:1px solid #eaecf0;border-radius:12px">${detailRows}</table>` : ''}
            <p style="margin:0 0 12px;color:#101828;font-size:14px;line-height:20px;font-weight:700">What happens next</p>
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">${nextSteps}</table>
            <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:18px 0 0"><tr><td align="center" bgcolor="#f97316" style="border-radius:9px">
              <a href="${fundingAppUrl}/funding/status" style="display:inline-block;padding:13px 20px;border:1px solid #f97316;border-radius:9px;color:#111827;font-size:14px;line-height:20px;font-weight:700;text-decoration:none">Open your Funding workspace</a>
            </td></tr></table>
            <p style="margin:22px 0 0;padding:14px 16px;background:#fff7ed;border-left:3px solid #f97316;color:#7c2d12;font-size:12px;line-height:19px">Your application remains with Boostify. It is not shared with funding partners unless the required agreements are reviewed and verified signatures are in place.</p>
          </td></tr>
          <tr><td style="padding:20px 32px;background:#f8f9fb;border-top:1px solid #eef0f3">
            <p style="margin:0;color:#667085;font-size:12px;line-height:19px">Questions? Reply to this email or contact <a href="mailto:support@boostifymusic.com" style="color:#c2410c;text-decoration:underline">Boostify Support</a>.</p>
            <p style="margin:10px 0 0;color:#98a2b3;font-size:11px;line-height:17px">This is a transactional update about your Funding request. © Boostify Music</p>
          </td></tr>
        </table>
      </td></tr>
    </table>
  </body></html>`;
  const textContent = [content.greeting, ...content.paragraphs, ...content.details.map(([label, value]) => `${label}: ${value}`), 'What happens next:', ...content.nextSteps, `Your Funding workspace: ${fundingAppUrl}/funding/status`, 'Your application remains with Boostify unless the required agreements are reviewed and verified signatures are in place.', 'Questions? support@boostifymusic.com'].join('\n\n');
  return { html, textContent };
}

async function notifyFundingTeam(subject: string, title: string, message: string) {
  return sendNotificationEmail(fundingInbox, subject, title, message);
}

router.get('/draft', isAuthenticated, async (req: any, res) => {
  try {
    const snapshot = await db.collection('fundingApplicationDrafts').doc(req.user.clerkUserId).get();
    if (!snapshot.exists) return res.status(200).json({ success: true, form: null, updatedAt: null });
    const data = snapshot.data();
    return res.status(200).json({ success: true, form: data?.form ?? null, updatedAt: data?.updatedAt ?? null });
  } catch (error) {
    console.error('[Funding] Could not load the private draft:', error);
    return res.status(500).json({ error: 'We could not load your saved Funding draft.' });
  }
});

router.put('/draft', isAuthenticated, async (req: any, res) => {
  const parsed = fundingDraftSchema.safeParse(req.body?.form);
  if (!parsed.success) return res.status(400).json({ error: 'Funding draft fields are invalid.' });
  try {
    const updatedAt = new Date().toISOString();
    await db.collection('fundingApplicationDrafts').doc(req.user.clerkUserId).set({
      userId: req.user.clerkUserId,
      form: parsed.data,
      updatedAt,
    });
    return res.status(200).json({ success: true, updatedAt });
  } catch (error) {
    console.error('[Funding] Could not save the private draft:', error);
    return res.status(500).json({ error: 'We could not save your Funding draft.' });
  }
});

router.post('/application-request', isAuthenticated, async (req: any, res) => {
  const parsed = applicationSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'Please complete the required funding fields.' });
  const applicantEmail = req.user?.email;
  if (!applicantEmail || !emailSchema.safeParse(applicantEmail).success) {
    return res.status(400).json({ error: 'Add a verified email to your account before requesting a review.' });
  }

  try {
    const createdAt = new Date().toISOString();
    await db.collection('fundingApplicationDrafts').doc(req.user.clerkUserId).set({
      userId: req.user.clerkUserId,
      form: parsed.data.form,
      updatedAt: createdAt,
    });
    const { form, ...applicationSummary } = parsed.data;
    const record = { ...applicationSummary, userId: req.user.clerkUserId, email: applicantEmail, status: 'awaiting_agreements', createdAt };
    const saved = await db.collection('fundingApplications').add(record);
    const safeArtist = escapeHtml(parsed.data.artistName);
    const safeAmount = escapeHtml(parsed.data.amount || 'Not provided');
    const teamEmail = await notifyFundingTeam('New Boostify Funding review request', 'Funding review requested',
      `Artist: ${safeArtist}<br/>Email: ${escapeHtml(applicantEmail)}<br/>Profile: ${escapeHtml(parsed.data.form.profileType || 'Not provided')}<br/>Exploring: ${safeAmount}<br/>Readiness estimate: ${parsed.data.readinessScore}/100<br/><br/>Status: awaiting counsel-reviewed agreements and verified signatures. No partner data has been shared.`);
    const applicantReceipt = buildFundingEmail({
      preview: 'Your private request is saved. Here is what happens next.',
      eyebrow: 'Request received',
      title: 'Your next chapter starts with a clear picture.',
      greeting: `Hi ${parsed.data.artistName},`,
      paragraphs: [
        'We received your Boostify Funding request and saved your profile securely. Our team will review the information and follow up with guidance on next steps.',
        'You can return to your Funding workspace any time to review or update your profile.'
      ],
      details: [
        ['Music profile', parsed.data.form.profileType || 'Not provided'],
        ['Exploring', parsed.data.amount ? `$${parsed.data.amount}` : 'To be discussed'],
        ['Focus', parsed.data.purpose || 'Funding readiness review']
      ],
      nextSteps: [
        'The Boostify team reviews the details you shared.',
        'We contact you if anything needs clarification or if a conversation would help.',
        'Any partner review happens only after the required agreements and verified signatures are in place.'
      ]
    });
    const applicantEmailResult = await sendTransactionalEmail(
      applicantEmail,
      'We received your Boostify Funding request',
      applicantReceipt.html,
      applicantReceipt.textContent
    );
    return res.status(201).json({ success: true, requestId: saved.id, status: 'awaiting_agreements', emailSent: teamEmail.success && applicantEmailResult.success });
  } catch (error) {
    console.error('[Funding] Could not save review request:', error);
    return res.status(500).json({ error: 'We could not save your request. Please try again.' });
  }
});

router.post('/meeting-request', isAuthenticated, async (req: any, res) => {
  const parsed = meetingSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'Choose a topic and share when you are available.' });
  const applicantEmail = req.user?.email;
  if (!applicantEmail || !emailSchema.safeParse(applicantEmail).success) {
    return res.status(400).json({ error: 'Add a verified email to your account before requesting a meeting.' });
  }

  try {
    const createdAt = new Date().toISOString();
    const record = { ...parsed.data, userId: req.user.clerkUserId, email: applicantEmail, status: 'requested', createdAt };
    const saved = await db.collection('fundingMeetingRequests').add(record);
    const teamEmail = await notifyFundingTeam('New Boostify Funding meeting request', 'Funding meeting requested',
      `Artist: ${escapeHtml(parsed.data.artistName)}<br/>Email: ${escapeHtml(applicantEmail)}<br/>Topic: ${escapeHtml(parsed.data.topic)}<br/>Availability: ${escapeHtml(parsed.data.availability)}<br/><br/>This is a request, not a confirmed calendar booking.`);
    const applicantReceipt = buildFundingEmail({
      preview: 'We have your meeting request and will follow up to confirm a time.',
      eyebrow: 'Meeting request received',
      title: 'Let’s find a time to talk music finance.',
      greeting: `Hi ${parsed.data.artistName},`,
      paragraphs: ['The Boostify team received your request. We will reply to this email to confirm a time that works. This message is not a calendar invitation.'],
      details: [
        ['Conversation topic', parsed.data.topic],
        ['Your availability', parsed.data.availability]
      ],
      nextSteps: [
        'Our team reviews the topic and time windows you shared.',
        'We reply by email to coordinate and confirm the meeting.',
        'You will receive a separate calendar invitation once the time is confirmed.'
      ]
    });
    const applicantEmailResult = await sendTransactionalEmail(
      applicantEmail,
      'Your Boostify Funding meeting request',
      applicantReceipt.html,
      applicantReceipt.textContent
    );
    return res.status(201).json({ success: true, requestId: saved.id, status: 'requested', emailSent: teamEmail.success && applicantEmailResult.success });
  } catch (error) {
    console.error('[Funding] Could not save meeting request:', error);
    return res.status(500).json({ error: 'We could not save your meeting request. Please try again.' });
  }
});

export default router;
