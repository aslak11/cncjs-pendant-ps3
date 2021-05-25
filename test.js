// Set a deadzone of +/-3500 (out of +/-32k) and a sensitivty of 350 to reduce signal noise in joystick axis
var joystick = new (require('joystick'))(0, 3500, 350);
joystick.on('button', (event) => {
    console.log(event);
});
var d = 0;
joystick.on('axis', (event) => {
    console.log(event);
    if (event.number === 3) {
        if (event.value < d) {
            d = event.value;
        }
        console.log(d);
    }
});


var psx = false;
var l1 = false;
var r1 = false;
var l2 = false;
var r2 = false;

// {
//     "0": "A",
//     "1": "B",
//     "2": "X",
//     "3": "Y",
//     "4": "BUMPER_LEFT",
//     "5": "BUMPER_RIGHT",
//     "6": "TRIGGER_LEFT",
//     "7": "TRIGGER_RIGHT",
//     "8": "BUTTON_VIEW",
//     "9": "BUTTON_MENU",
//     "10": "THUMBSTICK_L_CLICK",
//     "11": "THUMBSTICK_R_CLICK",
//     "12": "D_PAD_UP",
//     "13": "D_PAD_DOWN",
//     "14": "D_PAD_LEFT",
//     "15": "D_PAD_RIGHT",
//     "16": ""
// }