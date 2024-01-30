/**
 * One-time customers export job:
 * Exports customers that are modified after dengageCustomersDateUpdate.
 * Does not update lastExportDate of customers.
 *
 * Recurring customers export job:
 * Exports customers that are modified after dengageCustomersDateUpdate 
 *      AND lastExportDate is before last modified date.
 * Updates lastExportDate of each customer.
 **/

'use strict';

var CustomerMgr = require('dw/customer/CustomerMgr');
var Site = require('dw/system/Site');
var Transaction = require('dw/system/Transaction');
var Logger = require('dw/system/Logger');
var CustomObjectMgr = require('dw/object/CustomObjectMgr');
var CustomerMapping = require('int_dengage_core/cartridge/scripts/dengage/customerMapping');
var FileWriter = require('dw/io/FileWriter');
var File = require('dw/io/File');
var dengageUtils = require('int_dengage_core/cartridge/scripts/dengage/utils');
var errorFlag = false;

/**
 * 
 * This function export customers files
 **/
function exportCustomersFile(options) {
  var searchProfiles;

  var newdengageCustomersDateUpdate = dengageUtils.getTime();

  var dengageCustomersDateUpdate = Site.getCurrent().getCustomPreferenceValue('dengage_customers_date_update');

  Logger.info(['exportCustomersFile--run', dengageCustomersDateUpdate, newdengageCustomersDateUpdate]);

  if (!dengageCustomersDateUpdate) {
    dengageCustomersDateUpdate = newdengageCustomersDateUpdate;
    searchProfiles = CustomerMgr.searchProfiles(
      'creationDate <= {0}',
      null,
      dengageCustomersDateUpdate
    );
  } else {
    searchProfiles = CustomerMgr.searchProfiles(
      'lastModified >= {0}',
      null,
      dengageCustomersDateUpdate
    );
  }

  Transaction.wrap(function () {
    Site.getCurrent().setCustomPreferenceValue('dengage_customers_date_update',
      newdengageCustomersDateUpdate);
  });

  var counter = 0;

  var limit = 300000;
  if (!limit) {
    limit = 9999999;
  }

  if (searchProfiles.hasNext()) {
    var dengageCustomers = [];
    while (searchProfiles.hasNext() && (counter < limit)) {
      var contact = searchProfiles.next();
      var customerMapping = new CustomerMapping();
      var dengageCustomer = customerMapping.execute(contact);
      if (dengageCustomer)
        dengageCustomers.push(dengageCustomer);
      if (counter % 200 === 0) {
        dengageUtils.sendTransaction(dengageCustomers, 'customer');
        Logger.info(['exportCustomersFile-progress', counter + ' out of ' + searchProfiles.getCount() + ' customers processed']);
        dengageCustomers = [];
      }
      counter++;
      Logger.info(['call-exportCustomersFile-finished', counter]);
    }

    if (dengageCustomers.length) {
      dengageUtils.sendTransaction(dengageCustomers, 'customer');
    }

    Logger.info(['call-exportCustomersFile-finished', limit, counter]);
  }
}

module.exports = {
  exportCustomersFile: exportCustomersFile
};
