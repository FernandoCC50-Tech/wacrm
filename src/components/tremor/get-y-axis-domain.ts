// Tremor getYAxisDomain — copied from tremorlabs/tremor.
// License: Apache 2.0 (Tremor).
// Source: https://github.com/tremorlabs/tremor/blob/main/src/utils/getYAxisDomain.ts

export const getYAxisDomain = (
  autoMinValor: boolean,
  minValor: number | undefined,
  maxValor: number | undefined,
) => {
  const minDomain = autoMinValor ? "auto" : (minValor ?? 0)
  const maxDomain = maxValor ?? "auto"
  return [minDomain, maxDomain]
}
