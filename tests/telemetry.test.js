'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const { EventEmitter } = require('node:events');
const { TOPICS, parseValue, validateSettings, dynamicMetric } = require('../lib/telemetry');
const manifest = require('../drivers/daly-monitor/driver.compose.json');

function device() {
  const clients = [];
  class Device {
    constructor() {
      this.values = {}; this.options = {}; this.store = {};
      this.settings = validateSettings({ mqttBroker: 'localhost', mqttTopic: 'BMS01', mqttPort: 1883 });
      this.caps = new Set(manifest.capabilities.slice(0, 10));
      this.homey = { __: k => k, on() {}, setInterval: () => 1, clearInterval() {} };
    }
    getSettings() { return this.settings; }
    getCapabilities() { return [...this.caps]; }
    hasCapability(id) { return this.caps.has(id); }
    async addCapability(id) { this.caps.add(id); }
    async setCapabilityOptions(id, options) { this.options[id] = options; }
    getCapabilityValue(id) { return this.values[id] ?? null; }
    async setCapabilityValue(id, value) { this.values[id] = value; }
    getStoreValue(id) { return this.store[id]; }
    async setStoreValue(id, value) { this.store[id] = value; }
    async setAvailable() { this.available = true; }
    async setUnavailable(reason) { this.available = false; this.reason = reason; }
    error() {}
  }
  const mqtt = { connect(url) {
    const client = new EventEmitter(); client.url = url;
    client.subscribe = (topic, options, callback) => { client.topic = topic; callback(null, [{ qos: 0 }]); };
    client.end = () => { client.ended = true; client.emit('close'); };
    clients.push(client); return client;
  } };
  const context = { module: { exports: {} }, require(id) {
    if (id === 'homey') return { Device };
    if (id === 'mqtt') return mqtt;
    if (id === '../../lib/telemetry') return require('../lib/telemetry');
    if (id === '../../app.json') return { drivers: [manifest] };
    return require(id);
  } };
  vm.runInNewContext(fs.readFileSync(require.resolve('../drivers/daly-monitor/device'), 'utf8'), context);
  return { instance: new context.module.exports(), clients };
}

test('invalid or empty numeric payloads never become zero or infinity', () => {
  for (const raw of ['', ' ', 'null', 'NaN', 'Infinity', '1e999', '12V']) assert.equal(parseValue(raw, 'number'), null);
  assert.equal(parseValue('-2.6', 'number'), -2.6);
  assert.equal(parseValue(' false ', 'boolean'), false);
  assert.equal(parseValue('ON', 'boolean'), true);
});

test('connection settings reject wildcards and invalid ports before reconnect', () => {
  for (const settings of [{ mqttBroker: 'mqtt://host', mqttTopic: 'BMS' }, { mqttBroker: 'host', mqttTopic: 'BMS/#' }, { mqttBroker: 'host', mqttTopic: 'BMS', mqttPort: 0 }]) assert.throws(() => validateSettings(settings));
});

test('useful metrics have Insights; service metrics remain available without logs', () => {
  const excluded = new Set(['measure_heartbeat', 'measure_status_code', 'measure_cell_count',
    'measure_cell_high_index', 'measure_cell_low_index', 'relay_active', 'relay_manual']);
  for (const [id] of Object.values(TOPICS)) {
    assert.ok(manifest.capabilities.includes(id), id);
    assert.equal(manifest.capabilitiesOptions[id].preventInsights, excluded.has(id), id);
  }
});

test('upgrade adds missing capabilities and enables Insights on existing devices', async () => {
  const { instance: d } = device(); await d.onInit();
  assert.equal(d.getCapabilities().length, manifest.capabilities.length);
  assert.equal(d.options.meter_charge_ah.preventInsights, false);
  assert.equal(d.options.measure_wifi_rssi.preventInsights, false);
  assert.equal(d.options.measure_heartbeat.preventInsights, true);
  assert.equal(d.options.measure_status_code.preventInsights, true);
  assert.equal(d.options.relay_active.preventInsights, true);
  await d.onDeleted();
});

test('signed current, FET, cycles, alarms and discovered cells update safely', async () => {
  const { instance: d } = device(); await d.onInit();
  await d.handleTelemetry('Pack_Current', '-3.5'); assert.equal(d.values.bms_current, -3.5);
  await d.handleTelemetry('Pack_ChargeFET', 'true'); assert.equal(d.values.charge_fet, true);
  await d.handleTelemetry('Pack_Cycles', '123'); assert.equal(d.values.measure_cycles, 123);
  await d.handleTelemetry('Pack_SOC', '10'); assert.equal(d.values.alarm_battery, true);
  await d.handleTelemetry('Pack_SOC', '110'); assert.equal(d.values.measure_battery, 10);
  await d.handleTelemetry('Pack_Cells_Voltage/Cell_8', '3.32'); assert.equal(d.values['measure_voltage.cell_8'], 3.32);
  assert.equal(d.options['measure_voltage.cell_8'].preventInsights, false);
  assert.equal(dynamicMetric('Pack_Cells_Voltage/Cell_999'), null);
  await d.onDeleted();
});

test('topic change resubscribes and stale client events cannot overwrite availability', async () => {
  const { instance: d, clients } = device(); await d.onInit();
  clients[0].emit('connect'); assert.equal(clients[0].topic, 'BMS01/#');
  await d.onSettings({ newSettings: { ...d.settings, mqttTopic: 'BMS02' } });
  clients[1].emit('connect'); assert.equal(clients[1].topic, 'BMS02/#');
  clients[1].emit('message', 'BMS02/Pack_Voltage', Buffer.from('26.7'), { retain: false }); await d._queue;
  assert.equal(d.available, true);
  clients[0].emit('close'); assert.equal(d.available, true);
  clients[1].emit('message', 'BMS02/Pack_Status', Buffer.from('Offline'), { retain: false }); await d._queue;
  assert.equal(d.available, false);
  await d.onDeleted(); assert.equal(clients[1].ended, true);
});
