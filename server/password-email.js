import nodemailer from 'nodemailer'
const validEmail = value => typeof value === 'string' && /^[^\s<>@]+@[^\s<>@]+\.[^\s<>@]+$/.test(value)
export async function sendPasswordChangedEmail({ email, changedAt }, { env = process.env, createTransport = nodemailer.createTransport } = {}) {
  const { SMTP_HOST: host, SMTP_USER: user, SMTP_PASSWORD: pass, SMTP_FROM: from } = env
  if (!host || !user || !pass || !from) return 'not-configured'
  if (!validEmail(email) || !validEmail(from)) throw new Error('invalid-mail-config')
  const port = Number(env.SMTP_PORT || 465)
  const secure = env.SMTP_SECURE === undefined || env.SMTP_SECURE === '' ? port === 465 : env.SMTP_SECURE === 'true'
  if (![465, 587].includes(port) || (port === 465 && !secure) || (port === 587 && secure)) throw new Error('invalid-smtp-config')
  const contact = env.ADMIN_CONTACT_EMAIL
  if (contact && !validEmail(contact)) throw new Error('invalid-contact-email')
  const when = changedAt.toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo', dateStyle: 'long', timeStyle: 'short' })
  const text = [
    'Sua senha do Tracking Obra foi alterada.',
    `Data: ${when} (horário de Brasília).`,
    'Se você não realizou esta alteração, entre em contato com o administrador.',
    ...(contact ? [`Contato do administrador: ${contact}`] : []),
    'A senha da sua conta Google não foi alterada.',
  ].join('\n\n')
  const transport = createTransport({ host, port, secure, requireTLS: true, auth: { user, pass }, connectionTimeout: 5000, greetingTimeout: 5000, socketTimeout: 8000, logger: false, debug: false, disableFileAccess: true, disableUrlAccess: true })
  try {
    const result = await transport.sendMail({ from: { name: 'Tracking Obra', address: from }, to: email, ...(contact ? { replyTo: contact } : {}), subject: 'Sua senha do Tracking Obra foi alterada', text })
    if (!result.accepted?.some(address => String(address).toLowerCase() === email.toLowerCase())) throw new Error('mail-not-accepted')
    return 'sent'
  } finally { transport.close?.() }
}
