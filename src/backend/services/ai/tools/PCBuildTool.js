/**
 * MODULE 4: PCBuildTool
 * Deterministic compatibility checks for PC build.
 * LLM must call this tool and must not self-derive compatibility.
 */

function normalizeText(value) {
  return String(value || '').trim().toUpperCase().replace(/\s+/g, '');
}

function checkSocketCompatibility(cpu, mainboard) {
  const cpuSocket = normalizeText(cpu?.socket);
  const mbSocket = normalizeText(mainboard?.socket);

  if (!cpuSocket || !mbSocket) {
    return {
      compatible: false,
      reason: 'Missing socket data on CPU or Mainboard',
      details: {
        cpuSocket,
        mainboardSocket: mbSocket
      }
    };
  }

  const compatible = cpuSocket === mbSocket;

  return {
    compatible,
    reason: compatible ? 'CPU socket matches mainboard socket' : 'Socket mismatch',
    details: {
      cpuSocket,
      mainboardSocket: mbSocket
    }
  };
}

function checkRamBus(cpu, mainboard, ram) {
  const ramBus = Number(ram?.bus);
  const boardSupported = Array.isArray(mainboard?.supportedRamBus)
    ? mainboard.supportedRamBus.map((v) => Number(v)).filter(Number.isFinite)
    : [];

  if (!Number.isFinite(ramBus) || boardSupported.length === 0) {
    return {
      compatible: false,
      reason: 'Missing RAM bus or mainboard supported bus list',
      details: {
        ramBus: Number.isFinite(ramBus) ? ramBus : null,
        boardSupported
      }
    };
  }

  const compatible = boardSupported.includes(ramBus);

  return {
    compatible,
    reason: compatible ? 'RAM bus is supported by mainboard' : 'RAM bus is not supported by mainboard',
    details: {
      ramBus,
      boardSupported,
      cpuName: cpu?.name || null
    }
  };
}

const TOOL_SCHEMA = {
  name: 'pcCompatibilityCheck',
  description: 'Deterministic PC compatibility checker. Must be called before giving compatibility verdict.',
  strict: true,
  input_schema: {
    type: 'object',
    properties: {
      cpu: {
        type: 'object',
        properties: {
          name: { type: 'string' },
          socket: { type: 'string' }
        },
        required: ['name', 'socket'],
        additionalProperties: true
      },
      mainboard: {
        type: 'object',
        properties: {
          name: { type: 'string' },
          socket: { type: 'string' },
          supportedRamBus: {
            type: 'array',
            items: { type: 'number' }
          }
        },
        required: ['name', 'socket', 'supportedRamBus'],
        additionalProperties: true
      },
      ram: {
        type: 'object',
        properties: {
          name: { type: 'string' },
          bus: { type: 'number' }
        },
        required: ['name', 'bus'],
        additionalProperties: true
      }
    },
    required: ['cpu', 'mainboard', 'ram'],
    additionalProperties: false
  },
  policy: {
    llm_must_call_tool: true,
    llm_must_not_self_reason_compatibility: true
  }
};

module.exports = {
  TOOL_SCHEMA,
  checkSocketCompatibility,
  checkRamBus
};
