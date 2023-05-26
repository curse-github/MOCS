const input = require('./controller');
const { spawn } = require("child_process");

var lines = ["","","","","","","",""];
const controller = (new input("by-id/usb-ShanWan_PS3_PC_Adaptor-event-joystick"));
controller.Emitter.on("axis",(data)=>{
    let str = data.Buttons["triangle"]?"Tr ":"   ";
    str    += data.Buttons["circle"  ]?"Ci ":"   ";
    str    += data.Buttons["cross"   ]?"Cr ":"   ";
    str    += data.Buttons["square"  ]?"Sq ":"   ";
    str    += "  ";
    str    += data.Buttons["L1"      ]?"L1 ":"   ";
    str    += data.Buttons["R1"      ]?"R1 ":"   ";
    str    += data.Buttons["L2"      ]?"L2 ":"   ";
    str    += data.Buttons["R2"      ]?"R2":"  ";
    lines[2] = str;
    lines[3] = "[" + data.Axis[0] + ", " + data.Axis[1] + "]";
    restore([lines[2],lines[3],lines[4],lines[5],lines[6],lines[7]]);
});
controller.Emitter.on("button",(data)=>{
    let str = data.Buttons["triangle"]?"Tr":" ";
    str    += data.Buttons["circle"  ]?"Ci":" ";
    str    += data.Buttons["cross"   ]?"Cr":" ";
    str    += data.Buttons["square"  ]?"Sq":" ";
    str    += " ";
    str    += data.Buttons["L1"      ]?"L1":" ";
    str    += data.Buttons["R1"      ]?"R1":" ";
    str    += data.Buttons["L2"      ]?"L2":" ";
    str    += data.Buttons["R2"      ]?"R2":" ";
    lines[2] = str;
    lines[3] = "[" + data.Axis[0].toString().padStart(2," ") + ", " + data.Axis[1].toString().padStart(2," ") + "]";
    restore([lines[2],lines[3],lines[4],lines[5],lines[6],lines[7]]);
});


const refreshWait=500;
var timeoutId = 0;
var hasChanged = false;
function restore(linesList) {
    if (linesList) { for (var i = 0; i < (linesList.length < 6 ? linesList.length : 6); i++) {
        lines[i+2] = (((linesList[i] == null || linesList[i] == "" || linesList[i] == "null") ? " " : linesList[i]));
    } hasChanged=true; }
    
    if (timeoutId==0) {
        timeoutId=1;
        setTimeout(() => {
            timeoutId=0;
            actuallyRestore();
            if (hasChanged) restore([lines[2],lines[3],lines[4],lines[5],lines[6],lines[7]]);
        }, refreshWait);
        hasChanged=false;
    }
}
function actuallyRestore() {
    var lst = [lines[0],lines[1],lines[2],lines[3],lines[4],lines[5],lines[6],lines[7]];
    lst.unshift("/home/pi/restore.py");
    spawn("python",lst);
}