/** Mesma contagem da API: pontos de código, sem aparar nem normalizar. A API é quem decide. */
export function fitsPolicy(password: string): boolean {
  const length = [...password].length;
  return length >= 12 && length <= 128;
}
