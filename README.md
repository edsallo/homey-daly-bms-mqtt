# Daly BMS for Homey Pro

**English** · [Русская инструкция](README.ru.md)

Local, read-only Daly BMS monitoring over MQTT. Version **1.1.3**, Homey SDK 3. No battery control commands are provided.

## What this app is for

It brings battery charge, voltage, current, temperature and cell readings into Homey. You can view their history in Insights and use the available readings/alarms in Flows, for example to notify you of low charge. It does not replace the BMS or its safety protections.

The data path is: **Daly BMS → compatible ESP with BMS firmware → Wi-Fi/MQTT broker → this Homey app**. These are separate components: installing the Homey app does not flash the ESP or create a broker.

## ESP firmware and its paid license

The firmware is a separate project by **softwarecrash / All-Solutions**, not part of this Homey app:

- [Daly2MQTT project and wiring instructions](https://github.com/softwarecrash/Daly2MQTT).
- [100Daly2MQTT for 100Balance and newer Daly H/K/M/S series](https://github.com/softwarecrash/100Daly2MQTT). Choose by the author's compatibility instructions, not just the BMS case colour or current rating.
- [Author's web flasher](https://flash.2mqtt.de/), linked from the firmware project. Use a supported ESP board; the original Daly2MQTT recommends ESP8266/Wemos D1 Mini. Do not assume every ESP32 is compatible.
- [Firmware license from All-Solutions](https://all-solutions.store/en/store/license/).

**Full firmware functionality requires the author's paid license where the firmware's licensing applies (explicitly documented for 100Daly2MQTT).** It unlocks additional detailed data/features. Purchase and activate it according to the author's instructions. The license is tied to the BMS, not this Homey app. A purchased adapter may include a license entitlement; check your order before paying again. Price and conditions are set by the firmware author.

This Homey app has no additional license fee. It only displays the MQTT data your firmware actually publishes; it cannot unlock restricted ESP features. Its compatibility depends on the individual-topic format described below, not merely on purchasing a firmware license.

Before wiring anything, read the author's diagram and warnings: old Bluetooth and newer Wi-Fi/Bluetooth dongles can have different pinouts and supply voltages. Do not reuse their cables blindly. Choose classic individual MQTT topics, not JSON-only `Pack_Data`, for this app. Then configure Wi-Fi, the broker and base topic in the ESP firmware before adding the device to Homey.

## What you need

- Homey Pro with firmware **12.0.0 or newer**, an Athom account allowed to install apps, and a Mac or Windows computer.
- Homey and your computer must be able to communicate on the network. Internet access is needed during installation.
- A working MQTT broker already receiving Daly2MQTT telemetry. This app does not install a broker or connect directly to your BMS via Bluetooth.
- Your broker address, port, base topic and optional username/password, taken from your actual MQTT/Daly2MQTT configuration.

This is a manual source-code installation, not an App Store app. Opening the ZIP on your phone will not install it. The computer is only needed for installation; afterwards the app runs on Homey.

## 1. Install Node.js

1. Download an **LTS installer** for your operating system from [nodejs.org](https://nodejs.org/en/download).
2. Run it and follow the prompts. On Windows, keep the option to add Node.js to PATH enabled.
3. Open a new terminal: **Mac:** Command + Space → type `Terminal` → Enter. **Windows:** Start → type `cmd` → open Command Prompt.
4. Run these commands separately, pressing Enter after each:

   ```sh
   node --version
   ```

   ```sh
   npm --version
   ```

Both should display a version number. If a command is not found, reopen the terminal and check the Node.js installation.

## 2. Install Homey CLI

Homey CLI is the tool that uploads the app from your computer to Homey. Run:

```sh
npm install -g homey
```

Wait until the command finishes and you can type again. Check:

```sh
homey --version
```

For permission errors, do not change system permissions or add `sudo` blindly. Follow the [official setup guide](https://apps.developer.homey.app/the-basics/getting-started), which also describes using a Node version manager.

## 3. Download and extract the app

1. Open [this repository](https://github.com/edsallo/homey-daly-bms-mqtt), select **main**, then **Code → Download ZIP**.
2. Extract the ZIP. **Windows:** right-click → **Extract All**. **Mac:** double-click it.
3. Open the extracted folder. It must contain `app.json`, `package.json` and `drivers`. Use this folder, not the ZIP or its parent folder.

Alternatively, choose **Source code (zip)** in a [release](https://github.com/edsallo/homey-daly-bms-mqtt/releases/latest). Releases are fixed snapshots; `main` includes the latest repository changes.

## 4. Open the app folder in your terminal

**Mac:** type `cd `, including the space, drag the extracted folder from Finder into Terminal, then press Enter. Its path is inserted automatically.

**Windows:** open the extracted folder in File Explorer, click its address bar, type `cmd`, then press Enter.

Check the folder contents: run `ls` on Mac or `dir` on Windows. You should see `app.json` and `package.json`.

## 5. Install on Homey

Run each command separately and wait for it to finish before continuing.

1. Download the app's required libraries:

   ```sh
   npm install --omit=dev
   ```

2. Sign in:

   ```sh
   homey login
   ```

   A browser page opens. Sign in using the Athom account that manages your Homey and approve the requested login. Return to the terminal after success. If no page opens, follow the URL printed by the command.

3. Select your Homey:

   ```sh
   homey select
   ```

   If a list appears, use the arrow keys and Enter to choose the correct Homey.

4. Upload the app:

   ```sh
   homey app install
   ```

   Wait for the successful installation message. If an error appears, installation is not complete; keep the error text for troubleshooting.

Do **not** use `--clean`: it can remove existing app devices and settings. Use `homey app install`, not `homey app run`, which is intended for temporary development sessions. You may close the terminal after a successful installation. Docker is not needed for this install-only workflow.

## 6. Add your battery in Homey

Open the Homey mobile app → select your Homey → **Devices → + → Daly BMS** → select the Daly BMS device. Fill in the connection form:

| Field | Value |
|---|---|
| Name | Any name you choose, such as “Battery” |
| Broker | Your MQTT server IP or hostname, without `mqtt://` or `http://` |
| Port | Your broker port; commonly `1883` without TLS or `8883` with TLS |
| Base topic | The exact Daly2MQTT base topic, such as `BMS01`, without `/#` |
| Username/password | Broker credentials; leave blank only if your broker allows it |
| TLS | Enable only if your broker supports TLS; enter its matching port separately |

Tap the add button and wait for readings. Homey needs network access to the broker. Example: a topic `BMS01/Pack_Voltage` means the base topic is `BMS01`. Any example IP is only a placeholder, not a value to copy blindly.

## Updating

Download and extract the newer version, open its folder in a terminal, then run `npm install --omit=dev`, `homey select`, and `homey app install` separately. Use `homey login` first if needed. Do not uninstall the old app or use `--clean`. Existing devices and Flows should be preserved; new capabilities are added automatically.

## Troubleshooting

- **`node`/`npm` not found:** complete Step 1 and reopen the terminal.
- **`homey` not found:** complete Step 2 and reopen the terminal.
- **`package.json` not found:** you are in the wrong folder; repeat Step 4.
- **Homey not listed:** check your Athom account, permissions and Homey's network connection.
- **No readings:** check broker address, port, credentials, TLS and topic. Daly2MQTT must already publish live data; this app does not create the data source.
- **Some values are blank:** your firmware must publish those values; missing data is not invented.
- **Empty Insights:** history starts when new readings arrive; past MQTT values cannot backfill charts.

## Telemetry and Insights

History includes voltage, signed current, power, SOC, remaining Ah/kWh, BMS/MOS temperatures, cell delta, balancing current, FET states, charge/discharge Ah counters, cycles, cell extrema, balancing, Wi-Fi RSSI and alarms. Individual cell voltages (1–48) and temperature probes (1–16) are discovered from incoming topics.

Heartbeat, numeric mode, cell count, min/max cell indices, relay and manual relay mode remain available on the device/in Flow but are excluded from Insights. Wi-Fi history is retained. Numeric mode: 0 stationary, 1 charge, 2 discharge, 3 offline, 4 unknown.

Low-battery threshold: 20% by default. Fresh-data timeout: 300 seconds; 0 disables the check. Retained MQTT readings do not prove the BMS is live. Only individual `<base>/<parameter>` topics are supported; JSON `Pack_Data` is not processed. No HTTP API or BMS control commands. App ID: `com.daly.bms`; driver: `daly-monitor`. Passwords are not logged.

## Developer checks

```sh
node --test tests/*.test.js
homey app validate
```

[Official Homey CLI documentation](https://apps.developer.homey.app/the-basics/getting-started/homey-cli) · [Daly2MQTT protocol source](https://github.com/softwarecrash/Daly2MQTT)
