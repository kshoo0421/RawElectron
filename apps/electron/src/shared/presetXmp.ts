export const cameraRawXmpNamespace = 'http://ns.adobe.com/camera-raw-settings/1.0/';

const xmpKeys = {
  exposure: 'Exposure2012', contrast: 'Contrast2012', highlights: 'Highlights2012',
  shadows: 'Shadows2012', whites: 'Whites2012', blacks: 'Blacks2012',
  temperature: 'Temperature', tint: 'Tint', vibrance: 'Vibrance', saturation: 'Saturation',
  redHue: 'RedHue', redSaturation: 'RedSaturation', greenHue: 'GreenHue',
  greenSaturation: 'GreenSaturation', blueHue: 'BlueHue', blueSaturation: 'BlueSaturation',
  shadowHue: 'ColorGradeShadowHue', shadowSaturation: 'ColorGradeShadowSat',
  midtoneHue: 'ColorGradeMidtoneHue', midtoneSaturation: 'ColorGradeMidtoneSat',
  highlightHue: 'ColorGradeHighlightHue', highlightSaturation: 'ColorGradeHighlightSat',
  colorGradingBlending: 'ColorGradeBlending', colorGradingBalance: 'ColorGradeGlobalBalance',
  texture: 'Texture', clarity: 'Clarity2012', dehaze: 'Dehaze',
  vignette: 'PostCropVignetteAmount', vignetteMidpoint: 'PostCropVignetteMidpoint',
  vignetteRoundness: 'PostCropVignetteRoundness', vignetteFeather: 'PostCropVignetteFeather',
  vignetteHighlights: 'PostCropVignetteHighlightContrast', grain: 'GrainAmount',
  grainSize: 'GrainSize', grainRoughness: 'GrainFrequency', sharpening: 'Sharpness',
  sharpeningRadius: 'SharpenRadius', sharpeningDetail: 'SharpenDetail',
  sharpeningMasking: 'SharpenEdgeMasking', luminanceNoise: 'LuminanceSmoothing',
  luminanceNoiseDetail: 'LuminanceNoiseReductionDetail',
  luminanceNoiseContrast: 'LuminanceNoiseReductionContrast', colorNoise: 'ColorNoiseReduction',
  colorNoiseDetail: 'ColorNoiseReductionDetail', colorNoiseSmoothness: 'ColorNoiseReductionSmoothness',
  removeCa: 'AutoLateralCA', lensCorrection: 'LensProfileEnable',
} as const;

export type PresetParameter = keyof typeof xmpKeys;
export type PresetValues = Partial<Record<PresetParameter, number | boolean>>;

const escapeXml = (value: string) => value
  .replaceAll('&', '&amp;').replaceAll('"', '&quot;').replaceAll('<', '&lt;').replaceAll('>', '&gt;');

export function exportCameraRawXmp(name: string, values: PresetValues) {
  const attributes = Object.entries(values).flatMap(([parameter, value]) => {
    if (value === undefined) return [];
    const key = xmpKeys[parameter as PresetParameter];
    if (!key) return [];
    const compatibleValue = parameter === 'temperature' && typeof value === 'number'
      ? Math.round(6500 + value * 45)
      : value;
    const serialized = typeof compatibleValue === 'boolean'
      ? String(compatibleValue).toLowerCase()
      : String(compatibleValue);
    return [`    crs:${key}="${escapeXml(serialized)}"`];
  }).join('\n');
  return `<?xpacket begin="" id="W5M0MpCehiHzreSzNTczkc9d"?>
<x:xmpmeta xmlns:x="adobe:ns:meta/">
 <rdf:RDF xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#">
  <rdf:Description rdf:about="" xmlns:crs="${cameraRawXmpNamespace}"
    crs:PresetType="Normal" crs:Name="${escapeXml(name)}"
${attributes}/>
 </rdf:RDF>
</x:xmpmeta>
<?xpacket end="w"?>`;
}

export function importCameraRawXmp(source: string): PresetValues {
  const values: PresetValues = {};
  for (const [parameter, xmpKey] of Object.entries(xmpKeys) as Array<[PresetParameter, string]>) {
    const match = source.match(new RegExp(`crs:${xmpKey}=["']([^"']*)["']`, 'i'));
    if (!match) continue;
    if (parameter === 'removeCa' || parameter === 'lensCorrection') {
      values[parameter] = match[1].toLowerCase() === 'true' || Number(match[1]) > 0;
    } else {
      const numeric = Number(match[1]);
      if (Number.isFinite(numeric)) {
        values[parameter] = parameter === 'temperature' && Math.abs(numeric) > 500
          ? (numeric - 6500) / 45
          : numeric;
      }
    }
  }
  return values;
}
