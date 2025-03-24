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
                const paramObjs = func.overloads[j].parameters;
                addInput(parent, "button", parentName + device.name + "." + func.name, () => {
                    let cmd = parentName + device.name + "." + func.name + "(";
                    for (let k = 0; k < paramObjs.length; k++) {
                        const paramObj = paramObjs[k];
                        if (k > 0) cmd += ", ";
                        switch (paramObj.type) {
                            case "String":
                                cmd += "\"" + document.getElementById(parentName + device.name + "." + func.name + "." + k).value + "\"";
                                break;
                            case "Number":
                                cmd += document.getElementById(parentName + device.name + "." + func.name + "." + k).value;
                                break;
                            case "Bool":
                                cmd += document.getElementById(parentName + device.name + "." + func.name + "." + k).checked ? "true" : "false";
                                break;
                            case "Color":
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
                    switch (paramObj.type) {
                        case "String":
                            el = addInput(parent, "text", parentName + device.name + "." + func.name + "." + k, () => {});
                            el.value = paramObj.defaultValue;
                            break;
                        case "Number":
                            el = addInput(parent, "number", parentName + device.name + "." + func.name + "." + k, () => {});
                            el.value = paramObj.defaultValue;
                            break;
                        case "Bool":
                            el = addInput(parent, "checkbox", parentName + device.name + "." + func.name + "." + k, () => {});
                            el.checked = paramObj.defaultValue;
                            break;
                        case "Color":
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
            switch (value.type) {
                case "String":
                    el = addInput(parent, "text", parentName + device.name + "." + value.name, (data) => {
                        if (!value.readonly) callAndPrint("\"" + data + "\"");
                    });
                    updateCallbacks[parentName + device.name + "." + value.name] = (newValue) => {
                        el.value = newValue;
                    };
                    el.value = value.value;
                    break;
                case "Number":
                    el = addInput(parent, "number", parentName + device.name + "." + value.name, (data) => {
                        if (!value.readonly) callAndPrint(data);
                    });
                    updateCallbacks[parentName + device.name + "." + value.name] = (newValue) => {
                        el.value = newValue;
                    };
                    el.value = value.value;
                    break;
                case "Bool":
                    el = addInput(parent, "checkbox", parentName + device.name + "." + value.name, (data) => {
                        if (!value.readonly) callAndPrint((data ? "true" : "false"));
                    });
                    updateCallbacks[parentName + device.name + "." + value.name] = (newValue) => {
                        el.checked = newValue;
                    };
                    el.checked = value.value;
                    break;
                case "Color":
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