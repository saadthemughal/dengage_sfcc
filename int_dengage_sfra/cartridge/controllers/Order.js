'use strict';

var server = require('server');
server.extend(module.superModule);

/* API Includes */
var OrderMgr = require('dw/order/OrderMgr');

/* Script Modules */
var dengageUtils = require('*/cartridge/scripts/dengage/utils');
var orderHelper = require('*/cartridge/scripts/dengage/eventData/orderHelper');
var Logger = require('dw/system/Logger');


server.append('Confirm', function (req, res, next) {
    if (dengageUtils.dengageEnabled) {
        var dataObj;
        var currentOrder;

        if (req.form.orderID && req.form.orderToken) {
            currentOrder = OrderMgr.getOrder(req.form.orderID, req.form.orderToken);
            if (currentOrder && currentOrder.customerEmail) {
                // check to see if the status is new or created
                if (currentOrder.status == dw.order.Order.ORDER_STATUS_NEW || currentOrder.status == dw.order.Order.ORDER_STATUS_OPEN) {
                    dataObj = orderHelper.parseOrderData(currentOrder);
                    // Send the products to Dengage
                    if (dataObj.dengageProducts) {
                        dengageUtils.sendTransaction(dataObj.dengageProducts, 'product');
                        delete dataObj.dengageProducts;
                    }
                    // Send the customer to Dengage
                    if (dataObj.dengageCustomer) {
                        dengageUtils.sendTransaction(dataObj.dengageCustomer, 'customer');
                        delete dataObj.dengageCustomer;
                    }
                    dengageUtils.sendTransaction(dataObj, 'order');
                }
            }
        }
    }

    next();
});


module.exports = server.exports();
