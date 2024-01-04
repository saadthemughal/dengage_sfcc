'use strict';

var ProductMgr = require('dw/catalog/ProductMgr');

var Site = require('dw/system/Site');
var Transaction = require('dw/system/Transaction');
var Logger = require('dw/system/Logger');
var CustomObjectMgr = require('dw/object/CustomObjectMgr');
var FileWriter = require('dw/io/FileWriter');
var File = require('dw/io/File');
var dengageUtils = require('int_dengage_core/cartridge/scripts/dengage/utils');
var ProductMapping = require('int_dengage_core/cartridge/scripts/dengage/productMapping');

/**
 *
 * This function export products files
 */
function exportProductsFile(options) {
  var searchProducts;
  var newdengageProductsDateUpdate = dengageUtils.getTime();

  var lastRunObject = CustomObjectMgr.getCustomObject('DENGAGE_LASTRUN', 'dengageProductsDateUpdate');
  if (!lastRunObject) {
    Transaction.wrap(function () {
      lastRunObject = CustomObjectMgr.createCustomObject('DENGAGE_LASTRUN', 'dengageProductsDateUpdate');
    });
  }

  var dengageProductsDateUpdate = lastRunObject.custom.lastRunTime ? lastRunObject.custom.lastRunTime : Site.getCurrent().getCustomPreferenceValue('dengage_products_date_update');

  if (!dengageProductsDateUpdate) {
    dengageProductsDateUpdate = newdengageProductsDateUpdate;
    try {
      Transaction.wrap(function () {
        Site.getCurrent().setCustomPreferenceValue('dengage_products_date_update',
          newdengageProductsDateUpdate);
      });
      Transaction.wrap(function () {
        lastRunObject.custom.lastRunTime = newdengageProductsDateUpdate;
      });
    } catch (e) {
      Logger.info(['finish-exportProducts', newdengageProductsDateUpdate]);
    }
  }

  searchProducts = ProductMgr.queryAllSiteProductsSorted();

  if (searchProducts.hasNext()) {
    // Create CSV for export
    var exportFolderPath = File.IMPEX + '/dengage/';
    var exportFolder = new File(exportFolderPath);

    if (!exportFolder.exists()) {
      exportFolder.mkdirs();
    }

    var exportFilename = exportFolder.fullPath + File.SEPARATOR + 'products_' + dengageUtils.getTimestamp() + '.json';
    var exportFile = new File(exportFilename);
    var fileWriter = new FileWriter(exportFile, 'utf-8');
    var productsProcessed = [];
    var counter = 0;
    Logger.info(['Call-exportProductsFile', searchProducts.count, exportFilename]);

    while (searchProducts.hasNext()) {
      var product = searchProducts.next();
      var dengageLastExported;

      try {
        dengageLastExported = product.custom.dengage_last_exported;
      } catch (e) {
        dengageLastExported = '';
        product.custom.put('dengage_last_exported', '');
      }

      var productUpdatedRecently = product.lastModified >= dengageProductsDateUpdate;

      if (!productUpdatedRecently && product.onlineTo) {
        productUpdatedRecently = dengageProductsDateUpdate < product.onlineTo
          && product.onlineTo < dengageUtils.getTime();
      }

      if (!productUpdatedRecently && product.onlineFrom) {
        productUpdatedRecently = dengageProductsDateUpdate < product.onlineFrom
          && product.onlineFrom < dengageUtils.getTime();
      }

      if (!dengageLastExported || productUpdatedRecently) {
        counter++;

        var productMapping = new ProductMapping();
        var dengageProduct = productMapping.execute(product);

        if (counter % 400 === 0) {
          Logger.info(['exportProducts-details',
            dengageLastExported, dengageProductsDateUpdate, product.lastModified,
            productUpdatedRecently]);
        }

        if (counter % 2000 === 0) {
          fileWriter.close();

          dengageUtils.postProductsFile(exportFile.fullPath);

          productsProcessed.forEach(function (productProcessed) {
            Transaction.wrap(function () {
              productProcessed.custom.dengage_last_exported = dengageProductsDateUpdate;
            });
          });
          productsProcessed = [];

          exportFilename = exportFolder.fullPath + File.SEPARATOR
            + 'products_' + dengageUtils.getTimestamp()
            + '_' + counter
            + '.json';
          exportFile = new File(exportFilename);
          fileWriter = new FileWriter(exportFile, 'utf-8');

          Logger.info(['export-products-progress', counter + ' out of '
            + searchProducts.getCount() + ' products processed']);
        }

        fileWriter.writeLine(JSON.stringify(dengageProduct));
        productsProcessed.push(product);
      }
    }
    fileWriter.close();

    dengageUtils.postProductsFile(exportFile.fullPath);

    productsProcessed.forEach(function (productProcessed) {
      Transaction.wrap(function () {
        productProcessed.custom.dengage_last_exported = dengageProductsDateUpdate;
      });
    });
    productsProcessed = [];
  }

  newdengageProductsDateUpdate = dengageUtils.getTime();

  try {
    Transaction.wrap(function () {
      Site.getCurrent().setCustomPreferenceValue('dengage_products_date_update',
        newdengageProductsDateUpdate);
    });
    Transaction.wrap(function () {
      lastRunObject.custom.lastRunTime = newdengageProductsDateUpdate;
    });
  } catch (e) {
    Logger.info(['finish-exportProducts', newdengageProductsDateUpdate]);
  }
}

module.exports = {
  exportProductsFile: exportProductsFile
};
