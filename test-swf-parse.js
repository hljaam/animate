const { parseSwf } = require('swf-parser');
const fs = require('fs');

// SWF tag type IDs reference
const TAG_NAMES = {
  0: 'End', 1: 'ShowFrame', 2: 'DefineShape', 4: 'PlaceObject',
  5: 'RemoveObject', 6: 'DefineBits', 7: 'DefineButton', 8: 'JpegTables',
  9: 'SetBackgroundColor', 10: 'DefineFont', 11: 'DefineText',
  12: 'DoAction', 13: 'DefineFontInfo', 14: 'DefineSound',
  20: 'DefineBitsLossless', 21: 'DefineBitsJpeg2', 22: 'DefineShape2',
  26: 'PlaceObject2', 28: 'RemoveObject2', 32: 'DefineShape3',
  35: 'DefineBitsJpeg3', 36: 'DefineBitsLossless2', 37: 'DefineEditText',
  39: 'DefineSprite', 43: 'FrameLabel', 46: 'DefineMorphShape',
  48: 'DefineFont2', 56: 'ExportAssets', 57: 'ImportAssets',
  58: 'EnableDebugger', 59: 'DoInitAction', 60: 'DefineVideoStream',
  65: 'ScriptLimits', 69: 'FileAttributes', 70: 'PlaceObject3',
  73: 'DefineFontAlignZones', 74: 'CSMTextSettings', 75: 'DefineFont3',
  76: 'SymbolClass', 77: 'Metadata', 78: 'DefineScalingGrid',
  82: 'DoABC', 83: 'DefineShape4', 84: 'DefineMorphShape2',
  86: 'DefineSceneAndFrameLabelData', 87: 'DefineBinaryData',
  88: 'DefineFontName', 89: 'StartSound2', 91: 'DefineFont4',
  17: 'DefineBitsJpeg (v1?)', 41: 'ProductInfo', 49: 'Unknown49',
};

const swfBuffer = fs.readFileSync('C:/ClaudeWork/Animate/Untitled-6.swf');
const movie = parseSwf(new Uint8Array(swfBuffer));

// Replace Uint8Arrays for JSON serialization
function replacer(key, value) {
  if (value instanceof Uint8Array) {
    return `[Uint8Array length=${value.length}]`;
  }
  if (value && value.type === 'Buffer') {
    return `[Buffer length=${value.data ? value.data.length : '?'}]`;
  }
  if (ArrayBuffer.isView(value) && !(value instanceof DataView) && !(value instanceof Uint8Array)) {
    return `[typed-array length=${value.length}]`;
  }
  return value;
}

// 1. Movie header info
console.log('=== MOVIE HEADER ===');
console.log(JSON.stringify(movie.header, replacer, 2));

// 2. Tag summary with names
console.log('\n=== TAG SUMMARY ===');
const tagCounts = {};
for (const tag of movie.tags) {
  const tagType = typeof tag.type === 'number' ? tag.type : tag.type;
  const name = TAG_NAMES[tagType] || `Unknown(${tagType})`;
  tagCounts[name] = (tagCounts[name] || 0) + 1;
}
console.log(JSON.stringify(tagCounts, null, 2));

// 3. Show every tag with its structure
console.log('\n=== ALL TAGS (FULL DETAIL) ===');
for (let i = 0; i < movie.tags.length; i++) {
  const tag = movie.tags[i];
  const tagType = typeof tag.type === 'number' ? tag.type : tag.type;
  const name = TAG_NAMES[tagType] || `Unknown(${tagType})`;
  console.log(`\n--- Tag ${i}: ${name} (type=${tagType}) ---`);
  console.log(JSON.stringify(tag, replacer, 2));
}

// 4. Full dump
console.log('\n\n=== FULL PARSED MOVIE OBJECT ===');
console.log(JSON.stringify(movie, replacer, 2));
