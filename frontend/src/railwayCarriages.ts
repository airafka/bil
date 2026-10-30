export type RailwayCarriage = {
  id: string; name: string; modelId: string | null; modelName: string | null
  loadCapacity: number | null; nextDepotRepairDate: string | null
  carriageTypeId: string | null; carriageTypeName: string | null
}
export type RailwayCarriagePatch = {
  modelId: string | null; loadCapacity: string | null; nextDepotRepairDate: string | null; carriageTypeId: string | null
}
