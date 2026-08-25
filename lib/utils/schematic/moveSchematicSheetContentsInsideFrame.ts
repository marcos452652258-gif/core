import {
  type CircuitJsonUtilObjects,
  transformSchematicElements,
} from "@tscircuit/circuit-json-util"
import type { SchematicSheet } from "circuit-json"
import { getBoundsForSchematic } from "lib/utils/autorouting/getBoundsForSchematic"
import {
  DEFAULT_SCHEMATIC_SHEET_HEIGHT,
  DEFAULT_SCHEMATIC_SHEET_WIDTH,
} from "lib/utils/schematic/insertSchematicElementOutsideSheetWarnings"
import { applyToPoint, translate } from "transformation-matrix"

type SchematicSheetId = SchematicSheet["schematic_sheet_id"]

/**
 * Moves sheet content in schematic-world millimeters (+x right, +y up) into
 * the fixed, origin-centered sheet frame without changing relative placement.
 */
export const moveSchematicSheetContentsInsideFrame = ({
  db,
  schematicSheetId,
}: {
  db: CircuitJsonUtilObjects
  schematicSheetId: SchematicSheetId
}): void => {
  const schematicSheetFilter = { schematic_sheet_id: schematicSheetId }
  const schematicRects = db.schematic_rect.list(schematicSheetFilter)
  const schematicPaths = db.schematic_path.list(schematicSheetFilter)
  const schematicNetLabels = db.schematic_net_label.list(schematicSheetFilter)
  const schematicElements = [
    ...db.schematic_component.list(schematicSheetFilter),
    ...db.schematic_port.list(schematicSheetFilter),
    ...db.schematic_text.list(schematicSheetFilter),
    ...db.schematic_line.list(schematicSheetFilter),
    ...schematicRects,
    ...schematicPaths,
  ]

  if (schematicElements.length === 0) return

  const bounds = getBoundsForSchematic(schematicElements)
  if (
    !Number.isFinite(bounds.minX) ||
    !Number.isFinite(bounds.maxX) ||
    !Number.isFinite(bounds.minY) ||
    !Number.isFinite(bounds.maxY)
  ) {
    return
  }

  const sheetMinX = -DEFAULT_SCHEMATIC_SHEET_WIDTH / 2
  const sheetMaxX = DEFAULT_SCHEMATIC_SHEET_WIDTH / 2
  const sheetMinY = -DEFAULT_SCHEMATIC_SHEET_HEIGHT / 2
  const sheetMaxY = DEFAULT_SCHEMATIC_SHEET_HEIGHT / 2

  const contentFitsInsideSheet =
    bounds.maxX - bounds.minX <= sheetMaxX - sheetMinX &&
    bounds.maxY - bounds.minY <= sheetMaxY - sheetMinY
  // Leave oversized content unchanged so warnings identify its actual bounds.
  if (!contentFitsInsideSheet) return

  let translateX = 0
  let translateY = 0
  if (bounds.minX < sheetMinX) translateX = sheetMinX - bounds.minX
  else if (bounds.maxX > sheetMaxX) translateX = sheetMaxX - bounds.maxX
  if (bounds.minY < sheetMinY) translateY = sheetMinY - bounds.minY
  else if (bounds.maxY > sheetMaxY) translateY = sheetMaxY - bounds.maxY

  if (translateX === 0 && translateY === 0) return

  const schematicIntoFrameTransform = translate(translateX, translateY)

  transformSchematicElements(
    [
      ...schematicElements,
      ...schematicNetLabels,
      ...db.schematic_trace.list(schematicSheetFilter),
    ],
    schematicIntoFrameTransform,
  )

  // The shared transformer does not yet handle section rectangles or paths.
  for (const rect of schematicRects) {
    rect.center = applyToPoint(schematicIntoFrameTransform, rect.center)
  }

  for (const path of schematicPaths) {
    path.points = path.points.map((point) =>
      applyToPoint(schematicIntoFrameTransform, point),
    )
  }

  // Keep both net-label coordinates aligned with the translated traces.
  for (const netLabel of schematicNetLabels) {
    netLabel.center = applyToPoint(schematicIntoFrameTransform, netLabel.center)
    if (netLabel.anchor_position) {
      netLabel.anchor_position = applyToPoint(
        schematicIntoFrameTransform,
        netLabel.anchor_position,
      )
    }
  }
}
