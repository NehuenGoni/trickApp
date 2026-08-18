/**
 * Genera el HTML de los 13 templates de mail con datos de ejemplo, para
 * revisarlos en el navegador sin mandar nada real. No toca Mongo ni Resend:
 * solo importa `emailTemplates.ts`, así que corre en un segundo.
 *
 * Uso: `npm run mail:preview` (desde `backend/`). Escribe cada mail a
 * `.email-preview/<nombre>.html` y un `index.html` con la lista completa
 * para navegarlos todos desde ahí.
 */
import dotenv from "dotenv";
import fs from "fs";
import path from "path";
import { MailContent } from "../utils/mailer";

// Carga `.env` para poder previsualizar con `FRONTEND_URL`/`MAIL_LOGO_URL`
// reales en vez de los defaults de desarrollo (mismo patrón que el resto de
// `src/scripts/*`).
dotenv.config();
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
} from "../utils/emailTemplates";

const OUT_DIR = path.join(__dirname, "..", "..", ".email-preview");

// Username "hostil" para verificar a ojo que `escapeHtml()` sigue
// funcionando: si algún preview dispara un alert o rompe el layout, hay
// una regresión de escapado.
const HOSTILE_NAME = `<img src=x onerror=alert(1)> "Pehuén" O'Higgins`;

const FUTURE = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
const SOON = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000);
const UNSUB_URL = "https://trick-app.com/unsubscribe/token-de-ejemplo";
const TOURNAMENT_URL = "https://trick-app.com/tournaments/123";

const samples: Record<string, MailContent> = {
  "01-email-verification": emailVerificationEmail("Nehuen", "https://trick-app.com/verify-email/abc123", 48),
  "01b-email-verification-hostil": emailVerificationEmail(HOSTILE_NAME, "https://trick-app.com/verify-email/abc123", 48),
  "02-password-reset": passwordResetEmail("Nehuen", "https://trick-app.com/reset-password/abc123", 30),
  "03-password-changed": passwordChangedEmail("Nehuen"),
  "04-payment-approved": paymentApprovedEmail("Nehuen", "Pro", FUTURE),
  "05-payment-rejected": paymentRejectedEmail("Nehuen", "Pro", "https://trick-app.com/profile?tab=plan"),
  "06-subscription-canceled": subscriptionCanceledEmail("Nehuen", "Pro", FUTURE),
  "07-subscription-granted": subscriptionGrantedEmail("Nehuen", "Pro", FUTURE),
  "08-expiry-reminder": expiryReminderEmail("Nehuen", "Pro", SOON, "https://trick-app.com/profile?tab=plan"),
  "09-organizer-added": organizerAddedEmail("Nehuen", `Liga del Barrio "Los Ases"`, "https://trick-app.com/leagues/123"),
  "10-tournament-signup": tournamentSignupConfirmedEmail("Nehuen", "Copa Truco 2026", TOURNAMENT_URL, UNSUB_URL),
  "11-tournament-started": tournamentStartedEmail("Nehuen", "Copa Truco 2026", ["Pedro", "Ana"], "Los Tigres", TOURNAMENT_URL, UNSUB_URL),
  "11b-tournament-started-sin-rival": tournamentStartedEmail("Nehuen", "Copa Truco 2026", [], null, TOURNAMENT_URL, UNSUB_URL),
  "12-match-result-ganado": matchResultEmail("Nehuen", "Copa Truco 2026", true, "Cuartos de final", null, TOURNAMENT_URL, UNSUB_URL),
  "12b-match-result-perdido": matchResultEmail("Nehuen", "Copa Truco 2026", false, null, 5, TOURNAMENT_URL, UNSUB_URL),
  "13-tournament-closed": tournamentClosedEmail("Nehuen", "Copa Truco 2026", 2, 45, TOURNAMENT_URL, UNSUB_URL)
};

fs.mkdirSync(OUT_DIR, { recursive: true });

const entries = Object.entries(samples);
const rows = entries
  .map(([name, content]) => {
    const file = `${name}.html`;
    fs.writeFileSync(path.join(OUT_DIR, file), content.html ?? "<p>(sin html)</p>", "utf-8");
    return `<li><a href="${file}" target="preview">${name}</a><span>${content.subject}</span></li>`;
  })
  .join("\n");

const indexHtml = `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="utf-8" />
<title>Preview de emails — TrickApp</title>
<style>
  body { margin:0; display:flex; font-family: Arial, Helvetica, sans-serif; height:100vh; }
  nav { width:340px; overflow-y:auto; padding:16px; border-right:1px solid #ddd; box-sizing:border-box; background:#fafafa; }
  nav h1 { font-size:15px; margin:0 0 12px; }
  nav ul { list-style:none; padding:0; margin:0; }
  nav li { margin-bottom:2px; }
  nav a { display:block; padding:8px 10px; border-radius:6px; color:#111; text-decoration:none; font-size:13px; font-weight:600; }
  nav a:hover { background:#eee; }
  nav span { display:block; font-size:11px; font-weight:400; color:#888; margin-top:2px; }
  iframe { flex:1; border:0; }
</style>
</head>
<body>
  <nav>
    <h1>Emails de TrickApp (${entries.length})</h1>
    <ul>${rows}</ul>
  </nav>
  <iframe name="preview" src="${entries[0][0]}.html"></iframe>
</body>
</html>`;

fs.writeFileSync(path.join(OUT_DIR, "index.html"), indexHtml, "utf-8");

console.log(`✓ ${entries.length} emails generados en ${OUT_DIR}`);
console.log(`  Abrí ${path.join(OUT_DIR, "index.html")} en el navegador.`);
