import { expect, test } from "bun:test"
import { cju } from "@tscircuit/circuit-json-util"
import { any_circuit_element } from "circuit-json"
import { getBoundsForSchematic } from "lib/utils/autorouting/getBoundsForSchematic"
import {
  DEFAULT_SCHEMATIC_SHEET_WIDTH,
  insertSchematicElementOutsideSheetWarnings,
} from "lib/utils/schematic/insertSchematicElementOutsideSheetWarnings"
import batteryPowerSheetCircuitJson from "tests/repros/assets/repro173-battery-power-sheet.json"
import "tests/fixtures/extend-expect-circuit-snapshot"

test(
  "reproduces battery power Circuit JSON extending past the fixed frame",
  async () => {
    const circuitJson = batteryPowerSheetCircuitJson.map((schematicElement) =>
      any_circuit_element.parse(schematicElement),
    )
    const db = cju(circuitJson)
    const schematicSheet = db.schematic_sheet.getWhere({
      name: "battery_power",
    })!

    insertSchematicElementOutsideSheetWarnings({
      db,
      schematicSheetId: schematicSheet.schematic_sheet_id,
      schematicSheetName: schematicSheet.name ?? "battery_power",
      schematicSheetCenter: { x: 0, y: 0 },
    })

    const schematicElements = [
      ...db.schematic_component.list(),
      ...db.schematic_port.list(),
      ...db.schematic_text.list(),
      ...db.schematic_line.list(),
      ...db.schematic_rect.list(),
      ...db.schematic_circle.list(),
      ...db.schematic_arc.list(),
      ...db.schematic_path.list(),
    ]
    const bounds = getBoundsForSchematic(schematicElements)

    expect(db.schematic_sheet.list()).toHaveLength(1)
    expect(schematicSheet).not.toHaveProperty("center")
    expect(bounds.minX).toBeLessThan(-DEFAULT_SCHEMATIC_SHEET_WIDTH / 2)
    expect(
      db.schematic_element_outside_sheet_warning.list().length,
    ).toBeGreaterThan(0)

    await expect(circuitJson).toMatchStackedSchematicSnapshot(import.meta.path)
  },
  { timeout: 30_000 },
)
