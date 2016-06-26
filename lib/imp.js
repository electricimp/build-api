// build-api 0.3.0

var Request = require("request");

function Imp(settings) {
    this.request = Request;
    if (typeof settings != "object") settings = {};

    this.apiKey = null;
    this.apiBase = "build.electricimp.com";
    this.apiVersion = "/v4";

    if (settings && "apiKey" in settings) this.apiKey = settings.apiKey;
    if (settings && "apiBase" in settings) this.apiBase = settings.apiBase;
    if (settings && "apiVersion" in settings) this.apiVersion = settings.apiVersion;
};

Imp.prototype._buildError = function(code, shortMessage, fullMessage) {
    if (fullMessage === undefined) fullMessage = shortMessage;

    return {
        "code": code,
        "message_short": shortMessage,
        "message_full": fullMessage
    };
};

Imp.prototype._buildUrl = function(path, includeVersion) {
    // Default value is true
    if (includeVersion === undefined) includeVersion = true;

    // Set up the base API URL
    var url = "https://" + this.apiBase;

    // Add version if required
    if (includeVersion) url += this.apiVersion;

    // Finally, add path
    url += path;

    return url;
};

Imp.prototype._processResp = function(error, resp, body, cb) {
    // If there was an error with the request
    if (error) {
        cb(error, null);
        return;
    }

    // If we didn't get a 2xx status code
    if (resp.statusCode < 200 || resp.statusCode >= 300) {
        var error = this._buildError(resp.statusCode, resp.statusMessage);

        if (body) {
            if (typeof body == "string") {
                error.message_short = body;
                error.message_full = body;
            } else if (typeof body == "object" && "error" in body) {
                error = body.error;
            }
        }

        cb(error, null);
        return;
    }

    cb(null, body);
};

Imp.prototype._req = function(verb, url, headers, body, cb) {
    var options = {
        "method": verb.toUpperCase(),
        "json": true,
        "url": url,
        "headers": {
            "User-agent": "imp.js",
            "Content-type": "application/json",
            "Authorization": "Basic " + new Buffer(this.apiKey || "").toString('base64')
        }
    };

    if (body && options.method == "GET") {
        options.qs = body;
    } else if (body) {
        options.body = body;
    }

    headers = headers || {};
    for (var idx in headers) {
        options.headers[idx] = headers[idx];
    }

    this.request(options, function(error, resp, body) {
        this._processResp(error, resp, body, cb);
    }.bind(this));
};

Imp.prototype.apiRequest = function(verb, path, options, validOptions, cb) {
    var options = options || {};
    var validOptions = validOptions || {};

    if (options) {
        for (var idx in options) {
            if (!(idx in validOptions)) {
                var error = this._buildError("InvalidParam", "Invalid Parameter: " + idx);
                cb(error, null);
                return;
            }
        }
    }

    this._req(verb, path, null, options, cb);
};

/***** Build API Access Functions *****/

// Devices
Imp.prototype.getDevices = function(options, cb) {
    var validOptions = { "device_id": true, "mac_address": true, "model_id": true, "name": true };
    this.apiRequest("GET", this._buildUrl("/devices"), options, validOptions, cb);
};

Imp.prototype.getDevice = function(deviceId, cb) {
    this.apiRequest("GET", this._buildUrl("/devices/"+deviceId), null, null, cb);
};

Imp.prototype.assignDevice = function(deviceId, modelId, cb) {
    var validOptions = { "model_id": true };
    this.apiRequest("PUT", this._buildUrl("/devices/"+deviceId), { "model_id": modelId }, validOptions, cb);
};

Imp.prototype.renameDevice = function(deviceId, deviceName, cb) {
    var validOptions = { "name": true };
    this.apiRequest("PUT", this._buildUrl("/devices/"+deviceId), { "name": deviceName }, validOptions, cb);
};

Imp.prototype.deleteDevice = function(deviceId, cb) {
    this.apiRequest("DELETE", this._buildUrl("/devices/"+deviceId), null, null, cb);
};

// Device Logs
Imp.prototype.getDeviceLogs = function(deviceId, options, cb) {
    var validOptions = { "since": true, "type": true, "wait": true, "token": true };
    this.apiRequest("GET", this._buildUrl("/devices/"+deviceId+"/logs"), options, validOptions, cb);
};

Imp.prototype._streamCallbackFactory = function(deviceId, streamUrl, lastTS, cb) {
    return function(err, data) {
        if (err) {
            // If it's a timeout error
            if (err.code == 504) {
                lastTS = new Date().toISOString();
                this.streamDeviceLogs(deviceId, cb, streamUrl, lastTS)
                return;
            }

            // If it's a token error, open a new stream from last timestamp
            if (err.code == 400 && err.message_short == "InvalidLogToken") {
                this.streamDeviceLogs(deviceId, cb, null, lastTS);
                return;
            }

            // For any other error, invoke the callback and stop streaming
            cb(err, null);
            return;
        }

        if ("logs" in data && data.logs.length > 0) {
            lastTS = data.logs[data.logs.length-1].timestamp;
            cb(null, data);
        }

        streamUrl = "poll_url" in data ? data.poll_url : null;

        this.streamDeviceLogs(deviceId, cb, streamUrl, lastTS);
    }.bind(this);
};

Imp.prototype.streamDeviceLogs = function(deviceId, cb, streamUrl, lastTS) {
    if (streamUrl) {
        this.apiRequest("GET", this._buildUrl(streamUrl, false), null, null, this._streamCallbackFactory(deviceId, streamUrl, lastTS, cb));
        return;
    }

    if (!lastTS) lastTS = new Date().toISOString();
    this.getDeviceLogs(deviceId, { since: lastTS }, this._streamCallbackFactory(deviceId, streamUrl, lastTS, cb));
}

// Models
Imp.prototype.getModels = function(options, cb) {
    var validOptions = { "name": true };
    this.apiRequest("GET", this._buildUrl("/models"), options, validOptions, cb);
};

Imp.prototype.getModel = function(modelId, cb) {
    this.apiRequest("GET", this._buildUrl("/models/"+modelId), null, null, cb);
};

Imp.prototype.createModel = function(modelName, cb) {
    var validOptions = {"name": true };
    this.apiRequest("POST", this._buildUrl("/models"), { "name": modelName }, validOptions, cb);
};

Imp.prototype.renameModel = function(modelId, modelName, cb) {
    var validOptions = { "name": true };
    this.apiRequest("PUT", this._buildUrl("/models/"+modelId), { "name": modelName }, validOptions, cb);
};

Imp.prototype.deleteModel = function(modelId, cb) {
    this.apiRequest("DELETE", this._buildUrl("/models/"+modelId), null, null, cb);
};

Imp.prototype.restartModel = function(modelId, cb) {
    this.apiRequest("POST", this._buildUrl("/models/"+modelId+"/restart"), null, null, cb);
};

// Model Revisions
Imp.prototype.getModelRevisions = function(modelId, options, cb) {
    var validOptions = { "since": true, "until": true, "build_min": true, "build_max": true };
    this.apiRequest("GET", this._buildUrl("/models/"+modelId+"/revisions"), options, validOptions, cb);
};

Imp.prototype.getModelRevision = function(modelId, revisionId, cb) {
    this.apiRequest("GET", this._buildUrl("/models/"+modelId+"/revisions/"+revisionId), null, null, cb);
};

Imp.prototype.createModelRevision = function(modelId, model, cb) {
    var validOptions = { "device_code": true, "agent_code": true, "release_notes": true, "marker": "true" };
    this.apiRequest("POST", this._buildUrl("/models/"+modelId+"/revisions"), model, validOptions, cb);
};

module.exports = Imp;
