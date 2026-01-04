/**
 * electron-builder onNodeModuleFile hook
 * Returns null to skip all node_modules processing by electron-builder
 * We handle dependencies manually in afterPack.js to avoid infinite recursion
 */
exports.default = function onNodeModuleFile(file) {
  // Skip all node_modules files during scanning
  // We'll copy required dependencies in afterPack hook
  return null;
};
