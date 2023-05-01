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
		this.log.debug(`config.applicationKey: ${this.config.applicationKey}`);
		this.log.debug(`config.requestInterval: ${this.config.requestInterval}`);

		// check applicationKey
		if (!isValidApplicationKey.test(this.config.applicationKey)) {
			this.log.error('"Application Key" is not valid (allowed format: xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx) (ERR_#001)');
			return;
		}
		// check requestInterval
		if (!this.numberInRange(6, 168, this.config.requestInterval)) {
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
			for (let i = 0; i < vehicleIDs.length; i++) {
				await this.getTanks(vehicleIDs[i]);
				await this.getFuelings(vehicleIDs[i]);
				await this.getCostsnotes(vehicleIDs[i]);
			}
			await this.getReminders();

			await this.getFuelsorts();
			await this.getCurrencies();
			await this.getQuantityunits();
			await this.getCompanies();

			this.log.info(`Starting polltimer with a ${this.config.requestInterval}h interval.`);
			this.requestInterval = setInterval(async () => {
				await this.getVehicles();
				await this.fillObjectsVehicles(this.vehicles);
				for (let i = 0; i < vehicleIDs.length; i++) {
					await this.getTanks(vehicleIDs[i]);
					await this.getFuelings(vehicleIDs[i]);
					await this.getCostsnotes(vehicleIDs[i]);
				}
				await this.getReminders();
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
					if (error.response.status === 401) {
						throw new Error('Authentification failed. Check Application-Id. (ERR_#006)');
					}
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

	async getFuelsorts() {
		await this.requestClient({
			method: 'GET',
			url: 'https://api.spritmonitor.de/v1/fuelsorts.json',
			headers: {
				'Authorization': `Bearer ${this.config.applicationKey}`,
				'Application-Id': 'eea22a25be0bd8b3e1914ed0497af931',
				'User-Agent': 'ioBroker Spritmonitor API Access'
			},
		})
			.then(async (response) => {
				this.log.debug(`[getFuelsorts]: HTTP status response: ${response.status} ${response.statusText}; config: ${JSON.stringify(response.config)}; headers: ${JSON.stringify(response.headers)}; data: ${JSON.stringify(response.data)}`);

				await this.setObjectNotExistsAsync('general', {
					type: 'channel',
					common: {
						name: 'General queries for Spritmonitor',
					},
					native: {},
				});
				await this.setObjectNotExistsAsync(`general.fuelsorts`, {
					type: 'state',
					common: {
						name: 'List of supported fuelsorts, IDs and names',
						type: 'array',
						role: 'state',
						read: true,
						write: false,
					},
					native: {},
				});

				this.setStateAsync(`general.fuelsorts`, { val: JSON.stringify(response.data), ack: true });
			})
			.catch((error) => {
				if (error.response) {
					// The request was made and the server responded with a status code that falls out of the range of 2xx
					this.log.debug(`[getFuelsorts]: HTTP status response: ${error.response.status}; headers: ${JSON.stringify(error.response.headers)}; data: ${JSON.stringify(error.response.data)}`);
					if (error.response.status === 401) {
						throw new Error('Authentification failed. Check Application-Id. (ERR_#006)');
					}
				} else if (error.request) {
					// The request was made but no response was received `error.request` is an instance of XMLHttpRequest in the browser and an instance of http.ClientRequest in node.js
					this.log.debug(`[getFuelsorts]: error request: ${error}`);
				} else {
					// Something happened in setting up the request that triggered an Error
					this.log.debug(`[getFuelsorts]: error message: ${error.message}`);
				}
				this.log.debug(`[getFuelsorts]: error.config: ${JSON.stringify(error.config)}`);
			});
	}

	async getCurrencies() {
		await this.requestClient({
			method: 'GET',
			url: 'https://api.spritmonitor.de/v1/currencies.json',
			headers: {
				'Authorization': `Bearer ${this.config.applicationKey}`,
				'Application-Id': 'eea22a25be0bd8b3e1914ed0497af931',
				'User-Agent': 'ioBroker Spritmonitor API Access'
			},
		})
			.then(async (response) => {
				this.log.debug(`[getCurrencies]: HTTP status response: ${response.status} ${response.statusText}; config: ${JSON.stringify(response.config)}; headers: ${JSON.stringify(response.headers)}; data: ${JSON.stringify(response.data)}`);

				await this.setObjectNotExistsAsync('general', {
					type: 'channel',
					common: {
						name: 'General queries for Spritmonitor',
					},
					native: {},
				});
				await this.setObjectNotExistsAsync(`general.currencies`, {
					type: 'state',
					common: {
						name: 'List of supported currencies, IDs and names',
						type: 'array',
						role: 'state',
						read: true,
						write: false,
					},
					native: {},
				});

				this.setStateAsync(`general.currencies`, { val: JSON.stringify(response.data), ack: true });
			})
			.catch((error) => {
				if (error.response) {
					// The request was made and the server responded with a status code that falls out of the range of 2xx
					this.log.debug(`[getCurrencies]: HTTP status response: ${error.response.status}; headers: ${JSON.stringify(error.response.headers)}; data: ${JSON.stringify(error.response.data)}`);
					if (error.response.status === 401) {
						throw new Error('Authentification failed. Check Application-Id. (ERR_#006)');
					}
				} else if (error.request) {
					// The request was made but no response was received `error.request` is an instance of XMLHttpRequest in the browser and an instance of http.ClientRequest in node.js
					this.log.debug(`[getCurrencies]: error request: ${error}`);
				} else {
					// Something happened in setting up the request that triggered an Error
					this.log.debug(`[getCurrencies]: error message: ${error.message}`);
				}
				this.log.debug(`[getCurrencies]: error.config: ${JSON.stringify(error.config)}`);
			});
	}

	async getQuantityunits() {
		await this.requestClient({
			method: 'GET',
			url: 'https://api.spritmonitor.de/v1/quantityunits.json',
			headers: {
				'Authorization': `Bearer ${this.config.applicationKey}`,
				'Application-Id': 'eea22a25be0bd8b3e1914ed0497af931',
				'User-Agent': 'ioBroker Spritmonitor API Access'
			},
		})
			.then(async (response) => {
				this.log.debug(`[getQuantityunits]: HTTP status response: ${response.status} ${response.statusText}; config: ${JSON.stringify(response.config)}; headers: ${JSON.stringify(response.headers)}; data: ${JSON.stringify(response.data)}`);

				await this.setObjectNotExistsAsync('general', {
					type: 'channel',
					common: {
						name: 'General queries for Spritmonitor',
					},
					native: {},
				});
				await this.setObjectNotExistsAsync(`general.quantityunits`, {
					type: 'state',
					common: {
						name: 'List of supported quantityunits, IDs and names',
						type: 'array',
						role: 'state',
						read: true,
						write: false,
					},
					native: {},
				});

				this.setStateAsync(`general.quantityunits`, { val: JSON.stringify(response.data), ack: true });
			})
			.catch((error) => {
				if (error.response) {
					// The request was made and the server responded with a status code that falls out of the range of 2xx
					this.log.debug(`[getQuantityunits]: HTTP status response: ${error.response.status}; headers: ${JSON.stringify(error.response.headers)}; data: ${JSON.stringify(error.response.data)}`);
					if (error.response.status === 401) {
						throw new Error('Authentification failed. Check Application-Id. (ERR_#006)');
					}
				} else if (error.request) {
					// The request was made but no response was received `error.request` is an instance of XMLHttpRequest in the browser and an instance of http.ClientRequest in node.js
					this.log.debug(`[getQuantityunits]: error request: ${error}`);
				} else {
					// Something happened in setting up the request that triggered an Error
					this.log.debug(`[getQuantityunits]: error message: ${error.message}`);
				}
				this.log.debug(`[getQuantityunits]: error.config: ${JSON.stringify(error.config)}`);
			});
	}

	async getCompanies() {
		await this.requestClient({
			method: 'GET',
			url: 'https://api.spritmonitor.de/v1/companies.json',
			headers: {
				'Authorization': `Bearer ${this.config.applicationKey}`,
				'Application-Id': 'eea22a25be0bd8b3e1914ed0497af931',
				'User-Agent': 'ioBroker Spritmonitor API Access'
			},
		})
			.then(async (response) => {
				this.log.debug(`[getCompanies]: HTTP status response: ${response.status} ${response.statusText}; config: ${JSON.stringify(response.config)}; headers: ${JSON.stringify(response.headers)}; data: ${JSON.stringify(response.data)}`);

				await this.setObjectNotExistsAsync('general', {
					type: 'channel',
					common: {
						name: 'General queries for Spritmonitor',
					},
					native: {},
				});
				await this.setObjectNotExistsAsync(`general.companies`, {
					type: 'state',
					common: {
						name: 'List of supported companies, IDs and names',
						type: 'array',
						role: 'state',
						read: true,
						write: false,
					},
					native: {},
				});

				this.setStateAsync(`general.companies`, { val: JSON.stringify(response.data), ack: true });
			})
			.catch((error) => {
				if (error.response) {
					// The request was made and the server responded with a status code that falls out of the range of 2xx
					this.log.debug(`[getCompanies]: HTTP status response: ${error.response.status}; headers: ${JSON.stringify(error.response.headers)}; data: ${JSON.stringify(error.response.data)}`);
					if (error.response.status === 401) {
						throw new Error('Authentification failed. Check Application-Id. (ERR_#006)');
					}
				} else if (error.request) {
					// The request was made but no response was received `error.request` is an instance of XMLHttpRequest in the browser and an instance of http.ClientRequest in node.js
					this.log.debug(`[getCompanies]: error request: ${error}`);
				} else {
					// Something happened in setting up the request that triggered an Error
					this.log.debug(`[getCompanies]: error message: ${error.message}`);
				}
				this.log.debug(`[getCompanies]: error.config: ${JSON.stringify(error.config)}`);
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

				let numbersOfTanks = 1;
				if (vehicles[i].maintanktype === 3 || vehicles[i].maintanktype === 4) {
					numbersOfTanks = 2;
				}

				for (let j = 1; j <= numbersOfTanks; j++) {

					await this.setObjectNotExistsAsync(`${vehicles[i].id}.tanks.${j}`, {
						type: 'channel',
						common: {
							name: `Tank ${j}`,
						},
						native: {},
					});
					await this.setObjectNotExistsAsync(`${vehicles[i].id}.tanks.${j}.id`, {
						type: 'state',
						common: {
							name: 'Tank ID',
							type: 'number',
							role: 'state',
							read: true,
							write: false,
						},
						native: {},
					});
					await this.setObjectNotExistsAsync(`${vehicles[i].id}.tanks.${j}.fuelsorttype`, {
						type: 'state',
						common: {
							name: 'Type of tank',
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
					await this.setObjectNotExistsAsync(`${vehicles[i].id}.tanks.${j}.quantityunittype`, {
						type: 'state',
						common: {
							name: 'Quantity type of tank',
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
					await this.setObjectNotExistsAsync(`${vehicles[i].id}.tanks.${j}.name`, {
						type: 'state',
						common: {
							name: 'Name of fueltype in tank',
							type: 'string',
							role: 'state',
							read: true,
							write: false,
						},
						native: {},
					});
					await this.setObjectNotExistsAsync(`${vehicles[i].id}.tanks.${j}.consumption`, {
						type: 'state',
						common: {
							name: 'Consumption value of this fuel type',
							type: 'number',
							role: 'state',
							read: true,
							write: false,
						},
						native: {},
					});
					await this.setObjectNotExistsAsync(`${vehicles[i].id}.tanks.${j}.consumptionunit`, {
						type: 'state',
						common: {
							name: 'Name of consumption unit',
							type: 'string',
							role: 'state',
							read: true,
							write: false,
						},
						native: {},
					});
					await this.setObjectNotExistsAsync(`${vehicles[i].id}.tanks.${j}.consumptionunitid`, {
						type: 'state',
						common: {
							name: 'Numeric ID of consumption format',
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
					await this.setObjectNotExistsAsync(`${vehicles[i].id}.tanks.${j}.co2`, {
						type: 'state',
						common: {
							name: 'Emission of CO₂ for this vehicle in g/km',
							type: 'number',
							role: 'state',
							unit: 'g/kg',
							read: true,
							write: false,
						},
						native: {},
					});
					await this.setObjectNotExistsAsync(`${vehicles[i].id}.tanks.${j}.co2tripsum`, {
						type: 'state',
						common: {
							name: 'Amount of driven distance for which CO₂ was calculated',
							type: 'number',
							role: 'state',
							read: true,
							write: false,
						},
						native: {},
					});
					await this.setObjectNotExistsAsync(`${vehicles[i].id}.tanks.${j}.co2quantitysum`, {
						type: 'state',
						common: {
							name: 'Amount of emissioned CO₂ in kg',
							type: 'number',
							role: 'state',
							unit: 'kg',
							read: true,
							write: false,
						},
						native: {},
					});
					await this.setObjectNotExistsAsync(`${vehicles[i].id}.tanks.${j}.costsum`, {
						type: 'state',
						common: {
							name: 'Amount of money spent for fuel for this tank',
							type: 'number',
							role: 'state',
							read: true,
							write: false,
						},
						native: {},
					});
					await this.setObjectNotExistsAsync(`${vehicles[i].id}.tanks.${j}.costsumunit`, {
						type: 'state',
						common: {
							name: 'Currency of the fuel expenses',
							type: 'string',
							role: 'state',
							read: true,
							write: false,
						},
						native: {},
					});
					await this.setObjectNotExistsAsync(`${vehicles[i].id}.tanks.${j}.costtripsum`, {
						type: 'state',
						common: {
							name: 'Amount of driven distance for which the fuel expenses have been summed',
							type: 'number',
							role: 'state',
							read: true,
							write: false,
						},
						native: {},
					});
					await this.setObjectNotExistsAsync(`${vehicles[i].id}.tanks.${j}.tripsum`, {
						type: 'state',
						common: {
							name: 'Amount of driven distance for this tank (for consumption calculation)',
							type: 'number',
							role: 'state',
							read: true,
							write: false,
						},
						native: {},
					});
					await this.setObjectNotExistsAsync(`${vehicles[i].id}.tanks.${j}.tripsumunit`, {
						type: 'state',
						common: {
							name: 'Unit for driven distance (km, mi)',
							type: 'string',
							role: 'state',
							read: true,
							write: false,
						},
						native: {},
					});
					await this.setObjectNotExistsAsync(`${vehicles[i].id}.tanks.${j}.quantitysum`, {
						type: 'state',
						common: {
							name: 'Amount of tanked fuel for this tank (for consumption calculation)',
							type: 'number',
							role: 'state',
							read: true,
							write: false,
						},
						native: {},
					});
					await this.setObjectNotExistsAsync(`${vehicles[i].id}.tanks.${j}.quantitysumunit`, {
						type: 'state',
						common: {
							name: 'Unit for tanked fuel (l, GAL, kg, kWh, ...)',
							type: 'string',
							role: 'state',
							read: true,
							write: false,
						},
						native: {},
					});
				}
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
						type: 'array',
						role: 'state',
						read: true,
						write: false,
					},
					native: {},
				});
				// /vehicle/{vehicleId}/costsnotes.json
				// create channel "costsnotes"
				await this.setObjectNotExistsAsync(`${vehicles[i].id}.costsnotes`, {
					type: 'channel',
					common: {
						name: 'List of expenses and notes for given vehicle',
					},
					native: {},
				});
				await this.setObjectNotExistsAsync(`${vehicles[i].id}.costsnotes.raw`, {
					type: 'state',
					common: {
						name: 'A JSON array of costs / notes',
						type: 'array',
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
					type: 'array',
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
					type: 'boolean',
					def: false,
					role: 'button',
					read: true,
					write: true,
				},
				native: {},
			});
			// create channel "ADD"
			await this.setObjectNotExistsAsync(`ACTIONS.ADD`, {
				type: 'channel',
				common: {
					name: 'Add a new nueling for given tank of given vehicle',
				},
				native: {},
			});
			await this.setObjectNotExistsAsync(`ACTIONS.ADD.ADD`, {
				type: 'state',
				common: {
					name: 'Add a new fueling for given tank of given vehicle (single entry)',
					type: 'boolean',
					def: false,
					role: 'button',
					read: true,
					write: true,
				},
				native: {},
			});
			await this.setObjectNotExistsAsync(`ACTIONS.ADD.vehicleId`, {
				type: 'state',
				common: {
					name: 'Numeric ID of the vehicle to get fuelings for',
					type: 'number',
					def: 0,
					role: 'state',
					min: 0,
					read: true,
					write: true,
				},
				native: {},
			});
			await this.setObjectNotExistsAsync(`ACTIONS.ADD.tankId`, {
				type: 'state',
				common: {
					name: 'Numeric ID of the tank to get fuelings for',
					type: 'number',
					def: 0,
					role: 'state',
					min: 0,
					max: 1,
					read: true,
					write: true,
				},
				native: {},
			});
			await this.setObjectNotExistsAsync(`ACTIONS.ADD.date`, {
				type: 'state',
				common: {
					name: 'Date of the fueling to be added (requied format: DD.MM.YYYY)',
					type: 'string',
					def: '',
					role: 'state',
					read: true,
					write: true,
				},
				native: {},
			});
			await this.setObjectNotExistsAsync(`ACTIONS.ADD.odometer`, {
				type: 'state',
				common: {
					name: 'Odometer of the fueling to be added',
					type: 'number',
					def: 0,
					role: 'state',
					min: 0,
					read: true,
					write: true,
				},
				native: {},
			});
			await this.setObjectNotExistsAsync(`ACTIONS.ADD.trip`, {
				type: 'state',
				common: {
					name: 'Trip of the fueling to be added',
					type: 'number',
					def: 0,
					role: 'state',
					min: 0,
					read: true,
					write: true,
				},
				native: {},
			});
			await this.setObjectNotExistsAsync(`ACTIONS.ADD.quantity`, {
				type: 'state',
				common: {
					name: 'Amount of fuel of the fueling to be added',
					type: 'number',
					def: 0,
					role: 'state',
					min: 0,
					read: true,
					write: true,
				},
				native: {},
			});
			await this.setObjectNotExistsAsync(`ACTIONS.ADD.type`, {
				type: 'state',
				common: {
					name: 'Type of fueling to be added (allowed values: invalid, full, notfull, first)',
					type: 'string',
					def: '',
					role: 'state',
					states: { invalid: 'invalid', full: 'full', notfull: 'notfull', first: 'first' },
					read: true,
					write: true,
				},
				native: {},
			});
			await this.setObjectNotExistsAsync(`ACTIONS.ADD.price`, {
				type: 'state',
				common: {
					name: 'Price of the fueling to be added',
					type: 'number',
					def: 0,
					role: 'state',
					min: 0,
					read: true,
					write: true,
				},
				native: {},
			});
			await this.setObjectNotExistsAsync(`ACTIONS.ADD.currencyid`, {
				type: 'state',
				common: {
					name: 'Nummeric ID of the currency of the fueling to be added',
					type: 'number',
					def: 1,
					role: 'state',
					states: { 0: 'EUR', 1: 'CHF', 2: 'USD', 3: 'CAD', 4: 'GBP', 5: 'DKK', 6: 'NOK', 7: 'SEK', 8: 'PLN', 9: 'SKK', 10: 'CZK', 11: 'HUF', 12: 'SIT', 13: 'DEM', 14: 'BRL', 15: 'HRK', 16: 'BGN', 17: 'ARS', 18: 'CLP', 19: 'AUD', 20: 'LTL', 21: 'LVL', 22: 'RON', 23: 'RUB', 24: 'EEK', 25: 'ILS', 26: 'BYR', 27: 'TRY', 28: 'SGD', 29: 'MYR', 30: 'ISK', 31: 'YEN', 32: 'CNY', 33: 'RSD' },
					min: 0,
					max: 33,
					read: true,
					write: true,
				},
				native: {},
			});
			await this.setObjectNotExistsAsync(`ACTIONS.ADD.pricetype`, {
				type: 'state',
				common: {
					name: 'Nummeric ID of price (allowed values: 0: total price, 1: unit / liter price)',
					type: 'number',
					role: 'state',
					def: 0,
					states: { 0: 'total price', 1: 'unit / liter price' },
					min: 0,
					max: 1,
					read: true,
					write: true,
				},
				native: {},
			});
			await this.setObjectNotExistsAsync(`ACTIONS.ADD.fuelsortid`, {
				type: 'state',
				common: {
					name: 'Nummeric ID of the fuelsort of the fueling to be added',
					type: 'number',
					def: 0,
					role: 'state',
					// [{"id":2,"type":1,"name":"Biodiesel"},{"id":1,"type":1,"name":"Diesel"},{"id":25,"type":1,"name":"GTL Diesel"},{"id":4,"type":1,"name":"Premium Diesel"},{"id":3,"type":1,"name":"Pflanzenöl"},{"id":22,"type":2,"name":"Premium Benzin 100+"},{"id":15,"type":2,"name":"Bioethanol"},{"id":20,"type":2,"name":"E10"},{"id":6,"type":2,"name":"Normalbenzin"},{"id":9,"type":2,"name":"Premium Benzin 100"},{"id":18,"type":2,"name":"Premium Benzin 95"},{"id":8,"type":2,"name":"SuperPlus"},{"id":7,"type":2,"name":"Super"},{"id":16,"type":2,"name":"Zweitakt-Gemisch"},{"id":12,"type":3,"name":"LPG"},{"id":13,"type":4,"name":"CNG H"},{"id":14,"type":4,"name":"CNG L"},{"id":19,"type":5,"name":"Elektrizität"},{"id":24,"type":5,"name":"Ökostrom"},{"id":21,"type":6,"name":"AdBlue"},{"id":23,"type":7,"name":"Wasserstoff"}]
					// states: { 1: 'Diesel', 2: 'Gasoline', 3: 'LPG', 4: 'CNG', 5: 'Electricity', 6: 'AdBlue', 7: 'Hydrogen' },
					min: 0,
					read: true,
					write: true,
				},
				native: {},
			});
			await this.setObjectNotExistsAsync(`ACTIONS.ADD.quantityunitid`, {
				type: 'state',
				common: {
					name: 'Numeric ID of quantity unit',
					type: 'number',
					def: 1,
					role: 'state',
					states: { 1: 'Liter', 2: 'Kilogram', 3: 'Gallon (US)', 4: 'Gallon (Imp)', 5: 'Kilowatt hour' },
					min: 1,
					max: 5,
					read: true,
					write: true,
				},
				native: {},
			});
			await this.setObjectNotExistsAsync(`ACTIONS.ADD.note`, {
				type: 'state',
				common: {
					name: 'Free text note of the user for the fueling to be added',
					type: 'string',
					def: '',
					role: 'state',
					read: true,
					write: true,
				},
				native: {},
			});
			await this.setObjectNotExistsAsync(`ACTIONS.ADD.stationname`, {
				type: 'state',
				common: {
					name: 'Gas station company for the fueling to be added',
					type: 'string',
					def: '',
					role: 'state',
					read: true,
					write: true,
				},
				native: {},
			});
			await this.setObjectNotExistsAsync(`ACTIONS.ADD.location`, {
				type: 'state',
				common: {
					name: 'Free text location name for the fueling to be added',
					type: 'string',
					def: '',
					role: 'state',
					read: true,
					write: true,
				},
				native: {},
			});
			await this.setObjectNotExistsAsync(`ACTIONS.ADD.country`, {
				type: 'state',
				common: {
					name: 'Country of the gas station for the fueling to be added',
					type: 'number',
					def: 0,
					role: 'state',
					states: { 1: 'D', 2: 'A', 3: 'CH', 4: 'F', 5: 'B', 6: 'CDN', 7: 'CZ', 8: 'DK', 9: 'E', 10: 'FIN', 11: 'FL', 12: 'GB', 13: 'GR', 14: 'H', 15: 'I', 16: 'IRL', 17: 'IS', 18: 'L', 19: 'LT', 20: 'LV', 21: 'M', 22: 'MA', 23: 'MC', 24: 'N', 25: 'NL', 26: 'P', 27: 'PL', 28: 'RO', 29: 'RUS', 30: 'S', 31: 'SK', 32: 'SLO', 33: 'HR', 34: 'UA', 35: 'AND', 36: 'BIH', 37: 'SRB', 38: 'EST', 39: 'BG' },
					min: 0,
					max: 39,
					read: true,
					write: true,
				},
				native: {},
			});
			await this.setObjectNotExistsAsync(`ACTIONS.ADD.bc_consumption`, {
				type: 'state',
				common: {
					name: 'Consumption according to the vehicles borcomputer',
					type: 'number',
					def: 0,
					role: 'state',
					min: 0,
					read: true,
					write: true,
				},
				native: {},
			});
			await this.setObjectNotExistsAsync(`ACTIONS.ADD.bc_quantity`, {
				type: 'state',
				common: {
					name: 'Consumed quantity according to the vehicles borcomputer',
					type: 'number',
					def: 0,
					role: 'state',
					min: 0,
					read: true,
					write: true,
				},
				native: {},
			});
			await this.setObjectNotExistsAsync(`ACTIONS.ADD.bc_speed`, {
				type: 'state',
				common: {
					name: 'Average speed according to the vehicles borcomputer',
					type: 'number',
					def: 0,
					role: 'state',
					min: 0,
					read: true,
					write: true,
				},
				native: {},
			});
			await this.setObjectNotExistsAsync(`ACTIONS.ADD.position_lat`, {
				type: 'state',
				common: {
					name: 'Latitude of gas station',
					type: 'number',
					def: 0,
					role: 'state',
					min: -180,
					max: 180,
					read: true,
					write: true,
				},
				native: {},
			});
			await this.setObjectNotExistsAsync(`ACTIONS.ADD.position_lon`, {
				type: 'state',
				common: {
					name: 'Longitude of gas station',
					type: 'number',
					def: 0,
					role: 'state',
					min: -90,
					max: 90,
					read: true,
					write: true,
				},
				native: {},
			});
			await this.setObjectNotExistsAsync(`ACTIONS.ADD.attributes`, {
				type: 'state',
				common: {
					name: 'Combination of one tire type (wintertires, summertires, allyeartires) and one driving style (slow, normal, fast) and one or more extras (ac, heating, trailer)',
					type: 'string',
					def: '',
					role: 'state',
					read: true,
					write: true,
				},
				native: {},
			});
			await this.setObjectNotExistsAsync(`ACTIONS.ADD.streets`, {
				type: 'state',
				common: {
					name: 'Combination of city, autobahn, land',
					type: 'string',
					def: '',
					role: 'state',
					read: true,
					write: true,
				},
				native: {},
			});
			/*
			await this.setObjectNotExistsAsync(`ACTIONS.ADD.ADD_RAW`, {
				type: 'state',
				common: {
					name: 'Add new fueling for given tank of given vehicle (Object with a string)',
					type: 'string',
					role: 'state',
					read: true,
					write: true,
				},
				native: {},
			});
			*/
			// create channel "DEL"
			await this.setObjectNotExistsAsync(`ACTIONS.DEL`, {
				type: 'channel',
				common: {
					name: 'Delete an existing fueling for given tank of given vehicle',
				},
				native: {},
			});
			await this.setObjectNotExistsAsync(`ACTIONS.DEL.DEL`, {
				type: 'state',
				common: {
					name: 'Delete an existing fueling for given tank of given vehicle',
					type: 'boolean',
					def: false,
					role: 'button',
					read: true,
					write: true,
				},
				native: {},
			});
			await this.setObjectNotExistsAsync(`ACTIONS.DEL.vehicleId`, {
				type: 'state',
				common: {
					name: 'Numeric ID of the vehicle to delete a fueling for',
					type: 'number',
					role: 'state',
					min: 0,
					read: true,
					write: true,
				},
				native: {},
			});
			await this.setObjectNotExistsAsync(`ACTIONS.DEL.tankId`, {
				type: 'state',
				common: {
					name: 'Numeric ID of the tank to delete fueling for',
					type: 'number',
					role: 'state',
					min: 0,
					max: 1,
					read: true,
					write: true,
				},
				native: {},
			});
			await this.setObjectNotExistsAsync(`ACTIONS.DEL.fuelingId`, {
				type: 'state',
				common: {
					name: 'Numeric ID of the fueling to be deleted',
					type: 'number',
					role: 'state',
					min: 0,
					read: true,
					write: true,
				},
				native: {},
			});
			// subscribeStates
			this.subscribeStates('ACTIONS.UPDATE');
			this.subscribeStates('ACTIONS.ADD.ADD');
			// this.subscribeStates('ACTIONS.ADD.ADD_RAW');
			this.subscribeStates('ACTIONS.DEL.DEL');

			this.log.debug('[createObjects]: Objects created...');

		} else {
			throw new Error('No Vehicles found, no Objects created. Check API (ERR_#004)');
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
		for (let i = 0; i < tanks.length; i++) {
			this.setStateAsync(`${vehicles}.tanks.${i + 1}.id`, { val: tanks[i].id, ack: true });
			this.setStateAsync(`${vehicles}.tanks.${i + 1}.fuelsorttype`, { val: tanks[i].fuelsorttype, ack: true });
			this.setStateAsync(`${vehicles}.tanks.${i + 1}.quantityunittype`, { val: tanks[i].quantityunittype, ack: true });
			this.setStateAsync(`${vehicles}.tanks.${i + 1}.name`, { val: tanks[i].name, ack: true });
			this.setStateAsync(`${vehicles}.tanks.${i + 1}.consumption`, { val: Number(tanks[i].consumption), ack: true });
			this.setStateAsync(`${vehicles}.tanks.${i + 1}.consumptionunit`, { val: tanks[i].consumptionunit, ack: true });
			this.setStateAsync(`${vehicles}.tanks.${i + 1}.consumptionunitid`, { val: tanks[i].consumptionunitid, ack: true });
			this.setStateAsync(`${vehicles}.tanks.${i + 1}.co2`, { val: Number(tanks[i].co2), ack: true });
			this.setStateAsync(`${vehicles}.tanks.${i + 1}.co2tripsum`, { val: Number(tanks[i].co2tripsum), ack: true });
			this.setStateAsync(`${vehicles}.tanks.${i + 1}.co2quantitysum`, { val: Number(tanks[i].co2quantitysum), ack: true });
			this.setStateAsync(`${vehicles}.tanks.${i + 1}.costsum`, { val: Number(tanks[i].costsum), ack: true });
			this.setStateAsync(`${vehicles}.tanks.${i + 1}.costsumunit`, { val: tanks[i].costsumunit, ack: true });
			this.setStateAsync(`${vehicles}.tanks.${i + 1}.costtripsum`, { val: Number(tanks[i].costtripsum), ack: true });
			this.setStateAsync(`${vehicles}.tanks.${i + 1}.tripsum`, { val: Number(tanks[i].tripsum), ack: true });
			this.setStateAsync(`${vehicles}.tanks.${i + 1}.tripsumunit`, { val: tanks[i].tripsumunit, ack: true });
			this.setStateAsync(`${vehicles}.tanks.${i + 1}.quantitysum`, { val: Number(tanks[i].quantitysum), ack: true });
			this.setStateAsync(`${vehicles}.tanks.${i + 1}.quantitysumunit`, { val: tanks[i].quantitysumunit, ack: true });
		}
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
				this.log.debug(`[getFuelings]: HTTP status response: ${response.status} ${response.statusText}; config: ${JSON.stringify(response.config)}; headers: ${JSON.stringify(response.headers)}; data: ${JSON.stringify(response.data)}`);

				await this.fillObjectsFuelings(vehicleId, response.data);
			})
			.catch((error) => {
				if (error.response) {
					// The request was made and the server responded with a status code that falls out of the range of 2xx
					this.log.debug(`[getFuelings]: HTTP status response: ${error.response.status}; headers: ${JSON.stringify(error.response.headers)}; data: ${JSON.stringify(error.response.data)}`);
				} else if (error.request) {
					// The request was made but no response was received `error.request` is an instance of XMLHttpRequest in the browser and an instance of http.ClientRequest in node.js
					this.log.debug(`[getFuelings]: error request: ${error}`);
				} else {
					// Something happened in setting up the request that triggered an Error
					this.log.debug(`[getFuelings]: error message: ${error.message}`);
				}
				this.log.debug(`[getFuelings]: error.config: ${JSON.stringify(error.config)}`);
			});
	}

	async fillObjectsFuelings(vehicles, fuelings) {
		this.setStateAsync(`${vehicles}.fuelings.raw`, { val: JSON.stringify(fuelings), ack: true });

		const years = [...new Set(fuelings.map(item => item.date.substr(item.date.length - 4)))];
		// this.log.debug(`[fillObjectsFuelings]: years: ${years}`);

		let tempYear;
		for (let i = 0; i < years.length; i++) {

			// create channel "years"
			await this.setObjectNotExistsAsync(`${vehicles}.fuelings.${years[i]}`, {
				type: 'channel',
				common: {
					name: `Fuelings ${years[i]}`
				},
				native: {},
			});

			tempYear = [];
			for (let j = 0; j < Object.keys(fuelings).length; j++) {
				if (fuelings[j].date.substr(fuelings[j].date.length - 4) == years[i]) {
					tempYear.push(fuelings[j]);
				}
			}
			// this.log.debug(`[fillObjectsFuelings]: tempYear: ${JSON.stringify(tempYear)}`);

			await this.setObjectNotExistsAsync(`${vehicles}.fuelings.${years[i]}.raw`, {
				type: 'state',
				common: {
					name: `A JSON array of fuelings (${years[i]})`,
					type: 'array',
					role: 'state',
					read: true,
					write: false,
				},
				native: {},
			});
			this.setStateAsync(`${vehicles}.fuelings.${years[i]}.raw`, { val: JSON.stringify(tempYear), ack: true });
		}
	}

	async getCostsnotes(vehicleId) {
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
				this.log.debug(`[getCostnotes]: HTTP status response: ${response.status} ${response.statusText}; config: ${JSON.stringify(response.config)}; headers: ${JSON.stringify(response.headers)}; data: ${JSON.stringify(response.data)}`);

				await this.fillObjectsCostsnotes(vehicleId, response.data);
			})
			.catch((error) => {
				if (error.response) {
					// The request was made and the server responded with a status code that falls out of the range of 2xx
					this.log.debug(`[getCostnotes]: HTTP status response: ${error.response.status}; headers: ${JSON.stringify(error.response.headers)}; data: ${JSON.stringify(error.response.data)}`);
				} else if (error.request) {
					// The request was made but no response was received `error.request` is an instance of XMLHttpRequest in the browser and an instance of http.ClientRequest in node.js
					this.log.debug(`[getCostnotes]: error request: ${error}`);
				} else {
					// Something happened in setting up the request that triggered an Error
					this.log.debug(`[getCostnotes]: error message: ${error.message}`);
				}
				this.log.debug(`[getCostnotes]: error.config: ${JSON.stringify(error.config)}`);
			});
	}

	async fillObjectsCostsnotes(vehicles, costsnotes) {
		this.setStateAsync(`${vehicles}.costsnotes.raw`, { val: JSON.stringify(costsnotes), ack: true });

		const years = [...new Set(costsnotes.map(item => item.date.substr(item.date.length - 4)))];
		// this.log.debug(`[fillObjectsCostsnotes]: years: ${years}`);

		let tempYear;
		for (let i = 0; i < years.length; i++) {

			// create channel "years"
			await this.setObjectNotExistsAsync(`${vehicles}.costsnotes.${years[i]}`, {
				type: 'channel',
				common: {
					name: `Costs / Notes ${years[i]}`
				},
				native: {},
			});

			tempYear = [];
			for (let j = 0; j < Object.keys(costsnotes).length; j++) {
				if (costsnotes[j].date.substr(costsnotes[j].date.length - 4) == years[i]) {
					tempYear.push(costsnotes[j]);
				}
			}
			// this.log.debug(`[fillObjectsCostsnotes]: tempYear: ${JSON.stringify(tempYear)}`);

			await this.setObjectNotExistsAsync(`${vehicles}.costsnotes.${years[i]}.raw`, {
				type: 'state',
				common: {
					name: `A JSON array of costs / notes (${years[i]})`,
					type: 'array',
					role: 'state',
					read: true,
					write: false,
				},
				native: {},
			});
			this.setStateAsync(`${vehicles}.costsnotes.${years[i]}.raw`, { val: JSON.stringify(tempYear), ack: true });
		}
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
				this.log.debug(`[getReminders]: HTTP status response: ${response.status} ${response.statusText}; config: ${JSON.stringify(response.config)}; headers: ${JSON.stringify(response.headers)}; data: ${JSON.stringify(response.data)}`);

				await this.fillObjectsReminders(response.data);
			})
			.catch((error) => {
				if (error.response) {
					// The request was made and the server responded with a status code that falls out of the range of 2xx
					this.log.debug(`[getReminders]: HTTP status response: ${error.response.status}; headers: ${JSON.stringify(error.response.headers)}; data: ${JSON.stringify(error.response.data)}`);
				} else if (error.request) {
					// The request was made but no response was received `error.request` is an instance of XMLHttpRequest in the browser and an instance of http.ClientRequest in node.js
					this.log.debug(`[getReminders]: error request: ${error}`);
				} else {
					// Something happened in setting up the request that triggered an Error
					this.log.debug(`[getReminders]: error message: ${error.message}`);
				}
				this.log.debug(`[getReminders]: error.config: ${JSON.stringify(error.config)}`);
			});
	}

	async fillObjectsReminders(reminders) {
		this.setStateAsync(`reminders.raw`, { val: JSON.stringify(reminders), ack: true });
	}

	// https://api.spritmonitor.de/v1/vehicle/123456/tank/1/fueling.json?date=15.01.2019&odometer=45123&trip=652.4&quantity=45.4&type=full&price=89.4&currencyid=0&pricetype=0&fuelsortid=7&quantityunitid=1&note=My%20note%20for%20this%20fueling&stationname=Shell&location=Moosacher%20Strasse&country=D&bc_consumption=7.2&bc_quantity=53.4&bc_speed=53.4&position=48.137154%2C11.576124

	async addFueling(vehicleId, tankId, val) {
		await this.requestClient({
			method: 'GET',
			url: `https://api.spritmonitor.de/v1/vehicle/${vehicleId}/tank/${tankId}/fueling.json?${val}`,
			headers: {
				'Authorization': `Bearer ${this.config.applicationKey}`,
				'Application-Id': 'eea22a25be0bd8b3e1914ed0497af931',
				'User-Agent': 'ioBroker Spritmonitor API Access'
			},
		})
			.then(async (response) => {
				this.log.debug(`[addFueling]: HTTP status response: ${response.status} ${response.statusText}; config: ${JSON.stringify(response.config)}; headers: ${JSON.stringify(response.headers)}; data: ${JSON.stringify(response.data)}`);
				if (response.data.errors) {
					this.log.info(`[addFueling]: ${JSON.stringify(response.data.errormessages)}. NOTHING SET.`);
				}
			})
			.catch((error) => {
				if (error.response) {
					// The request was made and the server responded with a status code that falls out of the range of 2xx
					this.log.debug(`[addFueling]: HTTP status response: ${error.response.status}; headers: ${JSON.stringify(error.response.headers)}; data: ${JSON.stringify(error.response.data)}`);
				} else if (error.request) {
					// The request was made but no response was received `error.request` is an instance of XMLHttpRequest in the browser and an instance of http.ClientRequest in node.js
					this.log.debug(`[addFueling]: error request: ${error}`);
				} else {
					// Something happened in setting up the request that triggered an Error
					this.log.debug(`[addFueling]: error message: ${error.message}`);
				}
				this.log.debug(`[addFueling]: error.config: ${JSON.stringify(error.config)}`);
			});
	}

	async delFueling(vehicleId, tankId, fuelingId) {
		await this.requestClient({
			method: 'GET',
			url: `https://api.spritmonitor.de/v1/vehicle/${vehicleId}/tank/${tankId}/fueling/${fuelingId}.delete`,
			headers: {
				'Authorization': `Bearer ${this.config.applicationKey}`,
				'Application-Id': 'eea22a25be0bd8b3e1914ed0497af931',
				'User-Agent': 'ioBroker Spritmonitor API Access'
			},
		})
			.then(async (response) => {
				this.log.debug(`[delFueling]: HTTP status response: ${response.status} ${response.statusText}; config: ${JSON.stringify(response.config)}; headers: ${JSON.stringify(response.headers)}; data: ${JSON.stringify(response.data)}`);
				if (response.data.errors) {
					this.log.info(`[delFueling]: ${JSON.stringify(response.data.errormessages)}. NOTHING DELETED.`);
				}
			})
			.catch((error) => {
				if (error.response) {
					// The request was made and the server responded with a status code that falls out of the range of 2xx
					this.log.debug(`[delFueling]: HTTP status response: ${error.response.status}; headers: ${JSON.stringify(error.response.headers)}; data: ${JSON.stringify(error.response.data)}`);
				} else if (error.request) {
					// The request was made but no response was received `error.request` is an instance of XMLHttpRequest in the browser and an instance of http.ClientRequest in node.js
					this.log.debug(`[delFueling]: error request: ${error}`);
				} else {
					// Something happened in setting up the request that triggered an Error
					this.log.debug(`[delFueling]: error message: ${error.message}`);
				}
				this.log.debug(`[delFueling]: error.config: ${JSON.stringify(error.config)}`);
			});
	}

	dateIsValid(dateStr) {
		if (dateStr.match(/^\d{2}\.\d{2}\.\d{4}$/) === null) {
			return false;
		}
		const [day, month, year] = dateStr.split('.');
		const isoFormattedStr = `${year}-${month}-${day}`;
		const date = new Date(isoFormattedStr);
		const timestamp = date.getTime();
		if (typeof timestamp !== 'number' || Number.isNaN(timestamp)) {
			return false;
		}
		return date.toISOString().startsWith(isoFormattedStr);
	}

	numberInRange(min, max, val) {
		/*
		if (typeof val !== 'number' || Number.isNaN(val)) {
			return false;
		}
		*/
		if (min === null) {
			return val <= max;
		} else if (max === null) {
			return min <= val;
		} else {
			return min <= val && val <= max;
		}
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

				let command = null;
				const idSplit = id.split('.');

				if (idSplit.length === 4) {
					command = idSplit[3];
				} else if (idSplit.length === 5) {
					command = idSplit[4];
				}
				this.log.debug(`[onStateChange]: command: ${command}`);

				if (command === 'UPDATE' && state.val) {
					await this.getVehicles();
					await this.fillObjectsVehicles(this.vehicles);

					for (let i = 0; i < vehicleIDs.length; i++) {
						await this.getTanks(vehicleIDs[i]);
						await this.getFuelings(vehicleIDs[i]);
						await this.getCostsnotes(vehicleIDs[i]);
					}
					await this.getReminders();
				}
				if (command === 'ADD' && state.val) {

					let APIstring = '';

					const vehicleId = await this.getStateAsync(`ACTIONS.ADD.vehicleId`);
					if (vehicleId && vehicleId.val) {
						if (!vehicleIDs.includes(vehicleId.val)) {
							this.log.info(`[onStateChange]: vehicleId not valid. NOTHING SET.`);
							return;
						}
					} else {
						this.log.info(`[onStateChange]: vehicleId not valid. NOTHING SET.`);
						return;
					}
					const tankId = await this.getStateAsync(`ACTIONS.ADD.tankId`);
					if (tankId && tankId.val !== null) {
						if (!this.numberInRange(0, null, tankId.val)) {
							this.log.info(`[onStateChange]: tankId not valid. NOTHING SET.`);
							return;
						}
					} else {
						this.log.info(`[onStateChange]: tankId not valid. NOTHING SET.`);
						return;
					}
					const date = await this.getStateAsync(`ACTIONS.ADD.date`);
					if (date && this.dateIsValid(date.val)) {
						APIstring += `date=${date.val}`;
					} else {
						this.log.info(`[onStateChange]: date not valid. NOTHING SET.`);
						return;
					}
					const odometer = await this.getStateAsync(`ACTIONS.ADD.odometer`);
					if (odometer && odometer.val !== 0) {
						if (this.numberInRange(0.1, null, odometer.val)) {
							APIstring += `&odometer=${odometer.val}`;
						} else {
							this.log.info(`[onStateChange]: value odometer not valid. Value not added.`);
						}
					}
					const trip = await this.getStateAsync(`ACTIONS.ADD.trip`);
					if (trip && this.numberInRange(0.1, null, trip.val)) {
						APIstring += `&trip=${trip.val}`;
					} else {
						this.log.info(`[onStateChange]: value trip not valid. NOTHING SET.`);
						return;
					}
					const quantity = await this.getStateAsync(`ACTIONS.ADD.quantity`);
					if (quantity && this.numberInRange(0.1, null, quantity.val)) {
						APIstring += `&quantity=${quantity.val}`;
					} else {
						this.log.info(`[onStateChange]: value quantity not valid. NOTHING SET.`);
						return;
					}
					const type = await this.getStateAsync(`ACTIONS.ADD.type`);
					if (type && (type.val === 'invalid' || type.val === 'full' || type.val === 'notfull' || type.val === 'first')) {
						APIstring += `&type=${type.val}`;
					} else {
						this.log.info(`[onStateChange]: type not valid. NOTHING SET.`);
						return;
					}
					const price = await this.getStateAsync(`ACTIONS.ADD.price`);
					if (price && price.val !== 0) {
						if (this.numberInRange(0.1, null, price.val)) {
							APIstring += `&price=${price.val}`;
						} else {
							this.log.info(`[onStateChange]: price not valid. Value not added.`);
						}
					}
					const currencyid = await this.getStateAsync(`ACTIONS.ADD.currencyid`);
					if (currencyid && this.numberInRange(0, 33, currencyid.val)) {
						APIstring += `&currencyid=${currencyid.val}`;
					}
					const pricetype = await this.getStateAsync(`ACTIONS.ADD.pricetype`);
					if (pricetype && this.numberInRange(0, 1, pricetype.val)) {
						APIstring += `&pricetype=${pricetype.val}`;
					}
					const fuelsortid = await this.getStateAsync(`ACTIONS.ADD.fuelsortid`);
					if (fuelsortid && this.numberInRange(0, 33, fuelsortid.val)) {
						APIstring += `&fuelsortid=${fuelsortid.val}`;
					} else {
						this.log.info(`[onStateChange]: fuelsortid not valid. NOTHING SET.`);
						return;
					}
					const quantityunitid = await this.getStateAsync(`ACTIONS.ADD.quantityunitid`);
					if (quantityunitid && this.numberInRange(1, 5, quantityunitid.val)) {
						APIstring += `&quantityunitid=${quantityunitid.val}`;
					} else {
						this.log.info(`[onStateChange]: quantityunitid not valid. NOTHING SET.`);
						return;
					}
					const note = await this.getStateAsync(`ACTIONS.ADD.note`);
					if (note && note.val) {
						APIstring += `&note=${note.val}`;
					}
					const stationname = await this.getStateAsync(`ACTIONS.ADD.stationname`);
					if (stationname && stationname.val) {
						APIstring += `&stationname=${stationname.val}`;
					}
					const location = await this.getStateAsync(`ACTIONS.ADD.location`);
					if (location && location.val) {
						APIstring += `&location=${location.val}`;
					}
					const country = await this.getStateAsync(`ACTIONS.ADD.country`);
					if (country && country.val) {
						APIstring += `&country=${country.val}`;
					}
					const bc_consumption = await this.getStateAsync(`ACTIONS.ADD.bc_consumption`);
					if (bc_consumption && bc_consumption.val !== 0) {
						if (this.numberInRange(0.1, null, bc_consumption.val)) {
							APIstring += `&bc_consumption=${bc_consumption.val}`;
						} else {
							this.log.info(`[onStateChange]: bc_consumption not valid. Value not added.`);
						}
					}
					const bc_quantity = await this.getStateAsync(`ACTIONS.ADD.bc_quantity`);
					if (bc_quantity && bc_quantity.val !== 0) {
						if (this.numberInRange(0.1, null, bc_quantity.val)) {
							APIstring += `&bc_quantity=${bc_quantity.val}`;
						} else {
							this.log.info(`[onStateChange]: bc_quantity not valid. Value not added.`);
						}
					}
					const bc_speed = await this.getStateAsync(`ACTIONS.ADD.bc_speed`);
					if (bc_speed && bc_speed.val !== 0) {
						if (this.numberInRange(0.1, null, bc_speed.val)) {
							APIstring += `&bc_speed=${bc_speed.val}`;
						} else {
							this.log.info(`[onStateChange]: bc_speed not valid. Value not added.`);
						}
					}
					const position_lat = await this.getStateAsync(`ACTIONS.ADD.position_lat`);
					const position_long = await this.getStateAsync(`ACTIONS.ADD.position_long`);
					if (position_lat && position_lat.val !== 0 && position_long && position_long.val !== 0) {
						if (this.numberInRange(-180, 180, position_lat.val) && this.numberInRange(-90, 90, position_long.val)) {
							APIstring += `&position=${position_lat.val},${position_long.val}`;
						} else {
							this.log.info(`[onStateChange]: Position not valid. Value not added.`);
						}
					}
					const attributes = await this.getStateAsync(`ACTIONS.ADD.attributes`);
					if (attributes && attributes.val) {
						// remove dublicates
						let attributesMod = attributes.val.split(',');
						attributesMod = attributesMod.filter((item, index) => attributesMod.indexOf(item) === index);
						this.log.debug(`[onStateChange]: attributesMod: ${attributesMod}`);
						if (attributesMod.every((element) => ['wintertires', 'summertires', 'allyeartires', 'slow', 'normal', 'fast', 'ac', 'heating', 'trailer'].includes(element))) {
							APIstring += `&attributes=${attributesMod}`;
						} else {
							this.log.info(`[onStateChange]: attribut(es) not valid. Value not added.`);
						}
					}
					const streets = await this.getStateAsync(`ACTIONS.ADD.streets`);
					if (streets && streets.val) {
						// remove dublicates
						let streetsMod = streets.val.split(',');
						streetsMod = streetsMod.filter((item, index) => streetsMod.indexOf(item) === index);
						this.log.debug(`[onStateChange]: streetsMod: ${streetsMod}`);
						// check if only allowed elements
						if (streetsMod.every((element) => ['city', 'autobahn', 'land'].includes(element))) {
							APIstring += `&streets=${streetsMod}`;
						} else {
							this.log.info(`[onStateChange]: streets not valid. Value not added.`);
						}
					}

					this.log.debug(`[onStateChange]: APIstring ${APIstring}`);

					await this.addFueling(vehicleId.val, tankId.val, APIstring);

					// reset several userinputs
					// this.setState(`ACTIONS.ADD.vehicleId`, 0, true);
					// this.setState(`ACTIONS.ADD.tankId`, 0, true);
					this.setState(`ACTIONS.ADD.date`, '', true);
					this.setState(`ACTIONS.ADD.odometer`, 0, true);
					this.setState(`ACTIONS.ADD.trip`, 0, true);
					this.setState(`ACTIONS.ADD.quantity`, 0, true);
					// this.setState(`ACTIONS.ADD.type`, 0, true);
					this.setState(`ACTIONS.ADD.price`, 0, true);
					// this.setState(`ACTIONS.ADD.currencyid`, 0, true);
					// this.setState(`ACTIONS.ADD.pricetype`, 0, true);
					// this.setState(`ACTIONS.ADD.fuelsortid`, 0, true);
					// this.setState(`ACTIONS.ADD.quantityunitid`, 0, true);
					this.setState(`ACTIONS.ADD.note`, '', true);
					this.setState(`ACTIONS.ADD.stationname`, '', true);
					this.setState(`ACTIONS.ADD.location`, '', true);
					// this.setState(`ACTIONS.ADD.country`, '', true);
					this.setState(`ACTIONS.ADD.bc_consumption`, 0, true);
					this.setState(`ACTIONS.ADD.bc_quantity`, 0, true);
					this.setState(`ACTIONS.ADD.bc_speed`, 0, true);
					this.setState(`ACTIONS.ADD.position_lat`, 0, true);
					this.setState(`ACTIONS.ADD.position_lon`, 0, true);

					await this.getFuelings(vehicleId.val);
				}

				/*
				if (command === 'ADD_RAW' && state.val) {

					let APIstring = '';

					// TODO

					// reset userinput
					this.setState(`ACTIONS.ADD.ADD_RAW`, [], true);
				}
				*/

				if (command === 'DEL' && state.val) {
					const vehicleId = await this.getStateAsync(`ACTIONS.DEL.vehicleId`);
					if (vehicleId && vehicleId.val) {
						if (!vehicleIDs.includes(vehicleId.val)) {
							this.log.info(`[onStateChange - DEL]: vehicleId not valid. NOTHING DELETED.`);
							return;
						}
					} else {
						this.log.info(`[onStateChange - DEL]: vehicleId not valid. NOTHING DELETED.`);
						return;
					}
					const tankId = await this.getStateAsync(`ACTIONS.DEL.tankId`);
					if (tankId && tankId.val !== null) {
						if (!this.numberInRange(0, null, tankId.val)) {
							this.log.info(`[onStateChange - DEL]: tankId not valid. NOTHING DELETED.`);
							return;
						}
					} else {
						this.log.info(`[onStateChange - DEL]: tankId not valid. NOTHING DELETED.`);
						return;
					}
					const fuelingId = await this.getStateAsync(`ACTIONS.DEL.fuelingId`);
					if (fuelingId && fuelingId.val !== null) {
						if (!this.numberInRange(0, null, fuelingId.val)) {
							this.log.info(`[onStateChange - DEL]: fuelingId not valid. NOTHING DELETED.`);
							return;
						}
					} else {
						this.log.info(`[onStateChange - DEL]: fuelingId not valid. NOTHING DELETED.`);
						return;
					}

					await this.delFueling(vehicleId.val, tankId.val, fuelingId.val);

					// reset userinputs
					this.setState(`ACTIONS.DEL.vehicleId`, 0, true);
					this.setState(`ACTIONS.DEL.tankId`, 0, true);
					this.setState(`ACTIONS.DEL.fuelingId`, 0, true);

					await this.getFuelings(vehicleId.val);
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