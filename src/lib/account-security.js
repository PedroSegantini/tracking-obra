export function validatePasswordChange(input) {
  const { currentPassword, newPassword, confirmPassword } = input ?? {}
  if (typeof currentPassword !== 'string' || !currentPassword.length || currentPassword.length > 128) throw new Error('Informe sua senha atual.')
  if (typeof newPassword !== 'string' || newPassword.length < 10 || newPassword.length > 128) throw new Error('A nova senha deve ter de 10 a 128 caracteres.')
  if (newPassword !== confirmPassword) throw new Error('As novas senhas não conferem.')
  if (newPassword === currentPassword) throw new Error('A nova senha deve ser diferente da atual.')
  return { currentPassword, newPassword }
}
