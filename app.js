'use strict';

const Homey = require('homey');

module.exports = class DalyBMSApp extends Homey.App {
  async onInit() {
    this.log('Daly BMS MQTT started');
  }
};
