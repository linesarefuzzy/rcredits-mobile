/* global app */
(function (app) {
	'use strict';
	app.service('CashierModeService', function (PreferenceService, localStorageService) {
		var CASHIER_MODE_KEY = 'cashier_mode';
		var self;
		var CashierModeService = function () {
			self = this;
			this.isActivated = false;
		};
		CashierModeService.prototype.init = function () {
			if (PreferenceService.isCashierModeEnabled()) {
				var cashierMode = localStorageService.get(CASHIER_MODE_KEY);
				if (cashierMode === true) {
					this.activateCashierMode();
				}
			}
		};
		/**
		 * Checks if the Preference 'Cashier Mode' is on and
		 * if the user is on this Mode
		 * @returns boolean
		 */
		CashierModeService.prototype.isEnabled = function () {
			return this.isActivated && PreferenceService.isCashierModeEnabled();
		};
		CashierModeService.prototype.disable = function () {
			this.isActivated = false;
			localStorageService.remove(CASHIER_MODE_KEY);
		};
		CashierModeService.prototype.activateCashierMode = function () {
			if (!PreferenceService.isCashierModeEnabled()) {
				throw new Error("Unable to activate Cashier Mode because it's not enable on Preferences.");
			}
			this.isActivated = true;
			localStorageService.set(CASHIER_MODE_KEY, true);
		};
		CashierModeService.prototype.canCharge = function () {
			if (!this.isActivated) {
				return true;
			}
			console.log(PreferenceService.getCashierCanPref().isChargeEnabled());
			return PreferenceService.getCashierCanPref().isChargeEnabled();
		};
		CashierModeService.prototype.canRefund = function () {
			if (!this.isActivated) {
				return true;
			}
			return PreferenceService.getCashierCanPref().isRefundEnabled();
		};
		CashierModeService.prototype.canExchange = function () {
			if (!this.isActivated) {
				return true;
			}
			return PreferenceService.getCashierCanPref().isExchangeEnabled();
		};
		return new CashierModeService();
	});
})(app);
