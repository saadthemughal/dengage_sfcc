/*
 * map Sfcc model product
 *
 */
'use strict';

var dengageUtils = require('int_dengage_core/cartridge/scripts/dengage/utils');
var URLUtils = require('dw/web/URLUtils');
var Logger = require('dw/system/Logger');

module.exports = function () {
  var self = {};

  self.execute = function (contact) {
    if (!contact) {
      return;
    }

    var dengageCustomer = {};

    var customer = contact.customer;
    var customerProfile = contact;
    var defaultAddress = customer.addressBook.preferredAddress;
    var country = defaultAddress ? defaultAddress.countryCode.displayValue : '';
    if (!country) country = '';
    dengageCustomer.contact_key = customerProfile.email;
    dengageCustomer.name = customerProfile.firstName;
    dengageCustomer.surname = customerProfile.lastName || '';
    dengageCustomer.contact_status = 'A';
    dengageCustomer.email = customerProfile.email;
    // dengageCustomer.email_permission = true;
    // dengageCustomer.gsm_permission = true;
    dengageCustomer.subscription_date = dengageUtils.formatDate(customerProfile.creationDate);
    dengageCustomer.gsm = defaultAddress ? defaultAddress.phone : '';
    // dengageCustomer.address1_addressid = defaultAddress ? defaultAddress.getID() : 'N/A';
    // dengageCustomer.address1_city = defaultAddress ? defaultAddress.city : 'N/A';
    dengageCustomer.city = defaultAddress ? defaultAddress.city : '';
    dengageCustomer.country = country;
    // dengageCustomer.address1_line1 = defaultAddress ? defaultAddress.address1 : 'N/A';
    // dengageCustomer.address1_line2 = defaultAddress ? defaultAddress.address2 : 'N/A';
    // dengageCustomer.address1_line3 = '';
    dengageCustomer.gender = customerProfile.gender.displayValue;
    dengageCustomer.birth_date = dengageUtils.formatDate(customerProfile.birthday);

    Logger.info('Customer data: ' + JSON.stringify(dengageCustomer));

    return dengageCustomer;
  };

  return Object.freeze(self);
};
