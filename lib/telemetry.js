'use strict';

// Topic names follow Daly2MQTT; do not change existing capability IDs on upgrade.
const TOPICS = {
  Pack_Voltage: ['bms_voltage', 'number'],
  Pack_Current: ['bms_current', 'number'],
  Pack_Power: ['measure_power', 'number'],
  Pack_SOC: ['measure_battery', 'number'],
  Pack_Remaining_Ah: ['measure_capacity_ah', 'number'],
  Pack_Remaining_kWh: ['measure_remaining_energy', 'number'],
  Pack_BMS_Temperature: ['bms_temperature', 'number'],
  Pack_MOS_Temperature: ['mos_temperature', 'number'],
  Pack_Cell_Difference: ['measure_delta', 'number'],
  Pack_Balance_Current_mA: ['measure_balancing_current', 'number'],
  Pack_ChargeFET: ['charge_fet', 'boolean'],
  Pack_DischargeFET: ['discharge_fet', 'boolean'],
  Pack_TotalAh_DisChrg: ['meter_discharge_ah', 'number'],
  Pack_TotalAh_Chrg: ['meter_charge_ah', 'number'],
  Pack_Cycles: ['measure_cycles', 'number'],
  Pack_Cells: ['measure_cell_count', 'number'],
  Pack_Heartbeat: ['measure_heartbeat', 'number'],
  Pack_Cell_High: ['measure_cell_high_index', 'number'],
  Pack_Cell_Low: ['measure_cell_low_index', 'number'],
  Pack_Cell_High_Voltage: ['measure_cell_high_voltage', 'number'],
  Pack_Cell_Low_Voltage: ['measure_cell_low_voltage', 'number'],
  Pack_Balance_Active: ['balance_active', 'boolean'],
  Pack_Relais: ['relay_active', 'boolean'],
  Pack_Relais_Manual: ['relay_manual', 'boolean'],
  Wifi_RSSI: ['measure_wifi_rssi', 'number'],
};

function parseValue(raw, type) {
  const text = String(raw).trim();
  if (type === 'number') {
    if (!text || !/^[+-]?(?:\d+\.?\d*|\.\d+)(?:e[+-]?\d+)?$/i.test(text)) return null;
    const value = Number(text);
    return Number.isFinite(value) ? value : null;
  }
  if (/^(true|on|1)$/i.test(text)) return true;
  if (/^(false|off|0)$/i.test(text)) return false;
  return null;
}

function validateSettings(settings) {
  const broker = String(settings.mqttBroker || '').trim();
  const port = Number(settings.mqttPort ?? 1883);
  const topic = String(settings.mqttTopic || '').trim().replace(/\/+$/, '');
  if (!broker || /[\s/@?#]/.test(broker) || broker.includes('://')) throw new Error('invalid_broker');
  if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('invalid_port');
  if (!topic || /[+#\u0000]/.test(topic)) throw new Error('invalid_topic');
  const lowBattery = Number(settings.lowBattery ?? 20);
  const timeout = Number(settings.telemetryTimeout ?? 300);
  if (!Number.isFinite(lowBattery) || lowBattery < 0 || lowBattery > 100) throw new Error('invalid_threshold');
  if (!Number.isInteger(timeout) || timeout < 0 || timeout > 86400) throw new Error('invalid_timeout');
  return { ...settings, mqttBroker: broker, mqttPort: port, mqttTopic: topic, lowBattery, telemetryTimeout: timeout };
}

function dynamicMetric(topic) {
  let match = /^Pack_Cells_Voltage\/Cell_(\d+)$/.exec(topic);
  if (match && +match[1] >= 1 && +match[1] <= 48) return { id: `measure_voltage.cell_${+match[1]}`, kind: 'cell', index: +match[1] };
  match = /^Pack_Cell_Temperature_(\d+)$/.exec(topic);
  if (match && +match[1] >= 1 && +match[1] <= 16) return { id: `measure_temperature.probe_${+match[1]}`, kind: 'temperature', index: +match[1] };
  return null;
}

module.exports = { TOPICS, parseValue, validateSettings, dynamicMetric };
