import 'dotenv/config';
import express from 'express';
import fs from 'fs';
import path from 'path';
import { processPatientMessage } from './server/clinicEngine.ts';
import {
  addTicketReply,
  appendSessionMessage,
  clearDemoLeads,
  createLead,
  getAllLeads,
  getAllTickets,
  getClinicData,
  getSessionMessages,
  resetClinicData,
  seedDemoLeads,
  updateClinicData,
  updateLead,
  updateTicketStatus,
} from './server/store.ts';
import type { ClinicData, LeadStatus, TicketStatus } from './server/types.ts';

const PORT = 3000;
const VALID_STATUSES: TicketStatus[] = ['answered', 'needs human', 'urgent', 'closed'];
const VALID_LEAD_STATUSES: LeadStatus[] = ['New', 'Contacted', 'Appointment', 'Converted'];

async function startServer(): Promise<void> {
  const app = express();
  app.use(express.json({ limit: '2mb' }));

  // Health check
  app.get('/api/health', (_req, res) => {
    res.json({ ok: true });
  });

  // Clinic data endpoints
  app.get('/api/clinic-data', (_req, res) => {
    res.json(getClinicData());
  });

  app.put('/api/clinic-data', (req, res) => {
    const body = req.body as ClinicData;
    if (!body || !body.clinicName || !Array.isArray(body.doctors) || !Array.isArray(body.services)) {
      res.status(400).json({ error: 'Invalid clinic data payload.' });
      return;
    }
    const updated = updateClinicData(body);
    res.json(updated);
  });

  app.post('/api/clinic-data/reset', (_req, res) => {
    const reset = resetClinicData();
    res.json(reset);
  });

  // Session messages (polled by patient chat for real-time staff replies)
  app.get('/api/session/:sessionId', (req, res) => {
    const sessionId = req.params.sessionId;
    const messages = getSessionMessages(sessionId);
    res.json({ sessionId, messages });
  });

  // Patient chat endpoint
  app.post('/api/chat', async (req, res) => {
    try {
      const { sessionId, message, patientName } = req.body as {
        sessionId?: string;
        message?: string;
        patientName?: string;
      };

      if (!message || typeof message !== 'string' || !message.trim()) {
        res.status(400).json({ error: 'Message text is required.' });
        return;
      }

      const activeSessionId =
        sessionId && typeof sessionId === 'string' && sessionId.trim()
          ? sessionId.trim()
          : `sess-${Date.now()}`;

      const now = new Date().toISOString();
      appendSessionMessage({
        id: `msg-${Date.now()}-p`,
        sessionId: activeSessionId,
        sender: 'patient',
        text: message.trim(),
        timestamp: now,
      });

      const clinicData = getClinicData();
      const result = await processPatientMessage({
        sessionId: activeSessionId,
        message: message.trim(),
        patientName,
        clinicData,
      });

      const messages = appendSessionMessage({
        id: `msg-${Date.now()}-b`,
        sessionId: activeSessionId,
        sender: 'bot',
        text: result.reply,
        timestamp: new Date().toISOString(),
        fallbackUsed: result.fallbackUsed,
        sourceLabel: result.sourceLabel,
        language: result.language,
        ticketId: result.ticket?.id,
      });

      res.json({
        sessionId: activeSessionId,
        reply: result.reply,
        fallbackUsed: result.fallbackUsed,
        sourceLabel: result.sourceLabel,
        language: result.language,
        ticket: result.ticket ?? null,
        messages,
      });
    } catch (error) {
      console.error('Error in /api/chat:', error);
      res.status(500).json({ error: 'Failed to process message.' });
    }
  });

  // Staff ticket queue endpoints
  app.get('/api/tickets', (_req, res) => {
    res.json({ tickets: getAllTickets() });
  });

  app.post('/api/tickets/:id/reply', (req, res) => {
    const ticketId = req.params.id;
    const { reply, status } = req.body as {
      reply?: string;
      status?: TicketStatus;
    };

    if (!reply || typeof reply !== 'string' || !reply.trim()) {
      res.status(400).json({ error: 'Reply text is required.' });
      return;
    }

    const nextStatus: TicketStatus =
      status && VALID_STATUSES.includes(status) ? status : 'answered';

    const result = addTicketReply(ticketId, reply, nextStatus);
    if (!result) {
      res.status(404).json({ error: 'Ticket not found.' });
      return;
    }

    res.json(result);
  });

  app.patch('/api/tickets/:id/status', (req, res) => {
    const ticketId = req.params.id;
    const { status } = req.body as { status?: TicketStatus };
    if (!status || !VALID_STATUSES.includes(status)) {
      res.status(400).json({ error: 'Invalid ticket status.' });
      return;
    }
    const updated = updateTicketStatus(ticketId, status);
    if (!updated) {
      res.status(404).json({ error: 'Ticket not found.' });
      return;
    }
    res.json({ ticket: updated });
  });

  // Lead management endpoints (V2/V3 Lead Dashboard)
  app.get('/api/leads', (_req, res) => {
    res.json({ leads: getAllLeads() });
  });

  app.post('/api/leads', (req, res) => {
    const body = req.body as {
      patientName?: string;
      phone?: string;
      treatment?: string;
      preferredDate?: string;
      preferredTime?: string;
      message?: string;
      source?: 'appointment-form' | 'treatment-page' | 'chat-booking';
    };

    if (
      !body?.patientName?.trim() ||
      !body?.phone?.trim() ||
      !body?.treatment?.trim() ||
      !body?.preferredDate?.trim()
    ) {
      res.status(400).json({
        error: 'Patient name, mobile number, treatment, and preferred date are required.',
      });
      return;
    }

    const created = createLead({
      patientName: body.patientName,
      phone: body.phone,
      treatment: body.treatment,
      preferredDate: body.preferredDate,
      preferredTime: body.preferredTime,
      message: body.message,
      source: body.source || 'appointment-form',
    });

    res.status(201).json(created);
  });

  app.patch('/api/leads/:id', (req, res) => {
    const leadId = req.params.id;
    const body = req.body as {
      status?: LeadStatus;
      followUpNote?: string;
      followUpDate?: string;
      reminderSentAt?: string;
    };

    if (body.status && !VALID_LEAD_STATUSES.includes(body.status)) {
      res.status(400).json({ error: 'Invalid lead status.' });
      return;
    }

    const updated = updateLead(leadId, body);
    if (!updated) {
      res.status(404).json({ error: 'Lead not found.' });
      return;
    }
    res.json({ lead: updated });
  });

  app.post('/api/leads/seed-demo', (_req, res) => {
    res.json({ leads: seedDemoLeads() });
  });

  app.delete('/api/leads/demo', (_req, res) => {
    res.json({ leads: clearDemoLeads() });
  });

  const isProd = process.env.NODE_ENV === 'production';
  if (!isProd) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      const indexFile = path.join(distPath, 'index.html');
      if (fs.existsSync(indexFile)) {
        res.sendFile(indexFile);
      } else {
        res.status(404).send('Build not found. Run npm run build.');
      }
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Dentistae front desk server listening on http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Fatal server startup error:', err);
  process.exit(1);
});
