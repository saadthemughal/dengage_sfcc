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
    if (dengageUtils.dengageEnabled) {
        var searchOrders;
        var newDengageOrdersDateUpdate = dengageUtils.getTime();

        var dengageOrdersDateUpdate = Site.getCurrent().getCustomPreferenceValue('dengage_orders_date_update');

        if (!dengageOrdersDateUpdate) {
            dengageOrdersDateUpdate = newDengageOrdersDateUpdate;
            searchOrders = OrderMgr.queryOrders(
                'creationDate <= {0}',
                null,
                dengageOrdersDateUpdate
            );
        } else {
            searchOrders = OrderMgr.queryOrders(
                'lastModified >= {0}',
                null,
                dengageOrdersDateUpdate
            );
        }

        Transaction.wrap(function () {
            Site.getCurrent().setCustomPreferenceValue('dengage_orders_date_update',
                newDengageOrdersDateUpdate);
        });

        Logger.info(['call-exportOrdersFile', searchOrders.getCount(), dengageOrdersDateUpdate, Site.getCurrent().getCustomPreferenceValue('dengage_orders_date_update')]);
        var limit = 999999999;

        var newDengageOrdersDateUpdate = dengageUtils.getTime();
        var date = newDengageOrdersDateUpdate;
        var counter = 0;

        if (searchOrders.hasNext()) {
            var dengageOrders = [];
            var dengageCustomers = [];
            while (searchOrders.hasNext() && (counter < limit)) {
                var order = searchOrders.next();
                var orderMapping = new OrderMapping();
                var dengageOrder = orderMapping.execute(order);
                if (dengageOrder && dengageOrder.order_id)
                    dengageOrders.push(dengageOrder);
                if (dengageOrder && dengageOrder.dengageCustomer)
                    dengageCustomers.push(dengageOrder.dengageCustomer);
                if (counter % 200 === 0) {
                    dengageUtils.sendTransaction(dengageOrders, 'order');
                    Logger.info(['exportOrdersFile-progress', counter + ' out of '
                        + searchOrders.getCount() + ' orders processed']);
                    dengageUtils.sendTransaction(dengageCustomers, 'customer');
                    dengageOrders = [];
                    dengageCustomers = [];
                }
                counter++;
                Logger.info(['call-exportOrdersFile-finished', counter]);
            }
            if (dengageOrders.length)
                dengageUtils.sendTransaction(dengageOrders, 'order');
            if (dengageCustomers.length)
                dengageUtils.sendTransaction(dengageCustomers, 'customer');
            Logger.info(['call-exportOrdersFile-finished', limit, counter]);
        }
    }
}


module.exports = {
    exportOrdersFile: exportOrdersFile
};
