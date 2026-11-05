export type TransportCatalogKind = 'carriers' | 'drivers' | 'vehicles'
export type TransportCatalogEntry = {
 id: string; name: string; active: boolean; phoneNumber: string | null; poaNumber: string | null;
 poaValidTo: string | null; insuranceNumber: string | null; withTrailer: boolean | null; trailerNumber: string | null
}
export type TransportCatalogInput = Omit<TransportCatalogEntry,'id'>
export const transportCatalogTitles = {carriers:'Перевозчики / экспедиторы',drivers:'Водители-экспедиторы',vehicles:'Транспортные средства'}
export const catalogPath = (kind: TransportCatalogKind) => '/transport-' + kind
export const catalogDate = (value: string | null | undefined) => value ? value.split('-').reverse().join('.') : '—'
