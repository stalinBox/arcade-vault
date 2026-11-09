"use server";

import { Resend } from "resend";

export type ContactResult = { ok: true; name: string } | { ok: false; error: string };

const LIMITS = { name: 80, email: 254, msg: 2000 } as const;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Valida en servidor (no confiar en el cliente) y envía el mensaje con Resend.
export async function sendContact(formData: FormData): Promise<ContactResult> {
  const name = String(formData.get("name") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim();
  const msg = String(formData.get("msg") ?? "").trim();

  if (!name || !email || !msg) return { ok: false, error: "Completa todos los campos." };
  if (name.length > LIMITS.name || email.length > LIMITS.email || msg.length > LIMITS.msg) {
    return { ok: false, error: "Alguno de los campos es demasiado largo." };
  }
  if (!EMAIL_RE.test(email)) return { ok: false, error: "El correo no es válido." };

  const apiKey = process.env.RESEND_API_KEY;
  const to = process.env.CONTACT_TO_EMAIL;
  if (!apiKey || !to) {
    console.error("[contacto] Faltan RESEND_API_KEY o CONTACT_TO_EMAIL");
    return { ok: false, error: "El servicio de correo no está configurado." };
  }

  const resend = new Resend(apiKey);
  const { error } = await resend.emails.send({
    from: process.env.CONTACT_FROM_EMAIL ?? "Arcade Vault <onboarding@resend.dev>",
    to,
    replyTo: email,
    subject: `[Arcade Vault] Mensaje de ${name.replace(/[\r\n]+/g, " ")}`,
    text: `Nombre: ${name}\nCorreo: ${email}\n\n${msg}`,
  });

  if (error) {
    console.error("[contacto] Resend:", error.name, error.message);
    return { ok: false, error: "No pudimos enviar tu mensaje. Inténtalo de nuevo." };
  }
  return { ok: true, name };
}
