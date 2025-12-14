# Embedding Brand Fonts into PowerPoint and Exporting a Print-Ready PDF (Step-by-step)

This guide shows two options:
- Recommended (PowerPoint): Install OTF/TTF locally on Windows/Mac, embed fonts in PPTX, then export PDF using PowerPoint + Acrobat for PDF/X conversion.
- Programmatic (best-effort): Add font files to the PPTX package (ZIP) — not guaranteed to make PowerPoint use/recognize them for embedding; prefer manual method.

---

## A — Recommended: PowerPoint (Windows / macOS)
1. Install the font files (OTF/TTF) on the machine: double-click the font file and click Install.
2. Open the PPTX in PowerPoint.
3. Verify usage: select text and confirm text properties show the new font.
4. Embed fonts in the file: File → Options → Save → "Embed fonts in the file" (Windows) — check **Embed all characters** (recommended for print).
   - On Mac: PowerPoint for Mac does not always have an "Embed fonts" option; use Windows for reliable embedding or use InDesign/Illustrator after export.
5. Export to PDF: File → Save As → choose PDF → Options → select "Best for printing".
6. Validate PDF/X compliance: Use Acrobat Pro's Preflight tool to convert/export to PDF/X-1a or PDF/X-4 and check embedded fonts.

Note: Embedding fonts in PowerPoint depends on license permissions for the fonts (some foundries restrict embedding). If a font refuses to embed, use licensed/print-ready alternatives or create outlines in Illustrator for final art.

---

## B — Programmatic (best-effort, limited)
1. A PPTX file is a ZIP archive containing /ppt, /ppt/slides, /ppt/embeddings or /ppt/fonts directories.
2. Adding a font: unzip PPTX, place your .ttf under `ppt/fonts/`, update `ppt/fontTable.xml` to reference the new font and re-zip.
3. Important: PowerPoint will *not always* pick up fonts that are added into the archive manually and might not treat them as embedded in the embedded-font sense; embedding at authoring time is the reliable method.

---

## C — Exporting for print (PPTX → PDF/X)
1. After embedding fonts and exporting a PDF from PowerPoint, open in Adobe Acrobat Pro.
2. Use Print Production → Preflight → PDF/X conversion to convert to PDF/X-1a (or PDF/X-4) if required by your printer.
3. Ensure CMYK conversion is correct and high-res images (300DPI) are embedded.
4. Double-check crop marks and bleeds in the PDF in Acrobat.

---

## Example local instructions (Windows PowerPoint + Acrobat)
- Install fonts → open PPTX → File → Options → Save → Embed fonts in file → Save
- File → Save As → PDF (choose "Best for printing")
- Open PDF in Acrobat Pro → Tools → Print Production → Preflight → convert to PDF/X-1a → save as final file

---

## Next steps I can perform for you
- If you upload the exact OTF/TTF files I will embed them into the PPTX and re-export a PDF (I’ll also include a PDF/X conversion step in the report). Note: programmatic embedding into PPTX is fragile; PowerPoint export remains the most reliable way to embed fonts.
- I can generate a small helper script that attempts to add fonts into the PPTX package (best-effort) for convenience; I can run that if you want to try automated embedding.

