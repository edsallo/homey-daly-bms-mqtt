# Daly BMS for Homey Pro / Daly BMS для Homey Pro

Local, read-only MQTT monitoring of Daly BMS telemetry. Version 1.1.3, Homey SDK 3.
Локальный мониторинг Daly BMS через MQTT. Версия 1.1.3, Homey SDK 3.

## Установка и обновление

1. Установите Node.js и Homey CLI: `npm install -g homey`.
2. В папке приложения: `npm install --omit=dev`.
3. Выполните `homey login`, выберите Homey и установите: `homey app install`.
4. Не используйте `--clean`: обычная установка сохраняет устройства и Flow.
5. При добавлении укажите IP/имя брокера, порт, базовый MQTT-топик и при необходимости учётные данные. Для TLS включите переключатель и задайте порт брокера (обычно 8883).

Идентификатор приложения остаётся `com.daly.bms`, драйвера — `daly-monitor`. Новые capabilities и настройки Insights добавляются уже подключённым устройствам автоматически. Старые идентификаторы и внутренние store-ключи сохранены. Пароль не выводится в журнал.

## Параметры и Insights

История включена для основных числовых и логических параметров:
напряжение, ток со знаком, мощность, SOC, остаток Ah/kWh, температуры BMS/MOS,
дельта ячеек, ток балансировки, зарядный и разрядный FET, суммарные Ah заряда/разряда,
циклы, напряжения минимальной и максимальной ячейки,
балансировка, Wi-Fi RSSI, сигналы низкого заряда и ошибки BMS.

Напряжения `Pack_Cells_Voltage/Cell_N` (1–48) и температуры
`Pack_Cell_Temperature_N` (1–16) создаются по мере поступления, с отдельными графиками.
Если прошивка не публикует показатель, он остаётся без значения: приложение его не выдумывает.

Текстовые статус и описание ошибок остаются доступны в карточке и тегах.
Числовой параметр «Режим BMS» означает: 0 — покой, 1 — заряд, 2 — разряд, 3 — offline,
4 — неизвестный режим. Текст ошибок сопровождается логическим `alarm_generic`.
С версии 1.1.2 запись в Insights отключена для heartbeat, числового режима,
числа ячеек, номеров минимальной/максимальной ячейки, реле и ручного режима реле.
Эти параметры остаются в карточке и Flow. График Wi-Fi сохранён.
История новых параметров начинается после обновления; прошлые значения из MQTT восстановить нельзя.

Порог `alarm_battery` задаётся в настройках (по умолчанию 20%).
Тайм-аут свежих данных — 300 секунд; 0 отключает проверку. Сохранённые retained-сообщения
обновляют значения, но сами по себе не доказывают, что BMS доступна сейчас.

## MQTT

Топики — `<base>/<parameter>`, например `BMS01/Pack_Voltage`.
Поддерживаются индивидуальные топики Daly2MQTT; JSON `Pack_Data` не обрабатывается.
В приложении нет команд управления FET или реле и нет заявленного ранее HTTP API.

## Installation and upgrade

Install Node.js and Homey CLI (`npm install -g homey`), then run
`npm install --omit=dev`, `homey login`, and `homey app install` from this folder.
Use a normal install, without `--clean`, to preserve paired devices and Flows.
Enter the MQTT broker hostname/IP, port, base topic, and optional credentials during pairing.
TLS is optional; choose the corresponding broker port explicitly.

Core numeric and boolean readings have Insights enabled, including FET states,
charge/discharge Ah counters, cycles, cell extrema, balancing states and signal strength.
Individual cell voltages and temperature probes are discovered from incoming topics.
Existing devices are migrated automatically. No historical data can be backfilled.

The raw textual status is preserved. Its companion numeric mode parameter uses:
0 stationary, 1 charge, 2 discharge, 3 offline, 4 unknown.
Text error messages have a companion boolean alarm. Unsupported/unpublished fields stay empty.
Since 1.1.2, heartbeat, numeric mode, cell count, min/max cell indices, relay and manual
relay mode are excluded from Insights but remain available on the device and in Flow.
Wi-Fi signal history is retained.
Signed current is preserved (older versions incorrectly applied an absolute value).

Low-battery threshold defaults to 20%; telemetry timeout defaults to 300 seconds
(0 disables it). Retained MQTT values do not count as a live heartbeat.
Only individual MQTT topics are supported; no HTTP API or BMS control commands are exposed.

## Verification

`node --test tests/*.test.js`

`homey app validate`

Protocol reference: [Daly2MQTT source](https://github.com/softwarecrash/Daly2MQTT).
