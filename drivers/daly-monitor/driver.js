'use strict';

const Homey = require('homey');
const { randomUUID } = require('crypto');
const { validateSettings } = require('../../lib/telemetry');

module.exports = class DalyBMSDriver extends Homey.Driver {
  async onPair(session) {
    session.setHandler('validate_connection', async input => {
      try {
        return {
          name: String(input.name || 'Daly BMS').trim() || 'Daly BMS',
          data: { id: 'daly-bms-mqtt-' + randomUUID() },
          settings: validateSettings(input.settings),
        };
      } catch (err) {
        throw new Error(this.homey.__('errors.' + err.message));
      }
    });
  }
};
