//code based off of https://github.com/risacher/input-event
var fs = require('fs')
const { EventEmitter } = require('events');

class Controller {
    dev;
    bufferSize = 24;
    buf;
    Buttons;
    Axis;
    List;
    Emitter;
    constructor(dev) {
        this.onRead = this.onRead.bind(this);
        this.onOpen = this.onOpen.bind(this);
        this.wrap('onRead');
        this.wrap('tryOpen');
        this.dev = dev;
        this.buf = new Buffer(this.bufferSize);
        this.Buttons = {
            "triangle":false,
            "circle"  :false,
            "cross"   :false,
            "square"  :false,
            "L1":false,
            "L2":false,
            "R1":false,
            "R2":false
        };
        this.Axis = [0,0];
        this.List = [];
        this.Emitter = new EventEmitter();
        var self = this;
        fs.open('/dev/input/' + this.dev, 'r', self.onOpen); 
    }
    onOpen(err, fd) {
        if (err) {
        setTimeout(function (s) {
                fs.open(
                '/dev/input/' + s.dev,
                'r',
                (err,fd)=>s.onOpen(err, fd)
            );
        },5000,this);
        } else {
            this.fd = fd;
            this.startRead();
            this.Emitter.emit('opened', this.dev);
        }
    }
    wrap(name) {
        var fn = this[name];
        const self = this;
        this[name] = function (err) {
            if (err) {
                if (err.errno === -19) {
                    this.close();
                    setTimeout(fs.open('/dev/input/' + this.dev, 'r', self.onOpen), 7500);
                } else self.Emitter.emit('error', err);
                return;
            }
            return fn.apply(self, Array.prototype.slice.call(arguments, 1));
        }.bind(self);
    }
    startRead() {
        fs.read(this.fd, this.buf, 0, this.bufferSize, null, this.onRead);
    };
    processButton(data) {
        const btnMap = {
            589825:"triangle",
            589826:"circle",
            589827:"cross",
            589828:"square",
            589829:"L1",
            589830:"R1",
            589831:"L2",
            589832:"R2"
        };
        const button = btnMap[data[4]];
        if (button != null && button != undefined) {
            const isDown = data[8]==1;
            this.Buttons[button] = isDown;
            this.Emitter.emit("button",{"Buttons":this.Buttons,"Axis":this.Axis,"name":button,"value":isDown});
        }
    }
    processAxis(data) {
        const axisMap = {
            "65539,0"  :[ 0, 1],
            "3,255"    :[ 1, 0],
            "65539,255":[ 0,-1],
            "3,0"      :[-1, 0]
        };
        const index = data[3]+","+data[4];
        if (axisMap[index]) { this.Axis = axisMap[index]; }
        else { this.Axis = [0,0]; }
        this.Emitter.emit("axis",{"Buttons":this.Buttons,"Axis":this.Axis});
    }
    onRead(bytesRead) {
        if (this.List.length == 0) this.List.push(this.buf.readUInt32LE(0 ));
                for(let i=8;i<=20;i+=4) {
                    this.List.push(this.buf.readUInt32LE(i));
                }
                if (this.buf.readUInt32LE(16) == 0) {
                    if (this.List.length == 13) { this.processButton(this.List); } else { this.processAxis(this.List);}
                    this.Emitter.emit("all",{"Buttons":this.Buttons,"Axis":this.Axis});
                    this.List = [];
                }
        if (this.fd) this.startRead();
    }
    close(callback) {
        fs.close(this.fd, (function(){console.log(this);}));
        this.fd = undefined;
    }
}

module.exports = exports = Controller;