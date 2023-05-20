![Logo](admin/spritmonitor.svg)

# ioBroker.spritmonitor

[![NPM version](https://img.shields.io/npm/v/iobroker.spritmonitor.svg)](https://www.npmjs.com/package/iobroker.spritmonitor)
[![Downloads](https://img.shields.io/npm/dm/iobroker.spritmonitor.svg)](https://www.npmjs.com/package/iobroker.spritmonitor)
![Number of Installations](https://iobroker.live/badges/spritmonitor-installed.svg)
![Current version in stable repository](https://img.shields.io/badge/stable-not%20published-%23264777)

<!-- ![Current version in stable repository](https://iobroker.live/badges/spritmonitor-stable.svg) -->

[![NPM](https://nodei.co/npm/iobroker.spritmonitor.png?downloads=true)](https://nodei.co/npm/iobroker.spritmonitor/)

![Test and Release](https://github.com/ice987987/ioBroker.spritmonitor/workflows/Test%20and%20Release/badge.svg)

[![Donate](https://img.shields.io/badge/donate-paypal-blue?style=flat)](https://paypal.me/ice987987)

## spritmonitor adapter for ioBroker

This adapter allows you to manage your fuel consumption via [spritmonitor.de](http://www.spritmonitor.de).

## Disclaimer

All product and company names or logos are trademarks™ or registered® trademarks of their respective holders. Use of them does not imply any affiliation with or endorsement by them or any associated subsidiaries! This personal project is maintained in spare time and has no business goal. Spritmonitor is a trademark of Fisch und Fischl GmbH, D-94136 Thyrnau.

## Installation requirements

-   node.js >= v14.0 is required
-   js-controller >= v4.0.23 is required
-   admin >= v6.2.21 is required
-   Application Key, generated by [spritmonitor.de](https://www.spritmonitor.de/en/my_account/change_password.html), is required

## Controls

-   `.ACTIONS.UPDATE`: Update values
-   `.ACTIONS.ADD.ADD`: Add a new fueling
-   `.ACTIONS.ADD.vehicleId`[^1]: Numeric ID of the vehicle to get fuelings for
-   `.ACTIONS.ADD.tankId`[^1]: Numeric ID of the tank to get fuelings for
-   `.ACTIONS.ADD.date`[^1]: Date of the fueling to be added (requied format: `DD.MM.YYYY`)
-   `.ACTIONS.ADD.odometer`: Odometer of the fueling to be added
-   `.ACTIONS.ADD.trip`[^1]: Trip of the fueling to be added
-   `.ACTIONS.ADD.quantity`[^1]: Amount of fuel of the fueling to be added
-   `.ACTIONS.ADD.type`[^1]: Type of fueling to be added (allowed values: `invalid`, `full`, `notfull`, `first`)
-   `.ACTIONS.ADD.price`: Price of the fueling to be added
-   `.ACTIONS.ADD.currencyid`: Numerical ID of the currency of the fueling to be added (allowed values see `.general.currencies`)
-   `.ACTIONS.ADD.pricetype`: Numeric ID of price (allowed values: `0`: total price, `1`: unit / liter price)
-   `.ACTIONS.ADD.fuelsortid`[^1]: Numeric ID of the fuelsort of the fueling to be added (allowed values see `.general.fuelsorts`)
-   `.ACTIONS.ADD.quantityunitid`[^1]: Numeric ID of quantity unit (allowed values see `.general.quantityunits`)
-   `.ACTIONS.ADD.note`: Free text note of the user for the fueling to be added
-   `.ACTIONS.ADD.stationname`: Gas station company for the fueling to be added
-   `.ACTIONS.ADD.location`: Free text location name for the fueling to be added
-   `.ACTIONS.ADD.country`: Country of the gas station for the fueling to be added
-   `.ACTIONS.ADD.bc_consumption`: Consumption according to the vehicle's bordcomputer
-   `.ACTIONS.ADD.bc_quantity`: Consumed quantity according to the vehicle's bordcomputer
-   `.ACTIONS.ADD.bc_speed`: Average speed according to the vehicle's bordcomputer
-   `.ACTIONS.ADD.position_lat`: Latitude of gas station
-   `.ACTIONS.ADD.position_long`: Longitude of gas station
-   `.ACTIONS.ADD.attributes`: Combination of one tire type (`wintertires`, `summertires`, `allyeartires`) and one driving style (`slow`, `normal`, `fast`) and one or more extras (`ac`, `heating`, `trailer`)
-   `.ACTIONS.ADD.streets`: Combination of `city` and/or `autobahn` and/or `land`
-   `.ACTIONS.DEL.DEL`: Delete a fueling
-   `.ACTIONS.DEL.vehicleId`[^1]: Numeric ID of the vehicle to delete a fueling for
-   `.ACTIONS.DEL.tankId`[^1]: Numeric ID of the tank to delete a fueling for
-   `.ACTIONS.DEL.fuelingId`[^1]: Numeric ID of the fueling to be deleted
-   `Area` / `Grossraum` is not supported by the API

[^1]: required values

## Available values (readonly)

-   `.[vehicleID].id`: Vehicle ID
-   `.[vehicleID].make`: Make
-   `.[vehicleID].model`: Model
-   `.[vehicleID].consumption`: Consumption value of this fuel type
-   `.[vehicleID].consumptionunit`: Name of consumption unit
-   `.[vehicleID].tripsum`: Amount of driven distance for this tank (for consumption calculation)
-   `.[vehicleID].tripunit`: Trip unit
-   `.[vehicleID].quantitysum`: Amount of tanked fuel for this tank (for consumption calculation)
-   `.[vehicleID].maintank`: Maintank
-   `.[vehicleID].maintanktype`: Type of tank
-   `.[vehicleID].sign`: Sign
-   `.[vehicleID].picture_ts`: picture_ts
-   `.[vehicleID].bcconsumptionunit`: Bordcomputer consumption unit
-   `.[vehicleID].country`: Country
-   `.[vehicleID].tanks.[tankID].id`: Tank ID
-   `.[vehicleID].tanks.[tankID].fuelsorttype`: Type of tank
-   `.[vehicleID].tanks.[tankID].quantityunittype`: Quantity type of tank
-   `.[vehicleID].tanks.[tankID].name`: Name of fueltype in tank
-   `.[vehicleID].tanks.[tankID].consumption`: Consumption value of this fuel type
-   `.[vehicleID].tanks.[tankID].consumptionunit`: Name of consumption unit
-   `.[vehicleID].tanks.[tankID].consumptionunitid`: Numerical ID of consumption format
-   `.[vehicleID].tanks.[tankID].co2`: Emission of CO₂ for this vehicle in g/km
-   `.[vehicleID].tanks.[tankID].co2tripsum`: Amount of driven distance for which CO₂ was calculated
-   `.[vehicleID].tanks.[tankID].co2quantitysum`: Amount of emissioned CO₂ in kg
-   `.[vehicleID].tanks.[tankID].costsum`: Amount of money spent for fuel for this tank
-   `.[vehicleID].tanks.[tankID].costsumunit`: Currency of the fuel expenses
-   `.[vehicleID].tanks.[tankID].costtripsum`: Amount of driven distance for which the fuel expenses have been summed
-   `.[vehicleID].tanks.[tankID].tripsum`: Amount of driven distance for this tank (for consumption calculation)
-   `.[vehicleID].tanks.[tankID].tripsumunit`: Unit for driven distance (km, mi)
-   `.[vehicleID].tanks.[tankID].quantitysum`: Amount of tanked fuel for this tank (for consumption calculation)
-   `.[vehicleID].tanks.[tankID].quantitysumunit`: Unit for tanked fuel (l, GAL, kg, kWh, ...)
-   `.[vehicleID].fuelings.raw`: A JSON array of fuelings
-   `.[vehicleID].costsnotes.raw`: A JSON array of costs / notes
-   `.reminders.raw`: A JSON array of reminders
-   `.general.companies`: List of supported companies, IDs and names
-   `.general.currencies`: List of supported currencies, IDs and names
-   `.general.fuelsorts`: List of supported fuelsorts, IDs and names
-   `.general.quantityunits`: List of supported quantityunits, IDs and names

## How to report issues and feature requests

-   For issues please use [GitHub issues](https://github.com/ice987987/ioBroker.spritmonitor/issues/new/choose) -> "Bug report" and fill in the form.

    Set the adapter to debug log mode (Instances -> Expert mode -> Column Log level). Get the logfile from disk (subdirectory "log" in ioBroker installation directory and not from Admin because Admin cuts the lines). Check that there are no personal information before you publish your log.

-   For feature requests please use [GitHub issues](https://github.com/ice987987/ioBroker.spritmonitor/issues/new/choose) -> "Feature request" and fill in the form.

## Changelog

<!-- ### **WORK IN PROGRESS** -->

### 0.0.2-beta.7

-   (ice987987) BREAKING: `.[vehicleID].fuelings.[year].raw` and `.[vehicleID].costsnotes.[year].raw` removed
-   (ice987987) possibility to add and delete values added
-   (ice987987) all tanks added
-   (ice987987) `[vehicleID].costsnotes.[year].raw` and `[vehicleID].fuelings.[year].raw` added
-   (ice987987) `.ACTIONS.ADD.attributes` and `.ACTIONS.ADD.streets` added
-   (ice987987) `.general.companies`, `general.currencies`, `.general.fuelsorts` and `.general.quantityunits` added
-   (ice987987) dependencies updated
-   (ice987987) gui validator replaced

### 0.0.1 (26.11.2022)

-   (ice987987) initial release

## License

MIT License

Copyright (c) 2023 ice987987 <mathias.frei1@gmail.com>

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
