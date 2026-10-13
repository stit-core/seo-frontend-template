let sharpImport
async function loadSharp() {
  sharpImport ??= (await import("sharp")).default
  return sharpImport
}
export { loadSharp }
