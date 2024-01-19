'use strict';

var OrderMgr = require('dw/order/OrderMgr');
var Site = require('dw/system/Site');
var Transaction = require('dw/system/Transaction');
var Logger = require('dw/system/Logger');
var OrderMapping = require('int_dengage_core/cartridge/scripts/dengage/orderMapping');
var CustomObjectMgr = require('dw/object/CustomObjectMgr');
var FileWriter = require('dw/io/FileWriter');
var File = require('dw/io/File');
var dengageUtils = require('int_dengage_core/cartridge/scripts/dengage/utils');

/**
 * This function export orders files
 **/
function exportOrdersFile(options) {
    var searchOrders;
    var newDengageOrdersDateUpdate = dengageUtils.getTime();

    var lastRunObject = CustomObjectMgr.getCustomObject('DENGAGE_LASTRUN', 'dengageOrdersDateUpdate');
    if (!lastRunObject) {
        Transaction.wrap(function () {
            lastRunObject =
                CustomObjectMgr.createCustomObject('DENGAGE_LASTRUN', 'dengageOrdersDateUpdate');
        });
    }

    var dengageOrdersDateUpdate = lastRunObject.custom.lastRunTime ? lastRunObject.custom.lastRunTime : Site.getCurrent().getCustomPreferenceValue('dengage_orders_date_update');

    if (!dengageOrdersDateUpdate) {
        dengageOrdersDateUpdate = newDengageOrdersDateUpdate;

        try {
            Transaction.wrap(function () {
                Site.getCurrent().setCustomPreferenceValue('dengage_orders_date_update',
                    newDengageOrdersDateUpdate);
            });
            Transaction.wrap(function () {
                lastRunObject.custom.lastRunTime = newDengageOrdersDateUpdate;
            });
        } catch (e) {
            Logger.info(['finish-newDengageOrdersDateUpdate', newDengageOrdersDateUpdate]);
        }
    }

    // custom.dengage_last_exported < {0} OR custom.dengage_last_exported = NULL
    searchOrders = OrderMgr.queryOrders(
        'custom.dengage_last_exported < {0} OR custom.dengage_last_exported = NULL',
        //'creationDate <= {0}',
        null,
        dengageOrdersDateUpdate
    );

    Logger.info(['call-exportOrdersFile', searchOrders.getCount(), dengageOrdersDateUpdate, Site.getCurrent().getCustomPreferenceValue('dengage_orders_date_update')]);
    exportOrdersFileRuner(options, searchOrders, 999999999);
}

/**
 *  Generate CSV for Export
 **/
function exportOrdersFileRuner(options, searchOrders, limit) {
    var newDengageOrdersDateUpdate = dengageUtils.getTime();
    var date = newDengageOrdersDateUpdate;
    var counter = 0;

    if (searchOrders.hasNext()) {
        var siteID = Site.getCurrent().getID(),
            exportFolderPath = File.IMPEX + "/dengage/",
            exportFolder = new File(exportFolderPath);

        if (!exportFolder.exists()) {
            exportFolder.mkdirs();
        }

        var exportFilename = exportFolder.fullPath + "orders_"
            + dengageUtils.getTimestamp() + ".json";
        var exportFile = new File(exportFilename),
            fileWriter = new FileWriter(exportFile, "utf-8");

        var ordersProcessed = [];
        Logger.info(['call-exportOrdersFile', exportFile]);

        while (searchOrders.hasNext() && (counter++ < limit)) {
            var orders = searchOrders.next();
            var orderMapping = new OrderMapping();
            var dengageOrder = orderMapping.execute(orders);

            if (counter % 2000 === 0 && counter) {
                fileWriter.close();

                dengageUtils.postOrdersFile(exportFile.fullPath);

                // Update order date flag
                ordersProcessed.forEach(function (order) {
                    Transaction.wrap(function () {
                        order.custom.dengage_last_exported = newDengageOrdersDateUpdate;
                    });
                });
                ordersProcessed = [];

                exportFilename = exportFolder.fullPath + "orders_"
                    + dengageUtils.getTimestamp() + "_" + counter + ".json";
                exportFile = new File(exportFilename),
                    fileWriter = new FileWriter(exportFile, "utf-8"),

                    Logger.info(['exportOrdersFile-progress', counter + ' out of '
                        + searchOrders.getCount() + ' orders processed']);
            }

            if (dengageOrder) {
                fileWriter.writeLine(JSON.stringify(dengageOrder));
            }

            ordersProcessed.push(orders);
        }

        //Clear resources
        fileWriter.close();

        Logger.info(['call-exportOrdersFile', newDengageOrdersDateUpdate, exportFilename, counter]);

        dengageUtils.postOrdersFile(exportFile.fullPath);

        // Update order date flag
        ordersProcessed.forEach(function (order) {
            Transaction.wrap(function () {
                order.custom.dengage_last_exported = newDengageOrdersDateUpdate;
                Logger.info(['update-order-dengageLastExported', order.UUID]);
            });
        });
        ordersProcessed = [];
    }
}

module.exports = {
    exportOrdersFile: exportOrdersFile
};
