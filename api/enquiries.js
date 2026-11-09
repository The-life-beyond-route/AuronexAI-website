// This deployment serves the website while the Resend/Prisma integration is paused.
// Never acknowledge receipt unless an enquiry has actually been persisted.
export default function handler(request, response) {
  response.setHeader('Cache-Control', 'no-store');
  if (request.method !== 'POST') {
    response.setHeader('Allow', 'POST');
    return response.status(405).json({ error: 'Method not allowed.' });
  }
  return response.status(503).json({
    error: 'Online enquiries are not available yet. Please try again once our contact service is connected.',
  });
}
