import { validateRenovationName } from './domain.js'
export function validId(value) {
  if (typeof value !== 'string' || !/^[a-zA-Z0-9_-]{1,128}$/.test(value)) { const error = new Error('Identificador inválido.'); error.status = 400; throw error }
  return value
}
export function validateMemberEdit(input) {
  const { name, email, role } = input ?? {}
  if (typeof name !== 'string' || name.trim().length < 2 || name.trim().length > 80) throw new Error('O nome deve ter de 2 a 80 caracteres.')
  if (typeof email !== 'string' || email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error('Informe um e-mail válido.')
  if (!['admin', 'user'].includes(role)) throw new Error('Cargo inválido.')
  return { name: name.trim(), email: email.trim().toLowerCase(), role }
}
export function validateRenovationEdit(input) {
  const name = validateRenovationName(input?.name)
  if (!Array.isArray(input?.memberIds) || input.memberIds.length > 300) throw new Error('Selecione até 300 membros.')
  return { name, memberIds: [...new Set(input.memberIds.map(validId))] }
}
export function protectOwnAccount(actorUid, targetUid, action, role) {
  if (actorUid === targetUid && (action === 'delete' || role !== 'admin')) throw new Error('Você não pode remover a própria conta nem retirar seu próprio cargo de administrador.')
}
