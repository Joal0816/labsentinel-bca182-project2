# LabSentinel Dashboard Design

## Direction

Fieldwork passport: a calm, evidence-first station dashboard whose only authored flourish is a compact verification stamp for milestones backed by real device activity. It should read as an operational monitoring product before its personality becomes apparent.

## Palette and material

- Deep pine `#183B36` anchors navigation and the header; warm field-paper `#F4F0E4` is the main canvas.
- Ink `#202B2B` carries text; muted graphite `#677572` carries secondary labels.
- Vermilion `#C65B43` marks movement and earned verification; amber `#D99A36` signals warning; green `#3B8064` means healthy; blue `#4D7FA2` distinguishes light data.
- Sensor lines use stable per-sensor colors with explicit labels. Status is never conveyed by color alone.

## Type and density

Use a highly legible system sans stack for interface text and tabular numerals for readings. Use compact but breathable data density: align values and units, keep labels visible, and preserve chart axes and legends. Do not use handwritten or display type for controls or measurements.

## Signature interaction

When actual evidence verifies a milestone, a small stamped mark settles into the progress ribbon and links to the evidence that earned it. It does not cover readings, block controls, repeat for routine refreshes, or award a badge for demo telemetry without a visible demo label.

## Motion and interaction

Routine state feedback uses short transform/opacity transitions (150–250 ms). Connection and command states transition from pending to acknowledged only after the gateway/device result arrives. The milestone stamp is the single authored moment. Respect `prefers-reduced-motion`, stop nonessential loops when hidden, and keep the default state fully visible without animation.

## Component rules

Use standard navigation, cards, tabs, filters, charts, and explicit ON/OFF buttons. Show real, demo, stale, offline, pending, rejected, and unknown states. Keep requested output separate from actual output. Mobile layouts retain the core readings, freshness, and control action.

## Risks to avoid

The passport motif can become childish or obscure operational status. Keep achievements secondary, never use a score to summarize sensor truth, and do not celebrate normal button presses or data refreshes.

