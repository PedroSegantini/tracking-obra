export function errorMessage(error) {
  const messages = {
    'auth/invalid-credential': 'E-mail ou senha incorretos.',
    'auth/user-disabled': 'Esta conta está desativada.',
    'auth/too-many-requests': 'Muitas tentativas. Aguarde alguns minutos.',
    'auth/popup-closed-by-user': 'A janela do Google foi fechada antes de concluir.',
    'auth/popup-blocked': 'Permita pop-ups para entrar com o Google.',
    'auth/network-request-failed': 'Não foi possível conectar. Confira sua internet.',
    'auth/email-already-in-use': 'Este e-mail já possui uma conta. Entre nela para vincular os métodos.',
    'auth/credential-already-in-use': 'Este Google já está vinculado a outra conta. Entre na conta original; não criaremos uma cópia.',
    'auth/account-exists-with-different-credential': 'Já existe uma conta com este e-mail. Entre pelo método original e conecte o Google em Minha conta.',
    'auth/requires-recent-login': 'Por segurança, saia e entre novamente antes de vincular outro método.',
    'auth/wrong-password': 'Senha atual incorreta.',
    'auth/invalid-email': 'Informe um e-mail válido.',
    'auth/weak-password': 'Use uma senha mais forte, com pelo menos 10 caracteres.',
    'permission-denied': 'Acesso negado. Verifique se sua conta é membro da reforma.',
    'unavailable': 'Serviço indisponível. Verifique sua conexão e tente novamente.',
  }
  return messages[error?.code] || error?.message || 'Não foi possível concluir a operação.'
}
