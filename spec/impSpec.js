var Imp = require("../lib/imp");

describe("When you initialize a client", function() {
  describe("and you don't specify any settings", function() {
    it("the client should use the default settings", function() {
      var expectedApiKey = null;
      var expectedApiBase = "build.electricimp.com";
      var expectedApiVersion = "/v4";

      var imp = new Imp();

      expect(imp.apiKey).toBe(expectedApiKey);
      expect(imp.apiBase).toBe(expectedApiBase);
      expect(imp.apiVersion).toBe(expectedApiVersion);
    });
  });

  describe("and you don't pass a table parameter for settings", function() {
    it("the client should ignore the settings parameter", function() {
      var expectedApiKey = null;
      var expectedApiBase = "build.electricimp.com";
      var expectedApiVersion = "/v4";

      var imp = new Imp("garbage");

      expect(imp.apiKey).toBe(expectedApiKey);
      expect(imp.apiBase).toBe(expectedApiBase);
      expect(imp.apiVersion).toBe(expectedApiVersion);
    })
  })

  describe("and overload the default settings", function() {
    it("the client should use the specified settings", function() {
      var expectedApiKey = "myApiKey";
      var expectedApiBase = "myUri";
      var expectedApiVersion = "/myVersion";

      var imp = new Imp({
        "apiKey": expectedApiKey,
        "apiBase": expectedApiBase,
        "apiVersion": expectedApiVersion
      });

      expect(imp.apiKey).toBe(expectedApiKey);
      expect(imp.apiBase).toBe(expectedApiBase);
      expect(imp.apiVersion).toBe(expectedApiVersion);
    });
  });
});

describe("When you build a URL", function() {
  it("the client use the specified apiBase and version", function() {
    var testBase = "test-api.electricimp.com";
    var testVersion = "/test-version";
    var testPath = "/test-path";

    var expectedUrl = "https://test-api.electricimp.com/test-version/test-path";

    var imp = new Imp({
      "apiBase": testBase,
      "apiVersion": testVersion
    });

    expect(imp._buildUrl(testPath)).toBe(expectedUrl);
  });
});

describe("When _buildError is called", function() {
  var imp = new Imp();

  describe("with no full message", function() {
    it("it should set the short message for both messages", function() {
      var code = 123;
      var shortMessage = "short message";

      var err = imp._buildError(code, shortMessage);

      expect(err.code).toBe(code);
      expect(err.message_short).toBe(shortMessage);
      expect(err.message_full).toBe(shortMessage);
    })
  });

  describe("with a full message", function() {
    it("should set the short and full messages", function() {
      var code = 123;
      var shortMessage = "short message";
      var fullMessage = "full message"
      var err = imp._buildError(code, shortMessage, fullMessage);

      expect(err.code).toBe(code);
      expect(err.message_short).toBe(shortMessage);
      expect(err.message_full).toBe(fullMessage);
    });
  });
})

describe("When _req is called", function() {
  var imp;
  var apiKey = "abc123";
  var cb = function(err, data) {};

  beforeEach(function() {
    imp = new Imp({ "apiKey": apiKey });

    // create a stub for _buildUrl
    imp._buildUrl = function(val) {
      return val;
    };

    spyOn(imp, "_buildUrl").and.callThrough();
    spyOn(imp, "request");
    spyOn(imp, "_processResp");
  });

  describe("with a GET request", function() {
    it("options should be properly built, and form should be set to body", function() {
      var expectedVerb = "GET";
      var expectedUrl = "/some-path";
      var expectedHeaders = { "test-key": "test", "test-key1": "test1" };
      var expectedBody = { "foo": "bar "};
      var expectedAuth = "Basic " + new Buffer(apiKey).toString('base64');


      imp._req(expectedVerb, expectedUrl, expectedHeaders, expectedBody, cb);

      // Make sure options was populated properly
      expect(imp.request.calls.mostRecent().args[0].method).toEqual(expectedVerb);
      expect(imp.request.calls.mostRecent().args[0].json).toEqual(true);
      expect(imp.request.calls.mostRecent().args[0].url).toEqual(expectedUrl);
      expect(imp.request.calls.mostRecent().args[0].qs).toEqual(expectedBody);
      expect(imp.request.calls.mostRecent().args[0].headers["User-agent"]).toEqual("imp.js");
      expect(imp.request.calls.mostRecent().args[0].headers["Content-type"]).toEqual("application/json");
      expect(imp.request.calls.mostRecent().args[0].headers["Authorization"]).toEqual(expectedAuth);
      for(var idx in expectedHeaders) {
        expect(imp.request.calls.mostRecent().args[0].headers[idx]).toEqual(expectedHeaders[idx]);
      }
    });
  });

  describe("with a non-GET request", function() {
    it("options should be properly built, and body should be set to body", function() {
      var expectedVerb = "POST";
      var expectedUrl = "/some-path";
      var expectedHeaders = { "test-key": "test", "test-key1": "test1" };
      var expectedBody = { "foo": "bar "};
      var expectedAuth = "Basic " + new Buffer(apiKey).toString('base64');

      imp._req(expectedVerb, expectedUrl, expectedHeaders, expectedBody, cb);

      // Make sure options was populated properly
      expect(imp.request.calls.mostRecent().args[0].method).toEqual(expectedVerb);
      expect(imp.request.calls.mostRecent().args[0].json).toEqual(true);
      expect(imp.request.calls.mostRecent().args[0].url).toEqual(expectedUrl);
      expect(imp.request.calls.mostRecent().args[0].body).toEqual(expectedBody);
      expect(imp.request.calls.mostRecent().args[0].headers["User-agent"]).toEqual("imp.js");
      expect(imp.request.calls.mostRecent().args[0].headers["Content-type"]).toEqual("application/json");
      expect(imp.request.calls.mostRecent().args[0].headers["Authorization"]).toEqual(expectedAuth);
      for(var idx in expectedHeaders) {
        expect(imp.request.calls.mostRecent().args[0].headers[idx]).toEqual(expectedHeaders[idx]);
      }
    });
  });
});

describe("When the SDK processes a request", function() {
  var imp;

  beforeEach(function() {
    imp = new Imp();
  });

  describe("with an error", function() {
    it("the err param should bubble up to the callback", function(done) {
      var expectedError = "some error";

      imp._processResp(expectedError, null, null, function(err, data) {
        expect(err).toBe(expectedError);
        done();
      })
    });
  });

  describe("with a non-2xx response", function() {
    describe("and the body is empty", function() {
      it("the err param should have the error and message set to statusMessage", function(done) {
        var resp = {
          "statusCode": 401,
          "statusMessage": "Unauthorized"
        };

        imp._processResp(null, resp, null, function(err, data) {
          expect(err).not.toBe(null);
          expect(err.code).toBe(resp.statusCode);
          expect(err.message_short).toBe(resp.statusMessage);
          expect(err.message_full).toBe(resp.statusMessage);
          done();
        });
      });
    });

    describe("and the body doesn't contain a JSON object", function() {
      it("the error object should set the code to status code, and the messages to the body", function(done) {
        var resp = {
          "statusCode": 401,
          "statusMessage": "Unauthorized"
        };

        var body = "Unauthorized Request";

        imp._processResp(null, resp, body, function(err, data) {
          expect(err).not.toBe(null);
          expect(err.code).toBe(resp.statusCode);
          expect(err.message_short).toBe(body);
          expect(err.message_full).toBe(body);

          done();
        });
      });
    });

    describe("and the body contains error information", function() {
      it("the err param should should contain the errors", function(done) {
        var resp = {
          "statusCode": 401,
          "statusMessage": "Unauthorized"
        };
        var body = {
          "success": "false",
          "error": { "code": "code", "message_short": "short message", "message_full": "full message" }
        };

        imp._processResp(null, resp, body, function(err, data) {
          expect(err).not.toBe(null);
          expect(err).toBe(body.error);

          done();
        });
      });
    });
    describe("and the body doesn't contains error information", function() {
      it("the err param should have the error and message set to statusMessage", function(done) {
        var resp = {
          "statusCode": 401,
          "statusMessage": "Unauthorized"
        };
        var body = {
          "success": "false",
        };

        imp._processResp(null, resp, body, function(err, data) {
          expect(err.code).toBe(resp.statusCode);
          expect(err.message_short).toBe(resp.statusMessage);
          expect(err.message_full).toBe(resp.statusMessage);
          done();
        });
      });
    });
  });

  describe("with a 2xx response", function() {
    it("the data parameter should be set to the body", function(done) {
      var resp = {
        "statusCode": 200,
        "statusMessage": "Ok"
      };

      var body = {
        "success": "true"
      }

      imp._processResp(null, resp, body, function(err, data) {
        expect(err).toBe(null);
        expect(data).toBe(body);
        done();
      });
    });
  });
});

describe("When a request is made", function() {
  var imp;
  var cb = function(err, data) {};
  var path = "path";

  beforeEach(function() {
    imp = new Imp();
    spyOn(imp, "_req");
  });

  describe("with no parameters", function() {
    it("should make the request", function() {

      imp.apiRequest("GET", path, null, {}, cb);
      expect(imp._req).toHaveBeenCalledWith("GET", path, null, {}, cb);
    });
  });

  describe("with invalid parameters", function() {
    it("should make the request", function(done) {

      var expectedError = { "code": "InvalidParam", "message_short": "Invalid Parameter: a", "message_full": "Invalid Parameter: a" };

      imp.apiRequest("GET", path, { "a": true }, { "b": true }, function(err, data) {
        expect(err).not.toBe(null);
        expect(err.code).toBe(expectedError.code);
        expect(err.message_short).toBe(expectedError.message_short);
        expect(err.message_full).toBe(expectedError.message_full);

        expect(imp._req).not.toHaveBeenCalled();
        done();
      });
    });
  });

  describe("with valid parameters", function() {
    it("should make the request with the options", function() {
      var options = { "device_id" : "1", "mac_address": "1", "model_id": "1", "name": "1" };
      var validOptions = { "device_id" : true, "mac_address": true, "model_id": true, "name": true };

      imp.apiRequest("GET", path, options, validOptions, cb);
      expect(imp._req).toHaveBeenCalledWith("GET", path, null, options, cb);
    });
  });
});
