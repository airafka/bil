export type ComplexService = {
  id: string
  name: string
  priceWithoutVat: number
  priceWithVat: number
  tariffCount: number
}

export type ComplexServiceTariff = {
  id: string
  clientId: string
  clientName: string
  contractId: string
  contractName: string
  coefficient: number
  priceWithoutVat: number
  priceWithVat: number
}

export type ComplexServiceDetails = {
  service: ComplexService
  tariffs: ComplexServiceTariff[]
}

export type ComplexServicePayload = {
  name: string
  priceWithoutVat: string
  priceWithVat: string
}

export type ComplexServiceTariffPayload = {
  clientId: string
  contractId: string
  coefficient: string
}

export const priceLabel = (value: number) =>
  new Intl.NumberFormat('ru-RU', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(value)
