#!/usr/bin/env node

// Node.js Playstation 3 / DS3 Controller for CNC.js
// by Austin St. Aubin <austinsaintaubin@gmail.com>
// v1.0.9 BETA [2017/03/27]
// https://github.com/cheton/cnc/issues/103
// [PS3 CNC Control Button Map](https://docs.google.com/drawings/d/1DMzfBk5DSvjJ082FrerrfmpL19-pYAOcvcmTbZJJsvs/edit?usp=sharing)
// USAGE: ./cncjs-pendant-ps3 -p "/dev/ttyUSB0"

// [Dependacies]
const fs = require('fs');
const path = require('path');
const io = require('socket.io-client'); // Socket.io connection to CNC
const jwt = require('jsonwebtoken');
const get = require('lodash.get');
// const HID = require('node-hid');
// const dualShock = require('dualshock-controller'); // https://www.npmjs.com/package/dualshock-controller
var joystick = new(require('joystick'))(0, 3500, 350);

// View HID Devices
//var HID = require('node-hid');
//console.log(HID.devices());


// [Varables]
// =====================================================



// [Functions]
// =====================================================
// Generate Token
const generateAccessToken = function (payload, secret, expiration) {
	const token = jwt.sign(payload, secret, {
		expiresIn: expiration
	});

	return token;
};

// Get secret key from the config file and generate an access token
const getUserHome = function () {
	return process.env[(process.platform === 'win32') ? 'USERPROFILE' : 'HOME'];
};

// Pass User Defined Options
module.exports = function (options, callback) {
	options = options || {};
	options.secret = get(options, 'secret', process.env['CNCJS_SECRET']);
	options.baudrate = get(options, 'baudrate', 115200);
	options.socketAddress = get(options, 'socketAddress', 'localhost');
	options.socketPort = get(options, 'socketPort', 8000);
	options.controllerType = get(options, 'controllerType', 'Grbl');
	options.accessTokenLifetime = get(options, 'accessTokenLifetime', '30d');

	var pendant_started = false;

	// Logging Message
	console.log("Waiting for Pendant to connect... please press the PS button on the DS3 controller.");

	// [Function] check for controller to conect (show up in devices), then start services. Kill services on disconect.
	// setInterval(checkController, 3*1000);
	// function checkController(socket, controller) {
	// 	//console.log('Checkign Controller Status');

	// 	// Get HID Devices
	// 	var devices = HID.devices();

	// 	// Find DualShock 3 Controller HID
	// 	devices.forEach(function(device) {
	// 		// List Devices
	// 		//console.log(device.vendorId + " | " + device.productId);

	// 		// Detect DualShock 3 Controller HID
	// 		if (!pendant_started && (device.vendorId == 1356 && device.productId == 616)) {
	// 			console.log("Pendant Connected");

	// 			// Start Socket Connection & Controller Conection
	// 			pendant_started = true;
	// 			connectPendant();
	// 		}
	// 	});
	// }
	connectPendant();

	// ###########################################################################
	// Start Socket Connection & Controller Conection
	function connectPendant() {
		if (!options.secret) {
			const cncrc = path.resolve(getUserHome(), '.cncrc');
			try {
				const config = JSON.parse(fs.readFileSync(cncrc, 'utf8'));
				options.secret = config.secret;
			} catch (err) {
				console.error(err);
				process.exit(1);
			}
		}

		const token = generateAccessToken({
			id: '',
			name: 'cncjs-pendant'
		}, options.secret, options.accessTokenLifetime);
		const url = 'ws://' + options.socketAddress + ':' + options.socketPort + '?token=' + token;

		socket = io.connect('ws://' + options.socketAddress + ':' + options.socketPort, {
			'query': 'token=' + token
		});

		socket.on('connect', () => {
			console.log('Connected to ' + url);

			// Open port
			socket.emit('open', options.port, {
				baudrate: Number(options.baudrate),
				controllerType: options.controllerType
			});
		});

		socket.on('error', (err) => {
			console.error(err);
			console.error('Connection error.');
			if (socket) {
				socket.destroy();
				socket = null;
			}
		});

		socket.on('close', () => {
			console.log('Connection closed.');
		});

		socket.on('serialport:open', function (options) {
			options = options || {};

			console.log('Connected to port "' + options.port + '" (Baud rate: ' + options.baudrate + ')');

			callback(null, socket);
		});

		socket.on('serialport:error', function (options) {
			callback(new Error('Error opening serial port "' + options.port + '"'));
		});

		/*
	    socket.on('serialport:read', function(data) {
	        console.log((data || '').trim());
	    });
		*/

		/*
		socket.on('serialport:write', function(data) {
		    console.log((data || '').trim());
		});
		*/

		// =====================================================
		// Play Station 3 Controller / Game Pad
		// https://www.npmjs.com/package/dualshock-controller
		//var dualShock = require('dualshock-controller');

		//pass options to init the controller.
		//var controller = dualShock(
		// controller = dualShock({
		// 	//you can use a ds4 by uncommenting this line.
		// 	//config: "dualshock4-generic-driver",
		// 	//if using ds4 comment this line.
		// 	config: "dualShock3",
		// 	//smooths the output from the acelerometers (moving averages) defaults to true
		// 	accelerometerSmoothing: true,
		// 	//smooths the output from the analog sticks (moving averages) defaults to false
		// 	analogStickSmoothing: false // DO NOT ENABLE, does not retun sticks to center when enabled. 128 x 128
		// });

		//make sure you add an error event handler
		//controller.on('connection:change', data => console.log("conection" + data));

		// controller.on('connected', function (state) {
		// 	console.log('connected: ' + state);
		// });

		// controller.on('error', function (err) {
		// 	console.log("Error Message: " + err);
		// 	//controller.close();  // Not a function currently, have to kill program.
		// 	//controller.destroy();
		// 	process.exit(); // Kill Program
		// });

		// ------------------------------------------

		// Safety Switches & Modifyers
		ps3_led = 0b10000;
		ps3_rumble_left = 0;
		ps3_rumble_right = 0;

		// ------------------------------------------

		// Analog Sticks
		var stick_sensitivity = 1; // Do not set bellow 1

		var left_x = 0;
		left_y = 0;
		var right_x = 0;
		right_y = 0;

		// Safty
		var stick_left = false;
		stick_right = false;


		var psx = false;
		var l1 = false;
		var r1 = false;
		var l2 = false;
		var r2 = false;
		joystick.on("button", (event) => {
			const button = () => {
				switch (event.number) {
					case 0:
						return "a"
					case 1:
						return "b"
					case 2:
						return "x"
					case 3:
						return "y"
					case 4:
						return "trigger_left"
					case 5:
						return "trigger_right"
					case 6:
						return "view"
					case 7:
						return "menu"
					case 8:
						return "xbox"
					case 9:
						return "THUMBSTICK_L_CLICK"
					case 10:
						return "THUMBSTICK_R_CLICK"
					default:
						break;
				}
			}
			switch (button()) {
				case "xbox":
					if (event.value === 1) psx = true;
					else psx = false;
					break;
				case "trigger_left":
					if (event.value === 1) l1 = true;
					else l1 = false;
					break;
				case "trigger_right":
					if (event.value === 1) r1 = true;
					else r1 = false;
					break;
				case "menu":
					if (event.value === 1) {
						if (psx) {
							socket.emit('command', options.port, 'unlock');
						} else {
							socket.emit('command', options.port, 'cyclestart');
						}
					}
					break;
				case "view":
					if (event.value === 1) {
						if (psx) {
							socket.emit('command', options.port, 'reset');
						} else {
							socket.emit('command', options.port, 'feedhold');
						}
					}
					break;
				case "y":
					if (event.value === 1) {
						if (!r1 && !l1 && !psx) {
							socket.emit('command', options.port, 'start');
							// console.log('cyclestart:' + event);
						}
						if (r1) {
							move_z_axis += 0.25;
						}
						if (psx) {
							socket.emit('command', options.port, 'gcode', 'M7');
						}
					} else {
						if (r1) {
							move_z_axis = 0;
						}
					}
					break;
				case "x":
					if (event.value === 1) {
						if (!r1 && !l1 && !psx) {
							socket.emit('command', options.port, 'stop');
							// console.log('cyclestart:' + event);
						}
						if (r1) {
							// socket.emit('command', options.port, 'gcode', 'G91');
							// socket.emit('command', options.port, 'gcode', 'G38.2 Z-15.001 F120');
							// socket.emit('command', options.port, 'gcode', 'G90');
							// socket.emit('command', options.port, 'gcode', 'G10 L20 P1 Z15.001');
							// socket.emit('command', options.port, 'gcode', 'G91');
							// socket.emit('command', options.port, 'gcode', 'G0 Z3');
							// socket.emit('command', options.port, 'gcode', 'G90');

							// console.log('probe:' + event);
						}
						if (psx) {
							socket.emit('command', options.port, 'gcode', 'M9');
						}
					}
					break;
				case "b":
					if (event.value === 1) {
						if (!r1 && !l1 && !psx) {
							socket.emit('command', options.port, 'pause');
							// console.log('pause:' + event);
						}
						if (r1) {
							move_z_axis -= 0.05;
						}
						if (psx) {
							socket.emit('command', options.port, 'gcode', 'M8');
						}
					} else {
						if (r1) {
							move_z_axis = 0;
						}
					}
					break;
				case "a":
					if (event.value === 1) {
						if (!r1 && !l1 && !psx) {
							socket.emit('command', options.port, 'resume');
							// console.log('unlock:' + event);
						}
						if (r1) {
							move_z_axis -= 0.25;
						}
						if (psx) {
							socket.emit('command', options.port, 'homing');
						}
					} else {
						if (r1) {
							move_z_axis = 0;
						}
					}
					break;
				case "THUMBSTICK_L_CLICK":
					// Toggle Enable
					if (stick_left || stick_right) {
						stick_left = false;
						stick_right = false;
						ps3_rumble_left = 0; // 0-1 (Rumble left on/off)
					} else {
						stick_left = true;
						stick_right = true;
						ps3_rumble_left = 1; // 0-1 (Rumble left on/off)
					}
					break;
				case "THUMBSTICK_R_CLICK":
					// Toggle Enable
					if (stick_right || stick_left) {
						stick_right = false;
						stick_left = false;
						ps3_rumble_left = 0; // 0-1 (Rumble left on/off)
					} else {
						stick_right = true;
						stick_left = true;
						ps3_rumble_left = 1; // 0-1 (Rumble left on/off)
					}
					break;

				default:
					break;
			}
		})
		joystick.on("axis", (event) => {
			const axis = () => {
				switch (event.number) {
					case 0:
						return "right_x"
					case 1:
						return "right_y"
					case 2:
						return "bumper_left"
					case 3:
						return "left_x"
					case 4:
						return "left_y"
					case 5:
						return "bumper_right"
					case 6:
						return "dpad_x"
					case 7:
						return "dpad_y"
					default:
						break;
				}
			}
			switch (axis()) {
				case "dpad_y":
					if (event.value < 0) {
						dpad('Y', true)
					}
					if (event.value > 0) {
						dpad('Y', false)
					}
					if (event.value === 0) {
						move_y_axis = 0;
					}
					break;
				case "dpad_x":
					if (event.value > 0) {
						dpad('X', true)
					}
					if (event.value < 0) {
						dpad('X', false)
					}
					if (event.value === 0) {
						move_x_axis = 0;
					}
					break;
				case "bumper_right":
					if (event.value < -32760) {
						if (r1 && psx) {
							socket.emit('command', options.port, 'gcode', 'M3 S1000');
							spindle = true;
							// console.log('Spindle: ' + spindle);
						}
					}
					if (event.value > -32760) {
						if (!psx && spindle) {
							socket.emit('command', options.port, 'gcode', 'M5');
							spindle = false;
							// console.log('Spindle: ' + spindle);
						}
					}
					break;
				case "bumper_left":
					if (event.value < -32760) {
						l2 = true;
					}
					if (event.value > -32760) {
						l2 = false;
					}
					break;
				case "left_x":
					if (stick_left) {
						left_x = map(event.value, -32767, 32767, -1.0, 1.0) - 10
						// left_y = (data.y * -1) + 128
					} else {
						left_x = 0;
						// left_y = 0;
					}
					break;
				case "left_y":
					if (stick_left) {
						// left_x = event.value - 128
						left_y = (map(event.value, -32767, 32767, -1.0, 1.0) * -1) + 10
					} else {
						// left_x = 0;
						left_y = 0;
					}
					break;
				case "right_x":
					if (stick_right) {
						right_x = map(event.value, -32767, 32767, -1.0, 1.0) - 10
						// left_y = (data.y * -1) + 128
					} else {
						right_x = 0;
						// left_y = 0;
					}
					break;
				case "right_y":
					if (stick_right) {
						// left_x = event.value - 128
						right_y = (map(event.value, -32767, 32767, -1.0, 1.0) * -1) + 10
					} else {
						// left_x = 0;
						right_y = 0;
					}
					break;

				default:
					break;
			}
			console.log(left_x + " : " + left_x + " : " + stick_left + " : " + event.value + " : " + map(event.value, -32767, 32767, -1.0, 1.0) + " : " + axis())

		})
		// // psx
		// var psx = false;
		// controller.on('psxButton:press', function (data) {
		// 	psx = true;
		// 	//console.log(data + '|' + psx);
		// });
		// controller.on('psxButton:release', function (data) {
		// 	psx = false;
		// 	//console.log(data + '|' + psx);
		// });

		// // L1
		// var l1 = false;
		// controller.on('l1:press', function (data) {
		// 	l1 = true;
		// 	//console.log(data + '|' + l1);
		// });
		// controller.on('l1:release', function (data) {
		// 	l1 = false;
		// 	//console.log(data + '|' + l1);
		// });

		// // R1
		// var r1 = false;
		// controller.on('r1:press', function (data) {
		// 	r1 = true;
		// 	//console.log(data + '|' + r1);
		// });
		// controller.on('r1:release', function (data) {
		// 	r1 = false;
		// 	//console.log(data + '|' + r1);
		// });

		// // L2
		// var l2 = false;
		// controller.on('l2:press', function (data) {
		// 	l2 = true;
		// 	//console.log(data + '|' + l2);
		// });
		// controller.on('l2:release', function (data) {
		// 	l2 = false;
		// 	//console.log(data + '|' + l2);
		// });

		// // R2
		// var r2 = false;
		// controller.on('r2:press', function (data) {
		// 	r2 = true;
		// 	//console.log(data + '|' + r2);
		// });
		// controller.on('r2:release', function (data) {
		// 	r2 = false;
		// 	//console.log(data + '|' + r2);
		// });

		// // ------------------------------------------
		// // https://github.com/cncjs/cncjs/blob/master/src/web/lib/controller.js

		// // Unlock
		// controller.on('start:press', function (data) {
		// 	if (psx) {
		// 		socket.emit('command', options.port, 'unlock');
		// 	}
		// });

		// // Reset
		// controller.on('select:press', function (data) {
		// 	if (psx) {
		// 		socket.emit('command', options.port, 'reset');
		// 	}
		// });


		// // Cyclestart
		// controller.on('start:press', function (data) {
		// 	if (!psx) {
		// 		socket.emit('command', options.port, 'cyclestart');
		// 	}
		// });

		// // Feedhold
		// controller.on('select:press', function (data) {
		// 	if (!psx) {
		// 		socket.emit('command', options.port, 'feedhold');
		// 	}
		// });

		// // ------------------------------------------
		// // Default

		// // Start
		// controller.on('triangle:press', function (data) {
		// 	if (!r1 && !l1 && !psx) {
		// 		socket.emit('command', options.port, 'start');
		// 		//console.log('cyclestart:' + data);
		// 	}
		// });

		// // Stop
		// controller.on('square:press', function (data) {
		// 	if (!r1 && !l1 && !psx) {
		// 		socket.emit('command', options.port, 'stop');
		// 		//console.log('feedhold:' + data);
		// 	}
		// });


		// // Pause
		// controller.on('circle:press', function (data) {
		// 	if (!r1 && !l1 && !psx) {
		// 		socket.emit('command', options.port, 'pause');
		// 		//console.log('pause:' + data);
		// 	}
		// });

		// // Resume
		// controller.on('x:press', function (data) {
		// 	if (!r1 && !l1 && !psx) {
		// 		socket.emit('command', options.port, 'resume');
		// 		//console.log('unlock:' + data);
		// 	}
		// });

		// // ------------------------------------------
		// // R1

		// // Raise Z
		// controller.on('triangle:press', function (data) {
		// 	if (r1) {
		// 		move_z_axis += 0.25;
		// 	}
		// });
		// controller.on('triangle:hold', function (data) {
		// 	if (r1) {
		// 		move_z_axis += 0.25;
		// 	}
		// });
		// controller.on('triangle:release', function (data) {
		// 	if (r1) {
		// 		move_z_axis = 0;
		// 	}
		// });

		// // Probe
		// controller.on('square:press', function (data) {
		// 	if (r1) {
		// 		socket.emit('command', options.port, 'gcode', 'G91');
		// 		socket.emit('command', options.port, 'gcode', 'G38.2 Z-15.001 F120');
		// 		socket.emit('command', options.port, 'gcode', 'G90');
		// 		socket.emit('command', options.port, 'gcode', 'G10 L20 P1 Z15.001');
		// 		socket.emit('command', options.port, 'gcode', 'G91');
		// 		socket.emit('command', options.port, 'gcode', 'G0 Z3');
		// 		socket.emit('command', options.port, 'gcode', 'G90');

		// 		//console.log('probe:' + data);
		// 	}
		// });

		// // Lower Z (Slow)
		// controller.on('circle:press', function (data) {
		// 	if (r1) {
		// 		move_z_axis -= 0.05;
		// 	}
		// });
		// controller.on('circle:hold', function (data) {
		// 	if (r1) {
		// 		move_z_axis -= 0.05;
		// 	}
		// });
		// controller.on('circle:release', function (data) {
		// 	if (r1) {
		// 		move_z_axis = 0;
		// 	}
		// });

		// // Lower Z
		// controller.on('x:press', function (data) {
		// 	if (r1) {
		// 		move_z_axis -= 0.25;
		// 	}
		// });
		// controller.on('x:hold', function (data) {
		// 	if (r1) {
		// 		move_z_axis -= 0.25;
		// 	}
		// });
		// controller.on('x:release', function (data) {
		// 	if (r1) {
		// 		move_z_axis = 0;
		// 	}
		// });

		// /*
		// 		// ------------------------------------------
		// 		// R2

		// 		// Triangle
		// 		controller.on('triangle:press', function(data) {
		// 			if (r2) {
		// 				socket.emit('command', options.port, '');
		// 			}
		// 		});

		// 		// Square
		// 		controller.on('square:press', function(data) {
		// 			if (r2) {
		// 				socket.emit('command', options.port, '');
		// 			}
		// 		});

		// 		// Circle
		// 		controller.on('circle:press', function(data) {
		// 			if (r2) {
		// 				socket.emit('command', options.port, '');
		// 			}
		// 		});

		// 		// X
		// 		controller.on('x:press', function(data) {
		// 			if (r2) {
		// 				socket.emit('command', options.port, '');
		// 			}
		// 		});
		// */


		// // ------------------------------------------
		// // PSX

		// // M7
		// controller.on('triangle:press', function (data) {
		// 	if (psx) {
		// 		socket.emit('command', options.port, 'gcode', 'M7');
		// 	}
		// });

		// // M9
		// controller.on('square:press', function (data) {
		// 	if (psx) {
		// 		socket.emit('command', options.port, 'gcode', 'M9');
		// 	}
		// });

		// // M8
		// controller.on('circle:press', function (data) {
		// 	if (psx) {
		// 		socket.emit('command', options.port, 'gcode', 'M8');
		// 	}
		// });

		// // Home
		// controller.on('x:press', function (data) {
		// 	if (psx) {
		// 		socket.emit('command', options.port, 'homing');
		// 	}
		// });


		// ------------------------------------------

		/*
			// Raise Z
			controller.on('triangle:press', function(data) {
				if (psx) {
					socket.emit('command', options.port, 'gcode', 'G91 G0 Z0.1'); // Switch to relative coordinates, Move one unit right in X and one unit right in Y
					socket.emit('command', options.port, 'gcode', 'G90');  // Switch back to absolute coordinates

					console.log('Raising Z:' + data);
				}
			});

			//
			controller.on('square:press', function(data) {
				if (psx) {

				}
			});


			// Probe
			controller.on('circle:press', function(data) {
				if (psx) {
					socket.emit('command', options.port, 'gcode', 'G91');
					socket.emit('command', options.port, 'gcode', 'G38.2 Z-15.001 F120');
					socket.emit('command', options.port, 'gcode', 'G90');
					socket.emit('command', options.port, 'gcode', 'G10 L20 P1 Z15.001');
					socket.emit('command', options.port, 'gcode', 'G91');
					socket.emit('command', options.port, 'gcode', 'G0 Z3');
					socket.emit('command', options.port, 'gcode', 'G90');

					console.log('probe:' + data);
				}
			});

			// Lower Z
			controller.on('x:hold', function(data) {
				if (psx) {
					socket.emit('command', options.port, 'gcode', 'G91 G0 Z-0.1'); // Switch to relative coordinates, Move one unit right in X and one unit right in Y
					socket.emit('command', options.port, 'gcode', 'G90');  // Switch back to absolute coordinates

					console.log('Lowering Z:' + data);
				}
			});
		*/

		// ------------------------------------------

		// ==[ D Pad ]==
		var move_x_axis = 0;
		var move_y_axis = 0;
		var move_z_axis = 0;

		// Set Movement of Gantry Based on DPad, and Z-Imput from other buttons
		function dpad(axis, direction) {
			if (l2) {
				// Fast
				dpadSetAxisMovment(axis, direction, 3);
			} else if (l1) {
				// Slow
				dpadSetAxisMovment(axis, direction, 1);
			} else {
				// Normal
				dpadSetAxisMovment(axis, direction, 2);
			}

			// Debugging
			console.log("1 : " + direction + ' | ' + axis + ' | ' + " : " + l1 + " : " + r1);
		}

		// Set Movemtn Varables
		function dpadSetAxisMovment(axis, direction, speed) {
			// Set Spped
			switch (speed) {
				case 1:
					speed = 0.05;
					break;
				case 3:
					speed = 5;
					break;
				default:
					speed = 0.5;
			}

			// Set Movemnt Varables
			if (axis == "X" && (move_x_axis < 14 && move_x_axis > -14)) {
				// X Axis

				// Set Direction
				if (direction) {
					// Positve Movment
					move_x_axis += speed;
				} else {
					// Negitave Movment
					move_x_axis += speed * -1;
				}
			} else if (axis == "Y" && (move_y_axis < 14 && move_y_axis > -14)) {
				// Y Axis

				// Set Direction
				if (direction) {
					// Positve Movment
					move_y_axis += speed;
				} else {
					// Negitave Movment
					move_y_axis += speed * -1;
				}
			}

			// console.log("DPad Set Movemnet: " + move_x_axis + ': ' + move_y_axis + "   | " + speed)
		}

		// Move Gantry X | Y
		setInterval(dpadMoveAxis, 100);

		function dpadMoveAxis() {
			// Check if Axis Needs Moving
			if (move_x_axis != 0 || move_y_axis != 0 || move_z_axis != 0) {
				// Send gCode
				socket.emit('command', options.port, 'gcode', 'G91 G0 X' + move_x_axis + " Y" + move_y_axis + " Z" + move_z_axis);
				socket.emit('command', options.port, 'gcode', 'G90'); // Switch back to absolute coordinates

				// Debuging
				// console.log("DPad MOVE: " + move_y_axis + ': ' + move_y_axis + ': ' + move_z_axis);

				// Reset Axis Varables
				move_x_axis -= move_x_axis;
				move_y_axis -= move_y_axis;
				move_z_axis -= move_z_axis;
			}
		}

		// // - - - - - - - - - - - - - - - - - - - -

		// // Y Up
		// controller.on('dpadUp:press', function (data) {
		// 	dpad('Y', true, data)
		// });
		// controller.on('dpadUp:hold', function (data) {
		// 	dpad('Y', true, data)
		// });
		// controller.on('dpadUp:release', function (data) {
		// 	move_y_axis = 0;
		// });

		// // Y Down
		// controller.on('dpadDown:press', function (data) {
		// 	dpad('Y', false, data)
		// });
		// controller.on('dpadDown:hold', function (data) {
		// 	dpad('Y', false, data)
		// });
		// controller.on('dpadDown:release', function (data) {
		// 	move_y_axis = 0;
		// });

		// // X Right
		// controller.on('dpadRight:press', function (data) {
		// 	dpad('X', true, data)
		// });
		// controller.on('dpadRight:hold', function (data) {
		// 	dpad('X', true, data)
		// });
		// controller.on('dpadRight:release', function (data) {
		// 	move_x_axis = 0;
		// });

		// // X Left
		// controller.on('dpadLeft:press', function (data) {
		// 	dpad('X', false, data)
		// });
		// controller.on('dpadLeft:hold', function (data) {
		// 	dpad('X', false, data)
		// });
		// controller.on('dpadLeft:release', function (data) {
		// 	move_x_axis = 0;
		// });

		// ------------------------------------------

		// Spendle ON State
		var spindle = false;

		// Start Spindle
		// controller.on('r2:press', function (data) {
		// 	if (r1 && psx) {
		// 		socket.emit('command', options.port, 'gcode', 'M3 S1000');
		// 		spindle = true;
		// 		//console.log('Spindle: ' + spindle);
		// 	}
		// });

		// // Stop Spendle
		// controller.on('r2:release', function (data) {
		// 	if (!psx && spindle) {
		// 		socket.emit('command', options.port, 'gcode', 'M5');
		// 		spindle = false;
		// 		//console.log('Spindle: ' + spindle);
		// 	}
		// });

		// ------------------------------------------

		// Analog Sticks
		// var stick_sensitivity = 1; // Do not set bellow 1

		// var left_x = 0;
		// left_y = 0;
		// var right_x = 0;
		// right_y = 0;

		// // Safty
		// var stick_left = false;
		// stick_right = false;

		// Safty = Stick Button
		// controller.on('leftAnalogBump:press', function (data) {
		// 	// Toggle Enable
		// 	if (stick_left || stick_right) {
		// 		stick_left = false;
		// 		stick_right = false;
		// 		ps3_rumble_left = 0; // 0-1 (Rumble left on/off)
		// 	} else {
		// 		stick_left = true;
		// 		stick_right = true;
		// 		ps3_rumble_left = 1; // 0-1 (Rumble left on/off)
		// 	}

		// 	//console.log('L] rightAnalogBump: ' + stick_right + " leftAnalogBump: "+ stick_left);

		// 	/*
		// 	// Runble Controler Beefly
		// 	ps3_rumble_left = 1; // 0-1 (Rumble left on/off)
		// 	setTimeout(function () {
		// 	    ps3_rumble_left = 0; // 0-1 (Rumble left on/off)
		// 	}, 510);
		// 	*/
		// });
		// controller.on('rightAnalogBump:press', function (data) {
		// 	// Toggle Enable
		// 	if (stick_right || stick_left) {
		// 		stick_right = false;
		// 		stick_left = false;
		// 		ps3_rumble_left = 0; // 0-1 (Rumble left on/off)
		// 	} else {
		// 		stick_right = true;
		// 		stick_left = true;
		// 		ps3_rumble_left = 1; // 0-1 (Rumble left on/off)
		// 	}

		// 	//console.log('R] rightAnalogBump: ' + stick_right + " leftAnalogBump: "+ stick_left);

		// 	/*
		// 	// Runble Controler Beefly
		// 	ps3_rumble_left = 1; // 0-1 (Rumble left on/off)
		// 	setTimeout(function () {
		// 	    ps3_rumble_left = 0; // 0-1 (Rumble left on/off)
		// 	}, 510);
		// 	*/
		// });

		// // - - - - - - - - - - - - - - - - - - - -

		// // Analog Sticks
		// controller.on('left:move', function (data) {
		// 	//console.log('left Moved: ' + data.x + ' | ' + Number((data.y * -1) +255));
		// 	if (stick_left) {
		// 		left_x = data.x - 128
		// 		left_y = (data.y * -1) + 128
		// 	} else {
		// 		left_x = 0;
		// 		left_y = 0;
		// 	}

		// 	//console.log('stick-left: ' +  Number(data.x - 128) + ' [' + right_x + '] | ' +  Number(data.y - 128) + ' [' + right_y + '] | ' + stick_left)
		// });
		// controller.on('right:move', function (data) {
		// 	//console.log('right Moved: ' + data.x + ' | ' + Number((data.y * -1) +255));
		// 	if (stick_right) {
		// 		right_x = data.x - 128
		// 		right_y = (data.y * -1) + 128
		// 	} else {
		// 		right_x = 0;
		// 		right_y = 0;
		// 	}

		// 	//console.log('stick-right: ' + Number(data.x - 128) + ' [' + right_x + '] | ' +  Number(data.y - 128) + ' [' + right_y + '] | ' + stick_right)
		// });

		// [Function] map(value, fromLow, fromHigh, toLow, toHigh)   https://www.arduino.cc/en/Reference/Map
		function map(x, in_min, in_max, out_min, out_max) {
			return Number((x - in_min) * (out_max - out_min) / (in_max - in_min) + out_min);
		}

		// Move Gantry bassed on Sticks at a regualr interval
		setInterval(stickMovment, 50);

		// Move X & Y base on X & Y Stick Movments
		function stickMovment() {
			var sum_x = Number(left_x + right_x);
			var sum_y = Number(left_y + right_y);

			if (left_x >= stick_sensitivity | left_x <= -stick_sensitivity || left_y >= stick_sensitivity || left_y <= -stick_sensitivity || right_x >= stick_sensitivity || right_x <= -stick_sensitivity || right_y >= stick_sensitivity || right_y <= -stick_sensitivity) {
				// Additional Safty Catch
				if (!stick_left) {
					left_x = 0;
					left_y = 0;
				}
				if (!stick_right) {
					right_x = 0;
					right_y = 0;
				}

				//!!!!!!!!!!!!!!!!! need to detect if it's in inches or millimetersmm to avoid and overrun in the multiplier this can be done with agreeable status I believe.
				socket.emit('command', options.port, 'gcode', 'G21'); // set to millimeters

				// Move based on stick imput and mapping, need to add exponital curve.
				socket.emit('command', options.port, 'gcode', 'G91 G0 X' + map(sum_x, 0, 128, 0.0001, 2).toFixed(4) + ' Y' + map(sum_y, 0, 128, 0.0001, 2).toFixed(4)); // Switch to relative coordinates, Move one unit right in X and one unit right in Y
				socket.emit('command', options.port, 'gcode', 'G90'); // Switch back to absolute coordinates
				// console.log('setInterval: x' + sum_x + ' y' + sum_y + ' | ' + 'G91 G0 X' + map(sum_x, 0, 128, 0.0001, 2).toFixed(4) + ' Y' + map(sum_y, 0, 128, 0.0001, 2).toFixed(4));
			}
		}

		// ------------------------------------------

		//sixasis motion events:
		//the object returned from each of the movement events is as follows:
		//{
		//	 direction : values can be: 1 for right, forward and up. 2 for left, backwards and down.
		//	 value : values will be from 0 to 120 for directions right, forward and up and from 0 to -120 for left, backwards and down.
		//}

		/*
				//right-left movement
				controller.on('rightLeft:motion', function (data) {
					 //...doStuff();
				});

				//forward-back movement
				controller.on('forwardBackward:motion', function (data) {
					 //...doStuff();
				});
				//up-down movement
				controller.on('upDown:motion', function (data) {
					 //...doStuff();
				});
		*/
		// ------------------------------------------

		// Send Extras Updates
		setInterval(updateControllerExtras, 500);

		function updateControllerExtras() {
			// controller.setExtras({
			// 	rumbleLeft: ps3_rumble_left, // 0-1 (Rumble left on/off)
			// 	rumbleRight: ps3_rumble_right, // 0-255 (Rumble right intensity)
			// 	led: ps3_led // 2 | 4 | 8 | 16 (Leds 1-4 on/off, bitmasked)
			// });

			//console.log("ps3_rumble_left: " + ps3_rumble_left);
			//console.log("ps3_rumble_right: " + ps3_rumble_right);
		}

		//controller status
		//as of version 0.6.2 you can get the battery %, if the controller is connected and if the controller is charging
		var battery_level = 0;
		// controller.on('battery:change', function (value) {
		// 	console.log('battery:change:' + value);

		// 	// Set LEDs
		// 	switch (value) {
		// 		case '100%':
		// 		case "90%":
		// 			ps3_led = 30; // 0b11110 // 2 | 4 | 8 | 16 (Leds 1-4 on/off, bitmasked)
		// 			break;
		// 		case "80%":
		// 		case "70%":
		// 			ps3_led = 28; // 0b11100 // 2 | 4 | 8 | 16 (Leds 1-4 on/off, bitmasked)
		// 			break;
		// 		case "50%":
		// 		case "40%":
		// 		case "30%":
		// 			ps3_led = 24; // 0b11000 // 2 | 4 | 8 | 16 (Leds 1-4 on/off, bitmasked)
		// 			break;
		// 		default:
		// 			ps3_led = 16; // 0b10000 // 2 | 4 | 8 | 16 (Leds 1-4 on/off, bitmasked)
		// 			break;
		// 	}

		// });
		// controller.on('connection:change', function (value) {
		// 	console.log('connection:change:' + value);
		// });
		// controller.on('charging:change', function (value) {
		// 	console.log('connection:change:' + value);
		// });

		/*
				//DualShock 3 control rumble and light settings for the controller
				controller.setExtras({
					rumbleLeft:  0,   // 0-1 (Rumble left on/off)
					rumbleRight: 0,   // 0-255 (Rumble right intensity)
					led: 2 // 2 | 4 | 8 | 16 (Leds 1-4 on/off, bitmasked)
				});
		*/
	}
};