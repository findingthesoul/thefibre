// Number formatting for the generator. Currency symbol comes from the model.
export function makeFormatters(symbol: string) {
  const fmtMoney = (n: number) => (n < 0 ? '-' : '') + symbol + Math.round(Math.abs(n)).toLocaleString('en-US');
  const fmtMoneyK = (n: number) =>
    Math.abs(n) >= 1e6 ? (n < 0 ? '-' : '') + symbol + (Math.abs(n) / 1e6).toFixed(2) + 'M'
    : Math.abs(n) >= 1e4 ? (n < 0 ? '-' : '') + symbol + Math.round(Math.abs(n) / 1e3) + 'k'
    : fmtMoney(n);
  const fmtNum = (n: number) => Math.round(n).toLocaleString('en-US');
  const fmtPct = (n: number) => (Math.round(n * 10) / 10).toLocaleString('en-US') + '%';
  return { fmtMoney, fmtMoneyK, fmtNum, fmtPct };
}
export const singular = (s: string) => s.replace(/s$/, '');
export const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
