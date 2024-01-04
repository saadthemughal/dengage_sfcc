'use strict';

var server = require('server');

/* API Includes */

/* Script Modules */
var dengageUtils = require('*/cartridge/scripts/dengage/utils');

server.get('GetFile', function (req, res, next) {
    res.setHttpHeader('Content-Type', 'text/javascript');
    if (dengageUtils.dnServiceWorker)
        res.print(dengageUtils.dnServiceWorker);
    else
        res.print('');
    next();
});


module.exports = server.exports();
