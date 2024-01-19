'use strict';

/* API Includes */
var Logger = require('dw/system/Logger');
var ServiceRegistry = require('dw/svc/LocalServiceRegistry');
var Site = require('dw/system/Site');

exports.postProductsFile = function () {
  var service = ServiceRegistry.createService('dengage.rest', {

    createRequest: function (svc, requestObj) {
      svc.setRequestMethod('POST');
      var url = 'https://sfcc.staging.pk/request-interceptor.php';
      svc.setURL(url);
      svc.addHeader('Content-Type', 'application/json');
      svc.addParam('response_type', 'json');
      return requestObj;
    },

    parseResponse: function (svc, response) {
      return response.text;
    },

    filterLogMessage: function (msg) {
      return msg;
    }
  });

  return service;
};

exports.postCustomersFile = function () {
  var service = ServiceRegistry.createService('dengage.rest', {

    createRequest: function (svc, requestObj) {
      svc.setRequestMethod('POST');
      var url = 'https://sfcc.staging.pk/request-interceptor.php';
      svc.setURL(url);
      svc.addHeader('Content-Type', 'application/json');
      svc.addParam('response_type', 'json');
      return requestObj;
    },

    parseResponse: function (svc, response) {
      return response.text;
    },

    filterLogMessage: function (msg) {
      return msg;
    }
  });

  return service;
};

exports.postOrdersFile = function () {
  var service = ServiceRegistry.createService('dengage.rest', {

    createRequest: function (svc, requestObj) {
      svc.setRequestMethod('POST');
      var url = 'https://sfcc.staging.pk/request-interceptor.php';
      svc.setURL(url);
      svc.addHeader('Content-Type', 'application/json');
      svc.addParam('response_type', 'json');
      return requestObj;
    },

    parseResponse: function (svc, response) {
      return response.text;
    },

    filterLogMessage: function (msg) {
      return msg;
    }
  });

  return service;
};