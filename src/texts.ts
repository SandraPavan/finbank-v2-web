/** Textos da interface. Sem HTML: sempre renderizados como texto. */
export const TEXTS = {
  product: 'FinBank V2',
  notice: 'Ambiente educacional simulado. Use apenas dados fictícios.',
  aliasInvalid: 'Use de 3 a 40 letras minúsculas, números ou hífens.',
  required: 'Preencha este campo.',
  loginRefused: 'Não foi possível entrar. Confira os dados e tente novamente.',
  sessionRequired: 'Entre para continuar.',
  sessionExpired: 'Sua sessão expirou. Entre novamente.',
  csrf: 'Sua sessão mudou em outra aba. Confira os dados e envie de novo.',
  unavailable: 'Serviço indisponível no momento. Tente novamente em instantes.',
  forbidden: 'Você não tem acesso a esta página.',
  notFound: 'Página ou recurso não encontrado.',
  conflict: 'O cliente está desativado ou não tem senha cadastrada.',
  currentPasswordInvalid: 'Senha atual incorreta.',
  passwordPolicy: 'A senha deve ter de 12 a 128 caracteres.',
  passwordHint: 'De 12 a 128 caracteres.',
  passwordsDiffer: 'As senhas não coincidem.',
  recoveryPolicy: 'Use de 12 a 128 caracteres e uma senha diferente da credencial temporária.',
  passwordChanged: 'Senha trocada. As outras sessões foram encerradas.',
  rateLimited: (seconds: number): string => `Muitas tentativas. Tente novamente em ${seconds} segundos.`,
  unexpected: (correlationId: string | null): string =>
    correlationId === null ? 'Algo deu errado.' : `Algo deu errado. Código para suporte: ${correlationId}`,
} as const;
