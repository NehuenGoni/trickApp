import { MailContent } from "../../utils/mailer";
import {
  emailVerificationEmail,
  expiryReminderEmail,
  matchResultEmail,
  organizerAddedEmail,
  passwordChangedEmail,
  passwordResetEmail,
  paymentApprovedEmail,
  paymentRejectedEmail,
  subscriptionCanceledEmail,
  subscriptionGrantedEmail,
  tournamentClosedEmail,
  tournamentSignupConfirmedEmail,
  tournamentStartedEmail
} from "../../utils/emailTemplates";

// Username "hostil": si algún template interpola esto sin pasar por
// `escapeHtml()` (en el body o en el preheader oculto), el tag <img> crudo
// aparece en el HTML y este test lo detecta.
const HOSTILE = `<img src=x onerror=alert(1)>`;
const ESCAPED_HOSTILE = "&lt;img src=x onerror=alert(1)&gt;";

const FUTURE = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
const URL = "https://trick-app.com/some-path";

// Cada entrada dispara el template con `HOSTILE` en cada parámetro de texto
// libre (username, nombre de torneo/liga) para cubrir las 13 plantillas.
const templates: Record<string, () => MailContent> = {
  emailVerificationEmail: () => emailVerificationEmail(HOSTILE, URL, 48),
  passwordResetEmail: () => passwordResetEmail(HOSTILE, URL, 30),
  passwordChangedEmail: () => passwordChangedEmail(HOSTILE),
  paymentApprovedEmail: () => paymentApprovedEmail(HOSTILE, HOSTILE, FUTURE),
  paymentRejectedEmail: () => paymentRejectedEmail(HOSTILE, HOSTILE, URL),
  subscriptionCanceledEmail: () => subscriptionCanceledEmail(HOSTILE, HOSTILE, FUTURE),
  subscriptionGrantedEmail: () => subscriptionGrantedEmail(HOSTILE, HOSTILE, FUTURE),
  expiryReminderEmail: () => expiryReminderEmail(HOSTILE, HOSTILE, FUTURE, URL),
  organizerAddedEmail: () => organizerAddedEmail(HOSTILE, HOSTILE, URL),
  tournamentSignupConfirmedEmail: () => tournamentSignupConfirmedEmail(HOSTILE, HOSTILE, URL, URL),
  tournamentStartedEmail: () => tournamentStartedEmail(HOSTILE, HOSTILE, [HOSTILE], HOSTILE, URL, URL),
  matchResultEmail: () => matchResultEmail(HOSTILE, HOSTILE, true, HOSTILE, null, URL, URL),
  tournamentClosedEmail: () => tournamentClosedEmail(HOSTILE, HOSTILE, 1, 10, URL, URL)
};

describe("emailTemplates", () => {
  it.each(Object.entries(templates))("%s produce subject/text/html no vacíos y un documento HTML completo", (_name, build) => {
    const mail = build();

    expect(mail.subject.length).toBeGreaterThan(0);
    expect(mail.text.length).toBeGreaterThan(0);
    expect(mail.html).toBeDefined();
    expect(mail.html!.startsWith("<!DOCTYPE html>")).toBe(true);
    // El preheader (texto oculto junto al asunto en la bandeja de entrada)
    // tiene que estar presente para que el mail no se vea genérico ahí.
    expect(mail.html).toMatch(/display:none[\s\S]*mso-hide:all/);
  });

  it.each(Object.entries(templates))("%s escapa datos hostiles y nunca los deja crudos en el HTML", (_name, build) => {
    const mail = build();

    expect(mail.html).toContain(ESCAPED_HOSTILE);
    expect(mail.html).not.toContain(HOSTILE);
  });
});
