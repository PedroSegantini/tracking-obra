// Chamado diretamente pelo clique para preservar a ativação exigida pelo navegador.
export function openDatePicker(event) {
  const input = event.currentTarget
  if (input.disabled || input.readOnly || typeof input.showPicker !== 'function') return
  try {
    input.showPicker()
  } catch {
    // Se o navegador não permitir abrir programaticamente, mantém o controle nativo.
  }
}
