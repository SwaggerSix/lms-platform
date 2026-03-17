/**
 * SCORM 1.2 API Implementation
 * This file provides the SCORM 1.2 JavaScript API that content packages use
 * to communicate with the LMS via postMessage bridge.
 */

(function () {
  "use strict";

  // CMI Data Model
  var cmiData = {
    "cmi.core.student_id": "",
    "cmi.core.student_name": "",
    "cmi.core.lesson_location": "",
    "cmi.core.credit": "credit",
    "cmi.core.lesson_status": "not attempted",
    "cmi.core.entry": "ab-initio",
    "cmi.core.score.raw": "",
    "cmi.core.score.min": "0",
    "cmi.core.score.max": "100",
    "cmi.core.total_time": "0000:00:00.00",
    "cmi.core.session_time": "0000:00:00.00",
    "cmi.core.exit": "",
    "cmi.suspend_data": "",
    "cmi.launch_data": "",
    "cmi.comments": "",
    "cmi.comments_from_lms": "",
  };

  var initialized = false;
  var finished = false;
  var lastError = "0";

  // Error codes
  var ERROR_CODES = {
    NO_ERROR: "0",
    GENERAL_EXCEPTION: "101",
    INVALID_ARGUMENT: "201",
    ELEMENT_CANNOT_HAVE_CHILDREN: "202",
    ELEMENT_NOT_AN_ARRAY: "203",
    NOT_INITIALIZED: "301",
    NOT_IMPLEMENTED: "401",
    INVALID_SET_VALUE: "402",
    ELEMENT_IS_READ_ONLY: "403",
    ELEMENT_IS_WRITE_ONLY: "404",
    INCORRECT_DATA_TYPE: "405",
  };

  function sendMessage(type, data) {
    window.parent.postMessage(
      { source: "scorm-api", type: type, data: data },
      "*"
    );
  }

  // SCORM 1.2 API
  window.API = {
    LMSInitialize: function () {
      if (initialized) {
        lastError = ERROR_CODES.GENERAL_EXCEPTION;
        return "false";
      }
      initialized = true;
      finished = false;
      lastError = ERROR_CODES.NO_ERROR;
      sendMessage("initialize", {});
      return "true";
    },

    LMSFinish: function () {
      if (!initialized) {
        lastError = ERROR_CODES.NOT_INITIALIZED;
        return "false";
      }
      this.LMSCommit("");
      initialized = false;
      finished = true;
      lastError = ERROR_CODES.NO_ERROR;
      sendMessage("finish", { cmiData: cmiData });
      return "true";
    },

    LMSGetValue: function (element) {
      if (!initialized) {
        lastError = ERROR_CODES.NOT_INITIALIZED;
        return "";
      }
      if (cmiData.hasOwnProperty(element)) {
        lastError = ERROR_CODES.NO_ERROR;
        return cmiData[element];
      }
      lastError = ERROR_CODES.INVALID_ARGUMENT;
      return "";
    },

    LMSSetValue: function (element, value) {
      if (!initialized) {
        lastError = ERROR_CODES.NOT_INITIALIZED;
        return "false";
      }

      // Read-only elements
      var readOnly = [
        "cmi.core.student_id",
        "cmi.core.student_name",
        "cmi.core.credit",
        "cmi.core.entry",
        "cmi.core.total_time",
        "cmi.launch_data",
        "cmi.comments_from_lms",
      ];

      if (readOnly.indexOf(element) !== -1) {
        lastError = ERROR_CODES.ELEMENT_IS_READ_ONLY;
        return "false";
      }

      cmiData[element] = value;
      lastError = ERROR_CODES.NO_ERROR;
      sendMessage("setValue", { element: element, value: value });
      return "true";
    },

    LMSCommit: function () {
      if (!initialized) {
        lastError = ERROR_CODES.NOT_INITIALIZED;
        return "false";
      }
      lastError = ERROR_CODES.NO_ERROR;
      sendMessage("commit", { cmiData: cmiData });
      return "true";
    },

    LMSGetLastError: function () {
      return lastError;
    },

    LMSGetErrorString: function (errorCode) {
      var strings = {
        0: "No Error",
        101: "General Exception",
        201: "Invalid Argument Error",
        202: "Element Cannot Have Children",
        203: "Element Not an Array - Cannot Have Count",
        301: "Not Initialized",
        401: "Not Implemented Error",
        402: "Invalid Set Value, Element is a Keyword",
        403: "Element is Read Only",
        404: "Element is Write Only",
        405: "Incorrect Data Type",
      };
      return strings[errorCode] || "Unknown Error";
    },

    LMSGetDiagnostic: function () {
      return "Diagnostic: " + this.LMSGetErrorString(lastError);
    },
  };

  // Listen for messages from parent (restore state)
  window.addEventListener("message", function (event) {
    if (event.data && event.data.type === "restore-state") {
      var state = event.data.data;
      if (state) {
        Object.keys(state).forEach(function (key) {
          if (cmiData.hasOwnProperty(key)) {
            cmiData[key] = state[key];
          }
        });
      }
    }
  });

  // Signal ready
  sendMessage("ready", {});
})();
