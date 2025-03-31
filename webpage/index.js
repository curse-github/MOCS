function addLabel(parent, text, forName) {
    const el = document.createElement("label");
    el.innerText = text;
    el.for = forName;
    parent.appendChild(el);
    return el;
}
function addInput(parent, type, nameId, callback) {
    const el = document.createElement("input");
    el.type = type;
    el.name = el.id = nameId;
    if (type == "button") {
        el.addEventListener("click", (data) => {
            callback(undefined);
        });
    } else {
        el.addEventListener("change", (data) => {
            callback((type == "checkbox") ? el.checked : el.value);
        });
    }
    parent.appendChild(el);
    return el;
}
function addDiv(parent, id) {
    const el = document.createElement("div");
    el.id = id;
    parent.appendChild(el);
    return el;
}
function addBr(parent) {
    const el = document.createElement("br");
    parent.appendChild(el);
    return el;
}
function addText(parent, text) {
    parent.appendChild(document.createTextNode(text));
}
function processDevice(parent, parentName, device) {
    if (device.functions != undefined) {
        device.functions = device.functions.sort((a,b) => a.name.localeCompare(b.name));
        for (let i = 0; i < device.functions.length; i++) {
            const func = device.functions[i];
            for (let j = 0; j < func.overloads.length; j++) {
                if (!func.overloads[j].visible) continue;
                const paramObjs = func.overloads[j].parameters;
                addInput(parent, "button", parentName + device.name + "." + func.name, () => {
                    let cmd = parentName + device.name + "." + func.name + "(";
                    for (let k = 0; k < paramObjs.length; k++) {
                        const paramObj = paramObjs[k];
                        if (k > 0) cmd += ", ";
                        switch (paramObj.type) {
                            case "string":
                                cmd += "\"" + document.getElementById(parentName + device.name + "." + func.name + "." + k).value + "\"";
                                break;
                            case "float":
                                cmd += document.getElementById(parentName + device.name + "." + func.name + "." + k).value * ((paramObj.displayType === "slider") ? (1/100) : 1);
                                break;
                            case "integer":
                                cmd += document.getElementById(parentName + device.name + "." + func.name + "." + k).value;
                                break;
                            case "bool":
                                cmd += document.getElementById(parentName + device.name + "." + func.name + "." + k).checked ? "true" : "false";
                                break;
                            case "color":
                                cmd += "\"" + document.getElementById(parentName + device.name + "." + func.name + "." + k).value.toUpperCase() + "\"";
                                break;
                            default:
                                break;
                        }
                    }
                    call(cmd + ")").then((returnVal) => {
                        console.log(cmd+") => " + JSON.stringify(returnVal));
                    })
                }).value = func.name;
                addText(parent, "(");
                for (let k = 0; k < paramObjs.length; k++) {
                    const paramObj = paramObjs[k];
                    let el = undefined;
                    let type = "";
                    switch (paramObj.type) {
                        case "string":
                            el = addInput(parent, "text", parentName + device.name + "." + func.name + "." + k, () => {});
                            el.value = paramObj.defaultValue;
                            break;
                        case "float":
                            type = "number";
                            if (paramObj.displayType == "slider") type = "range";
                            el = addInput(parent, type, parentName + device.name + "." + func.name + "." + k, () => {});
                            if (paramObj.range != undefined) {
                                el.setAttribute("min", paramObj.range[0]*100);
                                el.setAttribute("max", paramObj.range[1]*100);
                            }
                            el.value = paramObj.defaultValue * ((paramObj.displayType === "slider") ? 100 : 1);
                            break;
                        case "integer":
                            type = "number";
                            if (paramObj.displayType == "slider") type = "range";
                            el = addInput(parent, type, parentName + device.name + "." + func.name + "." + k, () => {});
                            if (paramObj.range != undefined) {
                                el.setAttribute("min", paramObj.range[0]);
                                el.setAttribute("max", paramObj.range[1]);
                            }
                            el.value = paramObj.defaultValue;
                            break;
                        case "bool":
                            el = addInput(parent, "checkbox", parentName + device.name + "." + func.name + "." + k, () => {});
                            el.checked = paramObj.defaultValue;
                            break;
                        case "color":
                            el = addInput(parent, "color", parentName + device.name + "." + func.name + "." + k, () => {});
                            el.value = paramObj.defaultValue.toLowerCase();
                            break;
                        default:
                            console.log("unknown param type")
                            break;
                    }
                }
                addText(parent, ")");
                addBr(parent);
            }
            //console.log(device.name + "." + func.name + "(" + func.overloads[0].parameters.map((param) => "\"" + param.type + "\"").join(", ") + ")");
        }
    }
    if (device.values != undefined) {
        device.values = device.values.sort((a,b) => a.name.localeCompare(b.name));
        for (let i = 0; i < device.values.length; i++) {
            const value = device.values[i];
            addLabel(parent, value.name + ": ");
            let el = undefined;
            const callAndPrint = (parameters) => {
                const cmd = parentName + device.name + "." + value.name + ".set("+parameters+")";
                call(cmd).then((returnVal) => {
                console.log(cmd+" => " + JSON.stringify(returnVal));
            });
            }
            let type = "";
            switch (value.type) {
                case "string":
                    el = addInput(parent, "text", parentName + device.name + "." + value.name, (data) => {
                        if (!value.readonly) callAndPrint("\"" + data + "\"");
                    });
                    updateCallbacks[parentName + device.name + "." + value.name] = (newValue) => {
                        el.value = newValue;
                    };
                    el.value = value.value;
                    break;
                case "float":
                    type = "number";
                    if ((value.displayType == "hex") || (value.displayType == "binary")) type = "text";
                    if (value.displayType == "slider") type = "range";
                    el = addInput(parent, type, parentName + device.name + "." + value.name, (data) => {
                        if (value.readonly) return;
                        if (value.displayType == "slider")
                            callAndPrint(data/100);
                        else
                            callAndPrint(data);
                    });
                    if (value.range != undefined) {
                        el.setAttribute("min", value.range[0]*100);
                        el.setAttribute("max", value.range[1]*100);
                    }
                    updateCallbacks[parentName + device.name + "." + value.name] = (newValue) => {
                        if (value.displayType == "hex")
                            el.value = "0x" + newValue.toString(16).toUpperCase();
                        else if (value.displayType == "binary")
                            el.value = "0b" + newValue.toString(2);
                        else if (value.displayType == "slider")
                            el.value = newValue * 100;
                        else
                            el.value = newValue;
                    };
                    updateCallbacks[parentName + device.name + "." + value.name](value.value);
                    break;
                case "integer":
                    type = "number";
                    if ((value.displayType == "hex") || (value.displayType == "binary")) type = "text";
                    if (value.displayType == "slider") type = "range";
                    el = addInput(parent, type, parentName + device.name + "." + value.name, (data) => {
                        if (!value.readonly) callAndPrint(data);
                    });
                    if (value.range != undefined) {
                        el.setAttribute("min", value.range[0]);
                        el.setAttribute("max", value.range[1]);
                    }
                    updateCallbacks[parentName + device.name + "." + value.name] = (newValue) => {
                        if (value.displayType == "hex")
                            el.value = "0x" + newValue.toString(16).toUpperCase();
                        else if (value.displayType == "binary")
                            el.value = "0b" + newValue.toString(2);
                        else
                            el.value = newValue;
                    };
                    updateCallbacks[parentName + device.name + "." + value.name](value.value);
                    break;
                case "bool":
                    el = addInput(parent, "checkbox", parentName + device.name + "." + value.name, (data) => {
                        if (!value.readonly) callAndPrint((data ? "true" : "false"));
                    });
                    updateCallbacks[parentName + device.name + "." + value.name] = (newValue) => {
                        el.checked = newValue;
                    };
                    el.checked = value.value;
                    break;
                case "color":
                    el = addInput(parent, "color", parentName + device.name + "." + value.name, (data) => {
                        if (!value.readonly) callAndPrint("\"" + data.toUpperCase() + "\"");
                    });
                    updateCallbacks[parentName + device.name + "." + value.name] = (newValue) => {
                        el.value = newValue.toLowerCase();
                    };
                    el.value = value.value.toLowerCase();
                    break;
                default:
                    break;
            }
            if (value.readonly) el.setAttribute("disabled", true)
            addBr(parent);
            //console.log(parentName + device.name + "." + value.name + " = " + JSON.stringify(value.value));
            //console.log(parentName + device.name + "." + value.name + ".get(\"" + value.type + "\")");
            //console.log(parentName + device.name + "." + value.name + ".set(\"" + value.type + "\")");
        }
    }
}
async function processDeviceDisconnection(name) {
    document.getElementById(name).remove();
    numConnectedDevices--;
    if (numConnectedDevices == 0) {
        messageElement.innerText = "None of your devices are currently connected.";
    }
}