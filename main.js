'use strict';

/*
 * Created with @iobroker/create-adapter v2.3.0
 */

// The adapter-core module gives you access to the core ioBroker functions
// you need to create an adapter
const utils = require('@iobroker/adapter-core');

// Load your modules here, e.g.:
const axios = require('axios');

// variables
const isValidApplicationKey = /[a-zA-Z0-9]{50}/; // format: xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
const vehicleIDs = [];

class Spritmonitor extends utils.Adapter {
	/**
	 * @param {Partial<utils.AdapterOptions>} [options={}]
	 */
	constructor(options) {
		super({
			...options,
			name: 'spritmonitor',
		});
		this.on('ready', this.onReady.bind(this));
		this.on('stateChange', this.onStateChange.bind(this));
		// this.on('objectChange', this.onObjectChange.bind(this));
		// this.on('message', this.onMessage.bind(this));
		this.on('unload', this.onUnload.bind(this));

		this.requestClient = axios.create();

		this.vehicles = {};

		this.requestInterval = null;
		this.firstStart = true;
	}

	/**
	 * Is called when databases are connected and adapter received configuration.
	 */
	async onReady() {
		// Initialize your adapter here
		this.log.info('starting adapter "spritmonitor"...');

		// The adapters config (in the instance object everything under the attribute "native") is accessible via this.config:
		this.log.debug(`config.bearer_token: ${this.config.applicationKey}`);

		// check applicationKey
		if (!isValidApplicationKey.test(this.config.applicationKey)) {
			this.log.error(
				'"Application Key" is not valid (allowed format: xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx) (ERR_#001)',
			);
			return;
		}
		// check requestInterval
		if (this.config.requestInterval <= 6 && this.config.requestInterval >= 168) {
			this.log.error(
				'"Time interval to retrieve values" is not valid (6 <= t <= 168 hours) (ERR_#002)',
			);
			return;
		}

		this.log.debug('The configuration has been checked successfully. Trying to connect "Spritmonitor API"...');

		try {
			// get all vehicles
			await this.getVehicles();
			await this.createObjects(this.vehicles);
			await this.fillObjectsVehicles(this.vehicles);

			// some more variables
			for (let i = 0; i < vehicleIDs.length; i++) {
				await this.getTanks(vehicleIDs[i]);
				await this.getFuelings(vehicleIDs[i]);
				await this.getCostnotes(vehicleIDs[i]);
				await this.getReminders();
			}

			this.log.info(`Starting polltimer with a ${this.config.requestInterval}h interval.`);
			this.requestInterval = setInterval(async () => {
				await this.getVehicles();
				await this.fillObjectsVehicles(this.vehicles);

				for (let i = 0; i < vehicleIDs.length; i++) {
					await this.getTanks(vehicleIDs[i]);
					await this.getFuelings(vehicleIDs[i]);
					await this.getCostnotes(vehicleIDs[i]);
					await this.getReminders();
				}
			}, this.config.requestInterval * 60 * 60 * 1000); // 1h = 3600000ms

		} catch (error) {
			this.log.error(`${error} (ERR_#003)`);
		}
	}

	// https://api.spritmonitor.de/doc
	async getVehicles() {

		await this.requestClient({
			method: 'GET',
			url: 'https://api.spritmonitor.de/v1/vehicles.json',
			headers: {
				'Authorization': `Bearer ${this.config.applicationKey}`,
				'Application-Id': 'eea22a25be0bd8b3e1914ed0497af931',
				'User-Agent': 'ioBroker Spritmonitor API Access'
			},
		})
			.then((response) => {
				this.log.debug(`[getVehiclesData]: HTTP status response: ${response.status} ${response.statusText}; config: ${JSON.stringify(response.config)}; headers: ${JSON.stringify(response.headers)}; data: ${JSON.stringify(response.data)}`);

				this.vehicles = response.data;

			})
			.catch((error) => {
				if (error.response) {
					// The request was made and the server responded with a status code that falls out of the range of 2xx
					this.log.debug(`[getVehiclesData]: HTTP status response: ${error.response.status}; headers: ${JSON.stringify(error.response.headers)}; data: ${JSON.stringify(error.response.data)}`);
				} else if (error.request) {
					// The request was made but no response was received `error.request` is an instance of XMLHttpRequest in the browser and an instance of http.ClientRequest in node.js
					this.log.debug(`[getVehiclesData]: error request: ${error}`);
				} else {
					// Something happened in setting up the request that triggered an Error
					this.log.debug(`[getVehiclesData]: error message: ${error.message}`);
				}
				this.log.debug(`[getVehiclesData]: error.config: ${JSON.stringify(error.config)}`);
			});
	}

	// https://github.com/ioBroker/ioBroker.docs/blob/master/docs/en/dev/objectsschema.md
	// https://github.com/ioBroker/ioBroker/blob/master/doc/STATE_ROLES.md#state-roles
	async createObjects(vehicles) {
		if (vehicles && Object.keys(vehicles).length !== 0 && typeof (vehicles) === 'object') {
			this.log.debug(`[createObjects]: start objects creation for ${Object.keys(vehicles).length} vehicle${Object.keys(vehicles).length > 1 ? 's' : ''}...`);

			for (let i = 0; i < Object.keys(vehicles).length; i++) {
				// /vehicles.json
				// create device
				await this.setObjectNotExistsAsync(vehicles[i].id.toString(), {
					type: 'device',
					common: {
						name: `${vehicles[i].make}${vehicles[i].model ? ' ' + vehicles[i].model : ''}`
					},
					native: {},
				});
				await this.setObjectNotExistsAsync(`${vehicles[i].id}.id`, {
					type: 'state',
					common: {
						name: 'Vehicle ID',
						desc: 'Vehicle ID',
						type: 'number',
						role: 'state',
						read: true,
						write: false,
					},
					native: {},
				});
				await this.setObjectNotExistsAsync(`${vehicles[i].id}.make`, {
					type: 'state',
					common: {
						name: 'Make',
						desc: 'Make',
						type: 'string',
						role: 'state',
						read: true,
						write: false,
					},
					native: {},
				});
				await this.setObjectNotExistsAsync(`${vehicles[i].id}.model`, {
					type: 'state',
					common: {
						name: 'Model',
						desc: 'Model',
						type: 'string',
						role: 'state',
						read: true,
						write: false,
					},
					native: {},
				});
				await this.setObjectNotExistsAsync(`${vehicles[i].id}.consumption`, {
					type: 'state',
					common: {
						name: 'Consumption value of this fuel type',
						desc: 'Consumption value of this fuel type',
						type: 'number',
						role: 'state',
						read: true,
						write: false,
					},
					native: {},
				});
				await this.setObjectNotExistsAsync(`${vehicles[i].id}.consumptionunit`, {
					type: 'state',
					common: {
						name: 'Name of consumption unit',
						desc: 'Name of consumption unit',
						type: 'string',
						role: 'state',
						read: true,
						write: false,
					},
					native: {},
				});
				await this.setObjectNotExistsAsync(`${vehicles[i].id}.tripsum`, {
					type: 'state',
					common: {
						name: 'Amount of driven distance for this tank (for consumption calculation)',
						desc: 'Amount of driven distance for this tank (for consumption calculation)',
						type: 'number',
						role: 'state',
						read: true,
						write: false,
					},
					native: {},
				});
				await this.setObjectNotExistsAsync(`${vehicles[i].id}.tripunit`, {
					type: 'state',
					common: {
						name: 'Trip unit',
						desc: 'Trip unit',
						type: 'string',
						role: 'state',
						read: true,
						write: false,
					},
					native: {},
				});
				await this.setObjectNotExistsAsync(`${vehicles[i].id}.quantitysum`, {
					type: 'state',
					common: {
						name: 'Amount of tanked fuel for this tank (for consumption calculation)',
						desc: 'Amount of tanked fuel for this tank (for consumption calculation)',
						type: 'number',
						role: 'state',
						read: true,
						write: false,
					},
					native: {},
				});
				await this.setObjectNotExistsAsync(`${vehicles[i].id}.maintank`, {
					type: 'state',
					common: {
						name: 'Maintank',
						desc: 'Maintank',
						type: 'number',
						role: 'state',
						read: true,
						write: false,
					},
					native: {},
				});
				await this.setObjectNotExistsAsync(`${vehicles[i].id}.maintanktype`, {
					type: 'state',
					common: {
						name: 'Type of tank',
						desc: 'Type of tank',
						type: 'number',
						role: 'state',
						states: {
							1: 'Diesel',
							2: 'Gasoline',
							3: 'LPG',
							4: 'CNG',
							5: 'Electricity',
							6: 'AdBlue',
							7: 'Hydrogen'
						},
						min: 1,
						max: 7,
						read: true,
						write: false,
					},
					native: {},
				});
				await this.setObjectNotExistsAsync(`${vehicles[i].id}.sign`, {
					type: 'state',
					common: {
						name: 'Sign',
						desc: 'Sign',
						type: 'string',
						role: 'state',
						read: true,
						write: false,
					},
					native: {},
				});
				await this.setObjectNotExistsAsync(`${vehicles[i].id}.picture_ts`, {
					type: 'state',
					common: {
						name: 'picture_ts',
						desc: 'picture_ts',
						type: 'number',
						role: 'value.time',
						read: true,
						write: false,
					},
					native: {},
				});
				await this.setObjectNotExistsAsync(`${vehicles[i].id}.bcconsumptionunit`, {
					type: 'state',
					common: {
						name: 'Bordcomputer consumption unit',
						desc: 'Bordcomputer consumption unit',
						type: 'string',
						role: 'state',
						read: true,
						write: false,
					},
					native: {},
				});
				await this.setObjectNotExistsAsync(`${vehicles[i].id}.country`, {
					type: 'state',
					common: {
						name: 'Country',
						desc: 'Country',
						type: 'string',
						role: 'state',
						read: true,
						write: false,
					},
					native: {},
				});
				/*
				// create channel "rankingInfo"
				await this.setObjectNotExistsAsync(`${vehicles[i].id}.rankingInfo`, {
					type: 'channel',
					common: {
						name: 'rankingInfo',
					},
					native: {},
				});
				await this.setObjectNotExistsAsync(`${vehicles[i].id}.rankingInfo.min`, {
					type: 'state',
					common: {
						name: 'min',
						desc: 'min',
						type: 'number',
						role: 'state',
						read: true,
						write: false,
					},
					native: {},
				});
				await this.setObjectNotExistsAsync(`${vehicles[i].id}.rankingInfo.avg`, {
					type: 'state',
					common: {
						name: 'avg',
						desc: 'avg',
						type: 'number',
						role: 'state',
						read: true,
						write: false,
					},
					native: {},
				});
				await this.setObjectNotExistsAsync(`${vehicles[i].id}.rankingInfo.max`, {
					type: 'state',
					common: {
						name: 'max',
						desc: 'max',
						type: 'number',
						role: 'state',
						read: true,
						write: false,
					},
					native: {},
				});
				await this.setObjectNotExistsAsync(`${vehicles[i].id}.rankingInfo.unit`, {
					type: 'state',
					common: {
						name: 'max',
						desc: 'max',
						type: 'string',
						role: 'state',
						read: true,
						write: false,
					},
					native: {},
				});
				await this.setObjectNotExistsAsync(`${vehicles[i].id}.rankingInfo.total`, {
					type: 'state',
					common: {
						name: 'max',
						desc: 'max',
						type: 'number',
						role: 'state',
						read: true,
						write: false,
					},
					native: {},
				});
				await this.setObjectNotExistsAsync(`${vehicles[i].id}.rankingInfo.rank`, {
					type: 'state',
					common: {
						name: 'max',
						desc: 'max',
						type: 'number',
						role: 'state',
						read: true,
						write: false,
					},
					native: {},
				});
				*/
				// /vehicle/{vehicleId}/tanks.json
				// create channel "tanks"
				await this.setObjectNotExistsAsync(`${vehicles[i].id}.tanks`, {
					type: 'channel',
					common: {
						name: 'tanks',
					},
					native: {},
				});
				await this.setObjectNotExistsAsync(`${vehicles[i].id}.tanks.id`, {
					type: 'state',
					common: {
						name: 'Tank ID',
						desc: 'Tank ID',
						type: 'number',
						role: 'state',
						read: true,
						write: false,
					},
					native: {},
				});
				await this.setObjectNotExistsAsync(`${vehicles[i].id}.tanks.fuelsorttype`, {
					type: 'state',
					common: {
						name: 'Type of tank',
						desc: 'Type of tank',
						type: 'number',
						role: 'state',
						states: {
							1: 'Diesel',
							2: 'Gasoline',
							3: 'LPG',
							4: 'CNG',
							5: 'Electricity',
							6: 'AdBlue',
							7: 'Hydrogen'
						},
						min: 1,
						max: 7,
						read: true,
						write: false,
					},
					native: {},
				});
				await this.setObjectNotExistsAsync(`${vehicles[i].id}.tanks.quantityunittype`, {
					type: 'state',
					common: {
						name: 'Quantity type of tank',
						desc: 'Quantity type of tank',
						type: 'number',
						role: 'state',
						states: {
							1: 'Volume',
							2: 'Weight (for CNG)',
							3: 'Electricity'
						},
						min: 1,
						max: 3,
						read: true,
						write: false,
					},
					native: {},
				});
				await this.setObjectNotExistsAsync(`${vehicles[i].id}.tanks.name`, {
					type: 'state',
					common: {
						name: 'Name of fueltype in tank',
						desc: 'Name of fueltype in tank',
						type: 'string',
						role: 'state',
						read: true,
						write: false,
					},
					native: {},
				});
				await this.setObjectNotExistsAsync(`${vehicles[i].id}.tanks.consumption`, {
					type: 'state',
					common: {
						name: 'Consumption value of this fuel type',
						desc: 'Consumption value of this fuel type',
						type: 'number',
						role: 'state',
						read: true,
						write: false,
					},
					native: {},
				});
				await this.setObjectNotExistsAsync(`${vehicles[i].id}.tanks.consumptionunit`, {
					type: 'state',
					common: {
						name: 'Name of consumption unit',
						desc: 'Name of consumption unit',
						type: 'string',
						role: 'state',
						read: true,
						write: false,
					},
					native: {},
				});
				await this.setObjectNotExistsAsync(`${vehicles[i].id}.tanks.consumptionunitid`, {
					type: 'state',
					common: {
						name: 'Numerical ID of consumption format',
						desc: 'Numerical ID of consumption format',
						type: 'number',
						role: 'state',
						states: {
							1: 'km/l',
							2: 'l/100km',
							3: 'MPG (US)',
							4: 'MPG (Imp)',
							5: 'km/kg',
							6: 'kg/100km',
							7: 'mi/kg',
							8: 'km/kWh',
							9: 'kWh/100km',
							10: 'mi/kWh'
						},
						min: 1,
						max: 10,
						read: true,
						write: false,
					},
					native: {},
				});
				await this.setObjectNotExistsAsync(`${vehicles[i].id}.tanks.co2`, {
					type: 'state',
					common: {
						name: 'Emission of CO₂ for this vehicle in g/km',
						desc: 'Emission of CO₂ for this vehicle in g/km',
						type: 'number',
						role: 'state',
						read: true,
						write: false,
					},
					native: {},
				});
				await this.setObjectNotExistsAsync(`${vehicles[i].id}.tanks.co2tripsum`, {
					type: 'state',
					common: {
						name: 'Amount of driven distance for which CO₂ was calculated',
						desc: 'Amount of driven distance for which CO₂ was calculated',
						type: 'number',
						role: 'state',
						read: true,
						write: false,
					},
					native: {},
				});
				await this.setObjectNotExistsAsync(`${vehicles[i].id}.tanks.co2quantitysum`, {
					type: 'state',
					common: {
						name: 'Amount of emissioned CO₂ in kg',
						desc: 'Amount of emissioned CO₂ in kg',
						type: 'number',
						role: 'state',
						read: true,
						write: false,
					},
					native: {},
				});
				await this.setObjectNotExistsAsync(`${vehicles[i].id}.tanks.costsum`, {
					type: 'state',
					common: {
						name: 'Amount of money spent for fuel for this tank',
						desc: 'Amount of money spent for fuel for this tank',
						type: 'number',
						role: 'state',
						read: true,
						write: false,
					},
					native: {},
				});
				await this.setObjectNotExistsAsync(`${vehicles[i].id}.tanks.costsumunit`, {
					type: 'state',
					common: {
						name: 'Currency of the fuel expenses',
						desc: 'Currency of the fuel expenses',
						type: 'string',
						role: 'state',
						read: true,
						write: false,
					},
					native: {},
				});
				await this.setObjectNotExistsAsync(`${vehicles[i].id}.tanks.costtripsum`, {
					type: 'state',
					common: {
						name: 'Amount of driven distance for which the fuel expenses have been summed',
						desc: 'Amount of driven distance for which the fuel expenses have been summed',
						type: 'number',
						role: 'state',
						read: true,
						write: false,
					},
					native: {},
				});
				await this.setObjectNotExistsAsync(`${vehicles[i].id}.tanks.tripsum`, {
					type: 'state',
					common: {
						name: 'Amount of driven distance for this tank (for consumption calculation)',
						desc: 'Amount of driven distance for this tank (for consumption calculation)',
						type: 'number',
						role: 'state',
						read: true,
						write: false,
					},
					native: {},
				});
				await this.setObjectNotExistsAsync(`${vehicles[i].id}.tanks.tripsumunit`, {
					type: 'state',
					common: {
						name: 'Unit for driven distance (km, mi)',
						desc: 'Unit for driven distance (km, mi)',
						type: 'string',
						role: 'state',
						read: true,
						write: false,
					},
					native: {},
				});
				await this.setObjectNotExistsAsync(`${vehicles[i].id}.tanks.quantitysum`, {
					type: 'state',
					common: {
						name: 'Amount of tanked fuel for this tank (for consumption calculation)',
						desc: 'Amount of tanked fuel for this tank (for consumption calculation)',
						type: 'number',
						role: 'state',
						read: true,
						write: false,
					},
					native: {},
				});
				await this.setObjectNotExistsAsync(`${vehicles[i].id}.tanks.quantitysumunit`, {
					type: 'state',
					common: {
						name: 'Unit for tanked fuel (l, GAL, kg, kWh, ...)',
						desc: 'Unit for tanked fuel (l, GAL, kg, kWh, ...)',
						type: 'string',
						role: 'state',
						read: true,
						write: false,
					},
					native: {},
				});
				// /vehicle/{vehicleId}/fuelings.json
				// create channel "fuelings"
				await this.setObjectNotExistsAsync(`${vehicles[i].id}.fuelings`, {
					type: 'channel',
					common: {
						name: 'List of fuelings for given vehicle over all tanks, ordered by date and odometer descending',
					},
					native: {},
				});
				await this.setObjectNotExistsAsync(`${vehicles[i].id}.fuelings.raw`, {
					type: 'state',
					common: {
						name: 'A JSON array of fuelings',
						desc: 'A JSON array of fuelings',
						type: 'string',
						role: 'state',
						read: true,
						write: false,
					},
					native: {},
				});
				// /vehicle/{vehicleId}/costnotes.json
				// create channel "costnotes"
				await this.setObjectNotExistsAsync(`${vehicles[i].id}.costnotes`, {
					type: 'channel',
					common: {
						name: 'List of expenses and notes for given vehicle',
					},
					native: {},
				});
				await this.setObjectNotExistsAsync(`${vehicles[i].id}.costnotes.raw`, {
					type: 'state',
					common: {
						name: 'A JSON array of costs / notes',
						desc: 'A JSON array of costs / notes',
						type: 'string',
						role: 'state',
						read: true,
						write: false,
					},
					native: {},
				});
			}
			// /reminders.json
			// create channel "reminders"
			await this.setObjectNotExistsAsync(`reminders`, {
				type: 'channel',
				common: {
					name: 'List of reminders of all vehicles',
				},
				native: {},
			});
			await this.setObjectNotExistsAsync(`reminders.raw`, {
				type: 'state',
				common: {
					name: 'A JSON array of reminders',
					desc: 'A JSON array of reminders',
					type: 'string',
					role: 'state',
					read: true,
					write: false,
				},
				native: {},
			});
			// create channel "ACTIONS"
			await this.setObjectNotExistsAsync(`ACTIONS`, {
				type: 'channel',
				common: {
					name: 'Action Commands',
				},
				native: {},
			});
			await this.setObjectNotExistsAsync(`ACTIONS.UPDATE`, {
				type: 'state',
				common: {
					name: 'Update values',
					desc: 'Update values',
					type: 'boolean',
					def: false,
					role: 'button',
					read: true,
					write: true,
				},
				native: {},
			});

			// subscribeStates
			this.subscribeStates('ACTIONS.UPDATE');

			this.log.debug('[createObjects]: Objects created...');

		} else {
			throw new Error('No Vehicles found, no Objects created. Check API (ERR_#004).');
		}
	}

	async fillObjectsVehicles(vehicles) {
		for (const i in vehicles) {
			this.setStateAsync(`${vehicles[i].id}.id`, { val: vehicles[i].id, ack: true });
			this.setStateAsync(`${vehicles[i].id}.make`, { val: vehicles[i].make, ack: true });
			this.setStateAsync(`${vehicles[i].id}.model`, { val: vehicles[i].model, ack: true });
			this.setStateAsync(`${vehicles[i].id}.consumption`, { val: Number(vehicles[i].consumption), ack: true });
			this.setStateAsync(`${vehicles[i].id}.consumptionunit`, { val: vehicles[i].consumptionunit, ack: true });
			this.setStateAsync(`${vehicles[i].id}.tripsum`, { val: Number(vehicles[i].tripsum), ack: true });
			this.setStateAsync(`${vehicles[i].id}.tripunit`, { val: vehicles[i].tripunit, ack: true });
			this.setStateAsync(`${vehicles[i].id}.quantitysum`, { val: Number(vehicles[i].quantitysum), ack: true });
			this.setStateAsync(`${vehicles[i].id}.maintank`, { val: vehicles[i].maintank, ack: true });
			this.setStateAsync(`${vehicles[i].id}.maintanktype`, { val: vehicles[i].maintanktype, ack: true });
			this.setStateAsync(`${vehicles[i].id}.sign`, { val: vehicles[i].sign, ack: true });
			this.setStateAsync(`${vehicles[i].id}.picture_ts`, { val: vehicles[i].picture_ts, ack: true });
			this.setStateAsync(`${vehicles[i].id}.bcconsumptionunit`, { val: vehicles[i].bcconsumptionunit, ack: true });
			this.setStateAsync(`${vehicles[i].id}.country`, { val: vehicles[i].country, ack: true });
			/*
			this.setStateAsync(`${vehicles[i].id}.rankingInfo.min`, { val: Number(vehicles[i].rankingInfo.min), ack: true });
			this.setStateAsync(`${vehicles[i].id}.rankingInfo.avg`, { val: Number(vehicles[i].rankingInfo.avg), ack: true });
			this.setStateAsync(`${vehicles[i].id}.rankingInfo.max`, { val: Number(vehicles[i].rankingInfo.max), ack: true });
			this.setStateAsync(`${vehicles[i].id}.rankingInfo.unit`, { val: vehicles[i].rankingInfo.unit, ack: true });
			this.setStateAsync(`${vehicles[i].id}.rankingInfo.total`, { val: vehicles[i].rankingInfo.total, ack: true });
			this.setStateAsync(`${vehicles[i].id}.rankingInfo.rank`, { val: vehicles[i].rankingInfo.rank, ack: true });
			*/

			vehicleIDs.push(vehicles[i].id);
			// this.log.debug(`[fillObjectsVehicles]: ${vehicleIDs}`);
		}
	}

	async getTanks(vehicleId) {
		await this.requestClient({
			method: 'GET',
			url: `https://api.spritmonitor.de/v1/vehicle/${vehicleId}/tanks.json`,
			headers: {
				'Authorization': `Bearer ${this.config.applicationKey}`,
				'Application-Id': 'eea22a25be0bd8b3e1914ed0497af931',
				'User-Agent': 'ioBroker Spritmonitor API Access'
			},
		})
			.then(async (response) => {
				this.log.debug(`[getTanks]: HTTP status response: ${response.status} ${response.statusText}; config: ${JSON.stringify(response.config)}; headers: ${JSON.stringify(response.headers)}; data: ${JSON.stringify(response.data)}`);

				await this.fillObjectsTanks(vehicleId, response.data);
			})
			.catch((error) => {
				if (error.response) {
					// The request was made and the server responded with a status code that falls out of the range of 2xx
					this.log.debug(`[getTanks]: HTTP status response: ${error.response.status}; headers: ${JSON.stringify(error.response.headers)}; data: ${JSON.stringify(error.response.data)}`);
				} else if (error.request) {
					// The request was made but no response was received `error.request` is an instance of XMLHttpRequest in the browser and an instance of http.ClientRequest in node.js
					this.log.debug(`[getTanks]: error request: ${error}`);
				} else {
					// Something happened in setting up the request that triggered an Error
					this.log.debug(`[getTanks]: error message: ${error.message}`);
				}
				this.log.debug(`[getTanks]: error.config: ${JSON.stringify(error.config)}`);
			});
	}

	async fillObjectsTanks(vehicles, tanks) {
		//this.log.debug(`[fillObjectsTanks]: vehicles ${vehicles}; tanks ${JSON.stringify(tanks)}`);

		this.setStateAsync(`${vehicles}.tanks.id`, { val: tanks[0].id, ack: true });
		this.setStateAsync(`${vehicles}.tanks.fuelsorttype`, { val: tanks[0].fuelsorttype, ack: true });
		this.setStateAsync(`${vehicles}.tanks.quantityunittype`, { val: tanks[0].quantityunittype, ack: true });
		this.setStateAsync(`${vehicles}.tanks.name`, { val: tanks[0].name, ack: true });
		this.setStateAsync(`${vehicles}.tanks.consumption`, { val: Number(tanks[0].consumption), ack: true });
		this.setStateAsync(`${vehicles}.tanks.consumptionunit`, { val: tanks[0].consumptionunit, ack: true });
		this.setStateAsync(`${vehicles}.tanks.consumptionunitid`, { val: tanks[0].consumptionunitid, ack: true });
		this.setStateAsync(`${vehicles}.tanks.co2`, { val: Number(tanks[0].co2), ack: true });
		this.setStateAsync(`${vehicles}.tanks.co2tripsum`, { val: Number(tanks[0].co2tripsum), ack: true });
		this.setStateAsync(`${vehicles}.tanks.co2quantitysum`, { val: Number(tanks[0].co2quantitysum), ack: true });
		this.setStateAsync(`${vehicles}.tanks.costsum`, { val: Number(tanks[0].costsum), ack: true });
		this.setStateAsync(`${vehicles}.tanks.costsumunit`, { val: tanks[0].costsumunit, ack: true });
		this.setStateAsync(`${vehicles}.tanks.costtripsum`, { val: Number(tanks[0].costtripsum), ack: true });
		this.setStateAsync(`${vehicles}.tanks.tripsum`, { val: Number(tanks[0].tripsum), ack: true });
		this.setStateAsync(`${vehicles}.tanks.tripsumunit`, { val: tanks[0].tripsumunit, ack: true });
		this.setStateAsync(`${vehicles}.tanks.quantitysum`, { val: Number(tanks[0].quantitysum), ack: true });
		this.setStateAsync(`${vehicles}.tanks.quantitysumunit`, { val: tanks[0].quantitysumunit, ack: true });
	}

	async getFuelings(vehicleId) {
		await this.requestClient({
			method: 'GET',
			url: `https://api.spritmonitor.de/v1/vehicle/${vehicleId}/fuelings.json?limit=10000`,
			headers: {
				'Authorization': `Bearer ${this.config.applicationKey}`,
				'Application-Id': 'eea22a25be0bd8b3e1914ed0497af931',
				'User-Agent': 'ioBroker Spritmonitor API Access'
			},
		})
			.then(async (response) => {
				this.log.debug(`[getTanks]: HTTP status response: ${response.status} ${response.statusText}; config: ${JSON.stringify(response.config)}; headers: ${JSON.stringify(response.headers)}; data: ${JSON.stringify(response.data)}`);

				await this.fillObjectsFuelings(vehicleId, response.data);
			})
			.catch((error) => {
				if (error.response) {
					// The request was made and the server responded with a status code that falls out of the range of 2xx
					this.log.debug(`[getTanks]: HTTP status response: ${error.response.status}; headers: ${JSON.stringify(error.response.headers)}; data: ${JSON.stringify(error.response.data)}`);
				} else if (error.request) {
					// The request was made but no response was received `error.request` is an instance of XMLHttpRequest in the browser and an instance of http.ClientRequest in node.js
					this.log.debug(`[getTanks]: error request: ${error}`);
				} else {
					// Something happened in setting up the request that triggered an Error
					this.log.debug(`[getTanks]: error message: ${error.message}`);
				}
				this.log.debug(`[getTanks]: error.config: ${JSON.stringify(error.config)}`);
			});
	}

	async fillObjectsFuelings(vehicles, fuelings) {
		this.setStateAsync(`${vehicles}.fuelings.raw`, { val: JSON.stringify(fuelings), ack: true });
	}

	async getCostnotes(vehicleId) {
		await this.requestClient({
			method: 'GET',
			url: `https://api.spritmonitor.de/v1/vehicle/${vehicleId}/costsnotes.json?limit=10000`,
			headers: {
				'Authorization': `Bearer ${this.config.applicationKey}`,
				'Application-Id': 'eea22a25be0bd8b3e1914ed0497af931',
				'User-Agent': 'ioBroker Spritmonitor API Access'
			},
		})
			.then(async (response) => {
				this.log.debug(`[getTanks]: HTTP status response: ${response.status} ${response.statusText}; config: ${JSON.stringify(response.config)}; headers: ${JSON.stringify(response.headers)}; data: ${JSON.stringify(response.data)}`);

				await this.fillObjectsCostnotes(vehicleId, response.data);
			})
			.catch((error) => {
				if (error.response) {
					// The request was made and the server responded with a status code that falls out of the range of 2xx
					this.log.debug(`[getTanks]: HTTP status response: ${error.response.status}; headers: ${JSON.stringify(error.response.headers)}; data: ${JSON.stringify(error.response.data)}`);
				} else if (error.request) {
					// The request was made but no response was received `error.request` is an instance of XMLHttpRequest in the browser and an instance of http.ClientRequest in node.js
					this.log.debug(`[getTanks]: error request: ${error}`);
				} else {
					// Something happened in setting up the request that triggered an Error
					this.log.debug(`[getTanks]: error message: ${error.message}`);
				}
				this.log.debug(`[getTanks]: error.config: ${JSON.stringify(error.config)}`);
			});
	}

	async fillObjectsCostnotes(vehicles, costnotes) {
		this.setStateAsync(`${vehicles}.costnotes.raw`, { val: JSON.stringify(costnotes), ack: true });
	}

	async getReminders() {
		await this.requestClient({
			method: 'GET',
			url: `https://api.spritmonitor.de/v1/reminders.json`,
			headers: {
				'Authorization': `Bearer ${this.config.applicationKey}`,
				'Application-Id': 'eea22a25be0bd8b3e1914ed0497af931',
				'User-Agent': 'ioBroker Spritmonitor API Access'
			},
		})
			.then(async (response) => {
				this.log.debug(`[getTanks]: HTTP status response: ${response.status} ${response.statusText}; config: ${JSON.stringify(response.config)}; headers: ${JSON.stringify(response.headers)}; data: ${JSON.stringify(response.data)}`);

				await this.fillObjectsReminders(response.data);
			})
			.catch((error) => {
				if (error.response) {
					// The request was made and the server responded with a status code that falls out of the range of 2xx
					this.log.debug(`[getTanks]: HTTP status response: ${error.response.status}; headers: ${JSON.stringify(error.response.headers)}; data: ${JSON.stringify(error.response.data)}`);
				} else if (error.request) {
					// The request was made but no response was received `error.request` is an instance of XMLHttpRequest in the browser and an instance of http.ClientRequest in node.js
					this.log.debug(`[getTanks]: error request: ${error}`);
				} else {
					// Something happened in setting up the request that triggered an Error
					this.log.debug(`[getTanks]: error message: ${error.message}`);
				}
				this.log.debug(`[getTanks]: error.config: ${JSON.stringify(error.config)}`);
			});
	}

	async fillObjectsReminders(reminders) {
		this.setStateAsync(`reminders.raw`, { val: JSON.stringify(reminders), ack: true });
	}

	/**
	 * Is called when adapter shuts down - callback has to be called under any circumstances!
	 * @param {() => void} callback
	 */
	onUnload(callback) {
		try {
			// Here you must clear all timeouts or intervals that may still be active
			this.requestInterval && clearInterval(this.requestInterval);

			callback();
		} catch (e) {
			callback();
		}
	}

	/**
	 * Is called if a subscribed state changes
	 * @param {string} id
	 * @param {ioBroker.State | null | undefined} state
	 */
	async onStateChange(id, state) {
		if (state !== null && state !== undefined) {
			if (state.ack === false) {
				this.log.debug(`[onStateChange]: id: ${id}; state: ${JSON.stringify(state)}`);

				const command = id.split('.')[3];
				this.log.debug(`[onStateChange]: command: ${command}`);

				if (command === 'UPDATE' && state.val) {
					await this.getVehicles();
					await this.fillObjectsVehicles(this.vehicles);

					for (let i = 0; i < vehicleIDs.length; i++) {
						await this.getTanks(vehicleIDs[i]);
						await this.getFuelings(vehicleIDs[i]);
						await this.getCostnotes(vehicleIDs[i]);
						await this.getReminders();
					}
				}

			} else {
				// The state was changed by system
				this.log.debug(
					`[onStateChange]: state ${id} changed: ${state.val} (ack = ${state.ack}). NO ACTION PERFORMED.`,
				);
			}
		} else {
			// The state was deleted
			this.log.debug(`[onStateChange]: state ${id} was changed. NO ACTION PERFORMED.`);
		}
	}
}

if (require.main !== module) {
	// Export the constructor in compact mode
	/**
	 * @param {Partial<utils.AdapterOptions>} [options={}]
	 */
	module.exports = (options) => new Spritmonitor(options);
} else {
	// otherwise start the instance directly
	new Spritmonitor();
}
