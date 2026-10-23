import { Router } from 'express';
import { z } from 'zod';
import { db } from '../firebase';
import { isAuthenticated } from '../middleware/clerk-auth';
import { sendNotificationEmail } from '../services/brevo-email-service';

const router = Router();
const emailSchema = z.string().email().max(254);
const fundingDraftSchema = z.object({
  artistName: z.string().max(120), country: z.string().max(100), entityType: z.string().max(80), yearsActive: z.string().max(20),
  releasedSongs: z.string().max(20), catalogYears: z.string().max(20), distributor: z.string().max(120),
  masterOwnership: z.string().max(20), publishingOwnership: z.string().max(20), hasAdvance: z.string().max(20),
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

async function notifyFundingTeam(subject: string, title: string, message: string) {
  const inbox = process.env.FUNDING_INBOX_EMAIL || process.env.SUPPORT_EMAIL || 'support@boostifymusic.com';
  return sendNotificationEmail(inbox, subject, title, message);
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
      `Artist: ${safeArtist}<br/>Email: ${escapeHtml(applicantEmail)}<br/>Exploring: ${safeAmount}<br/>Readiness estimate: ${parsed.data.readinessScore}/100<br/><br/>Status: awaiting counsel-reviewed agreements and verified signatures. No partner data has been shared.`);
    const applicantEmailResult = await sendNotificationEmail(applicantEmail, 'We received your Boostify Funding request', 'Your request is with Boostify',
      `We saved your private funding review request for ${safeArtist}. Your information has not been sent to a funding partner. We will contact you after the agreements and secure signing workflow are ready.`);
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
    const applicantEmailResult = await sendNotificationEmail(applicantEmail, 'Your Boostify Funding meeting request', 'We received your meeting request',
      `Thanks, ${escapeHtml(parsed.data.artistName)}. The Boostify team received your request about ${escapeHtml(parsed.data.topic)} and will reply at this email to confirm a time. This email is not a calendar invitation.`);
    return res.status(201).json({ success: true, requestId: saved.id, status: 'requested', emailSent: teamEmail.success && applicantEmailResult.success });
  } catch (error) {
    console.error('[Funding] Could not save meeting request:', error);
    return res.status(500).json({ error: 'We could not save your meeting request. Please try again.' });
  }
});

export default router;
