/* global _$compile_, _$rootScope_, expect, browser */
//
// Feature: Parse QR Code
//   AS a cashier
//   I WANT the customer's QR code to be interpreted correctly
//   SO we know who we're dealing with.
var R2_steps = require('../r2.js');
describe('r2% -- FEATURE_NAME', function () {
	'use strict';
	var steps = new R2_steps();
	var createdItemUrl;
	beforeAll(function () {
		browser.manage().timeouts().pageLoadTimeout(40000);
		browser.manage().timeouts().implicitlyWait(25000);
		browser.driver.get("http://localhost:8100", 500);
		browser.waitForAngular();
		browser.getCurrentUrl().then(function (url) {
			createdItemUrl = url;
		});
	});
	beforeEach(function () { // Setup
		steps.extraSetup();
	});
	it('Scenario: We scan a valid old personal card.', function () {
		steps.testOnly = 0;
		steps.weScanPersonalQR('HTTP://NEW.RC4.ME/ABB.ZzhWMCq0zcBowqw');
		steps.testOnly = 1;
		steps.accountIsPersonal();
		steps.testOnly = 1;
		steps.accountIDIs('NEWABB');
		steps.testOnly = 1;
		steps.securityCodeIs('ZzhWMCq0zcBowqw');
	});

	it('Scenario: We scan a valid old company card.', function () {
		steps.testOnly = 0;
		steps.weScanCompanyQR('HTTP://NEW.RC4.ME/AAB-WeHlioM5JZv1O9G');
		steps.testOnly = 1;
		steps.accountIsCompany();
		steps.testOnly = 1;
		steps.accountIDIs('NEWAAB');
		steps.testOnly = 1;
		steps.securityCodeIs('WeHlioM5JZv1O9G');
	});

	it('Scenario: We scan a valid personal card.', function () {
		steps.testOnly = 0;
		steps.weScanPersonalQR('HTTP://6VM.RC4.ME/G0RZzhWMCq0zcBowqw');
		//console.log(steps.weScanQR('HTTP://6VM.RC4.ME/G0RZzhWMCq0zcBowqw');
		steps.testOnly = 1;
		steps.accountIsPersonal();
		//console.log(steps.accountIsPersonal();
		steps.testOnly = 1;
		steps.accountIDIs('NEWABB');
		//console.log(steps.accountIDIs('NEWABB');
		steps.testOnly = 1;
		steps.securityCodeIs('ZzhWMCq0zcBowqw');
		//console.log(steps.securityCodeIs('ZzhWMCq0zcBowqw');
	});

	it('Scenario: We scan a valid company card.', function () {
		steps.testOnly = 0;
		steps.weScanCompanyQR('HTTP://6VM.RC4.ME/H010WeHlioM5JZv1O9G');
		steps.testOnly = 1;
		steps.accountIsCompany();
		steps.testOnly = 1;
		steps.accountIDIs('NEWAAB-A');
		steps.testOnly = 1;
		steps.securityCodeIs('WeHlioM5JZv1O9G');
	});
});
  