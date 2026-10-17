'use strict';

const Homey = require('homey');
const mqtt = require('mqtt');
const { TOPICS, parseValue, validateSettings, dynamicMetric } = require('../../lib/telemetry');
const driverManifest = require('../../app.json').drivers.find(driver => driver.id === 'daly-monitor');

module.exports = class DalyBMSDevice extends Homey.Device {
  async onInit() {
    this._queue = Promise.resolve();
    this._stopped = false;
    for (const id of driverManifest.capabilities) {
      if (!this.hasCapability(id)) await this.addCapability(id);
    }
    // Existing devices need options applied explicitly; the driver manifest alone
    // does not migrate capabilities that were paired by older releases.
    for (const id of this.getCapabilities()) {
      const options = { ...driverManifest.capabilitiesOptions[id] };
      const dynamic = /^(measure_voltage\.cell_|measure_temperature\.probe_)(\d+)$/.exec(id);
      if (dynamic) {
        const cell = dynamic[1] === 'measure_voltage.cell_';
        options.title = {
          en: (cell ? 'Cell ' : 'Temperature ') + dynamic[2] + ' BMS',
          ru: (cell ? 'Ячейка ' : 'Температура ') + dynamic[2] + ' BMS',
        };
        options.decimals = cell ? 3 : 1;
      }
      if (id !== 'measure_status' && id !== 'bms_failure') options.preventInsights ??= false;
      await this.setCapabilityOptions(id, options);
    }
    await this.setUnavailable(this.homey.__('errors.connecting'));
    this.homey.on('unload', () => this.disconnectMQTT());
    try {
      this.connectMQTT(validateSettings(this.getSettings()));
    } catch (err) {
      await this.setUnavailable(this.homey.__('errors.' + err.message));
    }
  }

  async updateIfChanged(id, value) {
    if (this.getCapabilityValue(id) !== value) await this.setCapabilityValue(id, value);
  }

  connectMQTT(settings) {
    this.settings = settings;
    this._lastTelemetry = Date.now();
    this._offline = false;
    const client = mqtt.connect(
      (settings.mqttTls ? 'mqtts://' : 'mqtt://') + settings.mqttBroker,
      {
        port: settings.mqttPort, keepalive: 60, reconnectPeriod: 5000,
        connectTimeout: 15000, clientId: 'homey-daly-' + require('crypto').randomBytes(8).toString('hex'),
        ...(settings.mqttUser ? { username: settings.mqttUser, password: settings.mqttPassword || '' } : {}),
      },
    );
    this.client = client;
    const current = () => this.client === client && !this._stopped;
    client.on('connect', () => {
      if (!current()) return;
      client.subscribe(settings.mqttTopic + '/#', { qos: 0 }, (err, granted) => {
        if (!current()) return;
        if (err || !granted || granted.some(item => item.qos === 128)) {
          this.setUnavailable(this.homey.__('errors.subscription')).catch(error => this.error(error));
        }
        // Available is set only after valid BMS telemetry, not just a broker connection.
      });
    });
    client.on('message', (topic, message, packet) => {
      if (!current() || !topic.startsWith(settings.mqttTopic + '/')) return;
      const key = topic.slice(settings.mqttTopic.length + 1);
      this._queue = this._queue.then(async () => {
        if (!current()) return;
        const accepted = await this.handleTelemetry(key, message);
        if (!accepted) return;
        // Retained values are useful for the UI but do not prove a live BMS.
        if (!packet?.retain) {
          this._lastTelemetry = Date.now();
          if (!this._offline) await this.setAvailable();
        }
      }).catch(err => this.error('Telemetry update failed', err));
    });
    client.on('error', () => {
      if (current()) this.setUnavailable(this.homey.__('errors.connection')).catch(err => this.error(err));
    });
    client.on('close', () => {
      if (current()) this.setUnavailable(this.homey.__('errors.disconnected')).catch(err => this.error(err));
    });
    if (settings.telemetryTimeout > 0) {
      this._timer = this.homey.setInterval(() => {
        if (current() && Date.now() - this._lastTelemetry > settings.telemetryTimeout * 1000) {
          this.setUnavailable(this.homey.__('errors.stale')).catch(err => this.error(err));
        }
      }, 10000);
    }
  }

  async handleTelemetry(topic, raw) {
    if (topic === 'Pack_Status') {
      const text = String(raw).trim();
      if (!text) return false;
      await this.updateIfChanged('measure_status', text);
      const code = { stationary: 0, idle: 0, charge: 1, charging: 1, discharge: 2, discharging: 2, offline: 3 }[text.toLowerCase()] ?? 4;
      await this.updateIfChanged('measure_status_code', code);
      this._offline = code === 3;
      if (this._offline) await this.setUnavailable(this.homey.__('errors.bms_offline'));
      return true;
    }
    if (topic === 'Pack_Failure') {
      const text = String(raw).trim();
      await this.updateIfChanged('bms_failure', text || this.homey.__('values.no_failure'));
      await this.updateIfChanged('alarm_generic', !['', '0', 'none', 'false', '[]', 'no error', 'no errors'].includes(text.toLowerCase()));
      return true;
    }
    const metric = dynamicMetric(topic);
    const entry = TOPICS[topic];
    if (!metric && !entry) return false;
    const value = parseValue(raw, metric ? 'number' : entry[1]);
    if (value === null) return false;
    const id = metric ? metric.id : entry[0];
    if (id === 'measure_battery' && (value < 0 || value > 100)) return false;
    if (metric && !this.hasCapability(id)) {
      await this.addCapability(id);
      await this.setCapabilityOptions(id, {
        title: {
          en: (metric.kind === 'cell' ? 'Cell ' : 'Temperature ') + metric.index + ' BMS',
          ru: (metric.kind === 'cell' ? 'Ячейка ' : 'Температура ') + metric.index + ' BMS',
        },
        decimals: metric.kind === 'cell' ? 3 : 1,
        preventInsights: false,
      });
    }
    await this.updateIfChanged(id, value);
    if (id === 'measure_battery') await this.updateIfChanged('alarm_battery', value <= this.settings.lowBattery);
    // Preserve legacy store keys for consumers of old releases.
    const legacy = { charge_fet: 'chargeFET', discharge_fet: 'dischargeFET',
      meter_discharge_ah: 'totalAhDischarge', meter_charge_ah: 'totalAhCharge', measure_cycles: 'cycles' }[id];
    if (legacy && this.getStoreValue(legacy) !== value) await this.setStoreValue(legacy, value);
    return true;
  }

  disconnectMQTT() {
    if (this._timer) this.homey.clearInterval(this._timer);
    this._timer = null;
    const client = this.client;
    this.client = null;
    if (client) client.end(true);
  }

  async onSettings({ newSettings }) {
    let settings;
    try { settings = validateSettings(newSettings); }
    catch (err) { throw new Error(this.homey.__('errors.' + err.message)); }
    this.disconnectMQTT();
    await this._queue;
    await this.setUnavailable(this.homey.__('errors.connecting'));
    this.connectMQTT(settings);
  }

  async onDeleted() {
    this._stopped = true;
    this.disconnectMQTT();
    await this._queue;
  }
};
