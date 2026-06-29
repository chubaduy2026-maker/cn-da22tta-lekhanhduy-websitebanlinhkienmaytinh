/**
 * testPcCompatibilityTool.js
 * Lightweight deterministic checks for pcCompatibilityCheck tool.
 *
 * Usage:
 *   node scripts/testPcCompatibilityTool.js
 */

const assert = require('assert');
const PCBuildTool = require('../services/ai/tools/PCBuildTool');

async function run() {
  const schema = PCBuildTool.TOOL_SCHEMA;
  assert.strictEqual(schema.name, 'pcCompatibilityCheck', 'Schema name mismatch');

  const compatibleSocket = PCBuildTool.checkSocketCompatibility(
    { name: 'Intel Core i5-13600K', socket: 'LGA1700' },
    { name: 'MSI B760', socket: 'LGA 1700', supportedRamBus: [4800, 5600, 6000] }
  );
  assert.strictEqual(compatibleSocket.compatible, true, 'Socket compatibility should pass');

  const incompatibleSocket = PCBuildTool.checkSocketCompatibility(
    { name: 'AMD Ryzen 5 7600', socket: 'AM5' },
    { name: 'ASUS Z790', socket: 'LGA1700', supportedRamBus: [5600] }
  );
  assert.strictEqual(incompatibleSocket.compatible, false, 'Socket mismatch should fail');

  const compatibleBus = PCBuildTool.checkRamBus(
    { name: 'Intel Core i5-13600K', socket: 'LGA1700' },
    { name: 'MSI B760', socket: 'LGA1700', supportedRamBus: [4800, 5600, 6000] },
    { name: 'Corsair DDR5', bus: 5600 }
  );
  assert.strictEqual(compatibleBus.compatible, true, 'RAM bus compatibility should pass');

  const incompatibleBus = PCBuildTool.checkRamBus(
    { name: 'Intel Core i7', socket: 'LGA1700' },
    { name: 'Gigabyte B760', socket: 'LGA1700', supportedRamBus: [4800, 5600] },
    { name: 'G.Skill DDR5', bus: 6400 }
  );
  assert.strictEqual(incompatibleBus.compatible, false, 'RAM bus mismatch should fail');

  console.log('pcCompatibilityCheck tests passed');
}

run().catch((error) => {
  console.error('pcCompatibilityCheck tests failed:', error.message);
  process.exit(1);
});
