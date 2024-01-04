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

  var lastRunObject = CustomObjectMgr.getCustomObject('DENGAGE_LASTRUN', 'dengageCustomersDateUpdate');
  if (!lastRunObject) {
    Transaction.wrap(function () {
      lastRunObject =
        CustomObjectMgr.createCustomObject('DENGAGE_LASTRUN', 'dengageCustomersDateUpdate');
    });
  }

  var dengageCustomersDateUpdate = lastRunObject.custom.lastRunTime
    ? lastRunObject.custom.lastRunTime
    : Site.getCurrent().getCustomPreferenceValue('dengage_customers_date_update');

  Logger.info(['exportCustomersFile--run', dengageCustomersDateUpdate, newdengageCustomersDateUpdate]);

  if (!dengageCustomersDateUpdate) {
    dengageCustomersDateUpdate = newdengageCustomersDateUpdate;
    searchProfiles = CustomerMgr.searchProfiles(
      'creationDate < {0}',
      null,
      dengageCustomersDateUpdate
    );
  } else {
    searchProfiles = CustomerMgr.searchProfiles(
      'lastModified > {0}',
      null,
      dengageCustomersDateUpdate
    );
  }

  Transaction.wrap(function () {
    lastRunObject.custom.lastRunTime = newdengageCustomersDateUpdate;
  });
  Transaction.wrap(function () {
    Site.getCurrent().setCustomPreferenceValue('dengage_customers_date_update',
      newdengageCustomersDateUpdate);
  });

  exportCustomersFileRunner(searchProfiles, options, 300000);
}

function exportCustomersFileRunner(searchProfiles, options, limit) {
  var counter = 0;

  if (!limit) {
    limit = 9999999;
  }

  if (searchProfiles.hasNext()) {
    // Create CSV
    var exportFolderPath = File.IMPEX + "/dengage/";
    var exportFolder = new File(exportFolderPath);

    var exportFilename = exportFolder.fullPath + "customers_"
      + dengageUtils.getTimestamp() + ".json";

    var exportFile = new File(exportFilename);
    var fileWriter = new FileWriter(exportFile, "utf-8");

    Logger.info(['call-exportCustomersFile', exportFile]);

    while (searchProfiles.hasNext() && (counter < limit)) {
      var contact = searchProfiles.next();

      var customerMapping = new CustomerMapping();
      var dengageCustomer = customerMapping.execute(contact);

      if (counter % 2000 === 0 && counter) {
        fileWriter.close();

        dengageUtils.postCustomersFile(exportFile.fullPath);

        exportFilename = exportFolder.fullPath + "customers_"
          + dengageUtils.getTimestamp() + "_" + counter + ".json";

        exportFile = new File(exportFilename);
        fileWriter = new FileWriter(exportFile, "utf-8");

        Logger.info(['exportCustomersFile-progress', counter + ' out of ' + searchProfiles.getCount() + ' customers processed']);
      }

      fileWriter.writeLine(JSON.stringify(dengageCustomer));
      counter++;
    } //searchProfiles.hasNext

    // Clear resources
    fileWriter.close();

    dengageUtils.postCustomersFile(exportFile.fullPath);

    Logger.info(['call-exportCustomersFile-finished', exportFilename, limit, counter]);
  }
}

module.exports = {
  exportCustomersFile: exportCustomersFile
};
