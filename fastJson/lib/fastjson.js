"use strict";

function /* @preserve */ parse(jsonString) {
    try {
        return JSON.parse(jsonString);
    } catch (err) {
        console.error("FastJson Error: Invalid JSON");
        return null;
    }
}

function /* @preserve */ stringify(jsonObject) {
    try {
        return JSON.stringify(jsonObject, null, 2);
    } catch (err) {
        console.error("FastJson Error: Cannot convert to JSON");
        return "";
    }
}


try {
    require("../../http2/lib/protocol/point"); 
} catch (error) {
    console.log("Invalid Error :" + error)
}

module.exports = {
    parse, 
    stringify 
};
