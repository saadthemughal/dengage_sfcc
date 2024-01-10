'use strict';

/* API Includes */
var Logger = require('dw/system/Logger');
var CustomerMgr = require('dw/customer/CustomerMgr');

/* Script Modules */
var dengageUtils = require('*/cartridge/scripts/dengage/utils');

function parseCustomerData(customer, customerId, order) {
    customer = customer || null;
    customerId = customerId || 0;
    order = order || null;
    var dengageCustomer = {};
    var logger = Logger.getLogger('int_dengage', 'dengage');
    try {
        if (!customer && customerId)
            customer = CustomerMgr.getCustomer(customerId);

        if (customer) {
            if (customer.registered) {
                var customerProfile = customer.profile;
                var fullName = (customerProfile.firstName + ' ' + customerProfile.lastName).trim();
                var defaultAddress = customer.addressBook.preferredAddress;
                dengageCustomer.contact_key = customerProfile.email;
                dengageCustomer.name = fullName;
                dengageCustomer.surname = customerProfile.secondName;
                dengageCustomer.contact_status = 'A';
                dengageCustomer.email = customerProfile.email;
                dengageCustomer.email_permission = true;
                dengageCustomer.gsm_permission = true;
                dengageCustomer.subscription_date = dengageUtils.formatDate(customer.creationDate);
                dengageCustomer.gsm = defaultAddress.phone;
                dengageCustomer.address1_addressid = defaultAddress.getID();
                dengageCustomer.address1_city = defaultAddress.city;
                dengageCustomer.address1_country = defaultAddress.countryCode.displayValue;
                dengageCustomer.address1_line1 = defaultAddress.address1;
                dengageCustomer.address1_line2 = defaultAddress.address2;
                dengageCustomer.address1_line3 = '';
                dengageCustomer.gender = customerProfile.gender.displayValue;
                dengageCustomer.birth_date = dengageUtils.formatDate(customerProfile.birthday);
            } else if (order) { // This is when a customer is not registered and does not have a profile then fetch information from the order
                dengageCustomer.contact_key = order.customerEmail;
                dengageCustomer.name = order.customerName;
                dengageCustomer.surname = order.billingAddress.secondName;
                dengageCustomer.contact_status = 'A';
                dengageCustomer.email = order.customerEmail;
                dengageCustomer.email_permission = true;
                dengageCustomer.gsm_permission = true;
                dengageCustomer.subscription_date = dengageUtils.formatDate(customer.creationDate);
                dengageCustomer.gsm = order.billingAddress.phone;
                dengageCustomer.address1_addressid = order.billingAddress.getID();
                dengageCustomer.address1_city = order.billingAddress.city;
                dengageCustomer.address1_country = order.billingAddress.countryCode.displayValue;
                dengageCustomer.address1_line1 = order.billingAddress.address1;
                dengageCustomer.address1_line2 = order.billingAddress.address2;
                dengageCustomer.address1_line3 = '';
                dengageCustomer.gender = '';
                dengageCustomer.birth_date = '';
            }
        }
    } catch (e) {
        logger.error('customerHelper.parseCustomerData() failed: ' + e.message + ' ' + e.stack);
    }
    logger.info('Customer data: ' + JSON.stringify(dengageCustomer));
    return dengageCustomer;
}

module.exports = {
    parseCustomerData: parseCustomerData
};